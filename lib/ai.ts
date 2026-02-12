import OpenAI from 'openai';
import { db } from './db';
import { parseResumeLocally } from './resume-parser';

function prepareTextForLlm(input: string, maxChars: number) {
    const normalized = (input || "")
        .replace(/\u0000/g, " ")
        .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const suspiciousBinaryMarkers =
        normalized.includes("%PDF-") ||
        normalized.includes("endstream") ||
        normalized.includes("obj") ||
        normalized.includes("xref");

    return {
        text: normalized.slice(0, maxChars),
        wasTruncated: normalized.length > maxChars,
        isLikelyBinary: suspiciousBinaryMarkers
    };
}

const getClient = async () => {
    const data = await db.getData();
    let provider = data.settings.aiProvider || "groq"; // Default to free option

    // Fallback logic: if selected provider has no key or is Gemini, use Groq (free)
    if (provider === "openai" && !data.settings.openaiApiKey) {
        provider = "groq";
    }

    // Gemini temporarily disabled due to SDK compatibility issues
    if (provider === "gemini") {
        provider = "groq";
    }

    if (provider === "openai") {
        const apiKey = data.settings.openaiApiKey;
        if (!apiKey) throw new Error("OpenAI API Key not configured.");
        return {
            provider: "openai",
            client: new OpenAI({ apiKey, dangerouslyAllowBrowser: true })
        };
    } else {
        // Groq - Free API with generous limits
        const apiKey = data.settings.groqApiKey;
        return {
            provider: "groq",
            client: new OpenAI({
                apiKey: apiKey || undefined,
                baseURL: "https://api.groq.com/openai/v1",
                dangerouslyAllowBrowser: true
            })
        };
    }
};

function isMissingModelRequestScopeError(error: unknown) {
    const message = (error as Error)?.message || "";
    return message.includes("Missing scopes: model.request") || message.includes("insufficient permissions");
}

function isMissingCredentialsError(error: unknown) {
    const message = (error as Error)?.message?.toLowerCase() || "";
    return (
        message.includes("missing credentials") ||
        message.includes("please pass an `apikey`") ||
        message.includes("api key not configured") ||
        message.includes("invalid api key")
    );
}

function uniqueItems(items: string[]) {
    const seen = new Set<string>();
    return items.filter((item) => {
        const key = item.toLowerCase().trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function buildLocalSearchQueries(resumeContent: string, context?: SearchContext) {
    const combined = `${resumeContent} ${context?.summary || ""}`.toLowerCase();

    const titleMap: Array<{ needle: RegExp; title: string }> = [
        { needle: /\bfrontend|react|next\.?js|ui\b/, title: "Frontend Engineer" },
        { needle: /\bbackend|node|api|microservice|java|spring\b/, title: "Backend Engineer" },
        { needle: /\bfull[- ]?stack\b/, title: "Full Stack Engineer" },
        { needle: /\bdata|sql|analytics|python\b/, title: "Data Analyst" },
        { needle: /\bproduct|roadmap|stakeholder\b/, title: "Product Manager" },
    ];

    const inferredTitles = uniqueItems(
        titleMap.filter((t) => t.needle.test(combined)).map((t) => t.title)
    );

    const baseTitles = uniqueItems([
        ...(context?.recentTitles || []),
        ...(context?.priorJobTitles || []),
        ...inferredTitles,
        "Software Engineer",
    ]).slice(0, 5);

    const baseSkills = uniqueItems([
        ...(context?.skills || []),
        "JavaScript",
        "TypeScript",
        "React",
        "Node.js",
    ]).slice(0, 8);

    const location = context?.preferredLocation || context?.profileLocation || "United States";
    const keywordStr = baseSkills.slice(0, 4).join(" ");

    return {
        recommendedTitles: baseTitles,
        searchKeywords: baseSkills,
        booleanQueries: [
            { label: "US Broad", query: `(${baseTitles.slice(0, 3).join(" OR ")}) AND (${keywordStr}) AND (United States OR Remote)` },
            { label: "Remote Focus", query: `(${baseTitles.slice(0, 2).join(" OR ")}) AND (${keywordStr}) AND (Remote)` },
            { label: "Preferred Location", query: `(${baseTitles.slice(0, 2).join(" OR ")}) AND (${keywordStr}) AND (${location})` },
        ],
        reasoning: "Generated with local no-key mode using resume/profile signals. Add an AI key for deeper analysis.",
    };
}

function buildLocalTailoredContent(jobDescription: string, resumeContent: string) {
    const jobTerms = uniqueItems(
        (jobDescription || "")
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter((x) => x.length > 3)
    );
    const resumeLower = (resumeContent || "").toLowerCase();

    const keywords = jobTerms.slice(0, 10);
    const missingKeywords = keywords.filter((k) => !resumeLower.includes(k)).slice(0, 5);
    const matched = keywords.length - missingKeywords.length;
    const matchScore = keywords.length ? Math.max(35, Math.round((matched / keywords.length) * 100)) : 60;

    return {
        keywords: keywords.slice(0, 5),
        missingKeywords,
        matchScore,
        coverLetter: `Dear Hiring Manager,\n\nI am excited to apply for this role. My background aligns with your requirements, and I am confident I can contribute quickly.\n\nI have hands-on experience delivering results in fast-paced environments and collaborating across teams to ship high-quality work.\n\nThank you for your time and consideration.\n\nSincerely,\n[Your Name]`,
        resumeBullets: [
            "Delivered measurable project outcomes with strong ownership and cross-team collaboration.",
            "Applied modern tooling and best practices to improve quality, speed, and reliability.",
            "Communicated clearly with stakeholders and translated goals into shipped work.",
        ],
    };
}

async function runWithProviderFallback<T>(
    runner: (provider: "openai" | "groq", client: OpenAI) => Promise<T>
): Promise<T> {
    const primary = await getClient();
    const primaryProvider = primary.provider as "openai" | "groq";
    const primaryClient = primary.client as OpenAI;

    try {
        return await runner(primaryProvider, primaryClient);
    } catch (error) {
        if (primaryProvider === "openai" && isMissingModelRequestScopeError(error)) {
            const data = await db.getData();
            if (data.settings.groqApiKey) {
                const groqClient = new OpenAI({
                    apiKey: data.settings.groqApiKey,
                    baseURL: "https://api.groq.com/openai/v1",
                    dangerouslyAllowBrowser: true
                });
                return await runner("groq", groqClient);
            }

            throw new Error(
                "OpenAI key is missing required scope `model.request`. In Settings, either switch provider to Groq and add a Groq key, or update your OpenAI key permissions (Model Capabilities -> Request)."
            );
        }
        throw error;
    }
}

export async function generateTailoredContent(jobDescription: string, resumeContent: string) {
    try {
        const safeJob = prepareTextForLlm(jobDescription, 12000);
        const safeResume = prepareTextForLlm(resumeContent, 12000);

        const prompt = `You are an expert career coach and resume writer.
I will provide a Job Description (JD) and a Resume.

Your task is to:
1. Extract top 5 keywords from the JD.
2. Identify keywords missing from the resume.
3. Rate the match score (0-100).
4. Write a tailored cover letter.
5. Suggest 3 bullet points to add to the resume.

JD:
${safeJob.text}

Resume:
${safeResume.text}

Output VALID JSON ONLY:
{
    "keywords": ["..."],
    "missingKeywords": ["..."],
    "matchScore": number,
    "coverLetter": "...",
    "resumeBullets": ["..."]
}`;

        const completion = await runWithProviderFallback(async (provider, client) => {
            return client.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: provider === "groq" ? "llama-3.3-70b-versatile" : "gpt-4o-mini",
                response_format: { type: "json_object" },
            });
        });
        const content = completion.choices[0].message.content;
        if (!content) throw new Error("No content generated");
        return JSON.parse(content);

    } catch (error) {
        if (isMissingCredentialsError(error)) {
            return buildLocalTailoredContent(jobDescription, resumeContent);
        }
        console.error("AI Generation Error:", error);
        throw error;
    }
}

interface SearchContext {
    summary?: string;
    preferredLocation?: string;
    profileLocation?: string;
    skills?: string[];
    recentTitles?: string[];
    education?: string[];
    projects?: string[];
    priorJobTitles?: string[];
}

export async function generateSearchQueries(resumeContent: string, context?: SearchContext) {
    try {
        const safeResume = prepareTextForLlm(resumeContent, 10000);

        const prompt = `You are an expert career coach.
Analyze the following candidate data and suggest the best job search strategy.

Resume:
${safeResume.text}

Candidate Context (JSON):
${JSON.stringify(context || {}, null, 2)}

Output VALID JSON ONLY:
{
    "recommendedTitles": ["..."],
    "searchKeywords": ["..."],
    "booleanQueries": [
        { "label": "Broad Search", "query": "..." }
    ],
    "reasoning": "..."
}`;

        const completion = await runWithProviderFallback(async (provider, client) => {
            return client.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: provider === "groq" ? "llama-3.3-70b-versatile" : "gpt-4o-mini",
                response_format: { type: "json_object" },
            });
        });
        const content = completion.choices[0].message.content;
        if (!content) throw new Error("No content generated");
        return JSON.parse(content);

    } catch (error) {
        if (isMissingCredentialsError(error)) {
            return buildLocalSearchQueries(resumeContent, context);
        }
        console.error("AI Generation Error:", error);
        throw error;
    }
}

export async function analyzeEmailContent(emailBody: string, subject: string) {
    try {
        const prompt = `Analyze this email regarding a job application.
Determine the new status.

Subject: ${subject}
Body: ${emailBody.substring(0, 2000)}

Possible Statuses: INTERESTED, APPLIED, RECRUITER_SCREEN, TECHNICAL, ONSITE, OFFER, REJECTED, WITHDRAWN.

Output VALID JSON ONLY:
{
    "status": "STATUS_ENUM_OR_NULL",
    "reasoning": "Brief reason"
}`;

        const completion = await runWithProviderFallback(async (provider, client) => {
            return client.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: provider === "groq" ? "llama-3.3-70b-versatile" : "gpt-4o-mini",
                response_format: { type: "json_object" },
            });
        });
        const content = completion.choices[0].message.content;
        if (!content) return { status: null };
        return JSON.parse(content);

    } catch (error) {
        if (isMissingCredentialsError(error)) {
            const text = `${subject} ${emailBody}`.toLowerCase();
            if (/\breject|unfortunately|not moving forward\b/.test(text)) return { status: "REJECTED", reasoning: "Local no-key rule matched rejection language." };
            if (/\binterview|schedule|availability\b/.test(text)) return { status: "RECRUITER_SCREEN", reasoning: "Local no-key rule matched interview language." };
            if (/\boffer|congratulations\b/.test(text)) return { status: "OFFER", reasoning: "Local no-key rule matched offer language." };
            return { status: null, reasoning: "Local no-key mode: no clear status match." };
        }
        console.error("AI Email Analysis Error:", error);
        return { status: null };
    }
}

export async function parseResumeContent(resumeText: string) {
    try {
        const safeResume = prepareTextForLlm(resumeText, 30000);
        const parsed = parseResumeLocally(safeResume.text);

        const hasUsefulData =
            Boolean(parsed.summary) ||
            Boolean(parsed.contact?.email) ||
            Boolean(parsed.contact?.linkedin) ||
            Boolean(parsed.contact?.portfolio) ||
            Boolean(parsed.experience?.length) ||
            Boolean(parsed.education?.length) ||
            Boolean(parsed.skills?.length) ||
            Boolean(parsed.projects?.length);

        if (!hasUsefulData) {
            const prompt = `You are a resume parser.
Extract structured resume data from the raw text below.
Return VALID JSON ONLY with this exact shape:
{
  "contact": {
    "name": "",
    "email": "",
    "phone": "",
    "linkedin": "",
    "portfolio": "",
    "location": ""
  },
  "summary": "",
  "experience": [
    {
      "title": "",
      "company": "",
      "location": "",
      "startDate": "",
      "endDate": "",
      "bullets": [""]
    }
  ],
  "education": [
    {
      "school": "",
      "degree": "",
      "startYear": "",
      "endYear": "",
      "gpa": ""
    }
  ],
  "skills": [
    { "name": "", "category": "Technical" }
  ],
  "projects": [
    {
      "name": "",
      "description": "",
      "link": "",
      "bullets": [""]
    }
  ]
}

Resume text:
${safeResume.text}`;

            try {
                const completion = await runWithProviderFallback(async (provider, client) => {
                    return client.chat.completions.create({
                        messages: [{ role: "user", content: prompt }],
                        model: provider === "groq" ? "llama-3.3-70b-versatile" : "gpt-4o-mini",
                        response_format: { type: "json_object" },
                    });
                });
                const content = completion.choices[0].message.content;
                if (!content) {
                    throw new Error("No content generated");
                }
                const aiParsed = JSON.parse(content);
                const aiHasUsefulData =
                    Boolean(aiParsed?.summary) ||
                    Boolean(aiParsed?.contact?.email) ||
                    Boolean(aiParsed?.contact?.linkedin) ||
                    Boolean(aiParsed?.contact?.portfolio) ||
                    Boolean(aiParsed?.experience?.length) ||
                    Boolean(aiParsed?.education?.length) ||
                    Boolean(aiParsed?.skills?.length) ||
                    Boolean(aiParsed?.projects?.length);

                if (aiHasUsefulData) {
                    return aiParsed;
                }
            } catch (aiError) {
                if (!isMissingCredentialsError(aiError)) {
                    console.error("AI Resume Parsing Fallback Error:", aiError);
                }
            }

            throw new Error("Could not extract resume details locally. Please upload a text-readable resume or paste resume text.");
        }

        return parsed;

    } catch (error) {
        console.error("Resume Parsing Error:", error);
        throw error;
    }
}

function buildLocalCustomFields(resumeText: string) {
    const text = (resumeText || "").replace(/\r/g, "\n");
    const lines = text.split("\n");
    const standard = new Set([
        "summary", "profile", "about", "experience", "work experience", "professional experience",
        "education", "skills", "projects", "contact"
    ]);
    const result: Array<{ label: string; value: string }> = [];

    const isHeading = (line: string) => {
        const t = (line || "").trim();
        if (!t || t.length > 48) return false;
        return t === t.toUpperCase() || /^[A-Z][A-Za-z ]{2,40}:?$/.test(t);
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!isHeading(line)) continue;
        const label = line.replace(/:$/, "").trim();
        if (standard.has(label.toLowerCase())) continue;

        const block: string[] = [];
        for (let j = i + 1; j < lines.length; j++) {
            const next = lines[j].trim();
            if (!next) {
                if (block.length > 0) break;
                continue;
            }
            if (isHeading(next)) break;
            block.push(next);
        }

        const value = block.join("\n").trim();
        if (value.length >= 20) {
            if (!result.some((x) => x.label.toLowerCase() === label.toLowerCase())) {
                result.push({ label, value });
            }
        }
    }
    return result.slice(0, 10);
}

export async function inferCustomProfileFields(resumeText: string) {
    try {
        const safeResume = prepareTextForLlm(resumeText, 30000);
        const prompt = `Extract non-standard resume sections into custom profile fields.
Only include sections that are NOT the standard ones: Summary, Experience, Education, Skills, Projects, Contact.
Good examples: Certifications, Languages, Awards, Volunteer, Publications, Patents, Interests.
Return VALID JSON ONLY:
{
  "fields": [
    { "label": "Certifications", "value": "..." }
  ]
}

Resume text:
${safeResume.text}`;

        const completion = await runWithProviderFallback(async (provider, client) => {
            return client.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: provider === "groq" ? "llama-3.3-70b-versatile" : "gpt-4o-mini",
                response_format: { type: "json_object" },
            });
        });
        const content = completion.choices[0].message.content;
        if (!content) return buildLocalCustomFields(resumeText);
        const parsed = JSON.parse(content);
        const fields = Array.isArray(parsed?.fields) ? parsed.fields : [];
        return fields
            .map((f: any) => ({
                label: String(f?.label || "").trim(),
                value: String(f?.value || "").trim(),
            }))
            .filter((f: any) => f.label && f.value)
            .slice(0, 12);
    } catch (error) {
        if (!isMissingCredentialsError(error)) {
            console.error("Custom field inference error:", error);
        }
        return buildLocalCustomFields(resumeText);
    }
}
