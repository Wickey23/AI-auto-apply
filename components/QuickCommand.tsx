"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

const COMMANDS = [
    { label: "Go to Dashboard", href: "/dashboard", group: "Navigate" },
    { label: "Go to Find Jobs", href: "/find-jobs", group: "Navigate" },
    { label: "Go to Jobs Queue", href: "/jobs", group: "Navigate" },
    { label: "Go to Offers", href: "/offers", group: "Navigate" },
    { label: "Go to Documents", href: "/documents", group: "Navigate" },
    { label: "Go to Network", href: "/network", group: "Navigate" },
    { label: "Go to Profile", href: "/profile", group: "Navigate" },
    { label: "Go to Settings", href: "/settings", group: "Navigate" },
    { label: "Create New Job", href: "/jobs/new", group: "Actions" },
];

export function QuickCommand() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [dynamicCommands, setDynamicCommands] = useState<Array<{ label: string; href: string; group: string }>>([]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const isHotkey = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
            if (isHotkey) {
                e.preventDefault();
                setOpen((v) => !v);
            }
            if (e.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/command-data");
                if (!res.ok) return;
                const data = await res.json();
                if (cancelled) return;

                const appCommands = (data.applications || []).map((a: any) => ({
                    label: `Application: ${a.title} @ ${a.company} (${a.status})`,
                    href: `/applications/${a.id}`,
                    group: "Applications",
                }));
                const jobCommands = (data.jobs || []).map((j: any) => ({
                    label: `Job: ${j.title} @ ${j.company}`,
                    href: "/jobs",
                    group: "Jobs",
                }));
                const resumeCommands = (data.resumes || []).map((r: any) => ({
                    label: `Resume: ${r.name} (v${r.version})`,
                    href: "/documents",
                    group: "Documents",
                }));
                setDynamicCommands([...appCommands, ...jobCommands, ...resumeCommands].slice(0, 120));
            } catch {
                // ignore fetch errors
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open]);

    const filtered = useMemo(() => {
        const allCommands = [...COMMANDS, ...dynamicCommands];
        const q = query.trim().toLowerCase();
        if (!q) return allCommands;
        return allCommands.filter((c) => c.label.toLowerCase().includes(q) || c.href.toLowerCase().includes(q));
    }, [dynamicCommands, query]);

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="hidden md:inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
            >
                <Search className="h-3.5 w-3.5" />
                Quick Search
                <span className="rounded border px-1.5 py-0.5 text-[10px] text-slate-500">Ctrl/⌘K</span>
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/30 p-4 md:p-24" onClick={() => setOpen(false)}>
            <div className="mx-auto max-w-2xl rounded-xl border bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2 border-b px-4 py-3">
                    <Search className="h-4 w-4 text-slate-500" />
                    <input
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search actions and pages..."
                        className="w-full bg-transparent text-sm outline-none"
                    />
                </div>
                <div className="max-h-[55vh] overflow-y-auto p-2">
                    {filtered.map((cmd) => (
                        <Link
                            key={`${cmd.href}-${cmd.label}`}
                            href={cmd.href}
                            onClick={() => setOpen(false)}
                            className="block rounded-md px-3 py-2 hover:bg-slate-50"
                        >
                            <div className="text-sm font-medium text-slate-900">{cmd.label}</div>
                            <div className="text-xs text-slate-500">{cmd.group} · {cmd.href}</div>
                        </Link>
                    ))}
                    {filtered.length === 0 && (
                        <div className="px-3 py-6 text-center text-sm text-slate-500">No matching commands.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
