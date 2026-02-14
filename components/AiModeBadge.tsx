"use client";

import { getAiModeStatusAction } from "@/app/actions";
import { useEffect, useState } from "react";
import { Bot, KeyRound } from "lucide-react";

type AiModeStatus = {
    selected: string;
    effective: "local" | "openai" | "groq";
    noToken: boolean;
    note: string;
};

export function AiModeBadge() {
    const [status, setStatus] = useState<AiModeStatus | null>(null);

    useEffect(() => {
        let alive = true;
        getAiModeStatusAction()
            .then((res) => {
                if (alive) setStatus(res as AiModeStatus);
            })
            .catch(() => {
                if (alive) setStatus(null);
            });
        return () => {
            alive = false;
        };
    }, []);

    if (!status) {
        return (
            <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-500">
                <Bot size={12} />
                AI mode
            </div>
        );
    }

    return (
        <div
            title={status.note}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${status.noToken
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-blue-200 bg-blue-50 text-blue-700"
                }`}
        >
            {status.noToken ? <Bot size={12} /> : <KeyRound size={12} />}
            {status.noToken ? "Built-in AI (No Token)" : `${status.effective.toUpperCase()} AI`}
        </div>
    );
}
