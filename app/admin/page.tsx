import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminLogoutButton } from "@/components/AdminLogoutButton";
import { AdminDashboardClient } from "@/components/AdminDashboardClient";

export default async function AdminPage() {
    const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value || "";
    if (!verifyAdminSessionToken(token)) {
        redirect("/admin/login");
    }

    const [users, logs] = await Promise.all([
        db.getAdminOverview(),
        db.getAdminAuditLogs(120),
    ]);

    return (
        <div className="min-h-screen bg-slate-100">
            <div className="max-w-6xl mx-auto p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">ApplyPilot Admin</p>
                    <AdminLogoutButton />
                </div>
                <AdminDashboardClient users={users as any} logs={logs as any} />
            </div>
        </div>
    );
}
