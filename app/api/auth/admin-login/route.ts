import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken } from "@/lib/auth";
import { checkRateLimit, withIpKey } from "@/lib/rate-limit";

export async function POST(request: Request) {
    try {
        const rateLimitResponse = checkRateLimit(request, {
            key: withIpKey(request, "auth:admin-login"),
            limit: 10,
            windowMs: 60_000,
            message: "Too many admin login attempts. Try again in a minute.",
        });
        if (rateLimitResponse) return rateLimitResponse;

        const body = await request.json();
        const username = String(body?.username || "").trim();
        const password = String(body?.password || "");
        const configuredAdminUser = process.env.ADMIN_USERNAME;
        const configuredAdminPass = process.env.ADMIN_PASSWORD;

        if (process.env.NODE_ENV === "production" && (!configuredAdminUser || !configuredAdminPass)) {
            return NextResponse.json(
                { error: "Admin credentials are not configured on the server." },
                { status: 500 }
            );
        }

        const expectedUsername = configuredAdminUser || "admin";
        const expectedPassword = configuredAdminPass || "1234";

        if (username !== expectedUsername || password !== expectedPassword) {
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
