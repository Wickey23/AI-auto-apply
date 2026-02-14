"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { pushToast } from "@/lib/client-toast";

export function PasswordChangeCard() {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [saving, setSaving] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentPassword || !newPassword || !confirmPassword) {
            pushToast("Complete all password fields.", "info");
            return;
        }
        if (newPassword !== confirmPassword) {
            pushToast("New password and confirm password must match.", "info");
            return;
        }
        if (newPassword.length < 8) {
            pushToast("New password must be at least 8 characters.", "info");
            return;
        }

        setSaving(true);
        try {
            const res = await fetch("/api/auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "Password change failed.");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            pushToast("Password updated successfully.", "success");
        } catch (error) {
            pushToast((error as Error).message || "Password update failed.", "error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                <KeyRound className="text-indigo-500" /> Password Security
            </h3>
            <form onSubmit={submit} className="space-y-3">
                <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    className="w-full rounded-md border border-slate-300 p-2 text-sm"
                />
                <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min 8 chars)"
                    className="w-full rounded-md border border-slate-300 p-2 text-sm"
                />
                <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full rounded-md border border-slate-300 p-2 text-sm"
                />
                <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                    Update Password
                </button>
            </form>
        </div>
    );
}


