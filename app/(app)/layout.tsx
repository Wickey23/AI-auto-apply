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
        <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-8 space-y-4">
                <div className="flex justify-end items-center gap-2">
                    <QuickCommand />
                    <LogoutButton />
                </div>
                {children}
            </main>
        </div>
    );
}
