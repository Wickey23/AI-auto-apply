import { Sidebar } from "@/components/Sidebar";
import { QuickCommand } from "@/components/QuickCommand";
import { LogoutButton } from "@/components/LogoutButton";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";

export default async function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const userId = await getSessionUserId();
    if (!userId) {
        redirect("/login");
    }

    return (
        <div className="app-shell flex h-screen overflow-hidden text-slate-900">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-5 md:p-8 space-y-4">
                <div className="glass-card sticky top-4 z-20 rounded-xl px-3 py-2 md:px-4 md:py-3 flex justify-between items-center gap-2">
                    <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold">ApplyPilot Workspace</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <QuickCommand />
                        <LogoutButton />
                    </div>
                </div>
                {children}
            </main>
        </div>
    );
}
