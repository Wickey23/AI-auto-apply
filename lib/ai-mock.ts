export async function generateTailoredContent(jobDescription: string, resumeContent: string) {
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    return {
        keywords: ["React", "TypeScript", "Next.js", "Tailwind CSS", "Agile"],
        missingKeywords: ["GraphQL", "AWS"],
        matchScore: 85,
        coverLetter: `Dear Hiring Manager,

I am writing to express my strong interest in this role. My experience with React and Next.js aligns perfectly with your requirements.

In my previous role, I built scalable web applications using TypeScript and Tailwind CSS, improving performance by 40%.

Thank you for considering my application.

Sincerely,
[Your Name]`,
        resumeBullets: [
            "Architected a scalable frontend using Next.js 14 and React Server Components.",
            "Implemented a robust design system with Tailwind CSS and Shadcn UI.",
            "Optimized Core Web Vitals resulting in a 30% increase in conversion."
        ]
    };
}
