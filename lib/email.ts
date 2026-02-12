import imap from 'imap-simple';
import { simpleParser } from 'mailparser';
import { db } from './db';
import { analyzeEmailContent } from './ai';

function decodeBase64Url(input?: string) {
    if (!input) return "";
    const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
    try {
        return Buffer.from(b64, "base64").toString("utf-8");
    } catch {
        return "";
    }
}

function extractTextFromPayload(payload: any): string {
    if (!payload) return "";
    if (payload.body?.data && payload.mimeType?.startsWith("text/plain")) {
        return decodeBase64Url(payload.body.data);
    }
    const parts = payload.parts || [];
    for (const part of parts) {
        const found = extractTextFromPayload(part);
        if (found) return found;
    }
    return "";
}

async function applyStatusUpdates(updates: Array<{ appId: string; status: string }>) {
    if (updates.length === 0) return 0;
    const latestByAppId = new Map<string, string>();
    for (const u of updates) latestByAppId.set(u.appId, u.status);

    await db.updateData((data) => {
        for (const app of data.applications) {
            const nextStatus = latestByAppId.get(app.id);
            if (nextStatus && app.status !== nextStatus) {
                app.status = nextStatus as any;
                app.updatedAt = new Date();
            }
        }
    });

    return latestByAppId.size;
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

async function checkEmailsViaGmailApi() {
    const accessToken = await getValidGmailAccessToken();
    if (!accessToken) return null;

    const listRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?q=newer_than:1d&maxResults=20", {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!listRes.ok) {
        throw new Error("Gmail API request failed. Reconnect Gmail in Settings.");
    }

    const listData = await listRes.json();
    const messages: Array<{ id: string }> = listData.messages || [];
    const applications = await db.getApplications();
    const updates: Array<{ appId: string; status: string }> = [];

    for (const msg of messages) {
        const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!msgRes.ok) continue;
        const full = await msgRes.json();

        const headers: Array<{ name: string; value: string }> = full.payload?.headers || [];
        const subject = headers.find((h) => h.name.toLowerCase() === "subject")?.value || "";
        const from = headers.find((h) => h.name.toLowerCase() === "from")?.value || "";
        const body = extractTextFromPayload(full.payload) || full.snippet || "";
        if (!subject && !body) continue;

        for (const app of applications) {
            if (app.status === "REJECTED" || app.status === "OFFER") continue;
            const companyName = app.job.company.toLowerCase();
            const hay = `${subject} ${body} ${from}`.toLowerCase();
            if (!hay.includes(companyName)) continue;

            const result = await analyzeEmailContent(body, subject);
            if (result.status && result.status !== app.status) {
                updates.push({ appId: app.id, status: result.status });
            }
        }
    }

    const updatesApplied = await applyStatusUpdates(updates);
    return { success: true, updates: updatesApplied, source: "gmail-api" };
}

export async function checkEmailsForUpdates() {
    const gmailResult = await checkEmailsViaGmailApi();
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
            socketTimeout: 30000,
            tlsOptions: {
                servername: imapHost,
                rejectUnauthorized: true
            }
        }
    };

    try {
        let connection;
        try {
            connection = await imap.connect(config);
        } catch (error) {
            const message = (error as Error)?.message || "";
            const isSelfSigned = /self[-\s]?signed certificate/i.test(message);
            const isTimeout = /timed out|timeout/i.test(message);

            if (isSelfSigned) {
                // Some providers/dev mail stacks use self-signed cert chains.
                // Retry with relaxed verification only for this specific TLS failure.
                const relaxedConfig = {
                    imap: {
                        ...config.imap,
                        tlsOptions: {
                            ...(config.imap as any).tlsOptions,
                            rejectUnauthorized: false
                        }
                    }
                };
                connection = await imap.connect(relaxedConfig as any);
            } else if (isTimeout) {
                // Retry once with longer timeouts for slower networks/providers.
                const slowNetworkConfig = {
                    imap: {
                        ...config.imap,
                        authTimeout: 30000,
                        connTimeout: 30000,
                        socketTimeout: 60000
                    }
                };
                connection = await imap.connect(slowNetworkConfig as any);
            } else {
                throw error;
            }
        }
        await connection.openBox('INBOX');

        const searchCriteria = ['ALL', ['SINCE', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()]];
        const fetchOptions = {
            bodies: ['HEADER', 'TEXT'],
            markSeen: false
        };

        const messages = await connection.search(searchCriteria, fetchOptions);
        const applications = await db.getApplications();
        const updates: Array<{ appId: string; status: string }> = [];

        for (const item of messages) {
            const all = item.parts.find((part: any) => part.which === 'TEXT');
            if (!all) continue;

            const mail = await simpleParser(all.body);

            const subject = mail.subject;
            const from = mail.from?.text;
            const body = mail.text;

            if (!subject || !body) continue;

            for (const app of applications) {
                if (app.status === 'REJECTED' || app.status === 'OFFER') continue; // Skip finished ones

                const companyName = app.job.company.toLowerCase();
                if (subject.toLowerCase().includes(companyName) || body.toLowerCase().includes(companyName) || from?.toLowerCase().includes(companyName)) {

                    // Found a match! Analyze sentiment
                    const result = await analyzeEmailContent(body, subject);

                    if (result.status && result.status !== app.status) {
                        updates.push({ appId: app.id, status: result.status });
                    }
                }
            }
        }

        const updatesApplied = await applyStatusUpdates(updates);
        connection.end();
        return { success: true, updates: updatesApplied, source: "imap" };

    } catch (error) {
        console.error("IMAP Error:", error);
        const message = (error as Error)?.message || "";
        const isInvalidCreds =
            /invalid credentials|auth(?:entication)? failed|login failed|failure/i.test(message);

        if (isInvalidCreds) {
            throw new Error(
                "Invalid IMAP credentials. Verify host/user, and use a Google app password (16 chars, no spaces). If App Passwords are unavailable, your account policy may block IMAP client access."
            );
        }

        throw error;
    }
}
