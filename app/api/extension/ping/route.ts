import { NextResponse } from "next/server";
import { checkExtensionApiKey, corsHeaders, getExtensionUserIdOrError } from "@/lib/api-security";
import { checkRateLimit, withIpKey } from "@/lib/rate-limit";

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders() });
}

export async function POST(request: Request) {
    const rateLimitResponse = checkRateLimit(request, {
        key: withIpKey(request, "extension:ping"),
        limit: 120,
        windowMs: 60_000,
        message: "Too many requests.",
    });
    if (rateLimitResponse) {
        rateLimitResponse.headers.set("Access-Control-Allow-Origin", "*");
        rateLimitResponse.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        rateLimitResponse.headers.set("Access-Control-Allow-Headers", "Content-Type, X-ApplyPilot-Key, X-ApplyPilot-User-Token");
        return rateLimitResponse;
    }

    const authError = checkExtensionApiKey(request);
    if (authError) return authError;

    const userIdOrError = getExtensionUserIdOrError(request);
    if (userIdOrError instanceof NextResponse) return userIdOrError;

    return NextResponse.json(
        { success: true, userId: userIdOrError },
        { status: 200, headers: corsHeaders() }
    );
}
