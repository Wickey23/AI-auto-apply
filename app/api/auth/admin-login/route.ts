import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken } from "@/lib/auth";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const username = String(body?.username || "");
        const password = String(body?.password || "");

        if (username !== "admin" || password !== "1234") {
            return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
        }

        const token = createAdminSessionToken();
        const res = NextResponse.json({ success: true }, { status: 200 });
        res.cookies.set(ADMIN_SESSION_COOKIE, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 30,
        });
        return res;
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message || "Admin login failed." }, { status: 400 });
    }
}

