import imap from "imap-simple";
import { simpleParser } from "mailparser";
import { db } from "./db";
import { analyzeEmailContent } from "./ai";
import { Application, ApplicationStatus, Job } from "./types";

const HISTORY_DAYS = 365;
const RECENT_DAYS = 14;
const MAX_GMAIL_RESULTS = 200;

type EmailMessage = {
    subject: string;
    from: string;
    body: string;
    receivedAt?: Date;
};

type ImportCandidate = {
    company: string;
    title: string;
    link?: string;
    status: ApplicationStatus;
    receivedAt: Date;
    description: string;
};

type ScanMode = "recent" | "history";

function decodeBase64Url(input?: string) {
    if (!input) return "";
    const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
    try {
        return Buffer.from(b64, "base64").toString("utf-8");
    } catch {
        return "";
    }
}

function stripHtml(html: string) {
    return (html || "")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTextFromPayload(payload: any): string {
    if (!payload) return "";
    if (payload.body?.data && payload.mimeType?.startsWith("text/plain")) {
        return decodeBase64Url(payload.body.data);
    }
    if (payload.body?.data && payload.mimeType?.startsWith("text/html")) {
        return stripHtml(decodeBase64Url(payload.body.data));
    }
    const parts = payload.parts || [];
    const collected: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const part of parts as any[]) {
        const found = extractTextFromPayload(part);
        if (found) collected.push(found);
    }
    return collected.join("\n").trim();
}

function companyMentioned(haystack: string, companyName: string) {
    const hay = (haystack || "").toLowerCase();
    const company = (companyName || "").toLowerCase().trim();
    if (!company) return false;
    if (hay.includes(company)) return true;

    const tokens = company
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3)
        .filter((t) => !["inc", "llc", "ltd", "corp", "company", "technologies"].includes(t));
    if (!tokens.length) return false;

    const matched = tokens.filter((t) => hay.includes(t)).length;
    return matched >= Math.min(2, tokens.length);
}

function toImapSinceDate(date: Date) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = String(date.getDate()).padStart(2, "0");
    const month = months[date.getMonth()];
    const year = String(date.getFullYear());
    return `${day}-${month}-${year}`;
}

function normalizeKey(v: string) {
    return (v || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function cleanCompanyName(input: string) {
    return (input || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\b(careers?|jobs?|talent|team|recruiting|hr|hiring)\b/gi, " ")
        .replace(/\b(inc|llc|ltd|corp|co|company)\.?$/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function extractCompanyFromFromHeader(from: string) {
    const display = (from || "").split("<")[0].replace(/["']/g, "").trim();
    const cleanedDisplay = cleanCompanyName(display);
    if (cleanedDisplay && cleanedDisplay.length >= 2 && !/@/.test(cleanedDisplay)) {
        return cleanedDisplay;
    }

    const emailMatch = (from || "").match(/<([^>]+)>|([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
    const email = (emailMatch?.[1] || emailMatch?.[2] || "").toLowerCase();
    if (!email.includes("@")) return "";

    const domain = email.split("@")[1] || "";
    const secondLevel = domain.split(".")[0] || "";
    if (!secondLevel) return "";
    if (["gmail", "outlook", "yahoo", "hotmail", "googlemail", "icloud", "protonmail", "aol"].includes(secondLevel)) {
        return "";
    }
    return cleanCompanyName(secondLevel.replace(/[-_]/g, " "));
}

function extractCompanyFromSubject(subject: string) {
    const s = subject || "";
    const patterns = [
        /\bat\s+([A-Z][\w& .'-]{1,60})$/i,
        /\bfrom\s+([A-Z][\w& .'-]{1,60})$/i,
        /\bwith\s+([A-Z][\w& .'-]{1,60})$/i,
    ];
    for (const p of patterns) {
        const m = s.match(p);
        if (m?.[1]) {
            const cleaned = cleanCompanyName(m[1]);
            if (cleaned) return cleaned;
        }
    }
    return "";
}

function extractRoleFromSubject(subject: string) {
    const s = (subject || "").replace(/\s+/g, " ").trim();
    const patterns = [
        /\bapplication\s+(?:for|to)\s+(.+?)(?:\s+at\s+.+)?$/i,
        /\byour application (?:for|to)\s+(.+?)(?:\s+at\s+.+)?$/i,
        /\binterview\s+(?:for|with)\s+(.+?)(?:\s+at\s+.+)?$/i,
        /\b(?:position|role|job)\s*[:\-]\s*(.+)$/i,
    ];
    for (const p of patterns) {
        const m = s.match(p);
        if (m?.[1]) {
            const cleaned = m[1]
                .replace(/\b(application|interview|update|confirmation|receipt)\b/gi, " ")
                .replace(/\s+/g, " ")
                .trim();
            if (cleaned.length >= 3 && cleaned.length <= 100) return cleaned;
        }
    }
    return "";
}

function extractJobUrl(text: string) {
    const urls = (text.match(/https?:\/\/[^\s<>"')]+/g) || []).slice(0, 20);
    const preferred = urls.find((u) => /(jobs?|careers?|greenhouse|lever|workday|myworkdayjobs|ashby)/i.test(u));
    return preferred || urls[0] || "";
}

function isLikelyCorporateSender(from: string) {
    const emailMatch = (from || "").match(/<([^>]+)>|([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
    const email = (emailMatch?.[1] || emailMatch?.[2] || "").toLowerCase();
    if (!email.includes("@")) return false;
    const domain = email.split("@")[1] || "";
    if (!domain) return false;
    return !/(gmail\.com|outlook\.com|hotmail\.com|yahoo\.com|icloud\.com|aol\.com|protonmail\.com)$/i.test(domain);
}

function getApplicationImportConfidence(subject: string, body: string, from: string) {
    const text = `${subject} ${body}`.toLowerCase();
    const sender = (from || "").toLowerCase();
    let score = 0;

    if (/\b(thank you for applying|thanks for applying|application received|application submitted|we received your application|your application has been received|application confirmation)\b/.test(text)) {
        score += 5;
    }
    if (/\b(candidate portal|applicant portal|submission confirmation|application id|candidate profile)\b/.test(text)) {
        score += 3;
    }
    if (/\b(position|role|job)\b/.test(text) && /\bappl(y|ied|ication)\b/.test(text)) {
        score += 2;
    }
    if (/\b(noreply|no-reply|recruit|recruiting|talent|careers?|greenhouse|lever|workday|myworkdayjobs|icims|jobvite)\b/.test(sender + " " + text)) {
        score += 2;
    }
    if (/\b(do not reply|this is an automated message)\b/.test(text)) {
        score += 1;
    }
    if (isLikelyCorporateSender(from)) {
        score += 1;
    }

    // Common false positives that are not proof the user already applied.
    if (/\b(invite you to apply|recommended jobs?|job alert|new jobs? for you|unsubscribe)\b/.test(text)) {
        score -= 4;
    }

    return score >= 5;
}

function mapAiStatusToApplicationStatus(status: string | null): ApplicationStatus | null {
    if (!status) return null;
    if (["REJECTED", "OFFER", "ONSITE", "TECHNICAL", "RECRUITER_SCREEN", "APPLIED"].includes(status)) {
        return status as ApplicationStatus;
    }
    return null;
}

function buildImportCandidate(message: EmailMessage, inferredStatus: ApplicationStatus | null): ImportCandidate | null {
    const subject = message.subject || "";
    const from = message.from || "";
    const body = message.body || "";
    const strongApplicationSignal = getApplicationImportConfidence(subject, body, from);
    if (!strongApplicationSignal) return null;

    const company = cleanCompanyName(extractCompanyFromSubject(subject) || extractCompanyFromFromHeader(from));
    if (!company) return null;

    const role = extractRoleFromSubject(subject) || "Previously Applied Role";
    const link = extractJobUrl(body) || undefined;
    const receivedAt = message.receivedAt && !Number.isNaN(message.receivedAt.getTime()) ? message.receivedAt : new Date();
    const description = `${subject}\n\n${body}`.slice(0, 1800);

    return {
        company,
        title: role,
        link,
        status: inferredStatus || "APPLIED",
        receivedAt,
        description,
    };
}

async function applyEmailScan(messages: EmailMessage[], source: "gmail-api" | "imap", mode: ScanMode) {
    const scoped = await db.getData();
    const applications = scoped.applications || [];
    const updates = new Map<string, ApplicationStatus>();
    const importCandidates: ImportCandidate[] = [];

    const activeApps = applications.filter((app) => !["REJECTED", "OFFER", "WITHDRAWN"].includes(app.status));

    for (const message of messages) {
        const subject = message.subject || "";
        const from = message.from || "";
        const body = message.body || "";
        if (!subject && !body) continue;

        const hay = `${subject} ${body} ${from}`.toLowerCase();
        const ai = await analyzeEmailContent(body, subject);
        const nextStatus = mapAiStatusToApplicationStatus(ai.status);

        for (const app of activeApps) {
            const companyName = app.job.company || "";
            if (!companyMentioned(hay, companyName)) continue;
            if (nextStatus && app.status !== nextStatus) {
                updates.set(app.id, nextStatus);
            }
        }

        const candidate = buildImportCandidate(message, nextStatus);
        if (candidate && mode === "history") {
            importCandidates.push(candidate);
        }
    }

    let importedJobs = 0;
    let importedApplications = 0;

    await db.updateData((data) => {
        const userId = data.user.id;
        const existingApplications = data.applications || [];
        const existingJobs = data.jobs || [];

        const existingKeys = new Set<string>();
        for (const app of existingApplications) {
            const company = normalizeKey(app.job.company || "");
            const title = normalizeKey(app.job.title || "");
            if (company && title) existingKeys.add(`${company}|${title}`);
            if (company) existingKeys.add(`${company}|`);
        }

        for (const app of existingApplications) {
            const next = updates.get(app.id);
            if (next && app.status !== next) {
                app.status = next;
                app.updatedAt = new Date();
            }
        }

        for (const candidate of importCandidates) {
            const companyKey = normalizeKey(candidate.company);
            const titleKey = normalizeKey(candidate.title);
            if (!companyKey) continue;

            const exactKey = `${companyKey}|${titleKey}`;
            const looseKey = `${companyKey}|`;
            if (existingKeys.has(exactKey) || existingKeys.has(looseKey)) continue;

            const createdAt = candidate.receivedAt || new Date();
            const newJob: Job = {
                id: `job-email-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                userId,
                company: candidate.company,
                title: candidate.title,
                link: candidate.link || null,
                description: candidate.description || "Imported from email history.",
                source: "Email Import",
                priorityScore: 40,
                createdAt,
                updatedAt: createdAt,
            };

            const newApp: Application = {
                id: `app-email-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                userId,
                jobId: newJob.id,
                job: newJob,
                status: candidate.status,
                checklist: {
                    research: false,
                    tailor: false,
                    prepButtons: false,
                    review: false,
                    submitted: candidate.status !== "APPLIED",
                },
                notes: "Imported from historical email scan.",
                createdAt,
                updatedAt: createdAt,
            };

            existingJobs.push(newJob);
            existingApplications.push(newApp);
            existingKeys.add(exactKey);
            existingKeys.add(looseKey);
            importedJobs += 1;
            importedApplications += 1;
        }
    });

    return {
        success: true,
        source,
        scanned: messages.length,
        updates: updates.size,
        importedJobs,
        importedApplications,
        queued: importedApplications,
    };
}

async function getValidGmailAccessToken() {
    const data = await db.getData();
    const refreshToken = data.settings.gmailRefreshToken;
    const accessToken = data.settings.gmailAccessToken;
    const expiresAt = data.settings.gmailAccessTokenExpiresAt || 0;

    if (!refreshToken) return null;
    if (accessToken && Date.now() < expiresAt - 60_000) return accessToken;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error("Gmail is connected but GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET are missing.");
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
        }),
    });
    if (!tokenRes.ok) throw new Error("Failed to refresh Gmail access token.");

    const tokens = await tokenRes.json();
    const nextAccess = tokens.access_token as string;
    const expiresIn = Number(tokens.expires_in || 3600);

    await db.updateData((d) => {
        d.settings.gmailAccessToken = nextAccess;
        d.settings.gmailAccessTokenExpiresAt = Date.now() + expiresIn * 1000;
    });

    return nextAccess;
}

async function checkEmailsViaGmailApi(mode: ScanMode) {
    const accessToken = await getValidGmailAccessToken();
    if (!accessToken) return null;

    const days = mode === "history" ? HISTORY_DAYS : RECENT_DAYS;
    const maxResults = mode === "history" ? MAX_GMAIL_RESULTS : 80;
    const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=newer_than:${days}d&maxResults=${maxResults}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!listRes.ok) {
        throw new Error("Gmail API request failed. Reconnect Gmail in Settings.");
    }

    const listData = await listRes.json();
    const messages: Array<{ id: string }> = listData.messages || [];
    const parsedMessages: EmailMessage[] = [];

    for (const msg of messages) {
        const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!msgRes.ok) continue;
        const full = await msgRes.json();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const headers: Array<{ name: string; value: string }> = full.payload?.headers || [];
        const subject = headers.find((h) => h.name.toLowerCase() === "subject")?.value || "";
        const from = headers.find((h) => h.name.toLowerCase() === "from")?.value || "";
        const dateValue = headers.find((h) => h.name.toLowerCase() === "date")?.value || "";
        const receivedAt = dateValue ? new Date(dateValue) : undefined;
        const body = extractTextFromPayload(full.payload) || full.snippet || "";
        if (!subject && !body) continue;
        parsedMessages.push({ subject, from, body, receivedAt });
    }

    return applyEmailScan(parsedMessages, "gmail-api", mode);
}

export async function checkEmailsForUpdates(options?: { mode?: ScanMode }) {
    const mode: ScanMode = options?.mode === "history" ? "history" : "recent";

    const gmailResult = await checkEmailsViaGmailApi(mode);
    if (gmailResult) return gmailResult;

    const data = await db.getData();
    const imapUser = (data.settings.imapUser || "").trim();
    const imapPassword = (data.settings.imapPassword || "").replace(/\s+/g, "").trim();
    const imapHost = (data.settings.imapHost || "imap.gmail.com").trim().toLowerCase();

    if (!imapUser || !imapPassword) {
        throw new Error("Email credentials not configured");
    }

    const config = {
        imap: {
            user: imapUser,
            password: imapPassword,
            host: imapHost,
            port: 993,
            tls: true,
            authTimeout: 15000,
            connTimeout: 15000,
            socketTimeout: 60000,
            tlsOptions: {
                servername: imapHost,
                rejectUnauthorized: true,
            },
        },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let connection: any = null;
    try {
        try {
            connection = await imap.connect(config);
        } catch (error) {
            const message = (error as Error)?.message || "";
            const isSelfSigned = /self[-\s]?signed certificate/i.test(message);
            const isTimeout = /timed out|timeout/i.test(message);

            if (isSelfSigned) {
                const relaxedConfig = {
                    imap: {
                        ...config.imap,
                        tlsOptions: {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            ...(config.imap as any).tlsOptions,
                            rejectUnauthorized: false,
                        },
                    },
                };
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                connection = await imap.connect(relaxedConfig as any);
            } else if (isTimeout) {
                const slowNetworkConfig = {
                    imap: {
                        ...config.imap,
                        authTimeout: 30000,
                        connTimeout: 30000,
                        socketTimeout: 60000,
                    },
                };
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                connection = await imap.connect(slowNetworkConfig as any);
            } else {
                throw error;
            }
        }
        await connection.openBox("INBOX");

        const days = mode === "history" ? HISTORY_DAYS : RECENT_DAYS;
        const sinceDate = toImapSinceDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
        const searchCriteria = ["ALL", ["SINCE", sinceDate]];
        const fetchOptions = {
            bodies: ["HEADER", "TEXT"],
            markSeen: false,
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const messages: any[] = await connection.search(searchCriteria, fetchOptions);
        const parsedMessages: EmailMessage[] = [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const item of messages as any[]) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const all = item.parts.find((part: any) => part.which === "TEXT");
            if (!all) continue;

            const mail = await simpleParser(all.body);
            const subject = mail.subject || "";
            const from = mail.from?.text || "";
            const body = mail.text || stripHtml(mail.html ? String(mail.html) : "");
            const receivedAt = mail.date || undefined;

            if (!subject && !body) continue;
            parsedMessages.push({ subject, from, body, receivedAt: receivedAt || undefined });
        }

        return applyEmailScan(parsedMessages, "imap", mode);
    } catch (error) {
        console.error("IMAP Error:", error);
        const message = (error as Error)?.message || "";
        const isInvalidCreds = /invalid credentials|auth(?:entication)? failed|login failed|failure/i.test(message);

        if (isInvalidCreds) {
            throw new Error(
                "Invalid IMAP credentials. Verify host/user, and use a Google app password (16 chars, no spaces). If App Passwords are unavailable, your account policy may block IMAP client access."
            );
        }

        throw error;
    } finally {
        try {
            connection?.end?.();
        } catch {
        }
    }
}
