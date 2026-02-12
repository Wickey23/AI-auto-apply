import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSessionToken, normalizeEmail, SESSION_COOKIE, USER_COOKIE, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
    try {
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

