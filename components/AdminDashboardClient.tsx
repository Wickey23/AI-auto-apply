"use client";

import { adminClearUserDataAction, adminDeleteUserAction } from "@/app/actions";
import { ReactNode, useMemo, useState, useTransition } from "react";
import { BarChart3, Database, Search, ShieldAlert, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";

type AdminUserRow = {
    id: string;
    email: string;
    name: string;
    createdAt: string | Date;
    updatedAt: string | Date;
    lastActiveAt?: string | Date | null;
    stats: {
        resumes: number;
        jobs: number;
        applications: number;
        contacts: number;
        linkedinProfiles: number;
    };
};

type AdminLog = {
    id: string;
    action: string;
    details: string;
    userId: string;
    timestamp: string | Date;
};

export function AdminDashboardClient({
    users,
    logs,
}: {
    users: AdminUserRow[];
    logs: AdminLog[];
}) {
    const [query, setQuery] = useState("");
    const [logQuery, setLogQuery] = useState("");
    const [sortBy, setSortBy] = useState<"apps" | "newest" | "name">("apps");
    const [pending, startTransition] = useTransition();
    const router = useRouter();

    const totals = useMemo(() => {
        return users.reduce(
            (acc, u) => {
                acc.users += 1;
                acc.resumes += u.stats.resumes;
                acc.jobs += u.stats.jobs;
                acc.applications += u.stats.applications;
                acc.contacts += u.stats.contacts;
                return acc;
            },
            { users: 0, resumes: 0, jobs: 0, applications: 0, contacts: 0 }
        );
    }, [users]);

    const filteredUsers = useMemo(() => {
        const q = query.trim().toLowerCase();
        const base = q
            ? users.filter((u) => `${u.name} ${u.email} ${u.id}`.toLowerCase().includes(q))
            : users;

        const copy = [...base];
        if (sortBy === "apps") {
            copy.sort((a, b) => b.stats.applications - a.stats.applications);
        } else if (sortBy === "newest") {
            copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } else {
            copy.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
        }
        return copy;
    }, [users, query, sortBy]);

    const filteredLogs = useMemo(() => {
        const q = logQuery.trim().toLowerCase();
        if (!q) return logs;
        return logs.filter((log) =>
            `${log.action} ${log.details} ${log.userId}`.toLowerCase().includes(q)
        );
    }, [logs, logQuery]);

    const exportUsersCsv = () => {
        const header = [
            "id",
            "name",
            "email",
            "createdAt",
            "lastActiveAt",
            "resumes",
            "jobs",
            "applications",
            "contacts",
            "linkedinProfiles",
        ];
        const rows = filteredUsers.map((u) => [
            u.id,
            u.name || "",
            u.email || "",
            String(u.createdAt || ""),
            String(u.lastActiveAt || ""),
            String(u.stats.resumes || 0),
            String(u.stats.jobs || 0),
            String(u.stats.applications || 0),
            String(u.stats.contacts || 0),
            String(u.stats.linkedinProfiles || 0),
        ]);
        const csv = [header, ...rows]
            .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
            .join("\n");
        downloadCsv("admin-users.csv", csv);
    };

    const exportLogsCsv = () => {
        const header = ["id", "timestamp", "userId", "action", "details"];
        const rows = filteredLogs.map((log) => [
            log.id,
            String(log.timestamp || ""),
            log.userId,
            log.action,
            log.details,
        ]);
        const csv = [header, ...rows]
            .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
            .join("\n");
        downloadCsv("admin-audit-logs.csv", csv);
    };

    const runAction = (fn: () => Promise<void>) => {
        startTransition(async () => {
            try {
                await fn();
                router.refresh();
            } catch (error) {
                alert((error as Error).message || "Admin action failed.");
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl">
                <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">
                    <ShieldAlert size={14} /> Admin Control Center
                </p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight">Global Admin</h1>
                <p className="mt-1 text-sm text-slate-200/90">Monitor users, inspect account activity, and perform account-level maintenance.</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <StatCard icon={<Users size={16} />} label="Users" value={totals.users} />
                    <StatCard icon={<Database size={16} />} label="Resumes" value={totals.resumes} />
                    <StatCard icon={<BarChart3 size={16} />} label="Jobs" value={totals.jobs} />
                    <StatCard icon={<BarChart3 size={16} />} label="Applications" value={totals.applications} />
                    <StatCard icon={<Users size={16} />} label="Contacts" value={totals.contacts} />
                </div>
            </div>

            <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="relative w-full md:w-96">
                        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search by name, email, or user id"
                            className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm"
                        />
                    </div>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as "apps" | "newest" | "name")}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
                    >
                        <option value="apps">Sort: Most applications</option>
                        <option value="newest">Sort: Newest users</option>
                        <option value="name">Sort: Name</option>
                    </select>
                </div>
                <div className="mt-3">
                    <button
                        type="button"
                        onClick={exportUsersCsv}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                        Export Users CSV
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                        <tr>
                            <th className="text-left px-3 py-2">User</th>
                            <th className="text-left px-3 py-2">Resumes</th>
                            <th className="text-left px-3 py-2">Jobs</th>
                            <th className="text-left px-3 py-2">Applications</th>
                            <th className="text-left px-3 py-2">Contacts</th>
                            <th className="text-left px-3 py-2">LinkedIn</th>
                            <th className="text-left px-3 py-2">Last Active</th>
                            <th className="text-left px-3 py-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map((u) => (
                            <tr key={u.id} className="border-t align-top">
                                <td className="px-3 py-3">
                                    <p className="font-semibold text-slate-900">{u.name || "Unnamed"}</p>
                                    <p className="text-xs text-slate-500">{u.email}</p>
                                    <p className="text-[11px] text-slate-400 mt-1">{u.id}</p>
                                </td>
                                <td className="px-3 py-3">{u.stats.resumes}</td>
                                <td className="px-3 py-3">{u.stats.jobs}</td>
                                <td className="px-3 py-3">{u.stats.applications}</td>
                                <td className="px-3 py-3">{u.stats.contacts}</td>
                                <td className="px-3 py-3">{u.stats.linkedinProfiles}</td>
                                <td className="px-3 py-3 text-xs text-slate-600">{u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString() : "No activity"}</td>
                                <td className="px-3 py-3">
                                    <div className="flex flex-col gap-2">
                                        <button
                                            type="button"
                                            disabled={pending}
                                            onClick={() => {
                                                if (!confirm(`Clear all data for ${u.email}?`)) return;
                                                runAction(async () => adminClearUserDataAction(u.id));
                                            }}
                                            className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 hover:bg-amber-100"
                                        >
                                            Clear Data
                                        </button>
                                        <button
                                            type="button"
                                            disabled={pending}
                                            onClick={() => {
                                                if (!confirm(`Delete user ${u.email}? This cannot be undone.`)) return;
                                                runAction(async () => adminDeleteUserAction(u.id));
                                            }}
                                            className="inline-flex items-center justify-center gap-1 rounded-md border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-100"
                                        >
                                            <Trash2 size={12} /> Delete User
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredUsers.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-3 py-6 text-center text-slate-500">No users match this filter.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <h3 className="font-semibold text-slate-900">Recent Activity</h3>
                    <div className="flex gap-2">
                        <input
                            value={logQuery}
                            onChange={(e) => setLogQuery(e.target.value)}
                            placeholder="Filter logs by action/user/details"
                            className="w-72 rounded-md border border-slate-300 px-3 py-1.5 text-xs"
                        />
                        <button
                            type="button"
                            onClick={exportLogsCsv}
                            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                            Export Logs CSV
                        </button>
                    </div>
                </div>
                <div className="mt-3 space-y-2 max-h-72 overflow-auto pr-1">
                    {filteredLogs.length === 0 && <p className="text-sm text-slate-500">No audit logs match this filter.</p>}
                    {filteredLogs.map((log) => (
                        <div key={log.id} className="rounded-md border border-slate-200 px-3 py-2">
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-medium text-slate-800">{log.action}</p>
                                <p className="text-[11px] text-slate-500">{new Date(log.timestamp).toLocaleString()}</p>
                            </div>
                            <p className="text-xs text-slate-600 mt-1">{log.details}</p>
                            <p className="text-[11px] text-slate-400 mt-1">User: {log.userId}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function downloadCsv(filename: string, content: string) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
    return (
        <div className="rounded-xl border border-white/20 bg-white/10 p-3">
            <p className="text-xs text-slate-200/90 flex items-center gap-1.5">{icon} {label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
    );
}
