import { db } from "@/lib/db";
import DocumentsManager from "@/components/DocumentsManager";
import { TemplateManager } from "@/components/TemplateManager";

export default async function DocumentsPage() {
    const resumes = await db.getResumes();
    const jobs = await db.getJobs();
    const templates = await db.getCoverLetterTemplates();

    return (
        <div className="space-y-12">
            <DocumentsManager initialResumes={resumes} initialJobs={jobs} />
            <div className="border-t pt-8">
                <TemplateManager templates={templates} />
            </div>
        </div>
    );
}
