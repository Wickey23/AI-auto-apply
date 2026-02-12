"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Space_Grotesk } from "next/font/google";
import { ShieldCheck, Sparkles, BriefcaseBusiness } from "lucide-react";

const spaceGrotesk = Space_Grotesk({
    subsets: ["latin"],
    variable: "--font-space-grotesk",
});

export default function LoginPage() {
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
            const identifier = email.trim();
            const isAdminLogin = mode === "login" && identifier.toLowerCase() === "admin";
            if (mode === "register" && !identifier.includes("@")) {
                throw new Error("Please enter a valid email for registration.");
            }

            const endpoint = isAdminLogin
                ? "/api/auth/admin-login"
                : mode === "login"
                    ? "/api/auth/login"
                    : "/api/auth/register";
            const payload = isAdminLogin
                ? { username: "admin", password }
                : { name, email: identifier, password };

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error || "Authentication failed.");
            }
            router.push(isAdminLogin ? "/admin" : "/dashboard");
            router.refresh();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`${spaceGrotesk.variable} relative min-h-screen overflow-hidden bg-slate-950`}>
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-28 -left-20 h-80 w-80 rounded-full bg-cyan-500/25 blur-3xl" />
                <div className="absolute -bottom-20 -right-16 h-96 w-96 rounded-full bg-blue-600/30 blur-3xl" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_45%)]" />
            </div>

            <div className="relative mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 gap-6 p-5 md:grid-cols-2 md:items-center md:p-10">
                <div className="hidden md:block">
                    <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-cyan-100">
                        <Sparkles size={14} /> ApplyPilot
                    </p>
                    <h1 className="mt-5 text-5xl font-bold leading-tight text-white [font-family:var(--font-space-grotesk)]">
                        Your job search cockpit.
                    </h1>
                    <p className="mt-4 max-w-md text-slate-200/90">
                        Track applications, tailor resumes, and run focused job discovery in one place.
                    </p>
                    <div className="mt-8 space-y-3 text-sm text-slate-200">
                        <p className="flex items-center gap-2"><ShieldCheck size={16} className="text-cyan-300" /> Isolated per-user data</p>
                        <p className="flex items-center gap-2"><BriefcaseBusiness size={16} className="text-cyan-300" /> Smart multi-source job search</p>
                    </div>
                </div>

                <form
                    onSubmit={submit}
                    className="w-full rounded-2xl border border-white/15 bg-white/95 p-5 shadow-2xl shadow-black/20 backdrop-blur md:p-7"
                >
                    <h2 className="text-2xl font-semibold text-slate-900 [font-family:var(--font-space-grotesk)]">
                        {mode === "login" ? "Welcome back" : "Create your account"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                        {mode === "login" ? "Sign in to continue." : "Start using ApplyPilot in under a minute."}
                    </p>

                    <div className="mt-5 space-y-3">
                        {mode === "register" && (
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Full name"
                                className="w-full rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 outline-none ring-cyan-500/60 transition focus:border-slate-600 focus:ring-2"
                            />
                        )}
                        <input
                            type="text"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={mode === "login" ? "Email address (or admin)" : "Email address"}
                            className="w-full rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 outline-none ring-cyan-500/60 transition focus:border-slate-600 focus:ring-2"
                            required
                        />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            className="w-full rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 outline-none ring-cyan-500/60 transition focus:border-slate-600 focus:ring-2"
                            required
                        />
                    </div>

                    {error && (
                        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-4 w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
                    >
                        {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
                    </button>

                    <button
                        type="button"
                        onClick={() => setMode((m) => (m === "login" ? "register" : "login"))}
                        className="mt-3 w-full text-sm text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
                    >
                        {mode === "login" ? "Need an account? Register" : "Already have an account? Login"}
                    </button>
                    {mode === "login" && (
                        <a href="/admin/login" className="block w-full text-center text-xs text-slate-500 hover:text-slate-800 underline">
                            Open dedicated Admin Login
                        </a>
                    )}
                </form>
            </div>
        </div>
    );
}
