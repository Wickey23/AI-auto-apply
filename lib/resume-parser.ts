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

function sectionSlice(text: string, headings: string[]) {
    const lines = text.split("\n");
    const lowered = lines.map((l) => l.trim().toLowerCase());
    const target = headings.map((h) => h.toLowerCase());

    const start = lowered.findIndex((l) => target.includes(l.replace(/:$/, "")));
    if (start === -1) return "";

    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
        const v = lowered[i].replace(/:$/, "");
        if (["experience", "work experience", "education", "skills", "projects", "summary", "profile", "about"].includes(v)) {
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

export function parseResumeLocally(rawText: string): ParsedResume {
    const text = normalizeText(rawText);
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const top = lines.slice(0, 25).join("\n");

    const email = (top.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [""])[0];
    const phone = (top.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/) || [""])[0];
    const linkedInMatch = top.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s)]+/i);
    const portfolioMatch = top.match(/https?:\/\/(?!.*linkedin\.com)[^\s)]+/i);
    const locationMatch = top.match(/\b[A-Za-z .'-]+,\s*[A-Z]{2}\b/);

    const firstLineNameCandidate = lines[0] || "";
    const name =
        firstLineNameCandidate &&
            !firstLineNameCandidate.includes("@") &&
            !/https?:\/\//i.test(firstLineNameCandidate) &&
            !/\d{3}/.test(firstLineNameCandidate)
            ? firstLineNameCandidate
            : "";

    const summarySection = sectionSlice(text, ["summary", "profile", "about"]);
    const summary = summarySection ? summarySection.split("\n").slice(0, 3).join(" ").trim() : "";

    const skillsSection = sectionSlice(text, ["skills", "technical skills", "core skills"]);
    const rawSkillTokens = (skillsSection || "")
        .split(/[\n,|•\-]+/)
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
            const dateMatch = block.match(/((?:19|20)\d{2}(?:[-/](?:0?[1-9]|1[0-2]))?)\s*(?:-|to)\s*(Present|Current|(?:19|20)\d{2}(?:[-/](?:0?[1-9]|1[0-2]))?)/i);
            const bullets = bLines.filter((l) => /^[•*-]/.test(l)).map((l) => l.replace(/^[•*-]\s*/, "")).slice(0, 8);
            return {
                title: first,
                company: second,
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
            return {
                school: bLines[0] || "",
                degree: bLines[1] || "",
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
            const bullets = bLines.filter((l) => /^[•*-]/.test(l)).map((l) => l.replace(/^[•*-]\s*/, "")).slice(0, 8);
            return {
                name: bLines[0] || "",
                description: bLines.slice(1, 3).join(" "),
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
            linkedin: linkedInMatch?.[0] || "",
            portfolio: portfolioMatch?.[0] || "",
            location: locationMatch?.[0] || "",
        },
        summary,
        experience,
        education,
        skills,
        projects,
    };
}
