"use client";

import { useState } from "react";
import { scanEmailsAction } from "@/app/actions";
import { Mail, Loader2, RefreshCw } from "lucide-react";

export function ScanEmailButton() {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{ success: boolean; updates: number } | null>(null);

    const handleScan = async () => {
        setIsLoading(true);
        setResult(null);
        try {
            const res = await scanEmailsAction();
            setResult(res);
            setTimeout(() => setResult(null), 5000);
        } catch (error) {
            console.error(error);
            alert("Failed to scan emails. Check your settings.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            {result && (
                <span className="text-sm text-green-600 font-medium animate-in fade-in">
                    Found {result.updates} updates!
                </span>
            )}
            <button
                onClick={handleScan}
                disabled={isLoading}
                className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
                {isLoading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                Scan Emails
            </button>
        </div>
    );
}
