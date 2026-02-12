import crypto from "crypto";
import { cookies } from "next/headers";
import { db } from "./db";

export const SESSION_COOKIE = "applypilot_session";
export const USER_COOKIE = "applypilot_uid";
export const ADMIN_SESSION_COOKIE = "applypilot_admin_session";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function getSecret() {
    return process.env.AUTH_SECRET || "dev-auth-secret-change-me";
}

export function hashPassword(password: string) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
    const [salt, expected] = (stored || "").split(":");
    if (!salt || !expected) return false;
    const actual = crypto.scryptSync(password, salt, 64).toString("hex");
    const a = Buffer.from(actual, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

export function createSessionToken(userId: string) {
    const ts = Math.floor(Date.now() / 1000);
    const payload = `${userId}.${ts}`;
    const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
    return `${payload}.${sig}`;
}

export function createAdminSessionToken() {
    const ts = Math.floor(Date.now() / 1000);
    const payload = `admin.${ts}`;
    const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
    return `${payload}.${sig}`;
}

export function verifySessionToken(token?: string | null) {
    if (!token) return null;
    const [userId, tsRaw, sig] = token.split(".");
    if (!userId || !tsRaw || !sig) return null;
    const payload = `${userId}.${tsRaw}`;
    const expected = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const ts = Number(tsRaw);
    if (!Number.isFinite(ts)) return null;
    const age = Math.floor(Date.now() / 1000) - ts;
    if (age < 0 || age > SESSION_TTL_SECONDS) return null;
    return userId;
}

export function verifyAdminSessionToken(token?: string | null) {
    if (!token) return false;
    const [role, tsRaw, sig] = token.split(".");
    if (role !== "admin" || !tsRaw || !sig) return false;
    const payload = `${role}.${tsRaw}`;
    const expected = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    const ts = Number(tsRaw);
    if (!Number.isFinite(ts)) return false;
    const age = Math.floor(Date.now() / 1000) - ts;
    return age >= 0 && age <= SESSION_TTL_SECONDS;
}

export async function getSessionUserId() {
    try {
        const store = await cookies();
        const token = store.get(SESSION_COOKIE)?.value || null;
        return verifySessionToken(token);
    } catch {
        return null;
    }
}

export async function getSessionUser() {
    const userId = await getSessionUserId();
    if (!userId) return null;
    return db.getAuthUserById(userId);
}

export function normalizeEmail(email: string) {
    return (email || "").trim().toLowerCase();
}
