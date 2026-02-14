"use client";

import { useEffect, useMemo, useState } from "react";
import { addJobFromSearchAction } from "@/app/actions";
import { Briefcase, MapPin, Plus, Check, Loader2, Sparkles, Bot } from "lucide-react";
import { pushToast } from "@/lib/client-toast";

interface JobListing {
    id: string;
    title: string;
    company: string;
    location: string;
    description: string;
    url: string;
    postedDate?: string;
    level?: string;
    category?: string;
    source?: string;
    relevance?: number;
    matchTier?: "High" | "Medium" | "Low";
    highlights?: string[];
    linkedinUrl?: string;
    indeedUrl?: string;
    companySiteUrl?: string;
}

interface JobSearchResultsProps {
    jobs: JobListing[];
}

export function JobSearchResults({ jobs }: JobSearchResultsProps) {
    const [addedJobs, setAddedJobs] = useState<Set<string>>(new Set());
    const [queuedJobs, setQueuedJobs] = useState<Set<string>>(new Set());
    const [loadingJobs, setLoadingJobs] = useState<Set<string>>(new Set());
    const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
    const [sortBy, setSortBy] = useState<"relevance" | "newest" | "company">("relevance");
    const [sourceFilter, setSourceFilter] = useState("all");
    const [tierFilter, setTierFilter] = useState("all");
    const [bulkLoading, setBulkLoading] = useState(false);
    const [queueAutoApply, setQueueAutoApply] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    useEffect(() => {
        try {
            const raw = localStorage.getItem("applypilot.findJobs.queueAutoApply");
            if (raw === "true") setQueueAutoApply(true);
        } catch {
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem("applypilot.findJobs.queueAutoApply", queueAutoApply ? "true" : "false");
        } catch {
        }
    }, [queueAutoApply]);

    const sourceOptions = useMemo(() => {
        const sources = Array.from(new Set(jobs.map((j) => j.source || "Unknown Source")));
        return ["all", ...sources];
    }, [jobs]);

    const visibleJobs = useMemo(() => {
        let list = [...jobs];
        if (sourceFilter !== "all") {
            list = list.filter((job) => (job.source || "Unknown Source") === sourceFilter);
        }
        if (tierFilter !== "all") {
            list = list.filter((job) => (job.matchTier || "Low") === tierFilter);
        }
        if (sortBy === "newest") {
            list.sort((a, b) => {
                const aTime = a.postedDate ? new Date(a.postedDate).getTime() : 0;
                const bTime = b.postedDate ? new Date(b.postedDate).getTime() : 0;
                return bTime - aTime;
            });
        } else if (sortBy === "company") {
            list.sort((a, b) => (a.company || "").localeCompare(b.company || ""));
        } else {
            list.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
        }
        return list;
    }, [jobs, sortBy, sourceFilter, tierFilter]);

    const pendingSelected = useMemo(
        () => Array.from(selectedJobs).filter((id) => !addedJobs.has(id)),
        [selectedJobs, addedJobs]
    );

    const handleAddToPipeline = async (job: JobListing, options?: { queue?: boolean }) => {
        setLoadingJobs((prev) => new Set(prev).add(job.id));
        setStatusMessage(null);
        try {
            const result = await addJobFromSearchAction(job, { queueAutoApply: Boolean(options?.queue) });
            if ((result?.queued || 0) > 0) {
                setQueuedJobs((prev) => new Set(prev).add(job.id));
            } else if (options?.queue) {
                setStatusMessage("Job saved, but auto-queue skipped (missing URL or already queued).");
            }
            setAddedJobs((prev) => new Set(prev).add(job.id));
            return { added: true, queued: (result?.queued || 0) > 0 };
        } catch (error) {
            console.error("Failed to add job:", error);
            setStatusMessage((error as Error).message || "Failed to add job.");
            return { added: false, queued: false };
        } finally {
            setLoadingJobs((prev) => {
                const newSet = new Set(prev);
                newSet.delete(job.id);
                return newSet;
            });
        }
    };

    const handleBulkAdd = async () => {
        if (!pendingSelected.length) return;
        setBulkLoading(true);
        setStatusMessage(null);
        try {
            const queue = visibleJobs.filter((job) => pendingSelected.includes(job.id));
            let addedCount = 0;
            let queuedCount = 0;
            let failedCount = 0;
            for (const job of queue) {
                const res = await handleAddToPipeline(job, { queue: queueAutoApply });
                if (res.added) {
                    addedCount += 1;
                    if (res.queued) queuedCount += 1;
                } else {
                    failedCount += 1;
                }
            }
            setStatusMessage(
                queueAutoApply
                    ? `Added ${addedCount}. Queued ${queuedCount}. Failed ${failedCount}.`
                    : `Added ${addedCount}. Failed ${failedCount}.`
            );
        } catch (error) {
            console.error(error);
            pushToast("Bulk add hit an error. Some jobs may still have been added.", "error");
        } finally {
            setBulkLoading(false);
        }
    };

    if (jobs.length === 0) {
        return (
            <div className="bg-white p-8 rounded-xl border text-center">
                <p className="text-slate-500">No jobs found. Try a different search query.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
                <h3 className="font-semibold text-lg text-slate-900">
                    Found {jobs.length} Jobs
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as "relevance" | "newest" | "company")}
                        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                    >
                        <option value="relevance">Sort by Match</option>
                        <option value="newest">Sort by Newest</option>
                        <option value="company">Sort by Company</option>
                    </select>
                    <select
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter(e.target.value)}
                        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                    >
                        {sourceOptions.map((source) => (
                            <option key={source} value={source}>
                                {source === "all" ? "All Sources" : source}
                            </option>
                        ))}
                    </select>
                    <select
                        value={tierFilter}
                        onChange={(e) => setTierFilter(e.target.value)}
                        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                    >
                        <option value="all">All Match Tiers</option>
                        <option value="High">High Match</option>
                        <option value="Medium">Medium Match</option>
                        <option value="Low">Low Match</option>
                    </select>
                    <button
                        type="button"
                        onClick={() => {
                            const ids = visibleJobs.map((job) => job.id);
                            setSelectedJobs(new Set(ids));
                        }}
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-xs hover:bg-slate-50"
                    >
                        Select Visible
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedJobs(new Set())}
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-xs hover:bg-slate-50"
                    >
                        Clear
                    </button>
                    <button
                        type="button"
                        onClick={handleBulkAdd}
                        disabled={bulkLoading || pendingSelected.length === 0}
                        className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                        {bulkLoading ? <Loader2 size={12} className="animate-spin" /> : queueAutoApply ? <Bot size={12} /> : <Sparkles size={12} />}
                        {queueAutoApply ? `Add + Queue (${pendingSelected.length})` : `Add Selected (${pendingSelected.length})`}
                    </button>
                    <label className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-[11px] font-medium text-emerald-700">
                        <input
                            type="checkbox"
                            checked={queueAutoApply}
                            onChange={(e) => setQueueAutoApply(e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-emerald-300"
                        />
                        Queue for Auto-Apply
                    </label>
                </div>
            </div>
            {statusMessage && (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    {statusMessage}
                </div>
            )}

            <div className="grid gap-4">
                {visibleJobs.map((job) => {
                    const isAdded = addedJobs.has(job.id);
                    const isQueued = queuedJobs.has(job.id);
                    const isLoading = loadingJobs.has(job.id);
                    const linkedInUrl = job.linkedinUrl || `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(`${job.title} ${job.company}`)}`;
                    const indeedUrl = job.indeedUrl || `https://www.indeed.com/jobs?q=${encodeURIComponent(`${job.title} ${job.company}`)}`;
                    const companySiteUrl = job.companySiteUrl || `https://www.google.com/search?q=${encodeURIComponent(`${job.title} ${job.company} careers`)}`;
                    const posted = job.postedDate ? new Date(job.postedDate) : null;
                    const postedLabel = posted && !Number.isNaN(posted.getTime()) ? posted.toLocaleDateString() : null;
                    const tierClass =
                        job.matchTier === "High"
                            ? "bg-emerald-50 text-emerald-700"
                            : job.matchTier === "Medium"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-slate-100 text-slate-700";

                    return (
                        <div key={job.id} className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md transition">
                            <div className="mb-3 flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        checked={selectedJobs.has(job.id)}
                                        onChange={(e) => {
                                            setSelectedJobs((prev) => {
                                                const next = new Set(prev);
                                                if (e.target.checked) next.add(job.id);
                                                else next.delete(job.id);
                                                return next;
                                            });
                                        }}
                                        className="mt-1 h-4 w-4 rounded border-slate-300"
                                    />
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-lg text-slate-900 mb-1">{job.title}</h4>
                                        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                                            <span className="flex items-center gap-1">
                                                <Briefcase size={14} />
                                                {job.company}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <MapPin size={14} />
                                                {job.location}
                                            </span>
                                            {job.level && <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">{job.level}</span>}
                                            {job.source && <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">{job.source}</span>}
                                            {typeof job.relevance === "number" && <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">Match {job.relevance}</span>}
                                            {job.matchTier && <span className={`px-2 py-0.5 rounded text-xs font-medium ${tierClass}`}>{job.matchTier} tier</span>}
                                            {postedLabel && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-medium">Posted {postedLabel}</span>}
                                        </div>
                                        {job.highlights && job.highlights.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {job.highlights.slice(0, 4).map((highlight) => (
                                                    <span key={`${job.id}-${highlight}`} className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] text-sky-800">
                                                        {highlight}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleAddToPipeline(job, { queue: queueAutoApply })}
                                    disabled={isAdded || isLoading}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium transition ${isAdded ? "bg-green-50 text-green-700 border border-green-200" : "bg-blue-600 text-white hover:bg-blue-700"} disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" /> Adding...
                                        </>
                                    ) : isAdded ? (
                                        <>
                                            <Check size={16} /> {isQueued ? "Added + Queued" : "Added"}
                                        </>
                                    ) : (
                                        <>
                                            {queueAutoApply ? <Bot size={16} /> : <Plus size={16} />}
                                            {queueAutoApply ? "Add + Queue Auto-Apply" : "Add to Pipeline"}
                                        </>
                                    )}
                                </button>
                            </div>
                            <div className="mb-3 flex flex-wrap gap-2">
                                <a href={job.url} target="_blank" rel="noopener noreferrer nofollow" className="px-3 py-1.5 bg-slate-700 text-white rounded text-xs font-medium hover:bg-slate-800 transition">
                                    Original Listing
                                </a>
                                <a href={linkedInUrl} target="_blank" rel="noopener noreferrer nofollow" className="px-3 py-1.5 bg-[#0077b5] text-white rounded text-xs font-medium hover:opacity-90 transition">
                                    LinkedIn
                                </a>
                                <a href={indeedUrl} target="_blank" rel="noopener noreferrer nofollow" className="px-3 py-1.5 bg-[#2164f3] text-white rounded text-xs font-medium hover:opacity-90 transition">
                                    Indeed
                                </a>
                                <a href={companySiteUrl} target="_blank" rel="noopener noreferrer nofollow" className="px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800 transition">
                                    Company Site
                                </a>
                            </div>
                            <p className="text-sm text-slate-600 line-clamp-3">
                                {(job.description || "").replace(/<[^>]*>/g, "").substring(0, 320)}...
                            </p>
                            {job.category && (
                                <div className="mt-3">
                                    <span className="text-xs text-slate-500">Category: {job.category}</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
