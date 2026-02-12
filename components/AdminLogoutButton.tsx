"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLogoutButton() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const logout = async () => {
        setLoading(true);
        try {
            await fetch("/api/auth/admin-logout", { method: "POST" });
            router.push("/admin/login");
            router.refresh();
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            type="button"
            onClick={logout}
            disabled={loading}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
            {loading ? "Logging out..." : "Logout"}
        </button>
    );
}

