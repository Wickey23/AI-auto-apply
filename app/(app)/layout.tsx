import { Sidebar } from "@/components/Sidebar";
import { QuickCommand } from "@/components/QuickCommand";

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-8 space-y-4">
                <div className="flex justify-end">
                    <QuickCommand />
                </div>
                {children}
            </main>
        </div>
    );
}
