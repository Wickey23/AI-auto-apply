import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSessionToken, normalizeEmail, SESSION_COOKIE, USER_COOKIE, verifyPassword } from "@/lib/auth";
import { checkRateLimit, withIpKey } from "@/lib/rate-limit";

export async function POST(request: Request) {
    try {
        const rateLimitResponse = checkRateLimit(request, {
            key: withIpKey(request, "auth:login"),
            limit: 15,
            windowMs: 60_000,
            message: "Too many login attempts. Try again shortly.",
        });
        if (rateLimitResponse) return rateLimitResponse;

        const body = await request.json();
        const email = normalizeEmail(String(body?.email || ""));
        const password = String(body?.password || "");
        if (!email || !password) {
            return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
        }

        const user = await db.getAuthUserByEmail(email);
        if (!user || !verifyPassword(password, user.passwordHash)) {
            return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
        }

        const token = createSessionToken(user.id);
        const res = NextResponse.json({ success: true, userId: user.id }, { status: 200 });
        res.cookies.set(SESSION_COOKIE, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 30,
        });
        res.cookies.set(USER_COOKIE, user.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 30,
        });
        return res;
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message || "Login failed." }, { status: 400 });
    }
}
