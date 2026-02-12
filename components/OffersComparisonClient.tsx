"use client";

import { Application } from "@/lib/types";
import { useMemo, useState } from "react";

function parseSalaryToNumber(value?: string) {
    if (!value) return null;
    const matches = value.replace(/,/g, "").match(/\d{2,6}/g);
    if (!matches || matches.length === 0) return null;
    const nums = matches.map((m) => Number(m)).filter((n) => Number.isFinite(n));
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function normalizeSalaryScore(value?: string) {
    const n = parseSalaryToNumber(value);
    if (!n) return 55;
    const min = 50000;
    const max = 300000;
    const score = ((n - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, Math.round(score)));
}

function remoteScore(policy?: string) {
    if (!policy) return 60;
    if (policy === "Remote") return 100;
    if (policy === "Hybrid") return 75;
    return 45;
}

export default function OffersComparisonClient({ offers }: { offers: Application[] }) {
    const [wComp, setWComp] = useState(40);
    const [wFlex, setWFlex] = useState(20);
    const [wPriority, setWPriority] = useState(25);
    const [wConfidence, setWConfidence] = useState(15);

    const scored = useMemo(() => {
        const total = wComp + wFlex + wPriority + wConfidence;
        return offers
            .map((app) => {
                const compensation = normalizeSalaryScore(app.job.salaryTarget);
                const flexibility = remoteScore(app.job.remotePolicy);
                const priority = Math.max(0, Math.min(100, app.job.priorityScore || 50));
                const confidence = app.status === "OFFER" ? 100 : 30;
                const weighted =
                    (compensation * wComp +
                        flexibility * wFlex +
                        priority * wPriority +
                        confidence * wConfidence) / Math.max(total, 1);
                return { app, compensation, flexibility, priority, confidence, score: Math.round(weighted) };
            })
            .sort((a, b) => b.score - a.score);
    }, [offers, wComp, wConfidence, wFlex, wPriority]);

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Offer Comparison</h2>
                <p className="text-muted-foreground">Compare offers using weighted criteria.</p>
            </div>

            <div className="rounded-xl border bg-white p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">Scoring Weights</h3>
                <WeightSlider label="Compensation" value={wComp} setValue={setWComp} />
                <WeightSlider label="Flexibility" value={wFlex} setValue={setWFlex} />
                <WeightSlider label="Priority / Fit" value={wPriority} setValue={setWPriority} />
                <WeightSlider label="Confidence" value={wConfidence} setValue={setWConfidence} />
            </div>

            <div className="rounded-xl border bg-white overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                        <tr>
                            <th className="text-left px-4 py-3">Offer</th>
                            <th className="text-left px-4 py-3">Comp</th>
                            <th className="text-left px-4 py-3">Flex</th>
                            <th className="text-left px-4 py-3">Priority</th>
                            <th className="text-left px-4 py-3">Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        {scored.map((row) => (
                            <tr key={row.app.id} className="border-t">
                                <td className="px-4 py-3">
                                    <p className="font-semibold text-slate-900">{row.app.job.title}</p>
                                    <p className="text-xs text-slate-500">{row.app.job.company}</p>
                                </td>
                                <td className="px-4 py-3 text-slate-700">
                                    {row.app.job.salaryTarget || "N/A"} <span className="text-xs text-slate-400">({row.compensation})</span>
                                </td>
                                <td className="px-4 py-3 text-slate-700">
                                    {row.app.job.remotePolicy || "Unknown"} <span className="text-xs text-slate-400">({row.flexibility})</span>
                                </td>
                                <td className="px-4 py-3 text-slate-700">{row.priority}</td>
                                <td className="px-4 py-3">
                                    <span className="rounded-full border px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">
                                        {row.score}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {scored.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                                    No offers yet. Mark an application as OFFER to compare here.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function WeightSlider({
    label,
    value,
    setValue,
}: {
    label: string;
    value: number;
    setValue: (n: number) => void;
}) {
    return (
        <div className="grid grid-cols-[140px_1fr_44px] items-center gap-3">
            <span className="text-xs text-slate-700">{label}</span>
            <input
                type="range"
                min={0}
                max={60}
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
            />
            <span className="text-xs text-slate-500 text-right">{value}</span>
        </div>
    );
}

