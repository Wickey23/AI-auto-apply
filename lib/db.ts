import fs from 'fs/promises';
import path from 'path';
import { Application, Job, Profile, Resume, CoverLetterTemplate, AnswerBankItem, Contact, Interaction, TailoringOutput, Experience, Education, Project, Skill, LinkedInProfileSnapshot } from './types';
import { mockApplications, mockJobs, mockProfile, mockResumes } from './mock-data';

const DB_PATH = path.join(process.cwd(), 'data.json');

export interface DatabaseSchema {
    user: {
        id: string;
        email: string;
        name?: string;
    };
    profile: Profile;
    jobs: Job[];
    applications: Application[];
    resumes: Resume[];
    coverLetterTemplates: CoverLetterTemplate[];
    answerBank: AnswerBankItem[];
    contacts: Contact[];
    interactions: Interaction[];
    linkedinProfiles: LinkedInProfileSnapshot[];
    settings: {
        openaiApiKey?: string;
        geminiApiKey?: string;
        groqApiKey?: string;
        aiProvider?: "openai" | "gemini" | "groq";
        imapHost?: string;
        imapUser?: string;
        imapPassword?: string; // App Password
        preferredLocation?: string; // e.g. "New York, NY" or "Remote"
        gmailRefreshToken?: string;
        gmailAccessToken?: string;
        gmailAccessTokenExpiresAt?: number;
        gmailEmail?: string;
    };
    auditLogs: any[];
}

// Initial seed data with empty arrays for new sections if not present in mock
// We adapt the mockProfile to fit the new Profile interface
const initialProfile: Profile = {
    ...mockProfile,
    experience: [],
    education: [],
    projects: [],
    skills: (mockProfile.skills || []).map((s: string, i: number) => ({ id: `skill-${i}`, name: s })),
    contactInfo: mockProfile.contactInfo || "",
    linkedin: mockProfile.links?.LinkedIn,
    portfolio: mockProfile.links?.Portfolio,
    customFields: [],
};

const initialData: DatabaseSchema = {
    user: { id: 'user-1', email: 'user@example.com', name: 'User' },
    profile: initialProfile,
    jobs: mockJobs,
    applications: mockApplications,
    resumes: mockResumes as any, // Cast to any to bypass strict check during migration
    coverLetterTemplates: [],
    answerBank: [],
    contacts: [],
    interactions: [],
    linkedinProfiles: [],
    settings: {},
    auditLogs: []
};


async function readDb(): Promise<DatabaseSchema> {
    try {
        const data = await fs.readFile(DB_PATH, 'utf-8');
        const parsed = JSON.parse(data);
        let migrated = false;

        // Auto-migration: Ensure new fields exist if loading old data
        if (!parsed.profile.experience) parsed.profile.experience = [];
        if (!parsed.profile.education) parsed.profile.education = [];
        if (!parsed.profile.projects) parsed.profile.projects = [];
        if (!parsed.profile.customFields) parsed.profile.customFields = [];
        if (!parsed.coverLetterTemplates) parsed.coverLetterTemplates = [];
        if (!parsed.answerBank) parsed.answerBank = [];
        if (!parsed.contacts) parsed.contacts = [];
        if (!parsed.interactions) parsed.interactions = [];
        if (!parsed.linkedinProfiles) parsed.linkedinProfiles = [];
        if (!parsed.auditLogs) parsed.auditLogs = [];

        if (Array.isArray(parsed.resumes)) {
            parsed.resumes = parsed.resumes.map((resume: any) => {
                const content = String(resume?.content || "");
                const looksBinary =
                    content.includes("%PDF-") ||
                    content.includes("endstream") ||
                    content.includes("xref") ||
                    content.includes("/Type /Page");
                if (looksBinary) {
                    migrated = true;
                    return {
                        ...resume,
                        content: `Resume file uploaded (${resume?.name || "unknown"}). The original file is saved for download. Re-upload a text-readable resume for workshop editing.`,
                    };
                }
                return resume;
            });
        }

        if (migrated) {
            await writeDb(parsed);
        }

        return parsed;
    } catch (error) {
        // If file doesn't exist, create it with initial data
        await writeDb(initialData);
        return initialData;
    }
}

async function writeDb(data: DatabaseSchema): Promise<void> {
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
}

export const db = {
    async getData() {
        return readDb();
    },

    async updateData(updater: (data: DatabaseSchema) => void) {
        const data = await readDb();
        updater(data);
        await writeDb(data);
        return data;
    },

    // --- Getters ---
    async getApplications() {
        const data = await readDb();
        return data.applications;
    },

    async getJobs() {
        const data = await readDb();
        return data.jobs;
    },

    async getProfile() {
        const data = await readDb();
        return data.profile;
    },

    async getResumes() {
        const data = await readDb();
        return data.resumes;
    },

    async getCoverLetterTemplates() {
        const data = await readDb();
        return data.coverLetterTemplates;
    },

    async getAnswerBank() {
        const data = await readDb();
        return data.answerBank;
    },

    async getContacts() {
        const data = await readDb();
        return data.contacts;
    },

    async getInteractions() {
        const data = await readDb();
        return data.interactions;
    },

    async getLinkedInProfiles() {
        const data = await readDb();
        return data.linkedinProfiles;
    },

    // --- Mutators ---

    async addJob(job: Job) {
        return this.updateData((data) => {
            data.jobs.push(job);
        });
    },

    async addApplication(app: Application) {
        return this.updateData((data) => {
            data.applications.push(app);
        });
    },

    async updateApplication(id: string, updates: Partial<Application>) {
        return this.updateData((data) => {
            const index = data.applications.findIndex(a => a.id === id);
            if (index !== -1) {
                data.applications[index] = { ...data.applications[index], ...updates, updatedAt: new Date() };
            }
        });
    },

    async updateProfile(updates: Partial<Profile>) {
        return this.updateData((data) => {
            data.profile = { ...data.profile, ...updates };
        });
    }
};
