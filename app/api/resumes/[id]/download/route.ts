import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Buffer } from "node:buffer";

export const runtime = "nodejs";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const resolved = await params;
    const id = decodeURIComponent(resolved.id || "");
    const data = await db.getData();
    const resume = data.resumes.find((r) => r.id === id);
    if (!resume) {
        return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    if (!resume.originalFileBase64) {
        return NextResponse.json({ error: "Original file is not available for this resume." }, { status: 400 });
    }

    let bytes: Buffer;
    try {
        bytes = Buffer.from(resume.originalFileBase64, "base64");
    } catch {
        return NextResponse.json({ error: "Stored file data is invalid." }, { status: 500 });
    }
    const mime = resume.originalMimeType || "application/octet-stream";
    const filename = resume.originalFileName || resume.name || `resume-${id}.bin`;

    return new NextResponse(new Uint8Array(bytes), {
        status: 200,
        headers: {
            "Content-Type": mime,
            "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
            "Cache-Control": "no-store",
        },
    });
}
