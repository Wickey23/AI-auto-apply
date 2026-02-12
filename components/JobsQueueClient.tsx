"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PlusCircle, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Application, ApplicationStatus, Resume } from "@/lib/types";

function tokenize(text: string) {
    return (text || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 2);
}

function getRecommendedResume(jobText: string, resumes: Resume[]) {
    const terms = new Set(tokenize(jobText));
    let best: { resume: Resume; score: number } | null = null;

    for (const resume of resumes) {
        let score = 0;
        const roleTerms = tokenize(resume.targetRole || "");
        const skillTerms = (resume.focusSkills || []).flatMap((s) => tokenize(s));
        const tagTerms = (resume.tags || []).flatMap((s) => tokenize(s));
        const preferenceTerms = tokenize(resume.jobPreferences || "");

        for (const term of roleTerms) if (terms.has(term)) score += 3;
        for (const term of skillTerms) if (terms.has(term)) score += 2;
        for (const term of tagTerms) if (terms.has(term)) score += 1;
        for (const term of preferenceTerms) if (terms.has(term)) score += 2;

        if (!best || score > best.score) best = { resume, score };
    }

    if (!best || best.score <= 0) return null;
    return best.resume;
}

const STATUS_OPTIONS: Array<"ALL" | ApplicationStatus> = [
    "ALL",
    "INTERESTED",
    "DRAFTING",
    "READY",
    "APPLIED",
    "RECRUITER_SCREEN",
    "TECHNICAL",
    "ONSITE",
    "OFFER",
    "REJECTED",
    "WITHDRAWN",
];

type SortBy = "newest" | "oldest" | "company" | "status";
type SavedPreset = {
    id: string;
    name: string;
    query: string;
    statusFilter: "ALL" | ApplicationStatus;
    sourceFilter: string;
    sortBy: SortBy;
};

export default function JobsQueueClient({
    applications,
    resumes,
}: {
    applications: Application[];
    resumes: Resume[];
}) {
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"ALL" | ApplicationStatus>("ALL");
    const [sourceFilter, setSourceFilter] = useState("ALL");
    const [sortBy, setSortBy] = useState<SortBy>("newest");
    const [presets, setPresets] = useState<SavedPreset[]>([]);
    const [presetName, setPresetName] = useState("");

    const sourceOptions = useMemo(() => {
        const values = Array.from(
            new Set(applications.map((a) => (a.job.source || "").trim()).filter(Boolean))
        );
        return ["ALL", ...values];
    }, [applications]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem("applypilot.jobsQueue.presets");
            if (!raw) return;
            const parsed = JSON.parse(raw) as SavedPreset[];
            if (Array.isArray(parsed)) setPresets(parsed);
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        localStorage.setItem("applypilot.jobsQueue.presets", JSON.stringify(presets));
    }, [presets]);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        let rows = applications.filter((app) => {
            if (statusFilter !== "ALL" && app.status !== statusFilter) return false;
            if (sourceFilter !== "ALL" && (app.job.source || "") !== sourceFilter) return false;
            if (!q) return true;
            const hay = `${app.job.title} ${app.job.company} ${app.job.description || ""} ${app.status} ${app.job.source || ""}`.toLowerCase();
            return hay.includes(q);
        });

        rows = rows.sort((a, b) => {
            if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            if (sortBy === "company") return (a.job.company || "").localeCompare(b.job.company || "");
            return (a.status || "").localeCompare(b.status || "");
        });
        return rows;
    }, [applications, query, sortBy, sourceFilter, statusFilter]);

    const saveCurrentPreset = () => {
        const name = presetName.trim() || `Preset ${presets.length + 1}`;
        const preset: SavedPreset = {
            id: `preset-${Date.now()}`,
            name,
            query,
            statusFilter,
            sourceFilter,
            sortBy,
        };
        setPresets((prev) => [preset, ...prev].slice(0, 20));
        setPresetName("");
    };

    const applyPreset = (preset: SavedPreset) => {
        setQuery(preset.query);
        setStatusFilter(preset.statusFilter);
        setSourceFilter(preset.sourceFilter);
        setSortBy(preset.sortBy);
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Jobs Queue</h2>
                    <p className="text-muted-foreground">Manage and track your applications.</p>
                </div>
                <Link
                    href="/jobs/new"
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition shadow-sm"
                >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Job
                </Link>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
                <div className="relative md:col-span-2">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search jobs, companies, keywords..."
                        className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as "ALL" | ApplicationStatus)}
                    className="rounded-md border border-slate-300 bg-white py-2 px-3 text-sm"
                >
                    {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                            {status === "ALL" ? "All Statuses" : status}
                        </option>
                    ))}
                </select>
                <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="rounded-md border border-slate-300 bg-white py-2 px-3 text-sm"
                >
                    {sourceOptions.map((source) => (
                        <option key={source} value={source}>
                            {source === "ALL" ? "All Sources" : source}
                        </option>
                    ))}
                </select>
                <div className="md:col-span-4 flex items-center justify-between">
                    <div className="inline-flex items-center gap-2 text-sm text-slate-600">
                        <Filter className="h-4 w-4" />
                        Showing {visible.length} of {applications.length} jobs
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortBy)}
                            className="rounded-md border border-slate-300 bg-white py-2 px-3 text-sm"
                        >
                            <option value="newest">Sort: Newest</option>
                            <option value="oldest">Sort: Oldest</option>
                            <option value="company">Sort: Company</option>
                            <option value="status">Sort: Status</option>
                        </select>
                        <input
                            value={presetName}
                            onChange={(e) => setPresetName(e.target.value)}
                            placeholder="Preset name"
                            className="rounded-md border border-slate-300 bg-white py-2 px-3 text-sm"
                        />
                        <button
                            onClick={saveCurrentPreset}
                            className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                        >
                            Save Preset
                        </button>
                    </div>
                </div>
                {presets.length > 0 && (
                    <div className="md:col-span-4 flex flex-wrap items-center gap-2">
                        {presets.map((preset) => (
                            <div key={preset.id} className="inline-flex items-center rounded-full border bg-white">
                                <button
                                    onClick={() => applyPreset(preset)}
                                    className="px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-l-full"
                                >
                                    {preset.name}
                                </button>
                                <button
                                    onClick={() => setPresets((prev) => prev.filter((p) => p.id !== preset.id))}
                                    className="px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-r-full border-l"
                                    aria-label={`Delete preset ${preset.name}`}
                                >
                                    x
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium">
                            <tr>
                                <th className="px-6 py-4">Company / Role</th>
                                <th className="px-6 py-4">Recommended Resume</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Date Added</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {visible.map((app) => {
                                const jobText = `${app.job.title} ${app.job.company} ${app.job.description || ""}`;
                                const recommended = getRecommendedResume(jobText, resumes);
                                return (
                                    <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-900">{app.job.title}</span>
                                                <span className="text-slate-500">{app.job.company}</span>
                                                {app.job.source && <span className="text-xs text-slate-400">{app.job.source}</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {recommended ? (
                                                <div className="flex flex-col">
                                                    <span className="text-slate-900 font-medium">{recommended.name}</span>
                                                    <span className="text-xs text-slate-500">{(recommended.targetRole || "General").trim()}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-500">No strong match. Configure in Documents {" > "} Workshop.</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={cn(
                                                    "px-2.5 py-1 rounded-full text-xs font-medium border",
                                                    app.status === "INTERESTED" && "bg-slate-50 text-slate-600 border-slate-200",
                                                    app.status === "DRAFTING" && "bg-blue-50 text-blue-700 border-blue-200",
                                                    app.status === "READY" && "bg-indigo-50 text-indigo-700 border-indigo-200",
                                                    app.status === "APPLIED" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                                                    ["RECRUITER_SCREEN", "TECHNICAL", "ONSITE"].includes(app.status) && "bg-amber-50 text-amber-700 border-amber-200",
                                                    app.status === "OFFER" && "bg-green-50 text-green-700 border-green-200",
                                                    ["REJECTED", "WITHDRAWN"].includes(app.status) && "bg-red-50 text-red-600 border-red-200"
                                                )}
                                            >
                                                {app.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500">{new Date(app.createdAt).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-right">
                                            <Link href={`/applications/${app.id}`} className="text-blue-600 hover:text-blue-800 font-medium text-xs uppercase tracking-wide">
                                                View Details
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                            {visible.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                                        No jobs match your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
