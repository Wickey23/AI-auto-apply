import { NextResponse } from "next/server";
import { createExtensionUserToken, getSessionUserId } from "@/lib/auth";
import { checkRateLimit, withIpKey } from "@/lib/rate-limit";

export async function GET(request: Request) {
    const rateLimitResponse = checkRateLimit(request, {
        key: withIpKey(request, "extension:token"),
        limit: 30,
        windowMs: 60_000,
        message: "Too many token requests. Try again in a minute.",
    });
    if (rateLimitResponse) return rateLimitResponse;

    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = createExtensionUserToken(userId);
    return NextResponse.json({
        token,
        userId,
        expiresInDays: 180,
    });
}
