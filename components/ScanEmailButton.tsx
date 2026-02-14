"use client";

import { useState } from "react";
import { scanEmailsAction } from "@/app/actions";
import { History, Loader2, RefreshCw } from "lucide-react";

export function ScanEmailButton() {
    const [isLoading, setIsLoading] = useState<"recent" | "history" | null>(null);
    const [lastMode, setLastMode] = useState<"recent" | "history">("recent");
    const [result, setResult] = useState<{
        success: boolean;
        updates: number;
        source?: string;
        importedJobs?: number;
        importedApplications?: number;
        queued?: number;
        scanned?: number;
    } | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleScan = async (mode: "recent" | "history") => {
        if (mode === "history") {
            const ok = window.confirm(
                "Import email history from the last year? This will add prior applications to your queue when detected."
            );
            if (!ok) return;
        }

        setIsLoading(mode);
        setLastMode(mode);
        setResult(null);
        setErrorMessage(null);
        try {
            const res = await scanEmailsAction(mode);
            setResult(res);
            setTimeout(() => setResult(null), 5000);
        } catch (error) {
            console.error(error);
            setErrorMessage((error as Error).message || "Failed to scan emails. Check your settings.");
        } finally {
            setIsLoading(null);
        }
    };

    return (
        <div className="flex flex-col items-start gap-1">
            {result && (
                <span className="text-sm text-green-600 font-medium animate-in fade-in">
                    {lastMode === "history" ? "History import complete." : "Email scan complete."} Found {result.updates} status updates, imported {result.importedApplications || 0} prior applications
                    {result.source ? ` via ${result.source}` : ""}.
                </span>
            )}
            {errorMessage && (
                <span className="text-xs text-red-600 max-w-[380px]">
                    {errorMessage}
                </span>
            )}
            <div className="flex flex-wrap items-center gap-2">
                <button
                    onClick={() => handleScan("recent")}
                    disabled={Boolean(isLoading)}
                    className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                >
                    {isLoading === "recent" ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                    Scan Recent Emails
                </button>
                <button
                    onClick={() => handleScan("history")}
                    disabled={Boolean(isLoading)}
                    className="flex items-center gap-2 bg-slate-900 text-white border border-slate-900 px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
                >
                    {isLoading === "history" ? <Loader2 className="animate-spin" size={16} /> : <History size={16} />}
                    Import Email History
                </button>
            </div>
        </div>
    );
}
