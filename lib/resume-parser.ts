type ParsedContact = {
    name: string;
    email: string;
    phone: string;
    linkedin: string;
    portfolio: string;
    location: string;
};

type ParsedExperience = {
    title: string;
    company: string;
    location: string;
    startDate: string;
    endDate: string;
    bullets: string[];
};

type ParsedEducation = {
    school: string;
    degree: string;
    startYear: string;
    endYear: string;
    gpa: string;
};

type ParsedSkill = {
    name: string;
    category: "Technical" | "Soft" | "Language" | "Tool";
};

type ParsedProject = {
    name: string;
    description: string;
    link: string;
    bullets: string[];
};

export type ParsedResume = {
    contact: ParsedContact;
    summary: string;
    experience: ParsedExperience[];
    education: ParsedEducation[];
    skills: ParsedSkill[];
    projects: ParsedProject[];
};

function normalizeText(input: string) {
    return (input || "")
        .replace(/\u0000/g, " ")
        .replace(/\r/g, "")
        .replace(/[^\x09\x0A\x20-\x7E]/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function isLikelyHeadingLine(line: string) {
    const t = (line || "").trim();
    if (!t || t.length > 64) return false;
    const cleaned = t.replace(/:$/, "");
    if (/^[A-Z][A-Za-z &/()-]{2,}$/.test(cleaned)) return true;
    if (cleaned === cleaned.toUpperCase() && /[A-Z]/.test(cleaned)) return true;
    return false;
}

function sectionSlice(text: string, headings: string[]) {
    const lines = text.split("\n");
    const lowered = lines.map((l) => l.trim().toLowerCase());
    const target = headings.map((h) => h.toLowerCase().trim());
    const headingSet = [
        "experience",
        "work experience",
        "professional experience",
        "education",
        "skills",
        "technical skills",
        "core skills",
        "projects",
        "personal projects",
        "summary",
        "profile",
        "about",
        "certifications",
        "languages",
        "awards",
    ];

    const start = lowered.findIndex((l) => {
        const clean = l.replace(/:$/, "");
        return target.some((h) => clean === h || clean.includes(h));
    });
    if (start === -1) return "";

    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
        const raw = lines[i].trim();
        const v = lowered[i].replace(/:$/, "");
        if (headingSet.some((h) => v === h || v.includes(h)) && isLikelyHeadingLine(raw)) {
            end = i;
            break;
        }
    }
    return lines.slice(start + 1, end).join("\n").trim();
}

function unique<T>(items: T[]) {
    return Array.from(new Set(items));
}

function toSkillCategory(name: string): "Technical" | "Soft" | "Language" | "Tool" {
    const v = name.toLowerCase();
    if (["python", "javascript", "typescript", "java", "c++", "c#", "go", "react", "node", "sql", "aws", "azure", "docker", "kubernetes"].some((k) => v.includes(k))) {
        return "Technical";
    }
    if (["excel", "jira", "figma", "tableau", "power bi", "postman", "git", "github", "notion"].some((k) => v.includes(k))) {
        return "Tool";
    }
    if (["english", "spanish", "french", "hindi", "urdu", "arabic", "german"].some((k) => v.includes(k))) {
        return "Language";
    }
    return "Soft";
}

function cleanUrl(url: string) {
    const v = (url || "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    if (/^www\./i.test(v)) return `https://${v}`;
    return v;
}

export function parseResumeLocally(rawText: string): ParsedResume {
    const text = normalizeText(rawText);
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const top = lines.slice(0, 40).join("\n");

    const email = (top.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [""])[0];
    const phone = (top.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/) || [""])[0];
    const linkedInMatch =
        top.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s)]+/i) ||
        top.match(/\b(?:www\.)?linkedin\.com\/[^\s)]+/i);
    const portfolioMatch =
        top.match(/https?:\/\/(?!.*linkedin\.com)[^\s)]+/i) ||
        top.match(/\b(?:www\.)?(?:github\.com|gitlab\.com|behance\.net|medium\.com)\/[^\s)]+/i);
    const locationMatch = top.match(/\b[A-Za-z .'-]+,\s*[A-Z]{2}\b|\bRemote\b/i);

    const firstLineNameCandidate = lines[0] || "";
    const name =
        firstLineNameCandidate &&
            !firstLineNameCandidate.includes("@") &&
            !/https?:\/\//i.test(firstLineNameCandidate) &&
            !/\d{3}/.test(firstLineNameCandidate) &&
            firstLineNameCandidate.split(/\s+/).length <= 5
            ? firstLineNameCandidate
            : "";

    const summarySection = sectionSlice(text, ["summary", "profile", "about"]);
    const summary = summarySection ? summarySection.split("\n").slice(0, 4).join(" ").trim() : "";

    const skillsSection = sectionSlice(text, ["skills", "technical skills", "core skills"]);
    const rawSkillTokens = (skillsSection || "")
        .replace(/[\u2022\u00b7]/g, "\n")
        .split(/[\n,;|/]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 1 && s.length < 40);
    const skillNames = unique(rawSkillTokens).slice(0, 40);
    const skills: ParsedSkill[] = skillNames.map((nameItem) => ({
        name: nameItem,
        category: toSkillCategory(nameItem),
    }));

    const expSection = sectionSlice(text, ["experience", "work experience", "professional experience"]);
    const expBlocks = expSection ? expSection.split(/\n\s*\n/) : [];
    const experience: ParsedExperience[] = expBlocks
        .map((block) => block.trim())
        .filter(Boolean)
        .slice(0, 8)
        .map((block) => {
            const bLines = block.split("\n").map((l) => l.trim()).filter(Boolean);
            const first = bLines[0] || "";
            const second = bLines[1] || "";
            const dateMatch = block.match(/((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+)?(?:19|20)\d{2})\s*(?:-|to|–)\s*(Present|Current|(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+)?(?:19|20)\d{2})/i);

            let title = first;
            let company = second;
            const splitFirst = first.split(/\s*\|\s*|\s+@\s+|\s+ at \s+|,\s+/i).map((x) => x.trim()).filter(Boolean);
            if (splitFirst.length >= 2) {
                title = splitFirst[0];
                company = splitFirst[1];
            }

            let bullets = bLines
                .filter((l) => /^[\u2022*\-]/.test(l))
                .map((l) => l.replace(/^[\u2022*\-]\s*/, ""))
                .slice(0, 8);
            if (!bullets.length) {
                bullets = bLines.slice(2).filter((l) => l.length > 25).slice(0, 6);
            }

            return {
                title,
                company,
                location: (block.match(/\b[A-Za-z .'-]+,\s*[A-Z]{2}\b/) || [""])[0],
                startDate: dateMatch?.[1] || "",
                endDate: dateMatch?.[2] || "",
                bullets,
            };
        })
        .filter((e) => e.title || e.company);

    const eduSection = sectionSlice(text, ["education"]);
    const eduBlocks = eduSection ? eduSection.split(/\n\s*\n/) : [];
    const education: ParsedEducation[] = eduBlocks
        .map((block) => block.trim())
        .filter(Boolean)
        .slice(0, 5)
        .map((block) => {
            const bLines = block.split("\n").map((l) => l.trim()).filter(Boolean);
            const years = block.match(/((?:19|20)\d{2})(?:\s*-\s*((?:19|20)\d{2}|Present))?/i);
            const gpa = (block.match(/GPA[:\s]*([0-4]\.\d{1,2})/i) || ["", ""])[1];
            const maybeDegreeLine = bLines.find((l) => /(b\.?s\.?|bachelor|m\.?s\.?|master|ph\.?d|doctor|mba|associate)/i.test(l)) || bLines[1] || "";
            return {
                school: bLines[0] || "",
                degree: maybeDegreeLine,
                startYear: years?.[1] || "",
                endYear: years?.[2] || "",
                gpa: gpa || "",
            };
        })
        .filter((e) => e.school || e.degree);

    const projectSection = sectionSlice(text, ["projects", "personal projects"]);
    const projectBlocks = projectSection ? projectSection.split(/\n\s*\n/) : [];
    const projects: ParsedProject[] = projectBlocks
        .map((block) => block.trim())
        .filter(Boolean)
        .slice(0, 8)
        .map((block) => {
            const bLines = block.split("\n").map((l) => l.trim()).filter(Boolean);
            const link = (block.match(/https?:\/\/[^\s)]+/i) || [""])[0];
            let bullets = bLines
                .filter((l) => /^[\u2022*\-]/.test(l))
                .map((l) => l.replace(/^[\u2022*\-]\s*/, ""))
                .slice(0, 8);
            if (!bullets.length) {
                bullets = bLines.slice(1).filter((l) => l.length > 20).slice(0, 4);
            }
            return {
                name: bLines[0] || "",
                description: (bLines.find((l) => !/^[\u2022*\-]/.test(l) && l !== bLines[0]) || bLines.slice(1, 3).join(" ")).trim(),
                link,
                bullets,
            };
        })
        .filter((p) => p.name);

    return {
        contact: {
            name,
            email,
            phone,
            linkedin: cleanUrl(linkedInMatch?.[0] || ""),
            portfolio: cleanUrl(portfolioMatch?.[0] || ""),
            location: locationMatch?.[0] || "",
        },
        summary,
        experience,
        education,
        skills,
        projects,
    };
}

