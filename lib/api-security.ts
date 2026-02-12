import { NextResponse } from "next/server";

export function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-ApplyPilot-Key",
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

