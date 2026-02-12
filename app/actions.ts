"use server";

import { db } from "@/lib/db";
import { Application, Job, Profile, Resume, CoverLetterTemplate, AnswerBankItem, Contact, Interaction, Experience, Education, Skill, Project, CustomProfileField } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAction } from "@/lib/audit";

export async function createJob(formData: FormData) {
    const company = formData.get("company") as string;
    const title = formData.get("title") as string;
    const link = formData.get("link") as string;
    const description = formData.get("description") as string;
    const source = formData.get("source") as string;
    const priority = parseInt(formData.get("priority") as string) || 50;

    const newJob: Job = {
        id: `job-${Date.now()}`,
        userId: "user-1",
        company,
        title,
        link,
        description,
        source,
        priorityScore: priority,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const newApplication: Application = {
        id: `app-${Date.now()}`,
        userId: "user-1",
        jobId: newJob.id,
        job: newJob,
        status: "INTERESTED",
        checklist: {
            research: false,
            tailor: false,
            prepButtons: false,
            review: false,
            submitted: false
        },
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    await db.updateData((data) => {
        data.jobs.push(newJob);
        data.applications.push(newApplication);
    });
    await logAction("CREATE_JOB", `${title} at ${company}`);

    revalidatePath("/jobs");
    revalidatePath("/applications");
    revalidatePath("/dashboard");
    redirect("/jobs");
}

export async function updateApplicationStatus(applicationId: string, status: string) {
    let previousStatus = "";
    await db.updateData((data) => {
        const app = data.applications.find((a) => a.id === applicationId);
        if (app) {
            previousStatus = app.status;
            app.status = status as any;
            app.updatedAt = new Date();
        }
    });
    await logAction("UPDATE_APPLICATION_STATUS", `Application ${applicationId}: ${previousStatus || "UNKNOWN"} -> ${status}`);
    revalidatePath("/applications");
    revalidatePath(`/applications/${applicationId}`);
}

export async function updateProfile(data: Partial<Profile>) {
    await db.updateData((dbData) => {
        dbData.profile = { ...dbData.profile, ...data };
    });
    revalidatePath("/profile");
}

export async function deleteApplication(id: string) {
    await db.updateData((data) => {
        data.applications = data.applications.filter((a) => a.id !== id);
    });
    await logAction("DELETE_APPLICATION", `Application ${id} deleted`);
    revalidatePath("/applications");
    revalidatePath("/jobs");
}

export async function uploadResume(formData: FormData) {
    const file = formData.get("file") as File;
    if (!file) {
        throw new Error("No file uploaded");
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const base64 = bytes.toString("base64");
    const mimeType = file.type || "application/octet-stream";
    const rawText = await file.text();
    const normalizedText = (rawText || "")
        .replace(/\u0000/g, " ")
        .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const isLikelyBinary =
        normalizedText.includes("%PDF-") ||
        normalizedText.includes("endstream") ||
        normalizedText.includes("xref") ||
        normalizedText.includes("PK") && (mimeType.includes("word") || file.name.toLowerCase().endsWith(".docx"));
    const isReadableText = normalizedText.length > 120 && !isLikelyBinary;
    const resumeContent = isReadableText
        ? rawText
        : `Resume file uploaded (${file.name}). The original file is saved for download. For best workshop generation, upload a text-readable resume or paste cleaned resume text.`;
    const pdfExtractedText =
        (!isReadableText && mimeType.includes("pdf")) ? extractPdfTextFallback(bytes) : "";
    const effectiveResumeContent = pdfExtractedText.length > 200 ? pdfExtractedText : resumeContent;

    const newResume: Resume = {
        id: `resume-${Date.now()}`,
        userId: "user-1",
        name: file.name,
        content: effectiveResumeContent,
        filePath: `/uploads/${file.name}`,
        originalFileName: file.name,
        originalMimeType: mimeType,
        originalFileBase64: base64,
        version: 1,
        isLocked: false,
        createdAt: new Date(),
        targetRole: "",
        focusSkills: [],
        jobPreferences: "",
        workshopAnswers: {},
    };

    await db.updateData((data) => {
        // @ts-ignore
        data.resumes.push(newResume);
    });
    await logAction("UPLOAD_RESUME", `Uploaded resume ${file.name}`);

    // Auto-parse resume and update profile
    try {
        const { parseResumeContent, inferCustomProfileFields } = await import("@/lib/ai");
        const parsed = await parseResumeContent(effectiveResumeContent);
        const aiCustomFields = await inferCustomProfileFields(effectiveResumeContent);

        await db.updateData((data) => {
            const profile = data.profile;

            // Update contact info
            if (parsed.contact) {
                if (parsed.contact.email) profile.contactInfo = parsed.contact.email;
                if (parsed.contact.location) profile.location = parsed.contact.location;
                if (parsed.contact.linkedin) profile.linkedin = parsed.contact.linkedin;
                if (parsed.contact.portfolio) profile.portfolio = parsed.contact.portfolio;
            }

            // Update summary
            if (parsed.summary) {
                profile.summary = parsed.summary;
            }

            // Add experience
            if (parsed.experience && parsed.experience.length > 0) {
                parsed.experience.forEach((exp: any) => {
                    const newExp: Experience = {
                        id: `exp-${Date.now()}-${Math.random()}`,
                        title: exp.title,
                        company: exp.company,
                        location: exp.location,
                        startDate: exp.startDate,
                        endDate: exp.endDate,
                        bullets: exp.bullets || [],
                        skills: []
                    };
                    profile.experience.push(newExp);
                });
            }

            // Add education
            if (parsed.education && parsed.education.length > 0) {
                parsed.education.forEach((edu: any) => {
                    const newEdu: Education = {
                        id: `edu-${Date.now()}-${Math.random()}`,
                        school: edu.school,
                        degree: edu.degree,
                        startYear: edu.startYear,
                        endYear: edu.endYear,
                        gpa: edu.gpa
                    };
                    profile.education.push(newEdu);
                });
            }

            // Add skills
            if (parsed.skills && parsed.skills.length > 0) {
                parsed.skills.forEach((skill: any) => {
                    const newSkill: Skill = {
                        id: `skill-${Date.now()}-${Math.random()}`,
                        name: skill.name,
                        category: skill.category as any
                    };
                    profile.skills.push(newSkill);
                });
            }

            // Add projects
            if (parsed.projects && parsed.projects.length > 0) {
                parsed.projects.forEach((proj: any) => {
                    const newProj: Project = {
                        id: `proj-${Date.now()}-${Math.random()}`,
                        name: proj.name,
                        description: proj.description,
                        link: proj.link,
                        bullets: proj.bullets || [],
                        skills: []
                    };
                    profile.projects.push(newProj);
                });
            }

            const inferredCustom = inferCustomFieldsFromText(effectiveResumeContent);
            const combined = [...inferredCustom, ...aiCustomFields];
            for (const field of combined) {
                upsertCustomField(profile, field.label, field.value, "Resume");
            }
        });
    } catch (error) {
        console.error("Resume parsing failed:", error);
        // Continue even if parsing fails
    }

    revalidatePath("/documents");
    revalidatePath("/profile");
}

export async function deleteResume(id: string) {
    await db.updateData((data) => {
        data.resumes = data.resumes.filter((r) => r.id !== id);
    });
    await logAction("DELETE_RESUME", `Resume ${id} deleted`);
    revalidatePath("/documents");
}

export async function updateResumeWorkshopMetadata(id: string, targetRole: string, focusSkills: string[], jobPreferences: string) {
    await db.updateData((data) => {
        const resume = data.resumes.find((r) => r.id === id);
        if (!resume) return;
        resume.targetRole = (targetRole || "").trim();
        resume.focusSkills = focusSkills.map((s) => s.trim()).filter(Boolean);
        resume.jobPreferences = (jobPreferences || "").trim();
    });
    revalidatePath("/documents");
    revalidatePath("/jobs");
}

function parseLooseList(text: string) {
    return (text || "")
        .split(/\n|,|;|\|/)
        .map((s) => s.trim())
        .filter(Boolean);
}

type WorkshopAnswersInput = {
    yearsExperience?: string;
    topAchievements?: string;
    coreStrengths?: string;
    toolsAndTech?: string;
    certifications?: string;
    targetIndustries?: string;
    desiredRoles?: string;
    preferredLocations?: string;
    additionalNotes?: string;
    targetLevel?: string;
    leadershipScope?: string;
    strongestTech?: string;
    achievementMetric?: string;
    workModePreference?: string;
};

export async function saveWorkshopAnswersAndSyncProfile(resumeId: string, answers: WorkshopAnswersInput) {
    const clean = {
        yearsExperience: (answers.yearsExperience || "").trim(),
        topAchievements: (answers.topAchievements || "").trim(),
        coreStrengths: (answers.coreStrengths || "").trim(),
        toolsAndTech: (answers.toolsAndTech || "").trim(),
        certifications: (answers.certifications || "").trim(),
        targetIndustries: (answers.targetIndustries || "").trim(),
        desiredRoles: (answers.desiredRoles || "").trim(),
        preferredLocations: (answers.preferredLocations || "").trim(),
        additionalNotes: (answers.additionalNotes || "").trim(),
        targetLevel: (answers.targetLevel || "").trim(),
        leadershipScope: (answers.leadershipScope || "").trim(),
        strongestTech: (answers.strongestTech || "").trim(),
        achievementMetric: (answers.achievementMetric || "").trim(),
        workModePreference: (answers.workModePreference || "").trim(),
    };

    await db.updateData((data) => {
        const resume = data.resumes.find((r) => r.id === resumeId);
        if (!resume) return;

        resume.workshopAnswers = clean;

        const profile = data.profile;
        const mergedSkills = uniqueStrings([
            ...(profile.skills || []).map((s) => s.name),
            ...parseLooseList(clean.coreStrengths),
            ...parseLooseList(clean.toolsAndTech),
            ...parseLooseList(clean.certifications),
        ]);
        profile.skills = mergedSkills.slice(0, 60).map((name, idx) => ({
            id: `skill-${Date.now()}-${idx}`,
            name,
            category: "Technical",
        }));

        if (clean.preferredLocations && !profile.location) {
            profile.location = clean.preferredLocations.split(",")[0].trim();
        }

        const summaryParts = [
            profile.summary || "",
            clean.desiredRoles ? `Target roles: ${clean.desiredRoles}${clean.targetLevel ? ` (${clean.targetLevel})` : ""}.` : "",
            clean.targetIndustries ? `Industries of interest: ${clean.targetIndustries}.` : "",
            clean.yearsExperience ? `${clean.yearsExperience} years of experience.` : "",
            clean.strongestTech ? `Strongest technical domain: ${clean.strongestTech}.` : "",
            clean.leadershipScope ? `Leadership scope: ${clean.leadershipScope}.` : "",
            clean.workModePreference ? `Work mode preference: ${clean.workModePreference}.` : "",
            clean.additionalNotes || "",
        ].filter(Boolean);
        profile.summary = summaryParts.join(" ").replace(/\s+/g, " ").trim();

        const achievementBullets = parseLooseList(clean.topAchievements).slice(0, 4);
        if (achievementBullets.length) {
            if (!profile.experience.length) {
                profile.experience.push({
                    id: `exp-${Date.now()}`,
                    title: "Relevant Experience",
                    company: "Professional Background",
                    startDate: "",
                    endDate: "Present",
                    bullets: achievementBullets,
                    skills: [],
                    description: clean.additionalNotes || "",
                });
            } else {
                const latest = profile.experience[0];
                latest.bullets = uniqueStrings([...(latest.bullets || []), ...achievementBullets]).slice(0, 8);
            }
        }
    });

    revalidatePath("/documents");
    revalidatePath("/profile");
    revalidatePath("/jobs");
    return { ok: true };
}

function uniqueStrings(values: string[]) {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
        const v = (value || "").trim();
        if (!v) continue;
        const key = v.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(v);
    }
    return result;
}

function extractLooseSection(text: string, heading: string) {
    const normalized = (text || "").replace(/\r/g, "\n");
    const lines = normalized.split("\n");
    const idx = lines.findIndex((line) => line.trim().toLowerCase() === heading.toLowerCase() || line.trim().toLowerCase().startsWith(`${heading.toLowerCase()}:`));
    if (idx === -1) return "";

    const out: string[] = [];
    for (let i = idx + 1; i < lines.length; i++) {
        const cur = lines[i].trim();
        if (!cur) {
            if (out.length > 0) break;
            continue;
        }
        if (/^(experience|work experience|education|skills|projects|summary|profile|about|certifications?|licenses?|languages?|awards?|volunteer|volunteering)\b/i.test(cur)) {
            break;
        }
        out.push(cur);
    }
    return out.join("\n").trim();
}

function upsertCustomField(profile: Profile, label: string, value: string, source: "Resume" | "LinkedIn" | "Manual") {
    const cleanLabel = (label || "").trim();
    const cleanValue = (value || "").trim();
    if (!cleanLabel || !cleanValue) return;

    if (!profile.customFields) profile.customFields = [];
    const existing = profile.customFields.find((f) => (f.label || "").toLowerCase() === cleanLabel.toLowerCase());
    if (existing) {
        existing.value = cleanValue;
        existing.source = source;
        existing.updatedAt = new Date();
        return;
    }

    const field: CustomProfileField = {
        id: `custom-${Date.now()}-${Math.random()}`,
        label: cleanLabel,
        value: cleanValue,
        source,
        updatedAt: new Date(),
    };
    profile.customFields.push(field);
}

function inferCustomFieldsFromText(text: string) {
    const normalized = (text || "").replace(/\r/g, "\n");
    const lines = normalized.split("\n");
    const output: Array<{ label: string; value: string }> = [];

    const knownMap: Array<{ label: string; keys: string[] }> = [
        { label: "Certifications", keys: ["certifications", "licenses", "license"] },
        { label: "Languages", keys: ["languages", "language"] },
        { label: "Awards", keys: ["awards", "achievements", "honors"] },
        { label: "Volunteer", keys: ["volunteer", "volunteering", "community"] },
        { label: "Publications", keys: ["publications", "publication"] },
        { label: "Patents", keys: ["patents", "patent"] },
        { label: "Interests", keys: ["interests", "hobbies"] },
    ];

    for (const field of knownMap) {
        const value = field.keys
            .map((k) => extractLooseSection(normalized, k))
            .find((v) => Boolean((v || "").trim())) || "";
        if (value) output.push({ label: field.label, value });
    }

    const consumed = new Set(output.map((x) => x.label.toLowerCase()));
    const isLikelyHeading = (line: string) => {
        const t = (line || "").trim();
        if (!t) return false;
        if (t.length > 45) return false;
        const alpha = t.replace(/[^a-zA-Z]/g, "");
        if (alpha.length < 3) return false;
        return t === t.toUpperCase() || /^[A-Z][A-Za-z ]{2,30}:?$/.test(t);
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!isLikelyHeading(line)) continue;
        const label = line.replace(/:$/, "").trim();
        const lower = label.toLowerCase();
        if (/^(summary|profile|about|experience|work experience|education|skills|projects|professional experience)$/i.test(label)) continue;
        if (knownMap.some((k) => k.keys.some((needle) => lower.includes(needle)))) continue;
        if (consumed.has(lower)) continue;

        const block: string[] = [];
        for (let j = i + 1; j < lines.length; j++) {
            const next = lines[j].trim();
            if (!next) {
                if (block.length > 0) break;
                continue;
            }
            if (isLikelyHeading(next)) break;
            block.push(next);
        }
        const value = block.join("\n").trim();
        if (value.length >= 24) {
            output.push({ label, value });
            consumed.add(lower);
        }
    }

    return output;
}

function extractPdfTextFallback(buffer: Buffer) {
    const binary = buffer.toString("latin1");
    const chunks: string[] = [];

    const simpleTextOps = binary.match(/\((?:\\.|[^\\()]){3,}\)\s*Tj/g) || [];
    for (const op of simpleTextOps) {
        const raw = op.replace(/\)\s*Tj$/, "").replace(/^\(/, "");
        chunks.push(raw.replace(/\\([()\\])/g, "$1"));
    }

    const arrayTextOps = binary.match(/\[(?:[^\]]{4,})\]\s*TJ/g) || [];
    for (const op of arrayTextOps) {
        const body = op.replace(/\]\s*TJ$/, "").replace(/^\[/, "");
        const inner = body.match(/\((?:\\.|[^\\()])+\)/g) || [];
        for (const item of inner) {
            chunks.push(item.slice(1, -1).replace(/\\([()\\])/g, "$1"));
        }
    }

    return chunks
        .join(" ")
        .replace(/\\r/g, " ")
        .replace(/\\n/g, " ")
        .replace(/\\t/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function tokenize(text: string) {
    return (text || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 2);
}

function splitBullets(text: string) {
    if (!text) return [];
    return text
        .split(/\n|•|-/)
        .map((line) => line.trim())
        .filter((line) => line.length > 20)
        .slice(0, 4);
}

function normalizeBullet(text: string) {
    const cleaned = (text || "")
        .replace(/\s+/g, " ")
        .replace(/^[\-\u2022\*]+\s*/, "")
        .trim();
    if (!cleaned) return "";

    const startsWithVerb = /^(built|led|designed|developed|implemented|created|launched|improved|optimized|automated|managed|analyzed|delivered|drove|reduced|increased|owned|architected|streamlined|deployed|collaborated)\b/i.test(cleaned);
    const sentence = startsWithVerb ? cleaned : `Delivered ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

function topTermsFromJobs(jobs: Job[], limit = 24) {
    const stopwords = new Set([
        "with", "and", "for", "the", "from", "that", "this", "you", "your", "are", "our", "will",
        "have", "has", "into", "about", "years", "year", "plus", "using", "work", "role", "team",
        "job", "company", "experience", "required", "preferred", "skills", "knowledge", "remote",
        "hybrid", "onsite", "united", "states"
    ]);

    const counts = new Map<string, number>();
    const boost = new Map<string, number>();

    for (const job of jobs) {
        const titleTokens = tokenize(job.title || "");
        const descTokens = tokenize(job.description || "");
        const all = [...titleTokens, ...descTokens];
        for (const token of all) {
            if (token.length < 3 || stopwords.has(token)) continue;
            counts.set(token, (counts.get(token) || 0) + 1);
        }
        for (const token of titleTokens) {
            if (token.length < 3 || stopwords.has(token)) continue;
            boost.set(token, (boost.get(token) || 0) + 2);
        }
    }

    return [...counts.entries()]
        .sort((a, b) => ((b[1] + (boost.get(b[0]) || 0)) - (a[1] + (boost.get(a[0]) || 0))))
        .slice(0, limit)
        .map(([term]) => term);
}

function scoreResumeForJob(resume: Resume, job: Job) {
    const jobTerms = new Set(tokenize(`${job.title} ${job.company} ${job.description || ""}`));
    let score = 0;

    for (const term of tokenize(resume.targetRole || "")) {
        if (jobTerms.has(term)) score += 4;
    }
    for (const term of (resume.focusSkills || []).flatMap((s) => tokenize(s))) {
        if (jobTerms.has(term)) score += 3;
    }
    for (const term of tokenize(resume.jobPreferences || "")) {
        if (jobTerms.has(term)) score += 2;
    }
    for (const term of tokenize(resume.name || "")) {
        if (jobTerms.has(term)) score += 1;
    }

    const normalized = Math.min(100, Math.max(0, score * 4));
    return normalized;
}

export async function autoPopulateWorkshopFromJobs(resumeId: string) {
    await db.updateData((data) => {
        const resume = data.resumes.find((r) => r.id === resumeId);
        if (!resume) return;

        const jobs = [...data.jobs]
            .filter((job) => Boolean(job.title || job.description))
            .slice(-40);

        const preferredLocation = (data.settings.preferredLocation || "").trim();
        const topTerms = topTermsFromJobs(jobs, 30);
        const profileSkills = (data.profile.skills || []).map((s) => s.name).filter(Boolean);

        const inferredRole = (jobs[0]?.title || resume.targetRole || "").trim();
        const inferredSkills = uniqueStrings([
            ...(resume.focusSkills || []),
            ...profileSkills,
            ...topTerms.slice(0, 12),
        ]).slice(0, 14);

        const inferredPrefs = uniqueStrings([
            resume.jobPreferences || "",
            preferredLocation ? `Prefer ${preferredLocation} jobs` : "",
            "US-based roles prioritized",
            jobs.some((j) => (j.location || "").toLowerCase().includes("remote")) ? "Open to remote roles" : "",
        ]).join(". ");

        resume.targetRole = inferredRole || "Software Engineer";
        resume.focusSkills = inferredSkills;
        resume.jobPreferences = inferredPrefs || "US-based roles prioritized.";
    });

    revalidatePath("/documents");
    revalidatePath("/jobs");
    return { ok: true };
}

export async function getWorkshopInsights(resumeId: string) {
    const data = await db.getData();
    const resume = data.resumes.find((r) => r.id === resumeId);
    if (!resume) throw new Error("Resume not found.");

    const jobs = [...data.jobs].slice(-40);
    if (!jobs.length) {
        return {
            topJobFits: [],
            missingSkills: [],
            suggestedRole: resume.targetRole || "Software Engineer",
            suggestedSkills: resume.focusSkills || [],
            suggestedPreferences: resume.jobPreferences || "US-based roles prioritized.",
            note: "Add jobs to the queue to get workshop insights.",
        };
    }

    const topJobFits = jobs
        .map((job) => ({
            jobId: job.id,
            company: job.company,
            title: job.title,
            fitScore: scoreResumeForJob(resume, job),
        }))
        .sort((a, b) => b.fitScore - a.fitScore)
        .slice(0, 5);

    const jobTerms = topTermsFromJobs(jobs, 40);
    const resumeTerms = new Set([
        ...tokenize(resume.targetRole || ""),
        ...(resume.focusSkills || []).flatMap((s) => tokenize(s)),
        ...tokenize(resume.content || ""),
    ]);

    const missingSkills = jobTerms
        .filter((term) => !resumeTerms.has(term))
        .slice(0, 12);

    const suggestedRole =
        (topJobFits[0]?.title || resume.targetRole || "Software Engineer").trim();
    const suggestedSkills = uniqueStrings([
        ...(resume.focusSkills || []),
        ...jobTerms.slice(0, 10),
        ...(data.profile.skills || []).map((s) => s.name),
    ]).slice(0, 16);
    const suggestedPreferences = uniqueStrings([
        resume.jobPreferences || "",
        "US-based roles prioritized",
        data.settings.preferredLocation ? `Prefer ${data.settings.preferredLocation}` : "",
        jobs.some((j) => (j.location || "").toLowerCase().includes("remote")) ? "Remote-friendly opportunities" : "",
    ]).join(". ");

    return {
        topJobFits,
        missingSkills,
        suggestedRole,
        suggestedSkills,
        suggestedPreferences: suggestedPreferences || "US-based roles prioritized.",
        note: "Insights are based on jobs queue + profile + workshop metadata.",
    };
}

function topItemsByScore<T>(items: T[], scoreFn: (item: T) => number, limit: number) {
    return [...items]
        .map((item) => ({ item, score: scoreFn(item) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((x) => x.item);
}

function buildWorkshopResumeContent(
    resume: Resume,
    profile: Profile,
    relevantJobs: Job[]
) {
    const answers = resume.workshopAnswers || {};
    const roleText = resume.targetRole || "";
    const skillsText = [
        ...(resume.focusSkills || []),
        ...parseLooseList(answers.coreStrengths || ""),
        ...parseLooseList(answers.toolsAndTech || ""),
        ...parseLooseList(answers.certifications || ""),
    ].join(" ");
    const prefsText = uniqueStrings([
        resume.jobPreferences || "",
        answers.preferredLocations ? `Preferred locations: ${answers.preferredLocations}` : "",
        answers.workModePreference ? `Work mode: ${answers.workModePreference}` : "",
        answers.targetIndustries ? `Industries: ${answers.targetIndustries}` : "",
    ]).join(". ");
    const jobsText = relevantJobs.map((j) => `${j.title} ${j.company} ${j.description || ""}`).join(" ");

    const keywords = new Set(tokenize(`${roleText} ${skillsText} ${prefsText} ${jobsText}`));

    const scoreText = (value: string) => {
        const terms = tokenize(value);
        return terms.reduce((acc, term) => acc + (keywords.has(term) ? 1 : 0), 0);
    };

    const selectedExperienceRaw = topItemsByScore(
        profile.experience || [],
        (exp) => {
            const value = `${exp.title} ${exp.company} ${exp.location || ""} ${(exp.bullets || []).join(" ")} ${exp.description || ""}`;
            return scoreText(value);
        },
        4
    );
    const toSortableYear = (value?: string) => {
        if (!value) return 0;
        if (/present|current/i.test(value)) return 9999;
        const y = value.match(/\b(19|20)\d{2}\b/)?.[0];
        return y ? Number(y) : 0;
    };
    const selectedExperience = [...selectedExperienceRaw].sort((a, b) => {
        const aScore = Math.max(toSortableYear(a.endDate), toSortableYear(a.startDate));
        const bScore = Math.max(toSortableYear(b.endDate), toSortableYear(b.startDate));
        return bScore - aScore;
    });

    const selectedProjects = topItemsByScore(
        profile.projects || [],
        (proj) => scoreText(`${proj.name} ${proj.description} ${(proj.bullets || []).join(" ")}`),
        3
    );

    const selectedSkills = (() => {
        const explicit = (resume.focusSkills || []).map((s) => s.trim()).filter(Boolean);
        const answered = [
            ...parseLooseList(answers.coreStrengths || ""),
            ...parseLooseList(answers.toolsAndTech || ""),
            ...parseLooseList(answers.certifications || ""),
        ];
        const profileSkills = (profile.skills || []).map((s) => s.name);
        const merged = [...explicit, ...answered, ...profileSkills];
        const deduped = Array.from(new Set(merged.map((s) => s.trim()).filter(Boolean)));
        const sorted = deduped.sort((a, b) => scoreText(b) - scoreText(a));
        return sorted.slice(0, 16);
    })();

    const contactBlock = [
        profile.location || "",
        profile.contactInfo || "",
        profile.linkedin || "",
        profile.portfolio || "",
    ].filter(Boolean).join(" | ");

    const summary = profile.summary
        ? `${profile.summary} Targeting ${(roleText || answers.desiredRoles || "software").trim()}${answers.targetLevel ? ` (${answers.targetLevel})` : ""} roles with emphasis on ${selectedSkills.slice(0, 6).join(", ") || "core professional skills"}. ${answers.yearsExperience ? `${answers.yearsExperience} years of experience.` : ""} ${answers.strongestTech ? `Strongest area: ${answers.strongestTech}.` : ""}`.trim()
        : `Results-oriented candidate targeting ${(roleText || answers.desiredRoles || "software").trim()}${answers.targetLevel ? ` (${answers.targetLevel})` : ""} roles with strengths in ${selectedSkills.slice(0, 6).join(", ") || "core professional skills"}. ${answers.yearsExperience ? `${answers.yearsExperience} years of experience.` : ""} ${answers.strongestTech ? `Strongest area: ${answers.strongestTech}.` : ""}`.trim();

    const experienceSection = selectedExperience
        .map((exp, index) => {
            const bulletsRaw = [
                ...(exp.bullets || []),
                ...splitBullets(exp.description || ""),
            ];
            const bullets = bulletsRaw
                .map(normalizeBullet)
                .filter(Boolean)
                .slice(0, index === 0 ? 5 : 3);
            const finalBullets = bullets.length
                ? bullets
                : [
                    "Improved process efficiency by [X%] by implementing targeted workflow changes.",
                    "Collaborated cross-functionally to deliver project goals on time and with high quality.",
                ];

            const dateLine = `${exp.startDate || ""}${exp.endDate ? ` - ${exp.endDate}` : ""}`.trim() || "Dates not specified";
            return [
                `${(exp.title || "Role").trim()} | ${(exp.company || "Company").trim()}${exp.location ? ` | ${exp.location}` : ""}`,
                dateLine,
                ...finalBullets.map((b) => `- ${b}`),
            ].filter(Boolean).join("\n");
        })
        .join("\n\n");

    const projectsSection = selectedProjects
        .map((proj) => {
            const bulletsRaw = [
                ...(proj.bullets || []),
                ...splitBullets(proj.description || ""),
            ];
            const bullets = bulletsRaw
                .map(normalizeBullet)
                .filter(Boolean)
                .slice(0, 3);
            return [
                `${proj.name || "Project"}${proj.link ? ` | ${proj.link}` : ""}`,
                ...bullets.map((b) => `- ${b}`),
            ].filter(Boolean).join("\n");
        })
        .join("\n\n");

    const answeredProjectLines = parseLooseList(answers.topAchievements || "")
        .slice(0, 3)
        .map((x) => `- ${normalizeBullet(x)}`);

    const educationSection = (profile.education || [])
        .map((edu) => `${edu.degree || ""}${edu.school ? `, ${edu.school}` : ""}${edu.startYear || edu.endYear ? ` (${edu.startYear || ""}-${edu.endYear || ""})` : ""}`.trim())
        .filter(Boolean)
        .join("\n");

    const inferredName = (() => {
        const email = (profile.contactInfo || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
        if (!email) return "CANDIDATE NAME";
        const local = email.split("@")[0];
        const tokens = local.replace(/[._-]+/g, " ").split(/\s+/).filter(Boolean);
        if (!tokens.length) return "CANDIDATE NAME";
        return tokens.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(" ");
    })();

    const generatedResume = [
        inferredName.toUpperCase(),
        contactBlock || "Email | Phone | LinkedIn | Portfolio",
        "",
        "TARGET ROLE",
        roleText || "Software Engineer",
        "",
        "PROFESSIONAL SUMMARY",
        summary,
        "",
        "CORE SKILLS",
        selectedSkills.length ? selectedSkills.join(" | ") : "Add role-specific skills",
        "",
        "PROFESSIONAL EXPERIENCE",
        experienceSection || "Add at least one role with 3-4 quantified bullet points.",
        "",
        "PROJECTS",
        projectsSection || answeredProjectLines.join("\n") || "Add 1-3 relevant projects with outcome-focused bullets.",
        "",
        "EDUCATION",
        educationSection || "Add degree, school, and graduation years.",
    ].join("\n");

    return generatedResume;
}

export async function generateWorkshopResumePreview(resumeId: string) {
    const data = await db.getData();
    const resume = data.resumes.find((r) => r.id === resumeId);
    if (!resume) throw new Error("Resume not found.");

    const relevantJobs = data.jobs.slice(-20);
    return buildWorkshopResumeContent(resume, data.profile, relevantJobs);
}

export async function applyWorkshopResumeVariant(resumeId: string, content: string) {
    if (!content || !content.trim()) {
        throw new Error("Generated content is empty.");
    }

    await db.updateData((dbData) => {
        const target = dbData.resumes.find((r) => r.id === resumeId);
        if (!target) return;
        target.content = content;
        target.version = (target.version || 1) + 1;
    });

    revalidatePath("/documents");
    revalidatePath("/jobs");
    return { ok: true };
}

export async function generateWorkshopResumeVariant(resumeId: string) {
    const preview = await generateWorkshopResumePreview(resumeId);
    return applyWorkshopResumeVariant(resumeId, preview);
}

export async function addWorkshopResumeToLibrary(resumeId: string, content: string) {
    if (!content || !content.trim()) {
        throw new Error("Generated content is empty.");
    }

    await db.updateData((dbData) => {
        const source = dbData.resumes.find((r) => r.id === resumeId);
        if (!source) return;

        const timestamp = new Date().toISOString().slice(0, 10);
        dbData.resumes.push({
            id: `resume-${Date.now()}-${Math.random()}`,
            userId: source.userId,
            name: `${source.name.replace(/\.[^.]+$/, "")} - Tailored ${timestamp}.txt`,
            content,
            filePath: null,
            version: 1,
            isLocked: false,
            createdAt: new Date(),
            tags: uniqueStrings([...(source.tags || []), "Workshop", "Tailored"]),
            targetRole: source.targetRole || "",
            focusSkills: source.focusSkills || [],
            jobPreferences: source.jobPreferences || "",
            workshopAnswers: source.workshopAnswers || {},
        });
    });

    revalidatePath("/documents");
    revalidatePath("/jobs");
    return { ok: true };
}

type CoverLetterWorkshopInput = {
    company: string;
    title: string;
    hiringManager?: string;
    tone?: "confident" | "warm" | "direct";
    jobDescription?: string;
    whyCompany?: string;
    format?: "standard" | "email";
    additionalInfo?: string;
};

function sentenceCase(text: string) {
    const t = (text || "").trim();
    if (!t) return "";
    return t.charAt(0).toUpperCase() + t.slice(1);
}

function toTitleCase(value: string) {
    return (value || "")
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
}

function hasMetric(text: string) {
    return /(\d+%|\$\d+|\d+\+|\d+\s*(ms|sec|seconds|minutes|hours|days|users|customers|requests|tickets|projects|engineers))/i.test(text || "");
}

function trimToWords(text: string, maxWords: number) {
    const words = (text || "").trim().split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return (text || "").trim();
    return `${words.slice(0, maxWords).join(" ")}...`;
}

function extractResumeHighlights(resumeContent: string) {
    const lines = (resumeContent || "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

    const bulletLines = lines
        .filter((l) => l.startsWith("- "))
        .map((l) => l.replace(/^-+\s*/, "").trim());
    const quantified = bulletLines.filter(hasMetric);
    const source = quantified.length ? quantified : bulletLines;
    return uniqueStrings(source).slice(0, 3);
}

export async function generateWorkshopCoverLetter(resumeId: string, input: CoverLetterWorkshopInput) {
    const data = await db.getData();
    const resume = data.resumes.find((r) => r.id === resumeId);
    if (!resume) throw new Error("Resume not found.");

    const profile = data.profile;
    const answers = resume.workshopAnswers || {};
    const role = toTitleCase((input.title || resume.targetRole || answers.desiredRoles || "this role").trim());
    const company = toTitleCase((input.company || "your company").trim());
    const hiringManager = (input.hiringManager || "").trim();
    const greeting = hiringManager ? `Dear ${hiringManager},` : "Dear Hiring Team,";
    const tone = input.tone || "confident";
    const format = input.format || "standard";

    const skills = uniqueStrings([
        ...(resume.focusSkills || []),
        ...parseLooseList(answers.coreStrengths || ""),
        ...parseLooseList(answers.toolsAndTech || ""),
        ...(profile.skills || []).map((s) => s.name),
    ]).slice(0, 6);

    const achievements = uniqueStrings([
        ...parseLooseList(answers.topAchievements || ""),
        ...extractResumeHighlights(resume.content || ""),
        ...(profile.experience || []).flatMap((e) => e.bullets || []),
    ]);
    const quantifiedAchievements = achievements.filter(hasMetric);
    const impactEvidence = (quantifiedAchievements.length ? quantifiedAchievements : achievements)
        .slice(0, 2)
        .map((a) => sentenceCase(trimToWords(a, 26)));

    const jdTerms = tokenize(input.jobDescription || "");
    const keywordTerms = uniqueStrings(jdTerms).slice(0, 6);
    const topKeywords = keywordTerms.slice(0, 4);

    const introTone =
        tone === "warm"
            ? `I am excited to apply for the ${role} opportunity at ${company}.`
            : tone === "direct"
                ? `I am applying for the ${role} position at ${company}.`
                : `I am writing to express strong interest in the ${role} role at ${company}.`;

    const summaryLine = sentenceCase(
        profile.summary
            ? trimToWords(profile.summary, 28)
            : `I bring ${answers.yearsExperience ? `${answers.yearsExperience} years of experience` : "hands-on experience"} delivering high-impact outcomes across ${skills.slice(0, 3).join(", ")}.`
    );

    const achievementSentence = impactEvidence.length
        ? `For example, ${impactEvidence.map((x) => x.charAt(0).toLowerCase() + x.slice(1)).join("; ")}.`
        : "I have consistently delivered measurable outcomes through strong execution and cross-functional collaboration.";

    const alignmentLine = topKeywords.length
        ? `My background aligns with your priorities, especially ${topKeywords.join(", ")}.`
        : `My background aligns closely with the responsibilities and impact expected in this role.`;

    const whyCompany = (input.whyCompany || "").trim()
        ? sentenceCase(input.whyCompany || "")
        : `I am especially interested in ${company}'s mission and would value the opportunity to contribute to your team.`;
    const additionalInfo = trimToWords(sentenceCase(input.additionalInfo || ""), 35);

    const closeTone =
        tone === "direct"
            ? "I would welcome the opportunity to discuss how I can contribute immediately."
            : "I would welcome the opportunity to discuss how my experience can contribute to your team.";

    const nameFromEmail = (() => {
        const email = (profile.contactInfo || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
        if (!email) return "Your Name";
        const local = email.split("@")[0];
        return local
            .replace(/[._-]+/g, " ")
            .split(/\s+/)
            .filter(Boolean)
            .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
            .join(" ");
    })();

    const email = (profile.contactInfo || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "you@email.com";
    const location = profile.location || "";
    const linkedin = profile.linkedin || "";
    const portfolio = profile.portfolio || "";
    const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

    const openingParagraph = `${introTone} ${summaryLine}`;
    const evidenceParagraph = `${alignmentLine} ${achievementSentence}`;
    const motivationParagraph = `${whyCompany}${additionalInfo ? ` ${additionalInfo}` : ""} ${closeTone}`;

    const letter =
        format === "email"
            ? [
                `Subject: Application for ${role} - ${nameFromEmail}`,
                "",
                greeting,
                "",
                openingParagraph,
                "",
                evidenceParagraph,
                "",
                motivationParagraph,
                "",
                "Thank you for your time and consideration.",
                "",
                "Sincerely,",
                nameFromEmail,
                email,
                [linkedin, portfolio].filter(Boolean).join(" | "),
            ].filter(Boolean).join("\n")
            : [
                nameFromEmail,
                [location, email].filter(Boolean).join(" | "),
                [linkedin, portfolio].filter(Boolean).join(" | "),
                today,
                "",
                company,
                "",
                greeting,
                "",
                openingParagraph,
                "",
                evidenceParagraph,
                "",
                motivationParagraph,
                "",
                "Thank you for your time and consideration.",
                "",
                "Sincerely,",
                nameFromEmail,
            ].filter(Boolean).join("\n");

    return {
        content: letter,
        title: role,
        company,
        keywordsUsed: topKeywords,
        structure: {
            opening: openingParagraph,
            evidence: evidenceParagraph,
            motivation: motivationParagraph,
        },
    };
}

export async function refreshProfileFromLatestResume() {
    const data = await db.getData();
    const sortedResumes = [...data.resumes].sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
    });
    const latestResume = sortedResumes[0];

    if (!latestResume) {
        throw new Error("No resume found. Please upload a resume in Documents first.");
    }

    let normalizedResumeContent = (latestResume.content || "").trim();
    let selectedResumeName = latestResume.name;
    const isPlaceholderText =
        !normalizedResumeContent ||
        normalizedResumeContent.toLowerCase().includes("parsed content would go here") ||
        normalizedResumeContent.toLowerCase().includes("resume file uploaded (");

    if (isPlaceholderText && latestResume.originalFileBase64 && (latestResume.originalMimeType || "").toLowerCase().includes("pdf")) {
        try {
            const pdfBytes = Buffer.from(latestResume.originalFileBase64, "base64");
            const extracted = extractPdfTextFallback(pdfBytes);
            if (extracted.length > 200) {
                normalizedResumeContent = extracted;
            }
        } catch (error) {
            console.error("PDF extraction fallback failed:", error);
        }
    }

    if (!normalizedResumeContent || normalizedResumeContent.toLowerCase().includes("parsed content would go here") || normalizedResumeContent.toLowerCase().includes("resume file uploaded (")) {
        const backup = sortedResumes.find((r) => {
            const text = (r.content || "").trim().toLowerCase();
            return text.length > 200 && !text.includes("resume file uploaded (") && !text.includes("parsed content would go here");
        });
        if (backup) {
            normalizedResumeContent = (backup.content || "").trim();
            selectedResumeName = backup.name;
        }
    }

    if (!normalizedResumeContent || normalizedResumeContent.toLowerCase().includes("parsed content would go here")) {
        throw new Error(`Resume "${selectedResumeName}" has no usable text content. Upload a text-readable PDF/Doc or paste resume text and try again.`);
    }

    const { parseResumeContent, inferCustomProfileFields } = await import("@/lib/ai");
    const parsed = await parseResumeContent(normalizedResumeContent);
    const aiCustomFields = await inferCustomProfileFields(normalizedResumeContent);

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
        throw new Error("Could not extract useful fields from the latest resume. Please upload a text-based resume and try again.");
    }

    await db.updateData((dbData) => {
        const profile = dbData.profile;

        if (parsed.contact) {
            if (parsed.contact.email) profile.contactInfo = parsed.contact.email;
            if (parsed.contact.location) profile.location = parsed.contact.location;
            if (parsed.contact.linkedin) profile.linkedin = parsed.contact.linkedin;
            if (parsed.contact.portfolio) profile.portfolio = parsed.contact.portfolio;
        }

        if (parsed.summary) {
            profile.summary = parsed.summary;
        }

        profile.experience = (parsed.experience || []).map((exp: any) => ({
            id: `exp-${Date.now()}-${Math.random()}`,
            title: exp.title,
            company: exp.company,
            location: exp.location,
            startDate: exp.startDate,
            endDate: exp.endDate,
            bullets: exp.bullets || [],
            skills: [],
        }));

        profile.education = (parsed.education || []).map((edu: any) => ({
            id: `edu-${Date.now()}-${Math.random()}`,
            school: edu.school,
            degree: edu.degree,
            startYear: edu.startYear,
            endYear: edu.endYear,
            gpa: edu.gpa,
        }));

        profile.skills = (parsed.skills || []).map((skill: any) => ({
            id: `skill-${Date.now()}-${Math.random()}`,
            name: skill.name,
            category: skill.category as any,
        }));

        profile.projects = (parsed.projects || []).map((proj: any) => ({
            id: `proj-${Date.now()}-${Math.random()}`,
            name: proj.name,
            description: proj.description,
            link: proj.link,
            bullets: proj.bullets || [],
            skills: [],
        }));

        const inferredCustom = inferCustomFieldsFromText(normalizedResumeContent);
        const combined = [...inferredCustom, ...aiCustomFields];
        for (const field of combined) {
            upsertCustomField(profile, field.label, field.value, "Resume");
        }
    });

    revalidatePath("/profile");
}

export async function refreshProfileFromLinkedIn() {
    const data = await db.getData();
    const latestLinkedInProfile = [...(data.linkedinProfiles || [])].sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
    })[0];
    const linkedinJobs = data.jobs.filter((job) => {
        const source = (job.source || "").toLowerCase();
        const link = (job.link || "").toLowerCase();
        return source.includes("linkedin") || link.includes("linkedin.com");
    });

    const linkedinUrlFromContact = (data.profile.contactInfo || "").match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s)]+/i)?.[0] || "";
    const hasLinkedInSignal = Boolean(data.profile.linkedin || linkedinUrlFromContact || linkedinJobs.length || latestLinkedInProfile);
    if (!hasLinkedInSignal) {
        throw new Error("No LinkedIn data found yet. Use the extension on a LinkedIn profile or job page, then sync again.");
    }

    const cleanTitle = (title: string) => {
        return (title || "")
            .replace(/\|\s*linkedin.*$/i, "")
            .replace(/^\(\d+\)\s*top job picks for you\s*\|\s*linkedin$/i, "")
            .replace(/\s+/g, " ")
            .trim();
    };

    const titles = Array.from(
        new Set(
            linkedinJobs
                .map((j) => cleanTitle(j.title || ""))
                .filter((t) => t && !/^top job picks/i.test(t))
        )
    ).slice(0, 5);

    const profileBlob = `${latestLinkedInProfile?.headline || ""} ${latestLinkedInProfile?.about || ""} ${latestLinkedInProfile?.rawText || ""}`.toLowerCase();
    const descriptionsBlob = `${linkedinJobs.map((j) => j.description || "").join(" ")} ${profileBlob}`.toLowerCase();
    const skillCandidates = [
        "python", "javascript", "typescript", "react", "next.js", "node.js", "sql", "aws", "azure", "gcp",
        "docker", "kubernetes", "java", "c++", "c#", "go", "terraform", "graphql", "rest", "machine learning",
        "data engineering", "snowflake", "dbt", "airflow", "pandas", "numpy", "tableau", "power bi"
    ];
    const inferredSkills = skillCandidates
        .filter((s) => descriptionsBlob.includes(s))
        .map((name) => ({
            id: `skill-${Date.now()}-${Math.random()}`,
            name,
            category: "Technical" as const
        }));

    const inferredExperience = linkedinJobs
        .map((j) => {
            const cleanedTitle = cleanTitle(j.title || "");
            if (!cleanedTitle) return null;
            const snippet = (j.description || "")
                .replace(/<[^>]*>/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 180);
            return {
                id: `exp-${Date.now()}-${Math.random()}`,
                title: cleanedTitle,
                company: j.company || "LinkedIn Lead",
                location: j.location || "",
                startDate: "",
                endDate: "",
                bullets: snippet ? [snippet] : [],
                skills: []
            };
        })
        .filter(Boolean) as Experience[];

    await db.updateData((dbData) => {
        const profile = dbData.profile;

        if (!profile.linkedin) {
            profile.linkedin = latestLinkedInProfile?.profileUrl || linkedinUrlFromContact || profile.linkedin || "";
        }

        if (latestLinkedInProfile?.location && !profile.location) {
            profile.location = latestLinkedInProfile.location;
        }

        if (latestLinkedInProfile?.name && (!profile.contactInfo || !profile.contactInfo.includes(latestLinkedInProfile.name))) {
            const contactParts = [latestLinkedInProfile.name, profile.contactInfo].filter(Boolean);
            profile.contactInfo = contactParts.join(" | ");
        }

        const summaryCandidate = [latestLinkedInProfile?.headline, latestLinkedInProfile?.about].filter(Boolean).join(" ");
        if (summaryCandidate) {
            profile.summary = summaryCandidate.slice(0, 300);
        } else if (titles.length > 0 && (!profile.summary || profile.summary.includes("Professional summary"))) {
            profile.summary = `Targeting roles such as ${titles.join(", ")} based on recent LinkedIn activity.`;
        }

        const existing = new Set((profile.skills || []).map((s) => s.name.toLowerCase()));
        const merged = inferredSkills.filter((s) => !existing.has(s.name.toLowerCase()));
        profile.skills.push(...merged);

        const existingExp = new Set((profile.experience || []).map((e) => `${e.title}|${e.company}`.toLowerCase()));
        const expToAdd = inferredExperience.filter((e) => !existingExp.has(`${e.title}|${e.company}`.toLowerCase())).slice(0, 5);
        profile.experience.push(...expToAdd);

        const linkedInRaw = `${latestLinkedInProfile?.headline || ""}\n${latestLinkedInProfile?.about || ""}\n${latestLinkedInProfile?.rawText || ""}`;
        const certs = extractLooseSection(linkedInRaw, "certifications") || extractLooseSection(linkedInRaw, "licenses");
        const languages = extractLooseSection(linkedInRaw, "languages");
        if (certs) upsertCustomField(profile, "Certifications", certs, "LinkedIn");
        if (languages) upsertCustomField(profile, "Languages", languages, "LinkedIn");
    });

    revalidatePath("/profile");
}

export async function refreshProfileFromSources() {
    let resumeUpdated = false;
    let linkedinUpdated = false;
    const errors: string[] = [];

    try {
        await refreshProfileFromLatestResume();
        resumeUpdated = true;
    } catch (error) {
        errors.push((error as Error).message || "Resume update failed");
    }

    try {
        await refreshProfileFromLinkedIn();
        linkedinUpdated = true;
    } catch (error) {
        errors.push((error as Error).message || "LinkedIn update failed");
    }

    if (!resumeUpdated && !linkedinUpdated) {
        throw new Error(errors.join(" | ") || "Could not update profile from resume or LinkedIn.");
    }

    revalidatePath("/profile");
    return { resumeUpdated, linkedinUpdated, errors };
}

function decodeHtmlEntities(text: string) {
    return (text || "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;/g, "'")
        .replace(/&#x2F;/g, "/")
        .replace(/&nbsp;/g, " ");
}

function stripHtmlToText(html: string) {
    return decodeHtmlEntities(
        (html || "")
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
    );
}

function firstMatch(input: string, rx: RegExp) {
    const m = input.match(rx);
    return m?.[1]?.trim() || "";
}

export async function syncProfileFromLinkedInUrl(linkedinUrl: string) {
    const trimmed = (linkedinUrl || "").trim();
    if (!/^https?:\/\/(www\.)?linkedin\.com\/in\//i.test(trimmed)) {
        throw new Error("Please enter a valid LinkedIn profile URL (linkedin.com/in/...).");
    }

    let html = "";
    try {
        const response = await fetch(trimmed, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9",
            },
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error(`LinkedIn page returned ${response.status}`);
        }
        html = await response.text();
    } catch (error) {
        const msg = (error as Error).message || "Unknown error";
        if (msg.includes("init[\"status\"] must be in the range of 200 to 599")) {
            throw new Error("Could not fetch LinkedIn profile URL. LinkedIn blocked direct server fetch. Use the extension once on your LinkedIn profile page, then sync again.");
        }
        throw new Error(`Could not fetch LinkedIn profile URL. ${msg}`);
    }

    const ogTitle = firstMatch(html, /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) || "";
    const ogDescription = firstMatch(html, /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) || "";
    const titleTag = firstMatch(html, /<title[^>]*>([^<]+)<\/title>/i) || "";
    const text = stripHtmlToText(html).slice(0, 20000);

    const nameFromTitle = (ogTitle || titleTag).replace(/\|\s*linkedin.*$/i, "").trim();
    const headline = decodeHtmlEntities(ogDescription || "");
    const name = decodeHtmlEntities(nameFromTitle || "");
    const locationCandidate = firstMatch(text, /\b([A-Za-z .'-]+,\s*[A-Z]{2})\b/) || "";
    const about = headline.slice(0, 500);

    await db.updateData((data) => {
        if (!data.linkedinProfiles) data.linkedinProfiles = [];
        data.linkedinProfiles.push({
            id: `li-${Date.now()}`,
            userId: "user-1",
            profileUrl: trimmed,
            name,
            headline,
            location: locationCandidate,
            about,
            rawText: text,
            createdAt: new Date(),
            updatedAt: new Date(),
        } as any);
        data.profile.linkedin = trimmed;
    });

    await refreshProfileFromLinkedIn();
    revalidatePath("/profile");
    revalidatePath("/find-jobs");
    revalidatePath("/settings");
    return { ok: true };
}

export async function syncProfileFromLinkedInUrlAndResume(linkedinUrl: string) {
    const errors: string[] = [];
    let linkedinUpdated = false;
    let resumeUpdated = false;

    try {
        await syncProfileFromLinkedInUrl(linkedinUrl);
        linkedinUpdated = true;
    } catch (error) {
        errors.push((error as Error).message || "LinkedIn sync failed");
        const trimmed = (linkedinUrl || "").trim();
        const slug = trimmed.split("/in/")[1]?.split(/[/?#]/)[0] || "";
        const inferredName = slug
            .replace(/[-_]+/g, " ")
            .replace(/\d+/g, "")
            .trim()
            .replace(/\b\w/g, (c) => c.toUpperCase());
        await db.updateData((data) => {
            data.profile.linkedin = trimmed;
            if (inferredName && (!data.profile.contactInfo || !data.profile.contactInfo.toLowerCase().includes(inferredName.toLowerCase()))) {
                data.profile.contactInfo = [inferredName, data.profile.contactInfo].filter(Boolean).join(" | ");
            }
        });
        linkedinUpdated = Boolean(trimmed);
    }

    try {
        await refreshProfileFromLatestResume();
        resumeUpdated = true;
    } catch (error) {
        errors.push((error as Error).message || "Resume sync failed");
    }

    if (!linkedinUpdated && !resumeUpdated) {
        throw new Error(errors.join(" | ") || "Could not sync profile from LinkedIn URL or resume.");
    }

    revalidatePath("/profile");
    revalidatePath("/find-jobs");
    revalidatePath("/settings");
    return { linkedinUpdated, resumeUpdated, errors };
}

// --- Content Engine Actions ---

export async function createCoverLetterTemplate(name: string, content: string, category: string = "General") {
    const newTemplate: CoverLetterTemplate = {
        id: `tpl-${Date.now()}`,
        userId: "user-1",
        name,
        content,
        category
    };
    await db.updateData((data) => {
        data.coverLetterTemplates.push(newTemplate);
    });
    revalidatePath("/documents");
}

export async function deleteCoverLetterTemplate(id: string) {
    await db.updateData((data) => {
        data.coverLetterTemplates = data.coverLetterTemplates.filter(t => t.id !== id);
    });
    revalidatePath("/documents");
}

export async function createAnswerBankItem(question: string, answer: string, tags: string[]) {
    const newItem: AnswerBankItem = {
        id: `ans-${Date.now()}`,
        userId: "user-1",
        question,
        answer,
        tags,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    await db.updateData((data) => {
        data.answerBank.push(newItem);
    });
    revalidatePath("/profile");
}

export async function deleteAnswerBankItem(id: string) {
    await db.updateData((data) => {
        data.answerBank = data.answerBank.filter(i => i.id !== id);
    });
    revalidatePath("/profile");
}

export async function createContact(
    name: string,
    company: string,
    role: string,
    email?: string,
    linkedin?: string,
    tags: string[] = []
) {
    const newContact: Contact = {
        id: `contact-${Date.now()}`,
        userId: "user-1",
        name: (name || "").trim(),
        company: (company || "").trim(),
        role: (role || "").trim(),
        email: (email || "").trim() || undefined,
        linkedin: (linkedin || "").trim() || undefined,
        tags: tags.map((t) => t.trim()).filter(Boolean),
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    await db.updateData((data) => {
        data.contacts.push(newContact);
    });
    await logAction("CREATE_CONTACT", `${newContact.name} (${newContact.company})`);
    revalidatePath("/network");
}

export async function deleteContact(id: string) {
    await db.updateData((data) => {
        data.contacts = data.contacts.filter((c) => c.id !== id);
        data.interactions = data.interactions.filter((i) => i.contactId !== id);
    });
    await logAction("DELETE_CONTACT", `Contact ${id} deleted`);
    revalidatePath("/network");
}

export async function logInteraction(contactId: string, type: string, notes: string, date: Date = new Date()) {
    const interaction: Interaction = {
        id: `interaction-${Date.now()}`,
        contactId,
        type: (["Email", "LinkedIn", "Call", "Coffee", "Other"].includes(type) ? type : "Other") as Interaction["type"],
        date,
        notes: (notes || "").trim(),
    };
    await db.updateData((data) => {
        data.interactions.unshift(interaction);
    });
    await logAction("LOG_INTERACTION", `${interaction.type} interaction logged for ${contactId}`);
    revalidatePath("/network");
}

// --- AI Actions ---

// --- AI Actions ---

export async function generateTailoringAction(jobDescription: string, resumeId?: string) {
    // 1. Fetch Resume Content
    let resumeContent = "";
    const data = await db.getData();

    if (resumeId) {
        const resume = data.resumes.find(r => r.id === resumeId);
        if (resume) resumeContent = resume.content;
    } else {
        // Default to first resume
        const resume = data.resumes[0];
        if (resume) resumeContent = resume.content;
    }

    if (!resumeContent) {
        throw new Error("No resume found. Please upload a resume in Documents first.");
    }

    if (!jobDescription) {
        throw new Error("Job description is missing.");
    }

    // 2. Call AI
    try {
        const { generateTailoredContent } = await import("@/lib/ai");
        const result = await generateTailoredContent(jobDescription, resumeContent);
        return result;
    } catch (error) {
        console.error("AI Generation Error", error);
        throw new Error((error as Error).message || "Failed to generate content");
    }
}

export async function saveTailoring(applicationId: string, tailoringData: any) {
    await db.updateData((data) => {
        const app = data.applications.find((a) => a.id === applicationId);
        if (app) {
            (app as any).tailoring = {
                ...tailoringData,
                createdAt: new Date()
            };
        }
    });
    revalidatePath(`/applications/${applicationId}`);
}

export async function generateInterviewPrepPack(applicationId: string) {
    const data = await db.getData();
    const application = data.applications.find((a) => a.id === applicationId);
    if (!application) {
        throw new Error("Application not found.");
    }

    const jobText = `${application.job.title} ${application.job.company} ${application.job.description || ""}`;
    const terms = uniqueStrings(tokenize(jobText)).slice(0, 20);
    const resume = data.resumes[0];
    const resumeText = (resume?.content || "").toLowerCase();

    const topSkills = terms
        .filter((t) => resumeText.includes(t))
        .slice(0, 6);

    const missingSkills = terms
        .filter((t) => !resumeText.includes(t))
        .slice(0, 6);

    const likelyQuestions = [
        {
            question: `Why are you interested in the ${application.job.title} role at ${application.job.company}?`,
            tags: ["Motivation", "Company Fit"],
            guidance: "Connect your background to this role and mention one company-specific reason.",
        },
        {
            question: `Tell me about a project where you used ${topSkills[0] || "a key technical skill"} to deliver measurable impact.`,
            tags: ["Behavioral", "Technical", "STAR"],
            guidance: "Use Situation, Task, Action, Result and include one metric.",
        },
        {
            question: `How would you approach responsibilities in this role involving ${missingSkills[0] || "new problem domains"}?`,
            tags: ["Problem Solving", "Learning Agility"],
            guidance: "Show your structured approach and how you ramp quickly.",
        },
        {
            question: "Describe a difficult stakeholder or team challenge and how you handled it.",
            tags: ["Behavioral", "Collaboration", "STAR"],
            guidance: "Focus on communication, alignment, and outcomes.",
        },
        {
            question: "What are your 30/60/90-day priorities if you joined?",
            tags: ["Execution", "Ownership"],
            guidance: "Give a concrete onboarding and impact plan.",
        },
    ];

    const storyPrompts = [
        "A time you improved a process with measurable impact.",
        "A time you debugged a complex issue under pressure.",
        "A time you led without authority and delivered a result.",
    ];

    const companyResearchChecklist = [
        `Recent product/news updates for ${application.job.company}`,
        "Role scope and success metrics from job description",
        "Team/org context from LinkedIn and company careers pages",
        "2-3 tailored questions to ask interviewer",
    ];

    return {
        applicationId,
        role: application.job.title,
        company: application.job.company,
        topSkills,
        missingSkills,
        likelyQuestions,
        storyPrompts,
        companyResearchChecklist,
    };
}

export async function saveSettings(settings: any) {
    await db.updateData((data) => {
        data.settings = { ...data.settings, ...settings };
    });
    revalidatePath("/settings");
}
// ... existing code ...

export async function generateJobSearchQueriesAction() {
    // 1. Fetch full user context
    const data = await db.getData();
    const resume = [...data.resumes].sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
    })[0];

    if (!resume) {
        throw new Error("No resume found. Please upload a resume in Documents first.");
    }

    // 2. Call AI
    try {
        const { generateSearchQueries } = await import("@/lib/ai");
        const profile = data.profile;
        const latestLinkedInProfile = [...(data.linkedinProfiles || [])].sort((a, b) => {
            const aTime = new Date(a.updatedAt || a.createdAt).getTime();
            const bTime = new Date(b.updatedAt || b.createdAt).getTime();
            return bTime - aTime;
        })[0];

        const context = {
            summary: profile.summary || "",
            preferredLocation: data.settings.preferredLocation || "",
            profileLocation: profile.location || latestLinkedInProfile?.location || "",
            skills: profile.skills.map((s) => s.name).slice(0, 30),
            recentTitles: profile.experience.map((e) => e.title).slice(0, 8),
            education: profile.education.map((e) => `${e.degree} @ ${e.school}`).slice(0, 5),
            projects: profile.projects.map((p) => p.name).slice(0, 8),
            priorJobTitles: data.jobs.map((j) => j.title).slice(0, 8),
            linkedinHeadline: latestLinkedInProfile?.headline || "",
            linkedinAbout: latestLinkedInProfile?.about || "",
            linkedinRaw: (latestLinkedInProfile?.rawText || "").slice(0, 1200),
        };

        const result = await generateSearchQueries(resume.content, context);
        const baseTitles = (result?.recommendedTitles || []).filter(Boolean).slice(0, 3);
        const baseKeywords = (result?.searchKeywords || []).filter(Boolean).slice(0, 5);
        const titleClause = baseTitles.length ? `(${baseTitles.join(" OR ")})` : "(Software Engineer OR Developer)";
        const keywordClause = baseKeywords.length ? `(${baseKeywords.join(" OR ")})` : "(JavaScript OR TypeScript OR React)";
        const normalizedQueries = [
            ...(Array.isArray(result?.booleanQueries) ? result.booleanQueries : []),
            { label: "US Core", query: `${titleClause} AND ${keywordClause} AND (United States OR USA OR Remote)` },
            { label: "Company ATS", query: `${titleClause} AND ${keywordClause} AND (Greenhouse OR Lever OR Workday OR careers)` },
        ]
            .filter((q: any) => q?.label && q?.query)
            .reduce((acc: any[], q: any) => {
                const key = q.query.toLowerCase().trim();
                if (!acc.some((x) => x.query.toLowerCase().trim() === key)) {
                    acc.push({ label: q.label, query: q.query });
                }
                return acc;
            }, [])
            .slice(0, 6);

        return {
            ...result,
            booleanQueries: normalizedQueries,
            defaultFilters: {
                location: data.settings.preferredLocation || profile.location || latestLinkedInProfile?.location || "United States",
                usOnly: true,
                remoteOnly: false,
                level: "",
                minRelevance: 1,
                postedWithinDays: 30,
            },
        };
    } catch (error) {
        console.error("AI Generation Error", error);
        throw new Error((error as Error).message || "Failed to generate search queries");
    }
}

export async function getJobSearchPersonalizationStatusAction() {
    const data = await db.getData();
    const profile = data.profile;
    const latestResume = [...(data.resumes || [])]
        .sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime())[0];
    const latestLinkedInProfile = [...(data.linkedinProfiles || [])]
        .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())[0];

    const resumeReady = Boolean(latestResume && (latestResume.content || "").trim().length > 80);
    const profileReady = Boolean(
        (profile?.skills || []).length ||
        (profile?.experience || []).length ||
        (profile?.projects || []).length ||
        (profile?.summary || "").trim()
    );
    const linkedinReady = Boolean(
        latestLinkedInProfile &&
        (
            (latestLinkedInProfile.headline || "").trim() ||
            (latestLinkedInProfile.about || "").trim() ||
            (latestLinkedInProfile.rawText || "").trim()
        )
    );

    return {
        resume: {
            ready: resumeReady,
            detail: resumeReady ? (latestResume?.name || "Latest resume detected") : "No readable resume found",
        },
        profile: {
            ready: profileReady,
            detail: profileReady ? "Profile has enough signals" : "Add skills/experience in Profile",
        },
        linkedin: {
            ready: linkedinReady,
            detail: linkedinReady ? "LinkedIn snapshot available" : "No LinkedIn snapshot yet",
        },
    };
}

export async function scanEmailsAction() {
    try {
        const { checkEmailsForUpdates } = await import("@/lib/email");
        const result = await checkEmailsForUpdates();
        revalidatePath("/dashboard");
        revalidatePath("/applications");
        return result;
    } catch (error) {
        console.error("Scan Error", error);
        throw new Error((error as Error).message || "Failed to scan emails");
    }
}

export async function searchJobsAction(
    query: string,
    location?: string,
    filters?: {
        location?: string;
        locations?: string[];
        keywords?: string[];
        remoteOnly?: boolean;
        relocation?: "any" | "yes" | "no";
        level?: string;
        minRelevance?: number;
        usOnly?: boolean;
        postedWithinDays?: number;
    }
) {
    console.log('[searchJobsAction] Called with query:', query);

    try {
        const data = await db.getData();
        const latestResume = [...(data.resumes || [])]
            .sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime())
            .find((r) => (r.content || "").trim().length > 80);
        const latestLinkedInProfile = [...(data.linkedinProfiles || [])].sort((a, b) => {
            const aTime = new Date(a.updatedAt || a.createdAt).getTime();
            const bTime = new Date(b.updatedAt || b.createdAt).getTime();
            return bTime - aTime;
        })[0];

        const buildFallbackUrl = (title: string, company: string) =>
            `https://www.google.com/search?q=${encodeURIComponent(`${title} ${company} careers`)}`;

        const isHttpUrl = (value?: string) => Boolean(value && /^https?:\/\//i.test(value));
        const relocation = filters?.relocation || "any";
        const effectiveLocations = uniqueStrings([
            ...(filters?.locations || []),
            filters?.location || location || "",
        ].map((x) => (x || "").trim()).filter(Boolean));
        const primaryLocation = effectiveLocations[0] || "";
        const locationHints = uniqueStrings(
            effectiveLocations
                .flatMap((loc) => loc.toLowerCase().split(/[,\-\/]/))
                .map((x) => x.trim())
                .filter((x) => x.length > 2 && !["united states", "usa", "us"].includes(x))
        ).slice(0, 8);
        const levelFilter = (filters?.level || "").toLowerCase();
        const usOnly = filters?.usOnly !== false;
        const postedWithinDays = Number(filters?.postedWithinDays || 30);
        const usHints = ["united states", "usa", "u.s.", "us", "new york", "california", "texas", "florida", "washington", "illinois", "massachusetts"];
        const isLikelyUS = (text: string) => {
            const normalized = (text || "").toLowerCase();
            return usHints.some((hint) => normalized.includes(hint));
        };
        const isLikelyRemote = (text: string) => {
            const normalized = (text || "").toLowerCase();
            return normalized.includes("remote") || normalized.includes("work from home");
        };
        const matchesPreferredLocation = (text: string) => {
            const normalized = (text || "").toLowerCase();
            if (!effectiveLocations.length) return true;
            if (effectiveLocations.some((loc) => normalized.includes(loc.toLowerCase()))) return true;
            if (locationHints.some((hint) => normalized.includes(hint))) return true;
            return false;
        };
        const getDomain = (url: string) => {
            try {
                return new URL(url).hostname.toLowerCase();
            } catch {
                return "";
            }
        };
        const isCompanyAtsDomain = (url: string) => {
            const domain = getDomain(url);
            return [
                "greenhouse.io",
                "lever.co",
                "myworkdayjobs.com",
                "icims.com",
                "smartrecruiters.com",
                "ashbyhq.com",
                "jobs.ashbyhq.com",
            ].some((d) => domain.includes(d));
        };
        const asDate = (value?: string) => {
            if (!value) return null;
            const d = new Date(value);
            return Number.isNaN(d.getTime()) ? null : d;
        };
        const withinDays = (value?: string, maxDays = 30) => {
            if (!maxDays || maxDays <= 0) return true;
            const d = asDate(value);
            if (!d) return true;
            const ageMs = Date.now() - d.getTime();
            return ageMs <= maxDays * 24 * 60 * 60 * 1000;
        };
        const titleCatalog = [
            "software engineer",
            "frontend engineer",
            "backend engineer",
            "full stack engineer",
            "product manager",
            "data analyst",
            "data scientist",
            "machine learning engineer",
            "devops engineer",
            "site reliability engineer",
            "qa engineer",
            "security engineer",
            "cloud engineer",
            "ui engineer",
            "ux designer",
        ];
        const inferTitlesFromText = (text: string) => {
            const normalized = (text || "").toLowerCase();
            return titleCatalog.filter((t) => normalized.includes(t));
        };

        const rawTerms = query
            .replace(/[()"]/g, " ")
            .replace(/\s+(AND|OR|NOT)\s+/gi, " ")
            .split(/\s+/)
            .map((t) => t.trim().toLowerCase())
            .filter((t) => t.length > 2);

        const stopWords = new Set(["and", "or", "not", "with", "for", "the", "a", "an", "to", "of", "in", "on"]);
        const userKeywords = uniqueStrings((filters?.keywords || []).map((k) => (k || "").toLowerCase().trim()).filter(Boolean));
        const profile = data.profile || { experience: [], skills: [], projects: [], education: [] };
        const resumeText = (latestResume?.content || "").slice(0, 8000);
        const linkedinText = `${latestLinkedInProfile?.headline || ""} ${latestLinkedInProfile?.about || ""} ${latestLinkedInProfile?.rawText || ""}`.slice(0, 4000);
        const profileText = [
            profile.summary || "",
            ...(profile.experience || []).flatMap((e) => [e.title || "", e.company || "", e.description || "", ...(e.bullets || [])]),
            ...(profile.projects || []).flatMap((p) => [p.name || "", p.description || "", ...(p.skills || []), ...(p.bullets || [])]),
        ]
            .filter(Boolean)
            .join(" ");

        const personaTitles = uniqueStrings([
            ...(profile.experience || []).map((e) => (e.title || "").toLowerCase()),
            ...data.jobs.slice(-12).map((j) => (j.title || "").toLowerCase()),
            ...inferTitlesFromText(resumeText),
            ...inferTitlesFromText(linkedinText),
        ]).slice(0, 12);

        const profileSkills = uniqueStrings([
            ...(profile.skills || []).map((s) => (s.name || "").toLowerCase()),
            ...tokenize(resumeText).slice(0, 120),
            ...tokenize(linkedinText).slice(0, 80),
        ])
            .filter((t) => t.length > 2 && !stopWords.has(t))
            .slice(0, 80);

        const terms = Array.from(
            new Set([
                ...rawTerms.filter((t) => !stopWords.has(t)),
                ...userKeywords.flatMap((t) => tokenize(t)),
                ...personaTitles.flatMap((t) => tokenize(t)),
                ...profileSkills.slice(0, 24),
            ])
        );
        const linkedinTerms = tokenize(linkedinText).filter((t) => !stopWords.has(t)).slice(0, 24);

        const fetchMuseJobs = async () => {
            const fetchMuseForLocation = async (locationValue?: string) => {
                const params = new URLSearchParams({ descending: "true" });
                if (locationValue) params.append("location", locationValue);
                if (filters?.level) params.append("level", filters.level);

                const pages = [1, 2, 3].map(async (page) => {
                    const pageParams = new URLSearchParams(params);
                    pageParams.set("page", String(page));
                    const apiUrl = `https://www.themuse.com/api/public/jobs?${pageParams.toString()}`;
                    const response = await fetch(apiUrl);
                    if (!response.ok) {
                        console.error("[searchJobsAction] The Muse HTTP Error:", response.status, "for page", page);
                        return [];
                    }
                    const data = await response.json();
                    return (data.results || []).map((job: any) => {
                        const sourceUrl = job.refs?.landing_page;
                        return {
                            id: `muse-${job.id}`,
                            title: job.name || "Untitled Role",
                            company: job.company?.name || "Unknown Company",
                            location: job.locations?.[0]?.name || "Remote",
                            description: job.contents || "No description available",
                            level: job.levels?.[0]?.name || "",
                            category: job.categories?.[0]?.name || "",
                            postedDate: job.publication_date,
                            source: "The Muse",
                            url: isHttpUrl(sourceUrl) ? sourceUrl : buildFallbackUrl(job.name || "Job", job.company?.name || "Company"),
                        };
                    });
                });

                return (await Promise.all(pages)).flat();
            };

            const first = await fetchMuseForLocation(primaryLocation || "United States");
            if (first.length > 0) return first;

            const second = await fetchMuseForLocation("United States");
            if (second.length > 0) return second;

            return fetchMuseForLocation(undefined);
        };

        const fetchRemotiveJobs = async () => {
            const simpleQuery = terms.slice(0, 6).join(" ");
            const apiUrl = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(simpleQuery || query)}`;
            const response = await fetch(apiUrl);
            if (!response.ok) {
                console.error("[searchJobsAction] Remotive HTTP Error:", response.status);
                return [];
            }
            const data = await response.json();
            return (data.jobs || []).map((job: any) => {
                const sourceUrl = job.url;
                return {
                    id: `remotive-${job.id}`,
                    title: job.title || "Untitled Role",
                    company: job.company_name || "Unknown Company",
                    location: job.candidate_required_location || "Remote",
                    description: job.description || "No description available",
                    level: job.job_type || "",
                    category: job.category || "",
                    postedDate: job.publication_date,
                    source: "Remotive",
                    url: isHttpUrl(sourceUrl) ? sourceUrl : buildFallbackUrl(job.title || "Job", job.company_name || "Company"),
                };
            });
        };

        const fetchArbeitnowJobs = async () => {
            const response = await fetch("https://www.arbeitnow.com/api/job-board-api");
            if (!response.ok) {
                console.error("[searchJobsAction] Arbeitnow HTTP Error:", response.status);
                return [];
            }
            const data = await response.json();
            return (data.data || []).map((job: any) => {
                const sourceUrl = job.url;
                return {
                    id: `arbeitnow-${job.slug}`,
                    title: job.title || "Untitled Role",
                    company: job.company_name || "Unknown Company",
                    location: job.location || (job.remote ? "Remote" : "Unknown"),
                    description: job.description || "No description available",
                    level: (job.job_types || [])[0] || "",
                    category: (job.tags || [])[0] || "",
                    postedDate: job.created_at,
                    source: "Arbeitnow",
                    url: isHttpUrl(sourceUrl) ? sourceUrl : buildFallbackUrl(job.title || "Job", job.company_name || "Company"),
                    remote: Boolean(job.remote),
                    tags: job.tags || [],
                };
            });
        };

        const fetchUsaJobs = async () => {
            const host = process.env.USAJOBS_HOST;
            const userAgent = process.env.USAJOBS_USER_AGENT;
            const authKey = process.env.USAJOBS_AUTH_KEY;
            if (!host || !userAgent || !authKey) return [];

            const keyword = terms.slice(0, 6).join(" ") || query;
            const params = new URLSearchParams({
                Keyword: keyword,
                ResultsPerPage: "50",
            });
            if (primaryLocation) params.set("LocationName", primaryLocation);
            const response = await fetch(`https://data.usajobs.gov/api/search?${params.toString()}`, {
                headers: {
                    "Host": host,
                    "User-Agent": userAgent,
                    "Authorization-Key": authKey,
                },
            });
            if (!response.ok) {
                console.error("[searchJobsAction] USAJobs HTTP Error:", response.status);
                return [];
            }
            const data = await response.json();
            const items = data?.SearchResult?.SearchResultItems || [];
            return items.map((item: any, index: number) => {
                const descriptor = item?.MatchedObjectDescriptor || {};
                const title = descriptor?.PositionTitle || "Untitled Role";
                const company = descriptor?.OrganizationName || "US Government";
                const sourceUrl = descriptor?.PositionURI;
                return {
                    id: `usajobs-${descriptor?.PositionID || descriptor?.PositionURI || index}`,
                    title,
                    company,
                    location: descriptor?.PositionLocationDisplay || "United States",
                    description: descriptor?.UserArea?.Details?.MajorDuties?.join(" ") || "No description available",
                    level: descriptor?.JobGrade?.[0]?.Code || "",
                    category: descriptor?.PositionSchedule?.[0]?.Name || "",
                    postedDate: descriptor?.PublicationStartDate,
                    source: "USAJobs",
                    url: isHttpUrl(sourceUrl) ? sourceUrl : buildFallbackUrl(title, company),
                    remote: false,
                };
            });
        };

        const [museJobs, remotiveJobs, arbeitnowJobs, usaJobs] = await Promise.all([
            fetchMuseJobs(),
            fetchRemotiveJobs(),
            fetchArbeitnowJobs(),
            fetchUsaJobs(),
        ]);

        const allResults = [...museJobs, ...remotiveJobs, ...arbeitnowJobs, ...usaJobs];
        const deduped = Array.from(
            new Map(allResults.map((job) => [`${job.title}|${job.company}|${job.location}`.toLowerCase(), job])).values()
        );
        const recentFiltered = deduped.filter((job: any) => withinDays(job.postedDate, postedWithinDays));

        const remoteFiltered = filters?.remoteOnly
            ? recentFiltered.filter((job: any) => {
                const text = `${job.location} ${job.description}`.toLowerCase();
                return job.remote || text.includes("remote");
            })
            : recentFiltered;

        const usFiltered = usOnly
            ? remoteFiltered.filter((job: any) => {
                const text = `${job.location} ${job.description}`.toLowerCase();
                return isLikelyUS(text) || isLikelyRemote(text);
            })
            : remoteFiltered;

        const locationFiltered = effectiveLocations.length && relocation !== "yes"
            ? usFiltered.filter((job: any) => {
                const text = `${job.location} ${job.description}`.toLowerCase();
                return matchesPreferredLocation(text) || (filters?.remoteOnly ? isLikelyRemote(text) : false);
            })
            : usFiltered;

        const strictLevelFiltered = levelFilter
            ? locationFiltered.filter((job: any) => `${job.level || ""}`.toLowerCase().includes(levelFilter))
            : locationFiltered;
        const relaxedLocationFiltered = usFiltered;
        const relaxedLevelFiltered = levelFilter
            ? relaxedLocationFiltered.filter((job: any) => `${job.level || ""}`.toLowerCase().includes(levelFilter))
            : relaxedLocationFiltered;
        const candidatePool = strictLevelFiltered.length
            ? strictLevelFiltered
            : relaxedLevelFiltered.length
                ? relaxedLevelFiltered
                : usFiltered.length
                    ? usFiltered
                    : remoteFiltered;

        const scored = candidatePool
            .map((job: any) => {
                const haystack = [
                    job.title,
                    job.company,
                    job.category,
                    job.level,
                    job.location,
                    job.description,
                    (job.tags || []).join(" "),
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

                const titleText = (job.title || "").toLowerCase();
                const categoryText = `${job.category || ""}`.toLowerCase();
                const keywordScore = terms.reduce((acc, term) => {
                    const inBody = haystack.includes(term) ? 1 : 0;
                    const inTitle = titleText.includes(term) ? 4 : 0;
                    const inCategory = categoryText.includes(term) ? 1 : 0;
                    return acc + inBody + inTitle + inCategory;
                }, 0);
                const locationText = `${job.location || ""} ${job.description || ""}`.toLowerCase();
                const usBoost = isLikelyUS(locationText) ? 5 : 0;
                const nonUsPenalty = usOnly && !isLikelyUS(locationText) ? -6 : 0;
                const remoteBoost = isLikelyRemote(locationText) ? 2 : 0;
                const recencyBoost = withinDays(job.postedDate, 7) ? 4 : withinDays(job.postedDate, 30) ? 2 : 0;
                const atsBoost = isCompanyAtsDomain(job.url || "") ? 3 : 0;
                const personaTitleBoost = personaTitles.some((t) => t && titleText.includes(t)) ? 6 : 0;
                const skillOverlap = profileSkills.slice(0, 36).reduce((acc, term) => acc + (haystack.includes(term) ? 1 : 0), 0);
                const linkedinOverlap = linkedinTerms.reduce((acc, term) => acc + (haystack.includes(term) ? 1 : 0), 0);
                const profileOverlap = tokenize(profileText).slice(0, 36).reduce((acc, term) => acc + (haystack.includes(term) ? 1 : 0), 0);
                const score =
                    keywordScore +
                    usBoost +
                    remoteBoost +
                    recencyBoost +
                    atsBoost +
                    personaTitleBoost +
                    Math.min(8, skillOverlap) +
                    Math.min(4, linkedinOverlap) +
                    Math.min(4, profileOverlap) +
                    nonUsPenalty;
                return { job, score };
            })
            .sort((a, b) => b.score - a.score);

        const minRelevance = Math.max(0, filters?.minRelevance ?? 1);
        const relevant = scored.filter((item) => item.score >= minRelevance);
        const ranked = relevant.length > 0 ? relevant : scored;
        const bySource = new Map<string, Array<{ job: any; score: number }>>();
        for (const item of ranked) {
            const source = item.job.source || "Unknown Source";
            if (!bySource.has(source)) bySource.set(source, []);
            bySource.get(source)!.push(item);
        }
        for (const arr of bySource.values()) {
            arr.sort((a, b) => b.score - a.score);
        }

        const selectedRanked: Array<{ job: any; score: number }> = [];
        const minResultsFloor = 10;
        const maxResults = 15;
        const maxPerSource = 8;
        let round = 0;
        while (selectedRanked.length < maxResults) {
            let addedThisRound = 0;
            for (const [_, arr] of bySource.entries()) {
                if (selectedRanked.length >= maxResults) break;
                if (round >= arr.length) continue;
                const sourceCount = selectedRanked.filter((x) => x.job.source === arr[round].job.source).length;
                if (sourceCount >= maxPerSource) continue;
                selectedRanked.push(arr[round]);
                addedThisRound += 1;
            }
            if (!addedThisRound) break;
            round += 1;
        }

        if (selectedRanked.length < minResultsFloor) {
            const seenIds = new Set(selectedRanked.map((x) => String(x.job.id)));
            const fallbackScored = (recentFiltered.length ? recentFiltered : deduped)
                .map((job: any) => {
                    const haystack = [
                        job.title,
                        job.company,
                        job.category,
                        job.level,
                        job.location,
                        job.description,
                        (job.tags || []).join(" "),
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();
                    const titleText = (job.title || "").toLowerCase();
                    const keywordScore = terms.reduce((acc, term) => acc + (haystack.includes(term) ? 1 : 0) + (titleText.includes(term) ? 2 : 0), 0);
                    const locationText = `${job.location || ""} ${job.description || ""}`.toLowerCase();
                    const usBoost = isLikelyUS(locationText) ? 2 : 0;
                    const remoteBoost = isLikelyRemote(locationText) ? 1 : 0;
                    return { job, score: keywordScore + usBoost + remoteBoost };
                })
                .sort((a, b) => b.score - a.score);

            for (const item of fallbackScored) {
                if (selectedRanked.length >= minResultsFloor) break;
                const id = String(item.job.id);
                if (seenIds.has(id)) continue;
                selectedRanked.push(item);
                seenIds.add(id);
            }
        }

        const selected = selectedRanked.map(({ job, score }: any) => {
            const title = job.title || "Job";
            const company = job.company || "Company";
            const roleCompany = `${title} ${company}`;
            const roleCompanyLocation = `${roleCompany} ${job.location || ""}`.trim();
            const safeUrl = isHttpUrl(job.url) ? job.url : buildFallbackUrl(title, company);
            return {
                id: job.id.toString(),
                title,
                company,
                location: job.location || "Remote",
                description: job.description || "No description available",
                url: safeUrl,
                postedDate: job.postedDate,
                level: job.level,
                category: job.category,
                source: job.source || "Unknown Source",
                relevance: score,
                linkedinUrl: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(roleCompanyLocation)}`,
                indeedUrl: `https://www.indeed.com/jobs?q=${encodeURIComponent(roleCompanyLocation)}`,
                companySiteUrl: `https://www.google.com/search?q=${encodeURIComponent(`${company} careers`)}`,
            };
        });

        console.log("[searchJobsAction] Returning", selected.length, "jobs from", new Set(selected.map((j: any) => j.source)).size, "sources");
        return selected;
    } catch (error) {
        console.error("[searchJobsAction] Error:", error);
        return [];
    }
}

export async function addJobFromSearchAction(jobData: any) {
    const newJob: Job = {
        id: `job-${Date.now()}`,
        userId: "user-1",
        company: jobData.company,
        title: jobData.title,
        link: jobData.url,
        description: jobData.description,
        source: jobData.source || "Job Search",
        priorityScore: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const newApplication: Application = {
        id: `app-${Date.now()}`,
        userId: "user-1",
        jobId: newJob.id,
        job: newJob,
        status: "INTERESTED",
        checklist: {
            research: false,
            tailor: false,
            prepButtons: false,
            review: false,
            submitted: false
        },
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    await db.updateData((data) => {
        data.jobs.push(newJob);
        data.applications.push(newApplication);
    });

    revalidatePath("/jobs");
    revalidatePath("/applications");
    revalidatePath("/dashboard");

    return newApplication.id;
}
