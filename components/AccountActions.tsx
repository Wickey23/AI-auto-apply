"use client";

import { clearAllMyDataAction } from "@/app/actions";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AccountActions() {
    const [busy, setBusy] = useState(false);
    const router = useRouter();

    const logout = async () => {
        setBusy(true);
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/login");
            router.refresh();
        } finally {
            setBusy(false);
        }
    };

    const clearData = async () => {
        const ok = window.confirm("This will permanently remove your data for this account. Continue?");
        if (!ok) return;
        setBusy(true);
        try {
            await clearAllMyDataAction();
            alert("All account data has been cleared.");
            router.refresh();
        } catch (error) {
            alert((error as Error).message || "Failed to clear data.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-2">
            <button
                type="button"
                onClick={logout}
                disabled={busy}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
                Log out
            </button>
            <button
                type="button"
                onClick={clearData}
                disabled={busy}
                className="w-full rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
                Clear My Data
            </button>
        </div>
    );
}

