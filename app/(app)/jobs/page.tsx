import { db } from "@/lib/db";
import JobsQueueClient from "@/components/JobsQueueClient";

export default async function JobsPage() {
    const applications = await db.getApplications();
    const resumes = await db.getResumes();

    return <JobsQueueClient applications={applications} resumes={resumes} />;
}
