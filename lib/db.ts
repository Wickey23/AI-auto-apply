import fs from "fs/promises";
import path from "path";
import { cookies } from "next/headers";
import {
    Application,
    AnswerBankItem,
    Contact,
    CoverLetterTemplate,
    Interaction,
    Job,
    LinkedInProfileSnapshot,
    Profile,
    Resume,
} from "./types";
import { mockApplications, mockJobs, mockProfile, mockResumes } from "./mock-data";

const DB_PATH = path.join(process.cwd(), "data.json");
const USER_COOKIE = "applypilot_uid";

type Settings = {
    openaiApiKey?: string;
    geminiApiKey?: string;
    groqApiKey?: string;
    aiProvider?: "local" | "openai" | "gemini" | "groq";
    imapHost?: string;
    imapUser?: string;
    imapPassword?: string;
    preferredLocation?: string;
    gmailRefreshToken?: string;
    gmailAccessToken?: string;
    gmailAccessTokenExpiresAt?: number;
    gmailEmail?: string;
    autoApplyEnabled?: boolean;
    autoApplyAutoSubmit?: boolean;
    autoApplyQueue?: Array<{
        id: string;
        applicationId: string;
        jobUrl: string;
        status: "pending" | "running" | "completed" | "failed" | "skipped";
        attempts: number;
        lastError?: string;
        createdAt: string;
        updatedAt: string;
    }>;
};

export type AuthUser = {
    id: string;
    email: string;
    name?: string;
    passwordHash: string;
    createdAt: Date;
    updatedAt: Date;
};

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
    settings: Settings;
    auditLogs: any[];
    authUsers?: AuthUser[];
    // Multi-user backing stores
    profilesByUser?: Record<string, Profile>;
    settingsByUser?: Record<string, Settings>;
}

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
    user: { id: "user-1", email: "user@example.com", name: "User" },
    profile: initialProfile,
    jobs: mockJobs,
    applications: mockApplications,
    resumes: mockResumes as any,
    coverLetterTemplates: [],
    answerBank: [],
    contacts: [],
    interactions: [],
    linkedinProfiles: [],
    settings: {},
    auditLogs: [],
    authUsers: [],
    profilesByUser: { "user-1": initialProfile },
    settingsByUser: { "user-1": {} },
};

let updateQueue: Promise<void> = Promise.resolve();

function cloneData<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}

function makeEmptyProfile(userId: string): Profile {
    return {
        id: `profile-${userId}`,
        userId,
        contactInfo: "",
        experience: [],
        education: [],
        projects: [],
        skills: [],
        customFields: [],
        summary: "",
    };
}

async function getCurrentUserId() {
    try {
        const store = await cookies();
        return store.get(USER_COOKIE)?.value || "user-1";
    } catch {
        return "user-1";
    }
}

function normalizeRecord<T>(value: unknown): Record<string, T> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as Record<string, T>;
}

async function writeDbAtomic(data: DatabaseSchema): Promise<void> {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    const tmpPath = `${DB_PATH}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    await fs.rename(tmpPath, DB_PATH);
}

function migrateParsed(parsed: any): DatabaseSchema {
    const out = parsed as DatabaseSchema;
    let migrated = false;

    if (!out.profile?.experience) out.profile = { ...(out.profile || initialProfile), experience: [] as any };
    if (!out.profile?.education) out.profile.education = [];
    if (!out.profile?.projects) out.profile.projects = [];
    if (!out.profile?.skills) out.profile.skills = [];
    if (!out.profile?.customFields) out.profile.customFields = [];
    if (!out.coverLetterTemplates) out.coverLetterTemplates = [];
    if (!out.answerBank) out.answerBank = [];
    if (!out.contacts) out.contacts = [];
    if (!out.interactions) out.interactions = [];
    if (!out.linkedinProfiles) out.linkedinProfiles = [];
    if (!out.auditLogs) out.auditLogs = [];
    if (!out.settings) out.settings = {};
    if (!out.authUsers) out.authUsers = [];

    const profilesByUser = normalizeRecord<Profile>(out.profilesByUser);
    if (!profilesByUser["user-1"] && out.profile) {
        profilesByUser["user-1"] = out.profile;
        migrated = true;
    }
    if (!out.profilesByUser) migrated = true;
    out.profilesByUser = profilesByUser;

    const settingsByUser = normalizeRecord<Settings>(out.settingsByUser);
    if (!settingsByUser["user-1"] && out.settings) {
        settingsByUser["user-1"] = out.settings;
        migrated = true;
    }
    if (!out.settingsByUser) migrated = true;
    out.settingsByUser = settingsByUser;

    if (Array.isArray(out.resumes)) {
        out.resumes = out.resumes.map((resume: any) => {
            const content = String(resume?.content || "");
            const looksBinary =
                content.includes("%PDF-") ||
                content.includes("endstream") ||
                content.includes("xref") ||
                content.includes("/Type /Page");
            if (!resume.userId) {
                resume.userId = "user-1";
                migrated = true;
            }
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

    for (const collection of ["jobs", "applications", "coverLetterTemplates", "answerBank", "contacts", "linkedinProfiles"] as const) {
        const arr = (out as any)[collection];
        if (Array.isArray(arr)) {
            for (const item of arr) {
                if (item && !item.userId) {
                    item.userId = "user-1";
                    migrated = true;
                }
            }
        }
    }

    if (migrated) {
        // fire and forget; caller does not need to block read path.
        void writeDbAtomic(out).catch((error) => {
            console.error("Background DB migration write failed:", error);
        });
    }
    return out;
}

async function readDb(): Promise<DatabaseSchema> {
    try {
        const raw = await fs.readFile(DB_PATH, "utf-8");
        return migrateParsed(JSON.parse(raw));
    } catch {
        // Do not write during read path; build-time parallel prerender workers can race.
        // First real write will create the file.
        return cloneData(initialData);
    }
}

function buildScopedData(raw: DatabaseSchema, userId: string): DatabaseSchema {
    const profile = raw.profilesByUser?.[userId] || makeEmptyProfile(userId);
    const settings = raw.settingsByUser?.[userId] || {};
    return {
        ...raw,
        user: {
            id: userId,
            email: `${userId}@applypilot.local`,
            name: raw.user?.name || "User",
        },
        profile,
        settings,
        jobs: (raw.jobs || []).filter((x) => x.userId === userId),
        applications: (raw.applications || []).filter((x) => x.userId === userId),
        resumes: (raw.resumes || []).filter((x) => x.userId === userId),
        coverLetterTemplates: (raw.coverLetterTemplates || []).filter((x: any) => x.userId === userId),
        answerBank: (raw.answerBank || []).filter((x: any) => x.userId === userId),
        contacts: (raw.contacts || []).filter((x: any) => x.userId === userId),
        interactions: (raw.interactions || []).filter((x: any) => {
            const contactIds = new Set((raw.contacts || []).filter((c: any) => c.userId === userId).map((c: any) => c.id));
            return contactIds.has(x.contactId);
        }),
        linkedinProfiles: (raw.linkedinProfiles || []).filter((x: any) => x.userId === userId),
    };
}

function mergeScopedBack(raw: DatabaseSchema, scoped: DatabaseSchema, userId: string): DatabaseSchema {
    const next = { ...raw };
    next.profilesByUser = { ...(raw.profilesByUser || {}), [userId]: { ...scoped.profile, userId } };
    next.settingsByUser = { ...(raw.settingsByUser || {}), [userId]: { ...scoped.settings } };
    next.profile = next.profilesByUser[userId];
    next.settings = next.settingsByUser[userId];

    const mergeCollection = <T extends { userId?: string }>(base: T[], userItems: T[]) => {
        const others = base.filter((x) => x.userId !== userId);
        const normalized = userItems.map((x) => ({ ...x, userId })) as T[];
        return [...others, ...normalized];
    };

    next.jobs = mergeCollection(raw.jobs || [], scoped.jobs || []);
    next.applications = mergeCollection(raw.applications || [], scoped.applications || []);
    next.resumes = mergeCollection(raw.resumes || [], scoped.resumes || []);
    next.coverLetterTemplates = mergeCollection(raw.coverLetterTemplates || [], scoped.coverLetterTemplates || []);
    next.answerBank = mergeCollection(raw.answerBank || [], scoped.answerBank || []);
    next.contacts = mergeCollection(raw.contacts || [], scoped.contacts || []);
    next.linkedinProfiles = mergeCollection(raw.linkedinProfiles || [], scoped.linkedinProfiles || []);

    // Interactions are keyed by contact IDs, keep ones for contacts owned by user.
    const userContactIds = new Set((scoped.contacts || []).map((c) => c.id));
    const otherInteractions = (raw.interactions || []).filter((i) => !userContactIds.has(i.contactId));
    next.interactions = [...otherInteractions, ...(scoped.interactions || [])];

    return next;
}

async function queuedUpdate<T>(fn: () => Promise<T>): Promise<T> {
    const prev = updateQueue;
    let release: () => void = () => { };
    updateQueue = new Promise<void>((resolve) => {
        release = resolve;
    });
    await prev;
    try {
        return await fn();
    } finally {
        release();
    }
}

export const db = {
    async getDataForUser(userId: string) {
        const raw = await readDb();
        return buildScopedData(raw, userId);
    },

    async getData() {
        const userId = await getCurrentUserId();
        return this.getDataForUser(userId);
    },

    async updateDataForUser(userId: string, updater: (data: DatabaseSchema) => void) {
        return queuedUpdate(async () => {
            const raw = await readDb();
            const scoped = buildScopedData(raw, userId);
            updater(scoped);
            const merged = mergeScopedBack(raw, scoped, userId);
            await writeDbAtomic(merged);
            return buildScopedData(merged, userId);
        });
    },

    async updateData(updater: (data: DatabaseSchema) => void) {
        const userId = await getCurrentUserId();
        return this.updateDataForUser(userId, updater);
    },

    async getApplications() {
        const data = await this.getData();
        return data.applications;
    },

    async getJobs() {
        const data = await this.getData();
        return data.jobs;
    },

    async getProfile() {
        const data = await this.getData();
        return data.profile;
    },

    async getResumes() {
        const data = await this.getData();
        return data.resumes;
    },

    async getCoverLetterTemplates() {
        const data = await this.getData();
        return data.coverLetterTemplates;
    },

    async getAnswerBank() {
        const data = await this.getData();
        return data.answerBank;
    },

    async getContacts() {
        const data = await this.getData();
        return data.contacts;
    },

    async getInteractions() {
        const data = await this.getData();
        return data.interactions;
    },

    async getLinkedInProfiles() {
        const data = await this.getData();
        return data.linkedinProfiles;
    },

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
            const index = data.applications.findIndex((a) => a.id === id);
            if (index !== -1) {
                data.applications[index] = { ...data.applications[index], ...updates, updatedAt: new Date() };
            }
        });
    },

    async updateProfile(updates: Partial<Profile>) {
        return this.updateData((data) => {
            data.profile = { ...data.profile, ...updates };
        });
    },

    async getAuthUserByEmail(email: string) {
        const raw = await readDb();
        return (raw.authUsers || []).find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
    },

    async getAuthUserById(id: string) {
        const raw = await readDb();
        return (raw.authUsers || []).find((u) => u.id === id) || null;
    },

    async createAuthUser(user: AuthUser) {
        return queuedUpdate(async () => {
            const raw = await readDb();
            const exists = (raw.authUsers || []).some((u) => u.email.toLowerCase() === user.email.toLowerCase());
            if (exists) {
                throw new Error("An account with this email already exists.");
            }
            raw.authUsers = [...(raw.authUsers || []), user];
            await writeDbAtomic(raw);
            return user;
        });
    },

    async updateAuthUserPassword(userId: string, passwordHash: string) {
        return queuedUpdate(async () => {
            const raw = await readDb();
            const idx = (raw.authUsers || []).findIndex((u) => u.id === userId);
            if (idx === -1) {
                throw new Error("User not found.");
            }
            raw.authUsers![idx] = {
                ...raw.authUsers![idx],
                passwordHash,
                updatedAt: new Date(),
            };
            await writeDbAtomic(raw);
            return raw.authUsers![idx];
        });
    },

    async getAdminOverview() {
        const raw = await readDb();
        const users = raw.authUsers || [];
        const logs = Array.isArray(raw.auditLogs) ? raw.auditLogs : [];
        return users.map((u) => {
            const userId = u.id;
            const userLogs = logs.filter((l: any) => String(l.userId || "") === userId);
            const lastActiveAt = userLogs.length ? userLogs[0]?.timestamp : null;
            return {
                id: userId,
                email: u.email,
                name: u.name || "",
                createdAt: u.createdAt,
                updatedAt: u.updatedAt,
                lastActiveAt,
                stats: {
                    resumes: (raw.resumes || []).filter((x) => x.userId === userId).length,
                    jobs: (raw.jobs || []).filter((x) => x.userId === userId).length,
                    applications: (raw.applications || []).filter((x) => x.userId === userId).length,
                    contacts: (raw.contacts || []).filter((x: any) => x.userId === userId).length,
                    linkedinProfiles: (raw.linkedinProfiles || []).filter((x: any) => x.userId === userId).length,
                },
            };
        });
    },

    async getAdminAuditLogs(limit = 200) {
        const raw = await readDb();
        const logs = Array.isArray(raw.auditLogs) ? raw.auditLogs : [];
        return logs
            .slice(0, limit)
            .map((log: any) => ({
                id: String(log.id || `log-${Date.now()}`),
                action: String(log.action || "UNKNOWN"),
                details: String(log.details || ""),
                timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
                userId: String(log.userId || "unknown"),
            }));
    },

    async adminClearUserData(userId: string) {
        return queuedUpdate(async () => {
            const raw = await readDb();
            const userContactIds = new Set((raw.contacts || []).filter((c: any) => c.userId === userId).map((c: any) => c.id));
            raw.jobs = (raw.jobs || []).filter((x) => x.userId !== userId);
            raw.applications = (raw.applications || []).filter((x) => x.userId !== userId);
            raw.resumes = (raw.resumes || []).filter((x) => x.userId !== userId);
            raw.coverLetterTemplates = (raw.coverLetterTemplates || []).filter((x: any) => x.userId !== userId);
            raw.answerBank = (raw.answerBank || []).filter((x: any) => x.userId !== userId);
            raw.contacts = (raw.contacts || []).filter((x: any) => x.userId !== userId);
            raw.linkedinProfiles = (raw.linkedinProfiles || []).filter((x: any) => x.userId !== userId);
            raw.interactions = (raw.interactions || []).filter((i: any) => !userContactIds.has(i.contactId));

            raw.profilesByUser = { ...(raw.profilesByUser || {}), [userId]: makeEmptyProfile(userId) };
            raw.settingsByUser = { ...(raw.settingsByUser || {}), [userId]: {} };
            await writeDbAtomic(raw);
            return true;
        });
    },

    async adminDeleteUser(userId: string) {
        return queuedUpdate(async () => {
            const raw = await readDb();
            const contactIds = new Set((raw.contacts || []).filter((c: any) => c.userId === userId).map((c: any) => c.id));
            raw.authUsers = (raw.authUsers || []).filter((u) => u.id !== userId);
            raw.jobs = (raw.jobs || []).filter((x) => x.userId !== userId);
            raw.applications = (raw.applications || []).filter((x) => x.userId !== userId);
            raw.resumes = (raw.resumes || []).filter((x) => x.userId !== userId);
            raw.coverLetterTemplates = (raw.coverLetterTemplates || []).filter((x: any) => x.userId !== userId);
            raw.answerBank = (raw.answerBank || []).filter((x: any) => x.userId !== userId);
            raw.contacts = (raw.contacts || []).filter((x: any) => x.userId !== userId);
            raw.linkedinProfiles = (raw.linkedinProfiles || []).filter((x: any) => x.userId !== userId);
            raw.auditLogs = (raw.auditLogs || []).filter((x: any) => x.userId !== userId);
            raw.interactions = (raw.interactions || []).filter((i: any) => !contactIds.has(i.contactId));

            if (raw.profilesByUser) delete raw.profilesByUser[userId];
            if (raw.settingsByUser) delete raw.settingsByUser[userId];
            await writeDbAtomic(raw);
            return true;
        });
    },
};
