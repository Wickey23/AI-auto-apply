"use client";

import { Application } from "@/lib/types";
import { useState } from "react";
import { CheckCircle, ExternalLink, Globe, MapPin, Building } from "lucide-react";

interface StepResearchProps {
    application: Application;
    onComplete: () => void;
}

export function StepResearch({ application, onComplete }: StepResearchProps) {
    const [notes, setNotes] = useState(application.notes || "");

    return (
        <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">Step 1: Research & Context</h3>
                <p className="text-sm text-blue-700">
                    Review the job description and company details. Take notes on key requirements or team members to mention.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="bg-white p-4 rounded-lg border shadow-sm">
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
                        className="w-full h-48 p-3 text-sm border rounded-md focus:border-blue-500 focus:outline-none"
                        placeholder="Key things to mention: 
- Using Next.js
- Mention shared connection
- Values: 'Move fast'"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </div>
            </div>

            <div className="border bg-slate-50 p-4 rounded-md h-64 overflow-y-auto">
                <h4 className="font-medium text-slate-900 mb-2 text-sm sticky top-0 bg-slate-50">Job Description</h4>
                <div className="whitespace-pre-line text-sm text-slate-700">
                    {application.job.description || "No description available."}
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
