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

export async function generateTailoredContent(jobDescription: string, resumeContent: string) {
    return buildLocalTailoredContent(jobDescription, resumeContent);
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
    return buildLocalSearchQueries(resumeContent, context);
}

export async function analyzeEmailContent(emailBody: string, subject: string) {
    const text = `${subject} ${emailBody}`.toLowerCase();
    if (/\breject|unfortunately|not moving forward\b/.test(text)) return { status: "REJECTED", reasoning: "Local rule matched rejection language." };
    if (/\boffer|congratulations\b/.test(text)) return { status: "OFFER", reasoning: "Local rule matched offer language." };
    if (/\bonsite|on-site\b/.test(text)) return { status: "ONSITE", reasoning: "Local rule matched onsite language." };
    if (/\btechnical interview|coding interview|take-home\b/.test(text)) return { status: "TECHNICAL", reasoning: "Local rule matched technical stage language." };
    if (/\binterview|schedule|availability|recruiter\b/.test(text)) return { status: "RECRUITER_SCREEN", reasoning: "Local rule matched interview language." };
    return { status: null, reasoning: "Local mode: no clear status match." };
}

export async function parseResumeContent(resumeText: string) {
    const safeResume = prepareTextForLlm(resumeText, 30000);
    return parseResumeLocally(safeResume.text);
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
    return buildLocalCustomFields(resumeText);
}
