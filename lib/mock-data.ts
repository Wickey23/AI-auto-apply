import { Application, Job, Profile, Resume } from "./types";

export const MOCK_USER_ID = "user-1";

export const mockProfile: any = {
    id: "profile-1",
    userId: MOCK_USER_ID,
    contactInfo: "Sameer\nsameer@example.com",
    skills: ["React", "Next.js", "TypeScript", "Node.js", "Prisma"],
    links: { "LinkedIn": "https://linkedin.com/in/sameer", "Portfolio": "https://sameer.dev" }
};

export const mockResumes: any[] = [
    {
        id: "resume-1",
        userId: MOCK_USER_ID,
        name: "Software Engineer Resume v1",
        content: "Experienced Software Engineer...",
        version: 1,
        isLocked: false,
        createdAt: new Date()
    }
];

export const mockJobs: any[] = [
    {
        id: "job-1",
        userId: MOCK_USER_ID,
        company: "TechCorp",
        title: "Senior Frontend Engineer",
        location: "Remote",
        description: "We are looking for a React expert...",
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: "job-2",
        userId: MOCK_USER_ID,
        company: "StartupInc",
        title: "Full Stack Developer",
        location: "New York, NY",
        description: "Join our fast-paced team...",
        createdAt: new Date(),
        updatedAt: new Date()
    }
];

export const mockApplications: any[] = [
    {
        id: "app-1",
        userId: MOCK_USER_ID,
        jobId: "job-1",
        job: mockJobs[0],
        status: "INTERESTED",
        checklist: { research: false, tailor: false, prepButtons: false, review: false, submitted: false },
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: "app-2",
        userId: MOCK_USER_ID,
        jobId: "job-2",
        job: mockJobs[1],
        status: "APPLIED",
        resume: mockResumes[0],
        checklist: { research: true, tailor: true, prepButtons: true, review: true, submitted: true },
        createdAt: new Date(),
        updatedAt: new Date()
    }
];

export async function getApplications(): Promise<Application[]> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockApplications;
}

export async function getStats() {
    return {
        total: mockApplications.length,
        interested: mockApplications.filter(a => a.status === "INTERESTED").length,
        applied: mockApplications.filter(a => a.status === "APPLIED").length,
        interviews: mockApplications.filter(a => a.status === "INTERVIEW").length,
        offers: mockApplications.filter(a => a.status === "OFFER").length,
    }
}
