"use client";

import { useState } from "react";
import { addJobFromSearchAction } from "@/app/actions";
import { Briefcase, MapPin, Plus, Check, Loader2 } from "lucide-react";

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
    linkedinUrl?: string;
    indeedUrl?: string;
    companySiteUrl?: string;
}

interface JobSearchResultsProps {
    jobs: JobListing[];
}

export function JobSearchResults({ jobs }: JobSearchResultsProps) {
    const [addedJobs, setAddedJobs] = useState<Set<string>>(new Set());
    const [loadingJobs, setLoadingJobs] = useState<Set<string>>(new Set());

    const handleAddToPipeline = async (job: JobListing) => {
        setLoadingJobs(prev => new Set(prev).add(job.id));
        try {
            await addJobFromSearchAction(job);
            setAddedJobs(prev => new Set(prev).add(job.id));
        } catch (error) {
            console.error("Failed to add job:", error);
        } finally {
            setLoadingJobs(prev => {
                const newSet = new Set(prev);
                newSet.delete(job.id);
                return newSet;
            });
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
            <h3 className="font-semibold text-lg text-slate-900">
                Found {jobs.length} Job{jobs.length !== 1 ? 's' : ''}
            </h3>
            <div className="grid gap-4">
                {jobs.map((job) => {
                    const isAdded = addedJobs.has(job.id);
                    const isLoading = loadingJobs.has(job.id);
                    const linkedInUrl = job.linkedinUrl || `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(`${job.title} ${job.company}`)}`;
                    const indeedUrl = job.indeedUrl || `https://www.indeed.com/jobs?q=${encodeURIComponent(`${job.title} ${job.company}`)}`;
                    const companySiteUrl = job.companySiteUrl || `https://www.google.com/search?q=${encodeURIComponent(`${job.title} ${job.company} careers`)}`;
                    const posted = job.postedDate ? new Date(job.postedDate) : null;
                    const postedLabel = posted && !Number.isNaN(posted.getTime())
                        ? posted.toLocaleDateString()
                        : null;

                    return (
                        <div key={job.id} className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md transition">
                            <div className="flex items-start justify-between gap-4 mb-3">
                                <div className="flex-1">
                                    <h4 className="font-semibold text-lg text-slate-900 mb-1">{job.title}</h4>
                                    <div className="flex items-center gap-4 text-sm text-slate-600">
                                        <span className="flex items-center gap-1">
                                            <Briefcase size={14} />
                                            {job.company}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <MapPin size={14} />
                                            {job.location}
                                        </span>
                                        {job.level && (
                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                                                {job.level}
                                            </span>
                                        )}
                                        {job.source && (
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                                                {job.source}
                                            </span>
                                        )}
                                        {typeof job.relevance === "number" && (
                                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-medium">
                                                Match {job.relevance}
                                            </span>
                                        )}
                                        {postedLabel && (
                                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-medium">
                                                Posted {postedLabel}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleAddToPipeline(job)}
                                        disabled={isAdded || isLoading}
                                        className={`flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium transition ${isAdded
                                                ? 'bg-green-50 text-green-700 border border-green-200'
                                                : 'bg-blue-600 text-white hover:bg-blue-700'
                                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {isLoading ? (
                                            <><Loader2 size={16} className="animate-spin" /> Adding...</>
                                        ) : isAdded ? (
                                            <><Check size={16} /> Added</>
                                        ) : (
                                            <><Plus size={16} /> Add to Pipeline</>
                                        )}
                                    </button>
                                </div>
                            </div>
                            <div className="mb-3 flex flex-wrap gap-2">
                                <a
                                    href={job.url}
                                    target="_blank"
                                    rel="noopener noreferrer nofollow"
                                    className="px-3 py-1.5 bg-slate-700 text-white rounded text-xs font-medium hover:bg-slate-800 transition"
                                >
                                    Original Listing
                                </a>
                                <a
                                    href={linkedInUrl}
                                    target="_blank"
                                    rel="noopener noreferrer nofollow"
                                    className="px-3 py-1.5 bg-[#0077b5] text-white rounded text-xs font-medium hover:opacity-90 transition"
                                >
                                    LinkedIn
                                </a>
                                <a
                                    href={indeedUrl}
                                    target="_blank"
                                    rel="noopener noreferrer nofollow"
                                    className="px-3 py-1.5 bg-[#2164f3] text-white rounded text-xs font-medium hover:opacity-90 transition"
                                >
                                    Indeed
                                </a>
                                <a
                                    href={companySiteUrl}
                                    target="_blank"
                                    rel="noopener noreferrer nofollow"
                                    className="px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800 transition"
                                >
                                    Company Site
                                </a>
                            </div>
                            <p className="text-sm text-slate-600 line-clamp-3">
                                {job.description.replace(/<[^>]*>/g, '').substring(0, 300)}...
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
