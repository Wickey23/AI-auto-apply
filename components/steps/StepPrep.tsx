"use client";

import { Application } from "@/lib/types";
import { MessageSquare, Star, ChevronDown, ChevronUp, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { createAnswerBankItem, generateInterviewPrepPack } from "@/app/actions";

interface StepPrepProps {
    application: Application;
    onComplete: () => void;
}

type PrepQuestion = {
    question: string;
    tags: string[];
    guidance?: string;
};

export function StepPrep({ application, onComplete }: StepPrepProps) {
    const [prepPack, setPrepPack] = useState<any | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [answers, setAnswers] = useState<Record<number, string>>({});

    const [expanded, setExpanded] = useState<number | null>(0);

    const questions: PrepQuestion[] = prepPack?.likelyQuestions || [
        { question: "Tell me about a time you faced a technical challenge.", tags: ["Behavioral", "STAR"], guidance: "Use STAR format with a metric." },
        { question: "Why do you want to work at " + application.job.company + "?", tags: ["Motivation"], guidance: "Connect your skills to company mission." },
        { question: "What is your experience with this tech stack?", tags: ["Technical"], guidance: "Share practical examples and outcomes." },
    ];

    const handleGeneratePrep = async () => {
        setIsGenerating(true);
        try {
            const pack = await generateInterviewPrepPack(application.id);
            setPrepPack(pack);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveAnswer = async (index: number) => {
        const answer = (answers[index] || "").trim();
        if (!answer) return;
        const question = questions[index]?.question || `Interview prep question ${index + 1}`;
        const tags = questions[index]?.tags || ["Interview"];
        await createAnswerBankItem(question, answer, tags);
    };

    return (
        <div className="space-y-6">
            <div className="bg-green-50 border border-green-100 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">Step 3: Interview Prep</h3>
                <p className="text-sm text-green-700">
                    Prepare your stories and answers. Review these potential questions.
                </p>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">Likely Interview Questions</h3>
                    <button
                        onClick={handleGeneratePrep}
                        disabled={isGenerating}
                        className="inline-flex items-center rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                        {isGenerating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}
                        Generate Prep Pack
                    </button>
                </div>
                {prepPack && (
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-md border bg-slate-50 p-3">
                            <p className="text-xs font-semibold text-slate-800 mb-2">Top Matched Skills</p>
                            <div className="flex flex-wrap gap-1">
                                {(prepPack.topSkills || []).map((s: string) => (
                                    <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">{s}</span>
                                ))}
                            </div>
                        </div>
                        <div className="rounded-md border bg-slate-50 p-3">
                            <p className="text-xs font-semibold text-slate-800 mb-2">Potential Skill Gaps to Prep</p>
                            <div className="flex flex-wrap gap-1">
                                {(prepPack.missingSkills || []).map((s: string) => (
                                    <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{s}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                {questions.map((item, i) => (
                    <div key={i} className="bg-white border rounded-lg shadow-sm overflow-hidden">
                        <div
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition"
                            onClick={() => setExpanded(expanded === i ? null : i)}
                        >
                            <div className="flex items-center gap-3">
                                <MessageSquare className="text-slate-400" size={18} />
                                <span className="font-medium text-slate-800">{item.question}</span>
                            </div>
                            {expanded === i ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                        </div>

                        {expanded === i && (
                            <div className="p-4 bg-slate-50 border-t space-y-3">
                                <div className="flex gap-2 mb-2">
                                    {(item.tags || []).map((tag: string) => (
                                        <span key={tag} className="text-xs font-medium px-2 py-0.5 bg-white border rounded text-slate-600">{tag}</span>
                                    ))}
                                </div>
                                {item.guidance && (
                                    <p className="text-xs text-slate-500 mb-2">{item.guidance}</p>
                                )}
                                <textarea
                                    value={answers[i] || ""}
                                    onChange={(e) => setAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
                                    className="w-full p-3 text-sm border rounded shadow-sm focus:border-blue-500 focus:outline-none"
                                    rows={3}
                                    placeholder="Draft your answer here..."
                                />
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => handleSaveAnswer(i)}
                                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                        <Star size={12} /> Save to Answer Bank
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex justify-end pt-4 border-t">
                <button
                    onClick={onComplete}
                    className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition"
                >
                    Continue to Application
                </button>
            </div>
        </div>
    );
}
