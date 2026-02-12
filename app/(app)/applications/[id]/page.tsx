import { db } from "@/lib/db";
import ApplicationView from "@/components/ApplicationView";
import { notFound } from "next/navigation";

type PageParams = { id: string };

export default async function ApplicationDetailPage({ params }: { params: Promise<PageParams> }) {
    const resolvedParams = await params;
    const id = decodeURIComponent(resolvedParams.id || "");
    const applications = await db.getApplications();
    const application = applications.find((app) => app.id === id);

    if (!application) {
        notFound();
    }

    return <ApplicationView application={application} />;
}
