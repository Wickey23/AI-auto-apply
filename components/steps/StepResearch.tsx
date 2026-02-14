"use client";

import { Application } from "@/lib/types";
import { useMemo, useState } from "react";
import { CheckCircle, ExternalLink, Building } from "lucide-react";

interface StepResearchProps {
    application: Application;
    onComplete: () => void;
}

export function StepResearch({ application, onComplete }: StepResearchProps) {
    const [notes, setNotes] = useState(application.notes || "");
    const readableDescription = useMemo(
        () => toReadableDescription(application.job.description || ""),
        [application.job.description]
    );

    return (
        <div className="space-y-6">
            <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Step 1: Research & Context</h3>
                <p className="text-sm text-blue-700">
                    Review the job description and company details. Take notes on key requirements or team members to mention.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                            <Building size={16} className="text-slate-500" /> Company Snapshot
                        </h4>
                        <div className="space-y-2 text-sm">
                            <p><span className="text-slate-500">Name:</span> {application.job.company}</p>
                            <p><span className="text-slate-500">Location:</span> {application.job.location || "N/A"}</p>
                            <p><span className="text-slate-500">Source:</span> {application.job.source || "Unknown"}</p>
                            {application.job.link && (
                                <a href={application.job.link} target="_blank" className="text-blue-600 hover:underline flex items-center gap-1 mt-2">
                                    View Job Post <ExternalLink size={12} />
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h4 className="font-medium text-slate-900">Research Notes</h4>
                    <textarea
                        className="h-56 w-full rounded-xl border border-slate-300 bg-white p-4 text-sm leading-relaxed focus:border-blue-500 focus:outline-none"
                        placeholder="Capture talking points:
- team priorities
- tools/stack mentioned
- mission/culture cues
- people to reference in outreach"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </div>
            </div>

            <div className="h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h4 className="sticky top-0 mb-3 bg-white pb-2 text-sm font-semibold tracking-wide text-slate-700">Job Description</h4>
                <div className="space-y-3 text-sm leading-7 text-slate-700">
                    {readableDescription.paragraphs.map((paragraph, idx) => (
                        <p key={`${application.id}-${idx}`}>{paragraph}</p>
                    ))}
                    {readableDescription.paragraphs.length === 0 && (
                        <p className="text-slate-500">No description available.</p>
                    )}
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
                <button
                    onClick={onComplete}
                    className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition"
                >
                    <CheckCircle size={16} /> Mark Research Complete
                </button>
            </div>
        </div>
    );
}

function toReadableDescription(raw: string): { paragraphs: string[] } {
    if (!raw.trim()) return { paragraphs: [] };

    const normalizedHtml = raw
        .replace(/<\s*br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<li>/gi, "\n- ")
        .replace(/<\/li>/gi, "")
        .replace(/<\/h[1-6]>/gi, "\n\n");

    const temp = globalThis.document?.createElement("div");
    if (!temp) {
        const fallback = normalizedHtml.replace(/<[^>]*>/g, " ");
        return {
            paragraphs: fallback
                .split(/\n{2,}/)
                .map((x) => x.replace(/\s+/g, " ").trim())
                .filter(Boolean),
        };
    }

    temp.innerHTML = normalizedHtml;
    const decoded = (temp.textContent || "")
        .replace(/\u00a0/g, " ")
        .replace(/\r/g, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    return {
        paragraphs: decoded
            .split(/\n{2,}/)
            .map((x) => x.replace(/\s+/g, " ").trim())
            .filter(Boolean),
    };
}
