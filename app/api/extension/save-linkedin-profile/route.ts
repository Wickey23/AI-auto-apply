import { db } from "@/lib/db";
import { LinkedInProfileSnapshot } from "@/lib/types";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

function normalizeLinkedInText(raw: string) {
    const text = (raw || "")
        .replace(/\r/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    if (text.includes("\n")) return text;

    return text
        .replace(/\b(Experience|Education|Skills|Projects|Licenses(?: &| and )certifications?)\b/gi, "\n$1\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function extractSection(text: string, heading: string, nextHeadings: string[]) {
    const lower = text.toLowerCase();
    const start = lower.indexOf(heading.toLowerCase());
    if (start === -1) return "";

    let end = text.length;
    for (const next of nextHeadings) {
        const idx = lower.indexOf(next.toLowerCase(), start + heading.length);
        if (idx !== -1 && idx < end) end = idx;
    }
    return text.slice(start + heading.length, end).trim();
}

function uniqueByKey<T>(items: T[], keyFn: (x: T) => string) {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const item of items) {
        const key = keyFn(item).toLowerCase().trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(item);
    }
    return out;
}

function parseEducationFromLinkedIn(rawText: string, headline: string) {
    const normalized = normalizeLinkedInText(rawText);
    const section = extractSection(normalized, "Education", ["Experience", "Skills", "Projects", "Licenses", "Certifications"]);
    const degreeRx = /\b(bachelor|master|mba|phd|b\.?s\.?|b\.?a\.?|m\.?s\.?|m\.?a\.?|associate|bootcamp|certificate)\b/i;
    const schoolRx = /\b(university|college|school|institute|academy)\b/i;

    const blocks = section
        ? section.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
        : [];

    const parsed = blocks.map((block) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        const schoolLine = lines.find((l) => schoolRx.test(l)) || lines[0] || "";
        const degreeLine = lines.find((l) => degreeRx.test(l)) || lines[1] || "";
        const years = (block.match(/((?:19|20)\d{2})\s*[-–]\s*((?:19|20)\d{2}|present)/i) || []);
        return {
            school: schoolLine,
            degree: degreeLine,
            startYear: years[1] || "",
            endYear: years[2] || "",
            gpa: "",
        };
    }).filter((e) => e.school || e.degree);

    if (parsed.length > 0) return uniqueByKey(parsed, (e) => `${e.school}|${e.degree}`);

    const studentAt = (headline || "").match(/\b(student|graduate)\s+at\s+([^|,]+)/i);
    if (studentAt?.[2]) {
        return [{
            school: studentAt[2].trim(),
            degree: studentAt[1].toLowerCase() === "graduate" ? "Graduate" : "Student",
            startYear: "",
            endYear: "",
            gpa: "",
        }];
    }

    return [];
}

function parseProjectsFromLinkedIn(rawText: string) {
    const normalized = normalizeLinkedInText(rawText);
    const section = extractSection(normalized, "Projects", ["Experience", "Education", "Skills", "Licenses", "Certifications"]);
    if (!section) return [];

    const blocks = section.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).slice(0, 4);
    return blocks.map((block) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        return {
            name: lines[0] || "LinkedIn Project",
            description: lines.slice(1, 3).join(" ").slice(0, 220),
            link: "",
            bullets: lines.slice(1, 4).filter((x) => x.length > 18).slice(0, 3),
            skills: [],
        };
    }).filter((p) => p.name);
}

function upsertCustomField(profile: any, label: string, value: string, source: "LinkedIn" | "Resume" | "Manual") {
    const cleanLabel = (label || "").trim();
    const cleanValue = (value || "").trim();
    if (!cleanLabel || !cleanValue) return;

    if (!Array.isArray(profile.customFields)) profile.customFields = [];
    const existing = profile.customFields.find((f: any) => (f.label || "").toLowerCase() === cleanLabel.toLowerCase());
    if (existing) {
        existing.value = cleanValue;
        existing.source = source;
        existing.updatedAt = new Date();
        return;
    }
    profile.customFields.push({
        id: `custom-${Date.now()}-${Math.random()}`,
        label: cleanLabel,
        value: cleanValue,
        source,
        updatedAt: new Date(),
    });
}

export async function OPTIONS() {
    return NextResponse.json({}, {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
    });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { profileUrl, name, headline, location, about, rawText } = body;

        if (!profileUrl) {
            return NextResponse.json(
                { error: "profileUrl is required" },
                { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
            );
        }

        const snapshot: LinkedInProfileSnapshot = {
            id: `li-${Date.now()}`,
            userId: "user-1",
            profileUrl,
            name: name || "",
            headline: headline || "",
            location: location || "",
            about: about || "",
            rawText: (rawText || "").slice(0, 20000),
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const blob = `${headline || ""} ${about || ""} ${rawText || ""}`.toLowerCase();
        const skillCandidates = [
            "python", "javascript", "typescript", "react", "next.js", "node.js", "sql", "aws", "azure", "gcp",
            "docker", "kubernetes", "java", "c++", "c#", "go", "terraform", "graphql", "rest", "machine learning",
            "data engineering", "snowflake", "dbt", "airflow", "pandas", "numpy", "tableau", "power bi", "figma",
        ];
        const inferredSkills = skillCandidates.filter((s) => blob.includes(s));

        const cleanHeadline = (headline || "").replace(/\s+/g, " ").trim();
        const roleAtCompany = cleanHeadline.match(/^(.+?)\s+at\s+(.+)$/i);
        const inferredTitle = roleAtCompany?.[1]?.trim() || "";
        const inferredCompany = roleAtCompany?.[2]?.trim() || "";
        const profileSummary = [headline || "", about || ""].filter(Boolean).join(" ").slice(0, 320);
        const inferredEducation = parseEducationFromLinkedIn(rawText || "", headline || "");
        const inferredProjects = parseProjectsFromLinkedIn(rawText || "");
        const normalizedLinkedIn = normalizeLinkedInText(rawText || "");
        const certifications = extractSection(normalizedLinkedIn, "Licenses", ["Experience", "Education", "Skills", "Projects", "Certifications"]);
            + "\n" + extractSection(normalizedLinkedIn, "Certifications", ["Experience", "Education", "Skills", "Projects", "Licenses"]);
        const languages = extractSection(normalizedLinkedIn, "Languages", ["Experience", "Education", "Skills", "Projects", "Licenses", "Certifications"]);

        await db.updateData((data) => {
            if (!data.linkedinProfiles) data.linkedinProfiles = [];
            data.linkedinProfiles.push(snapshot);

            data.profile.linkedin = profileUrl;
            if (location && !data.profile.location) data.profile.location = location;

            if (name && (!data.profile.contactInfo || !data.profile.contactInfo.includes(name))) {
                data.profile.contactInfo = [name, data.profile.contactInfo].filter(Boolean).join(" | ");
            }

            if (profileSummary) {
                data.profile.summary = profileSummary;
            }

            const existingSkillNames = new Set((data.profile.skills || []).map((s) => (s.name || "").toLowerCase()));
            for (const skillName of inferredSkills) {
                if (existingSkillNames.has(skillName)) continue;
                data.profile.skills.push({
                    id: `skill-${Date.now()}-${Math.random()}`,
                    name: skillName,
                    category: "Technical",
                });
                existingSkillNames.add(skillName);
            }

            if (inferredTitle) {
                const expKey = `${inferredTitle}|${inferredCompany || "LinkedIn"}`.toLowerCase();
                const existingExp = new Set((data.profile.experience || []).map((e) => `${e.title}|${e.company}`.toLowerCase()));
                if (!existingExp.has(expKey)) {
                    data.profile.experience.unshift({
                        id: `exp-${Date.now()}-${Math.random()}`,
                        title: inferredTitle,
                        company: inferredCompany || "LinkedIn",
                        location: location || "",
                        startDate: "",
                        endDate: "Present",
                        bullets: about ? [about.slice(0, 180)] : [],
                        skills: [],
                    });
                }
            }

            const existingEducation = new Set((data.profile.education || []).map((e) => `${e.school}|${e.degree}`.toLowerCase()));
            for (const edu of inferredEducation) {
                const eduKey = `${edu.school}|${edu.degree}`.toLowerCase();
                if (existingEducation.has(eduKey)) continue;
                data.profile.education.push({
                    id: `edu-${Date.now()}-${Math.random()}`,
                    school: edu.school,
                    degree: edu.degree,
                    startYear: edu.startYear || "",
                    endYear: edu.endYear || "",
                    gpa: edu.gpa || "",
                });
                existingEducation.add(eduKey);
            }

            const existingProjects = new Set((data.profile.projects || []).map((p) => (p.name || "").toLowerCase()));
            for (const project of inferredProjects) {
                const key = (project.name || "").toLowerCase();
                if (!key || existingProjects.has(key)) continue;
                data.profile.projects.push({
                    id: `proj-${Date.now()}-${Math.random()}`,
                    name: project.name,
                    description: project.description,
                    link: project.link,
                    bullets: project.bullets,
                    skills: project.skills,
                });
                existingProjects.add(key);
            }

            if ((certifications || "").trim()) {
                upsertCustomField(data.profile, "Certifications", certifications.replace(/\n{2,}/g, "\n").trim(), "LinkedIn");
            }
            if ((languages || "").trim()) {
                upsertCustomField(data.profile, "Languages", languages.trim(), "LinkedIn");
            }
        });

        revalidatePath("/profile");
        revalidatePath("/find-jobs");
        revalidatePath("/settings");

        return NextResponse.json(
            {
                success: true,
                synced: true,
                snapshotId: snapshot.id,
                updated: {
                    linkedin: true,
                    summary: Boolean(profileSummary),
                    inferredSkills: inferredSkills.length,
                    inferredExperience: Boolean(inferredTitle),
                    inferredEducation: inferredEducation.length,
                    inferredProjects: inferredProjects.length,
                },
            },
            { status: 201, headers: { "Access-Control-Allow-Origin": "*" } }
        );
    } catch (error) {
        console.error("Extension LinkedIn API Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
        );
    }
}
