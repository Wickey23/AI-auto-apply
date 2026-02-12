import { NextResponse } from "next/server";
import { verifyExtensionUserToken } from "@/lib/auth";

export function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-ApplyPilot-Key, X-ApplyPilot-User-Token",
    };
}

export function checkExtensionApiKey(request: Request) {
    const requiredKey = process.env.EXTENSION_API_KEY;
    if (!requiredKey) {
        if (process.env.NODE_ENV === "production") {
            return NextResponse.json(
                { error: "Server not configured: EXTENSION_API_KEY is required in production." },
                { status: 500, headers: corsHeaders() }
            );
        }
        return null;
    }
    const provided = request.headers.get("x-applypilot-key") || request.headers.get("X-ApplyPilot-Key") || "";
    if (provided !== requiredKey) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders() });
    }
    return null;
}

export function getExtensionUserIdOrError(request: Request) {
    const token =
        request.headers.get("x-applypilot-user-token") ||
        request.headers.get("X-ApplyPilot-User-Token") ||
        "";

    const userId = verifyExtensionUserToken(token);
    if (!userId) {
        return NextResponse.json(
            { error: "Unauthorized: missing or invalid extension user token." },
            { status: 401, headers: corsHeaders() }
        );
    }

    return userId;
}
