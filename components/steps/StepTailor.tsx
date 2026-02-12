"use client";

import { Application } from "@/lib/types";
import { generateTailoringAction, saveTailoring } from "@/app/actions";
import { useState } from "react";
import { Loader2, FileText, Copy, ArrowRight, Save, AlertCircle } from "lucide-react";

interface StepTailorProps {
    application: Application;
    onComplete: () => void;
}

export function StepTailor({ application, onComplete }: StepTailorProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tailoredContent, setTailoredContent] = useState<any>((application as any).tailoring || null);

    const handleGenerate = async () => {
        setIsGenerating(true);
        setError(null);
        try {
            const result = await generateTailoringAction(
                application.job.description || "",
                // We pass undefined for resumeId to use default, or ideally we'd let user pick
                undefined
            );
            setTailoredContent(result);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveAndContinue = async () => {
        if (tailoredContent) {
            setIsSaving(true);
            await saveTailoring(application.id, tailoredContent);
            setIsSaving(false);
            onComplete();
        } else {
            onComplete();
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-purple-50 border border-purple-100 p-4 rounded-lg">
                <h3 className="font-semibold text-purple-900 mb-2">Step 2: Tailor Materials</h3>
                <p className="text-sm text-purple-700">
                    Generate optimized keywords, resume bullets, and a cover letter based on the job description.
                </p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex gap-2 items-start text-red-700 text-sm">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <div>
                        <p className="font-semibold">Generation Failed</p>
                        <p>{error}</p>
                    </div>
                </div>
            )}

            {!tailoredContent ? (
                <div className="text-center py-12 border-2 border-dashed rounded-xl bg-slate-50">
                    <FileText className="mx-auto text-slate-400 mb-4" size={48} />
                    <h3 className="text-lg font-medium text-slate-900">No tailoring generated yet</h3>
                    <p className="text-slate-500 mb-6 max-w-md mx-auto">
                        Our AI will analyze the job description and your profile to suggest the best customization.
                    </p>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition disabled:opacity-50 font-medium"
                    >
                        {isGenerating ? <Loader2 className="mr-2 animate-spin" size={20} /> : <FileText className="mr-2" size={20} />}
                        Generate Tailored Content
                    </button>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Keywords */}
                    <div className="bg-white p-6 rounded-xl border shadow-sm">
                        <h3 className="text-sm font-semibold uppercase text-slate-500 tracking-wider mb-4">Keyword Analysis</h3>
                        <div className="flex flex-wrap gap-2">
                            {tailoredContent.keywords.map((k: string) => (
                                <span key={k} className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full font-medium">
                                    {k}
                                </span>
                            ))}
                            {tailoredContent.missingKeywords.map((k: string) => (
                                <span key={k} className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded-full font-medium border border-red-200">
                                    Missing: {k}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Cover Letter */}
                    <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold uppercase text-slate-500 tracking-wider">Draft Cover Letter</h3>
                            <button
                                onClick={() => navigator.clipboard.writeText(tailoredContent.coverLetter)}
                                className="text-xs text-blue-600 flex items-center gap-1 hover:underline cursor-pointer"
                            >
                                <Copy size={12} /> Copy to Clipboard
                            </button>
                        </div>
                        <div className="bg-slate-50 p-4 rounded border text-sm whitespace-pre-line text-slate-700 leading-relaxed font-serif">
                            {tailoredContent.coverLetter}
                        </div>
                    </div>

                    {/* Bullets */}
                    <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold uppercase text-slate-500 tracking-wider">Suggested Resume Bullets</h3>
                        </div>
                        <ul className="space-y-3">
                            {tailoredContent.resumeBullets.map((bullet: string, i: number) => (
                                <li key={i} className="bg-slate-50 p-3 rounded border text-sm flex gap-3">
                                    <span className="text-blue-500 font-bold mt-0.5">•</span>
                                    {bullet}
                                    <button className="ml-auto text-slate-400 hover:text-blue-600" title="Copy">
                                        <Copy size={14} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="flex justify-end pt-4 border-t sticky bottom-0 bg-white/80 backdrop-blur-sm p-4 -mx-4 -mb-6 md:static md:bg-transparent md:p-0">
                        <button
                            onClick={handleSaveAndContinue}
                            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition shadow-lg"
                        >
                            {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                            Save & Continue
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
