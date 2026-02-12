import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId, hashPassword, verifyPassword } from "@/lib/auth";
import { checkRateLimit, withIpKey } from "@/lib/rate-limit";

export async function POST(request: Request) {
    try {
        const rateLimitResponse = checkRateLimit(request, {
            key: withIpKey(request, "auth:change-password"),
            limit: 12,
            windowMs: 10 * 60_000,
            message: "Too many password change attempts. Try again later.",
        });
        if (rateLimitResponse) return rateLimitResponse;

        const userId = await getSessionUserId();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const currentPassword = String(body?.currentPassword || "");
        const newPassword = String(body?.newPassword || "");
        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: "Current password and new password are required." }, { status: 400 });
        }
        if (newPassword.length < 8) {
            return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
        }

        const user = await db.getAuthUserById(userId);
        if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
            return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
        }
        if (verifyPassword(newPassword, user.passwordHash)) {
            return NextResponse.json({ error: "New password must be different from current password." }, { status: 400 });
        }

        await db.updateAuthUserPassword(userId, hashPassword(newPassword));
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message || "Failed to change password." }, { status: 400 });
    }
}
