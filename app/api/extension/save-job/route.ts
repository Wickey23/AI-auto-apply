import { db } from "@/lib/db";
import { Job, Application } from "@/lib/types";
import { NextResponse } from "next/server";
import { checkExtensionApiKey, corsHeaders, getExtensionUserIdOrError } from "@/lib/api-security";
import { checkRateLimit, withIpKey } from "@/lib/rate-limit";

export async function OPTIONS() {
    return NextResponse.json({}, {
        headers: corsHeaders(),
    });
}

export async function POST(request: Request) {
    try {
        const rateLimitResponse = checkRateLimit(request, {
            key: withIpKey(request, "extension:save-job"),
            limit: 120,
            windowMs: 60_000,
            message: "Rate limit reached. Slow down and try again in a minute.",
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
        const { company, title, link, description, source } = body;

        if (!company || !title) {
            return NextResponse.json(
                { error: "Company and Title are required" },
                {
                    status: 400,
                    headers: corsHeaders(),
                }
            );
        }

        const newJob: Job = {
            id: `job-${Date.now()}`,
            userId,
            company,
            title,
            link: link || "",
            description: description || "",
            source: source || "Extension",
            priorityScore: 50,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const newApplication: Application = {
            id: `app-${Date.now()}`,
            userId,
            jobId: newJob.id,
            job: newJob,
            status: "INTERESTED",
            checklist: {
                research: false,
                tailor: false,
                prepButtons: false,
                review: false,
                submitted: false
            },
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await db.updateDataForUser(userId, (data) => {
            data.jobs.push(newJob);
            data.applications.push(newApplication);
        });

        return NextResponse.json(
            { success: true, jobId: newJob.id },
            {
                status: 201,
                headers: corsHeaders(),
            }
        );

    } catch (error) {
        console.error("Extension API Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            {
                status: 500,
                headers: corsHeaders(),
            }
        );
    }
}
