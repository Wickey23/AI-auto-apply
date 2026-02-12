"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Bot, BriefcaseBusiness, FileSearch, MailCheck, ShieldCheck, Sparkles, Users } from "lucide-react";

export default function HomeAuthLanding() {
    const [mode, setMode] = useState<"login" | "register">("login");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Authentication failed.");
            router.push("/dashboard");
            router.refresh();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            <section className="relative overflow-hidden border-b border-white/10">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-24 -left-20 h-80 w-80 rounded-full bg-cyan-500/25 blur-3xl" />
                    <div className="absolute -bottom-24 -right-10 h-96 w-96 rounded-full bg-blue-600/25 blur-3xl" />
                </div>
                <div className="relative mx-auto grid min-h-[70vh] max-w-6xl items-center gap-8 px-6 pb-14 pt-20 md:grid-cols-2 md:pb-20 md:pt-24">
                    <div className="space-y-5">
                        <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-cyan-100">
                            <Sparkles size={14} /> ApplyPilot
                        </p>
                        <h1 className="text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
                            Sign in and run your entire job search from one system.
                        </h1>
                        <p className="text-slate-200/90">
                            Track opportunities, tailor resumes, generate cover letters, and manage outreach without juggling tools.
                        </p>
                        <a href="#features" className="inline-flex items-center gap-2 text-sm text-cyan-200 hover:text-cyan-100">
                            Explore everything you can do <ArrowRight size={16} />
                        </a>
                    </div>

                    <form onSubmit={submit} className="rounded-2xl border border-white/15 bg-white/95 p-5 text-slate-900 shadow-2xl md:p-7">
                        <div className="mb-4 flex items-center gap-2 rounded-lg bg-slate-100 p-1">
                            <button
                                type="button"
                                onClick={() => setMode("login")}
                                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${mode === "login" ? "bg-white shadow" : "text-slate-600"}`}
                            >
                                Login
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode("register")}
                                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${mode === "register" ? "bg-white shadow" : "text-slate-600"}`}
                            >
                                Sign Up
                            </button>
                        </div>

                        {mode === "register" && (
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Full name"
                                className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                            />
                        )}
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email address"
                            className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                            required
                        />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                            required
                        />
                        {error && <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-4 w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                            {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
                        </button>
                    </form>
                </div>
            </section>

            <section id="features" className="mx-auto max-w-6xl px-6 py-14 md:py-20">
                <h2 className="text-2xl font-semibold md:text-3xl">What you get after login</h2>
                <p className="mt-2 text-slate-300">A complete search workflow from discovery to interview prep.</p>
                <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <FeatureCard icon={<FileSearch size={18} />} title="Find Jobs Engine" text="Multi-source job search with filters, scoring, and saved workflow." />
                    <FeatureCard icon={<BriefcaseBusiness size={18} />} title="Pipeline Tracking" text="Manage statuses from interested to offer with daily analytics." />
                    <FeatureCard icon={<Bot size={18} />} title="Resume Workshop" text="Generate targeted resumes and cover letters for specific roles." />
                    <FeatureCard icon={<MailCheck size={18} />} title="Email Updates" text="Scan inbox updates to keep your application timeline current." />
                    <FeatureCard icon={<Users size={18} />} title="Networking CRM" text="Track recruiters/contacts and interaction history in one view." />
                    <FeatureCard icon={<ShieldCheck size={18} />} title="Secure Account Isolation" text="Each account has isolated data and admin-level controls." />
                </div>
            </section>
        </div>
    );
}

function FeatureCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
    return (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <p className="inline-flex items-center gap-2 text-cyan-200">{icon} {title}</p>
            <p className="mt-2 text-sm text-slate-300">{text}</p>
        </div>
    );
}
