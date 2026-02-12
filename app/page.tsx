import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-6 py-4 flex items-center justify-between border-b">
        <div className="font-bold text-xl flex items-center gap-2">
          <span className="bg-blue-600 text-white p-1 rounded text-sm">AP</span>
          ApplyPilot
        </div>
        <div className="flex gap-4">
          <Link href="/dashboard" className="text-sm font-medium hover:text-blue-600">Login</Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-slate-50">
        <div className="max-w-2xl space-y-6">
          <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
            Land your dream job <span className="text-blue-600">faster</span>.
          </h1>
          <p className="text-lg text-slate-600">
            Auto-fill, track, and tailor your job applications without losing control.
            Strict guardrails. No automated botting. Just you, supercharged.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link
              href="/dashboard"
              className="px-8 py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition flex items-center gap-2"
            >
              Go to Dashboard <ArrowRight size={18} />
            </Link>
            <Link
              href="https://github.com/sameer/apply-pilot"
              className="px-8 py-3 bg-white text-slate-900 border border-slate-300 rounded-md font-medium hover:bg-slate-50 transition"
            >
              View on GitHub
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-sm text-slate-500">
        &copy; {new Date().getFullYear()} ApplyPilot. Built for speed and safety.
      </footer>
    </div>
  );
}
