import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSessionToken, hashPassword, normalizeEmail, SESSION_COOKIE, USER_COOKIE } from "@/lib/auth";
import { checkRateLimit, withIpKey } from "@/lib/rate-limit";

export async function POST(request: Request) {
    try {
        const rateLimitResponse = checkRateLimit(request, {
            key: withIpKey(request, "auth:register"),
            limit: 8,
            windowMs: 10 * 60_000,
            message: "Too many registration attempts. Try again later.",
        });
        if (rateLimitResponse) return rateLimitResponse;

        const body = await request.json();
        const name = String(body?.name || "").trim();
        const email = normalizeEmail(String(body?.email || ""));
        const password = String(body?.password || "");

        if (!email || !password) {
            return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
        }
        if (password.length < 8) {
            return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
        }

        const user = await db.createAuthUser({
            id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            email,
            name,
            passwordHash: hashPassword(password),
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const token = createSessionToken(user.id);
        const res = NextResponse.json({ success: true, userId: user.id }, { status: 201 });
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
        return NextResponse.json({ error: (error as Error).message || "Registration failed." }, { status: 400 });
    }
}
