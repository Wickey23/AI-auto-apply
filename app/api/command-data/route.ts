import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
    const [applications, jobs, resumes] = await Promise.all([
        db.getApplications(),
        db.getJobs(),
        db.getResumes(),
    ]);

    return NextResponse.json({
        applications: applications.slice(0, 80).map((a) => ({
            id: a.id,
            title: a.job.title,
            company: a.job.company,
            status: a.status,
        })),
        jobs: jobs.slice(0, 80).map((j) => ({
            id: j.id,
            title: j.title,
            company: j.company,
            source: j.source || "",
        })),
        resumes: resumes.slice(0, 50).map((r) => ({
            id: r.id,
            name: r.name,
            version: r.version || 1,
        })),
    });
}

