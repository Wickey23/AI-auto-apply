import { NextResponse } from "next/server";
import { checkExtensionApiKey, corsHeaders, getExtensionUserIdOrError } from "@/lib/api-security";
import { checkRateLimit, withIpKey } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders() });
}

export async function POST(request: Request) {
    const rateLimitResponse = checkRateLimit(request, {
        key: withIpKey(request, "extension:automation-report"),
        limit: 240,
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
    const userId = userIdOrError;

    const body = await request.json();
    const taskId = String(body?.taskId || "");
    const status = String(body?.status || "");
    const error = String(body?.error || "");
    const applicationId = String(body?.applicationId || "");
    const details = body?.details && typeof body.details === "object" ? body.details : null;
    if (!taskId || !["completed", "failed", "skipped"].includes(status)) {
        return NextResponse.json({ error: "taskId and valid status are required." }, { status: 400, headers: corsHeaders() });
    }

    await db.updateDataForUser(userId, (data) => {
        const settings: any = data.settings || {};
        const q = (Array.isArray(settings.autoApplyQueue) ? settings.autoApplyQueue : []) as any[];
        let resolvedApplicationId = applicationId;
        settings.autoApplyQueue = q.map((t) => {
            if (t.id !== taskId) return t;
            if (!resolvedApplicationId) resolvedApplicationId = String(t.applicationId || "");
            return {
                ...t,
                status,
                lastError: status === "failed" ? error || "Unknown error" : "",
                updatedAt: new Date().toISOString(),
                ...(details ? { lastResult: details } : {}),
            };
        });
        data.settings = settings;

        if (status === "completed" && resolvedApplicationId) {
            const app = (data.applications || []).find((a) => a.id === resolvedApplicationId);
            if (app && app.status !== "APPLIED") {
                app.status = "APPLIED";
                app.updatedAt = new Date();
            }
        }
    });

    return NextResponse.json({ success: true }, { status: 200, headers: corsHeaders() });
}
