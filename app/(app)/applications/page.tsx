import { db } from "@/lib/db";
import ApplicationsBoardClient from "@/components/ApplicationsBoardClient";

export default async function ApplicationsPage() {
    const applications = await db.getApplications();
    return <ApplicationsBoardClient applications={applications} />;
}
