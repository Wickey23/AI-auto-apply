import { db } from "@/lib/db";
import { Job, Application } from "@/lib/types";
import { NextResponse } from "next/server";

export async function OPTIONS() {
    return NextResponse.json({}, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { company, title, link, description, source } = body;

        if (!company || !title) {
            return NextResponse.json(
                { error: "Company and Title are required" },
                {
                    status: 400,
                    headers: { 'Access-Control-Allow-Origin': '*' }
                }
            );
        }

        const newJob: Job = {
            id: `job-${Date.now()}`,
            userId: "user-1", // Default user for local app
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
            userId: "user-1",
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

        await db.updateData((data) => {
            data.jobs.push(newJob);
            data.applications.push(newApplication);
        });

        return NextResponse.json(
            { success: true, jobId: newJob.id },
            {
                status: 201,
                headers: { 'Access-Control-Allow-Origin': '*' }
            }
        );

    } catch (error) {
        console.error("Extension API Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            {
                status: 500,
                headers: { 'Access-Control-Allow-Origin': '*' }
            }
        );
    }
}
