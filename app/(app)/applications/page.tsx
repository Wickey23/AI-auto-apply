import { db } from "@/lib/db";
import ApplicationsBoardClient from "@/components/ApplicationsBoardClient";

export default async function ApplicationsPage() {
    const data = await db.getData();
    const settings: any = data.settings || {};
    const queue = Array.isArray(settings.autoApplyQueue) ? settings.autoApplyQueue : [];
    const queueStats = {
        pending: queue.filter((t: any) => t.status === "pending").length,
        running: queue.filter((t: any) => t.status === "running").length,
        completed: queue.filter((t: any) => t.status === "completed").length,
        failed: queue.filter((t: any) => t.status === "failed").length,
        total: queue.length,
    };

    return (
        <ApplicationsBoardClient
            applications={data.applications}
            autoApply={{
                enabled: Boolean(settings.autoApplyEnabled),
                autoSubmit: Boolean(settings.autoApplyAutoSubmit),
                queueStats,
            }}
        />
    );
}
