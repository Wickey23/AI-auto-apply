"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Application, ApplicationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type BoardColumn = {
    id: string;
    label: string;
    color: string;
    statuses: ApplicationStatus[];
};

const COLUMNS: BoardColumn[] = [
    { id: "INTERESTED", label: "Interested", color: "bg-slate-100 border-slate-200", statuses: ["INTERESTED"] },
    { id: "DRAFTING", label: "Drafting", color: "bg-blue-50 border-blue-200", statuses: ["DRAFTING", "READY"] },
    { id: "APPLIED", label: "Applied", color: "bg-indigo-50 border-indigo-200", statuses: ["APPLIED"] },
    { id: "INTERVIEW", label: "Interview", color: "bg-amber-50 border-amber-200", statuses: ["RECRUITER_SCREEN", "TECHNICAL", "ONSITE"] },
    { id: "OFFER", label: "Offer", color: "bg-green-50 border-green-200", statuses: ["OFFER"] },
    { id: "REJECTED", label: "Closed", color: "bg-red-50 border-red-200", statuses: ["REJECTED", "WITHDRAWN"] },
];

export default function ApplicationsBoardClient({ applications }: { applications: Application[] }) {
    const [query, setQuery] = useState("");
    const [showOnlyActive, setShowOnlyActive] = useState(false);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return applications.filter((app) => {
            if (showOnlyActive && ["REJECTED", "WITHDRAWN", "OFFER"].includes(app.status)) return false;
            if (!q) return true;
            const hay = `${app.job.title} ${app.job.company} ${app.status} ${app.job.description || ""}`.toLowerCase();
            return hay.includes(q);
        });
    }, [applications, query, showOnlyActive]);

    return (
        <div className="h-full flex flex-col space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Applications Board</h2>
                    <p className="text-muted-foreground">Track your progress from queue to offer.</p>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search applications..."
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                    <button
                        onClick={() => setShowOnlyActive((v) => !v)}
                        className={cn(
                            "rounded-md border px-3 py-2 text-sm",
                            showOnlyActive ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-300 text-slate-700"
                        )}
                    >
                        {showOnlyActive ? "Active Only" : "Show All"}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-x-auto pb-4">
                <div className="flex h-full gap-6 min-w-[1180px]">
                    {COLUMNS.map((column) => {
                        const columnApps = filtered.filter((app) => column.statuses.includes(app.status));
                        return (
                            <div key={column.id} className="flex-1 flex flex-col min-w-[280px]">
                                <div className={cn("mb-3 flex items-center justify-between rounded-md border px-3 py-2", column.color)}>
                                    <span className="font-semibold text-sm">{column.label}</span>
                                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-600 border">
                                        {columnApps.length}
                                    </span>
                                </div>
                                <div className="flex-1 space-y-3 rounded-lg bg-slate-50/50 p-2 border border-slate-100/50">
                                    {columnApps.map((app) => (
                                        <Link
                                            key={app.id}
                                            href={`/applications/${app.id}`}
                                            className="block group rounded-lg border bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-blue-300"
                                        >
                                            <div className="space-y-1">
                                                <h4 className="font-semibold text-slate-900 line-clamp-1">{app.job.title}</h4>
                                                <p className="text-sm text-slate-500 line-clamp-1">{app.job.company}</p>
                                                <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                                                    <span>{new Date(app.updatedAt).toLocaleDateString()}</span>
                                                    <span className="px-1.5 py-0.5 rounded border bg-slate-50 text-slate-600">
                                                        {app.status}
                                                    </span>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                    {columnApps.length === 0 && (
                                        <div className="flex h-24 items-center justify-center rounded border border-dashed text-sm text-slate-400">
                                            Empty
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

