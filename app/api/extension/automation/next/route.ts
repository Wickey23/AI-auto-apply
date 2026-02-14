import { NextResponse } from "next/server";
import { checkExtensionApiKey, corsHeaders, getExtensionUserIdOrError } from "@/lib/api-security";
import { checkRateLimit, withIpKey } from "@/lib/rate-limit";
import { db } from "@/lib/db";

const RUNNING_TASK_TIMEOUT_MS = 20 * 60 * 1000;

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders() });
}

export async function POST(request: Request) {
    const rateLimitResponse = checkRateLimit(request, {
        key: withIpKey(request, "extension:automation-next"),
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

    const scoped = await db.getDataForUser(userId);
    const settings = (scoped.settings as any) || {};
    const queue = Array.isArray(settings.autoApplyQueue) ? settings.autoApplyQueue : [];
    const enabled = Boolean(settings.autoApplyEnabled);
    if (!enabled) {
        return NextResponse.json({ success: true, task: null, reason: "disabled" }, { status: 200, headers: corsHeaders() });
    }

    const staleRunningTaskIds = queue
        .filter((t: any) => t?.status === "running")
        .filter((t: any) => {
            const updatedAt = new Date(t?.updatedAt || 0).getTime();
            if (!Number.isFinite(updatedAt) || updatedAt <= 0) return true;
            return Date.now() - updatedAt > RUNNING_TASK_TIMEOUT_MS;
        })
        .map((t: any) => String(t?.id || ""));
    if (staleRunningTaskIds.length) {
        await db.updateDataForUser(userId, (data) => {
            const nextSettings: any = data.settings || {};
            const q = (Array.isArray(nextSettings.autoApplyQueue) ? nextSettings.autoApplyQueue : []) as any[];
            nextSettings.autoApplyQueue = q.map((t) => {
                if (!staleRunningTaskIds.includes(String(t?.id || ""))) return t;
                return {
                    ...t,
                    status: "failed",
                    lastError: "Timed out while running. Auto-requeued manually if needed.",
                    updatedAt: new Date().toISOString(),
                };
            });
            data.settings = nextSettings;
        });
    }

    const pending = queue.filter((t: any) => t?.status === "pending");
    if (!pending.length) {
        return NextResponse.json({ success: true, task: null, reason: "empty" }, { status: 200, headers: corsHeaders() });
    }

    const appsById = new Map((scoped.applications || []).map((a) => [a.id, a]));
    const invalidTaskIds: string[] = [];
    let selected:
        | {
            task: any;
            url: string;
        }
        | null = null;

    for (const task of pending) {
        const app = appsById.get(task.applicationId);
        const url = String(app?.job?.link || task?.jobUrl || "").trim();
        if (!app || !url) {
            invalidTaskIds.push(String(task.id || ""));
            continue;
        }
        selected = { task, url };
        break;
    }

    if (invalidTaskIds.length) {
        await db.updateDataForUser(userId, (data) => {
            const nextSettings: any = data.settings || {};
            const q = (Array.isArray(nextSettings.autoApplyQueue) ? nextSettings.autoApplyQueue : []) as any[];
            nextSettings.autoApplyQueue = q.map((t) => {
                if (!invalidTaskIds.includes(String(t.id || ""))) return t;
                return {
                    ...t,
                    status: "skipped",
                    lastError: "Skipped: missing application or job URL.",
                    updatedAt: new Date().toISOString(),
                };
            });
            data.settings = nextSettings;
        });
    }

    if (!selected) {
        return NextResponse.json({ success: true, task: null, reason: "no_valid_tasks" }, { status: 200, headers: corsHeaders() });
    }

    await db.updateDataForUser(userId, (data) => {
        const nextSettings: any = data.settings || {};
        const q = (Array.isArray(nextSettings.autoApplyQueue) ? nextSettings.autoApplyQueue : []) as any[];
        const idx = q.findIndex((t) => t.id === selected?.task.id);
        if (idx !== -1) {
            q[idx] = {
                ...q[idx],
                status: "running",
                jobUrl: selected?.url || q[idx].jobUrl || "",
                attempts: Number(q[idx].attempts || 0) + 1,
                updatedAt: new Date().toISOString(),
                lastError: "",
            };
        }
        nextSettings.autoApplyQueue = q;
        data.settings = nextSettings;
    });

    const refreshed = await db.getDataForUser(userId);
    const app = (refreshed.applications || []).find((a) => a.id === selected?.task.applicationId);
    if (!app) {
        await db.updateDataForUser(userId, (data) => {
            const nextSettings: any = data.settings || {};
            const q = (Array.isArray(nextSettings.autoApplyQueue) ? nextSettings.autoApplyQueue : []) as any[];
            nextSettings.autoApplyQueue = q.map((t) =>
                t.id === selected?.task.id
                    ? {
                        ...t,
                        status: "failed",
                        lastError: "Application no longer exists.",
                        updatedAt: new Date().toISOString(),
                    }
                    : t
            );
            data.settings = nextSettings;
        });
        return NextResponse.json({ success: true, task: null, reason: "missing_application" }, { status: 200, headers: corsHeaders() });
    }

    const latestResume = [...(refreshed.resumes || [])]
        .sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime())[0];

    return NextResponse.json(
        {
            success: true,
            task: {
                id: selected.task.id,
                attempts: Number(selected.task?.attempts || 0) + 1,
                applicationId: app.id,
                title: app.job.title,
                company: app.job.company,
                url: selected.url,
                status: "running",
                profile: {
                    contactInfo: refreshed.profile.contactInfo || "",
                    location: refreshed.profile.location || "",
                    linkedin: refreshed.profile.linkedin || "",
                    portfolio: refreshed.profile.portfolio || "",
                    summary: refreshed.profile.summary || "",
                },
                resume: {
                    name: latestResume?.name || "",
                    content: (latestResume?.content || "").slice(0, 3000),
                },
            },
            autoSubmit: Boolean((refreshed.settings as any)?.autoApplyAutoSubmit),
        },
        { status: 200, headers: corsHeaders() }
    );
}
