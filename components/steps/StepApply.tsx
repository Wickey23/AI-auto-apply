"use client";

import { Application } from "@/lib/types";
import { Copy, ExternalLink, CheckCircle, AlertTriangle } from "lucide-react";
import { useState } from "react";

interface StepApplyProps {
    application: Application;
    onComplete: () => void;
}

export function StepApply({ application, onComplete }: StepApplyProps) {
    const [confirmed, setConfirmed] = useState(false);

    // Mock fields to copy
    const fields = [
        { label: "Company", value: application.job.company },
        { label: "Title", value: application.job.title },
        { label: "Phone", value: "555-0123" }, // Should come from Profile
        { label: "Email", value: "user@example.com" }, // Should come from Profile
        { label: "LinkedIn", value: "linkedin.com/in/user" }, // Should come from Profile
    ];

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        // Could show toast here
    };

    const followUpSubject = `Following up on ${application.job.title} application`;
    const followUpBody = `Hi Hiring Team,\n\nI hope you're doing well. I wanted to follow up on my application for the ${application.job.title} role at ${application.job.company}. I remain very interested in the opportunity and would appreciate any update on next steps.\n\nThanks for your time,\n[Your Name]`;
    const thankYouSubject = `Thank you - ${application.job.title} interview`;
    const thankYouBody = `Hi [Interviewer Name],\n\nThank you for speaking with me today about the ${application.job.title} role at ${application.job.company}. I enjoyed learning more about the team and the work. Our conversation reinforced my excitement about the opportunity.\n\nThanks again,\n[Your Name]`;

    return (
        <div className="space-y-6">
            <div className="bg-orange-50 border border-orange-100 p-4 rounded-lg flex gap-3">
                <AlertTriangle className="text-orange-600 shrink-0 mt-0.5" size={20} />
                <div>
                    <h3 className="font-semibold text-orange-900 mb-1">Step 3: Application Submission</h3>
                    <p className="text-sm text-orange-800">
                        Open the job portal below. Use the "Copy" buttons to quickly fill fields.
                        <strong> Do not submit until you have visually verified all information.</strong>
                    </p>
                </div>
            </div>

            <div className="flex gap-4">
                <div className="w-1/3 space-y-4">
                    <div className="bg-white border rounded-lg p-4 shadow-sm">
                        <h4 className="font-medium mb-3 text-sm uppercase tracking-wider text-slate-500">Quick Copy</h4>
                        <div className="space-y-3">
                            {fields.map((f, i) => (
                                <div key={i} className="flex justify-between items-center group">
                                    <div>
                                        <span className="text-xs text-slate-500 block">{f.label}</span>
                                        <span className="text-sm font-medium truncate max-w-[150px] block">{f.value}</span>
                                    </div>
                                    <button
                                        onClick={() => copyToClipboard(f.value)}
                                        className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition"
                                        title="Copy"
                                    >
                                        <Copy size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {application.job.link && (
                        <a
                            href={application.job.link}
                            target="_blank"
                            className="flex justify-center items-center w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition shadow-sm"
                        >
                            Open Application Portal <ExternalLink size={16} className="ml-2" />
                        </a>
                    )}
                </div>

                <div className="w-2/3 bg-slate-50 rounded-lg border flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <div className="max-w-md space-y-4">
                        <h3 className="font-semibold text-lg">Submission Checklist</h3>
                        <div className="space-y-2 text-left bg-white p-4 rounded border">
                            <label className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 text-blue-600" />
                                <span className="text-sm">Verified Resume version attachment</span>
                            </label>
                            <label className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 text-blue-600" />
                                <span className="text-sm">Verified Cover Letter content</span>
                            </label>
                            <label className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 text-blue-600" />
                                <span className="text-sm">Checked for typos in form fields</span>
                            </label>
                            <label className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={confirmed}
                                    onChange={(e) => setConfirmed(e.target.checked)}
                                    className="w-4 h-4 text-blue-600"
                                />
                                <span className="text-sm font-semibold">I have clicked Submit on the portal</span>
                            </label>
                        </div>

                        <button
                            disabled={!confirmed}
                            onClick={onComplete}
                            className="w-full py-3 bg-green-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-bold shadow-lg transition hover:scale-[1.02]"
                        >
                            Confirm Submission
                        </button>
                    </div>
                </div>
            </div>

            <div className="rounded-lg border bg-white p-4 space-y-4">
                <h4 className="text-sm font-semibold text-slate-800">Post-Apply Communication Drafts</h4>
                <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-md border bg-slate-50 p-3 space-y-2">
                        <p className="text-xs font-semibold text-slate-700">Status Follow-up (5-7 days)</p>
                        <p className="text-[11px] text-slate-500">Subject: {followUpSubject}</p>
                        <pre className="whitespace-pre-wrap text-xs text-slate-700">{followUpBody}</pre>
                        <button
                            onClick={() => copyToClipboard(`Subject: ${followUpSubject}\n\n${followUpBody}`)}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                            <Copy size={12} /> Copy Draft
                        </button>
                    </div>
                    <div className="rounded-md border bg-slate-50 p-3 space-y-2">
                        <p className="text-xs font-semibold text-slate-700">Interview Thank-You</p>
                        <p className="text-[11px] text-slate-500">Subject: {thankYouSubject}</p>
                        <pre className="whitespace-pre-wrap text-xs text-slate-700">{thankYouBody}</pre>
                        <button
                            onClick={() => copyToClipboard(`Subject: ${thankYouSubject}\n\n${thankYouBody}`)}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                            <Copy size={12} /> Copy Draft
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
