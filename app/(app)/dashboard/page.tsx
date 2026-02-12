import Link from "next/link";
import { db } from "@/lib/db";
import { Briefcase, CheckCircle, Clock, FileText, Send, Flame, Target, TrendingUp, XCircle, AlertTriangle, Activity } from "lucide-react";
import { Application } from "@/lib/types";
import { ScanEmailButton } from "@/components/ScanEmailButton";
import { getAuditLogs } from "@/lib/audit";

export default async function DashboardPage() {
    const applications = await db.getApplications();
    const jobs = await db.getJobs();
    const logs = await getAuditLogs();

    // --- Analytics Logic ---
    const totalJobs = jobs.length;

    // Funnel Stats
    const interested = applications.filter(a => a.status === "INTERESTED").length;
    const applied = applications.filter(a => a.status === "APPLIED").length;
    const interviews = applications.filter(a => ["RECRUITER_SCREEN", "TECHNICAL", "ONSITE"].includes(a.status)).length;
    const offers = applications.filter(a => a.status === "OFFER").length;
    const rejected = applications.filter(a => a.status === "REJECTED").length;
    const terminal = applications.filter(a => ["OFFER", "REJECTED", "WITHDRAWN"].includes(a.status)).length;
    const activePipeline = Math.max(0, applications.length - terminal);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const now = Date.now();
    const staleApps = applications.filter((a) => {
        if (["OFFER", "REJECTED", "WITHDRAWN"].includes(a.status)) return false;
        const ageDays = (now - new Date(a.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
        return ageDays >= 14;
    }).length;
    const staleApplications = applications
        .filter((a) => {
            if (["OFFER", "REJECTED", "WITHDRAWN"].includes(a.status)) return false;
            const ageDays = (now - new Date(a.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
            return ageDays >= 14;
        })
        .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
        .slice(0, 5);
    const responseRate = applied > 0 ? Math.round((interviews / applied) * 100) : 0;
    const last7Days = Array.from({ length: 7 }).map((_, idx) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (6 - idx));
        d.setHours(0, 0, 0, 0);
        return d;
    });
    const appliedByDay = last7Days.map((day) => {
        const end = new Date(day);
        end.setDate(day.getDate() + 1);
        const count = applications.filter((a) => {
            const t = new Date(a.updatedAt).getTime();
            return t >= day.getTime() && t < end.getTime() && ["APPLIED", "RECRUITER_SCREEN", "TECHNICAL", "ONSITE", "OFFER", "REJECTED", "WITHDRAWN"].includes(a.status);
        }).length;
        return { day, count };
    });
    const weeklyTotal = appliedByDay.reduce((sum, x) => sum + x.count, 0);
    const maxDaily = Math.max(1, ...appliedByDay.map((x) => x.count));

    // Daily Goal & Streak
    const appliedApps = applications
        .filter(a => a.status !== "INTERESTED" && a.status !== "DRAFTING" && a.status !== "READY")
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const appsToday = appliedApps.filter(a => {
        const d = new Date(a.updatedAt);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
    }).length;

    const DAILY_TARGET = 3;
    const progressPercent = Math.min((appsToday / DAILY_TARGET) * 100, 100);

    // Calculate Streak
    let currentStreak = 0;
    let checkDate = new Date(today);

    // Check if we applied today, if so start streak from today, else yesterday
    // Actually, streak usually allows missed today if it's early. 
    // Simplified: Check consecutive days backwards that have at least one application.

    // Group apps by date string
    const activityMap = new Set<string>();
    appliedApps.forEach(a => {
        activityMap.add(new Date(a.updatedAt).toDateString());
    });

    while (true) {
        if (activityMap.has(checkDate.toDateString())) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            // If we haven't applied today YET, don't break streak from yesterday immediately? 
            // For strict streak, yes. For lenient, maybe check yesterday.
            // Let's do strict for now: if no activity today and checking today, streak might be 0 unless we check yesterday.
            if (checkDate.getTime() === today.getTime() && appsToday === 0) {
                checkDate.setDate(checkDate.getDate() - 1);
                continue;
            }
            break;
        }
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                    <p className="text-muted-foreground">Detailed analytics and progress tracking.</p>
                </div>

                <div className="flex items-center gap-4">
                    <ScanEmailButton />
                    {/* Daily Goal Card (Compact) */}
                    <div className="bg-white border rounded-xl p-4 flex items-center gap-6 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${appsToday >= DAILY_TARGET ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                <Target size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-medium uppercase">Daily Goal</p>
                                <p className="font-bold text-slate-900">{appsToday} / {DAILY_TARGET} <span className="text-xs font-normal text-slate-400">Apps</span></p>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-slate-200" />
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-orange-100 text-orange-600">
                                <Flame size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-medium uppercase">Streak</p>
                                <p className="font-bold text-slate-900">{currentStreak} <span className="text-xs font-normal text-slate-400">Days</span></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Funnel Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard title="Pipeline (Interested)" value={interested} icon={Briefcase} color="text-slate-500" />
                <StatsCard title="Applications Sent" value={applied} icon={Send} color="text-blue-500" />
                <StatsCard title="Active Interviews" value={interviews} icon={Clock} color="text-purple-600" />
                <StatsCard title="Offers Received" value={offers} icon={CheckCircle} color="text-green-600" />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
                <StatsCard title="Active Pipeline" value={activePipeline} icon={Activity} color="text-indigo-600" />
                <StatsCard title="Stale Applications (14d+)" value={staleApps} icon={AlertTriangle} color="text-amber-600" />
                <StatsCard title="Response Rate %" value={responseRate} icon={TrendingUp} color="text-emerald-600" />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Recent Activity */}
                <div className="col-span-4 rounded-xl border bg-white text-card-foreground shadow-sm">
                    <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Recent Activity</h3>
                        <Link href="/jobs" className="text-sm text-blue-500 hover:underline">View Queue</Link>
                    </div>
                    <div className="p-6 pt-0">
                        {applications.length === 0 ? (
                            <div className="text-center py-6 text-slate-500">No applications yet. Start by adding a job!</div>
                        ) : (
                            <div className="space-y-4">
                                {applications.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5).map((app) => (
                                    <div key={app.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium leading-none">{app.job.title}</p>
                                            <p className="text-sm text-muted-foreground">{app.job.company}</p>
                                        </div>
                                        <div className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(app.status)}`}>
                                            {app.status.replace("_", " ")}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Metrics Breakdown */}
                <div className="col-span-3 space-y-4">
                    {/* Conversion Rates */}
                    <div className="rounded-xl border bg-white text-card-foreground shadow-sm p-6">
                        <h3 className="tracking-tight text-sm font-medium mb-4">Funnel Efficiency</h3>
                        <div className="space-y-4">
                            <MetricRow
                                label="Interview Rate"
                                value={applied > 0 ? Math.round((interviews / applied) * 100) : 0}
                                icon={<TrendingUp size={14} />}
                                color="bg-purple-100 text-purple-600"
                            />
                            <MetricRow
                                label="Offer Rate"
                                value={interviews > 0 ? Math.round((offers / interviews) * 100) : 0}
                                icon={<CheckCircle size={14} />}
                                color="bg-green-100 text-green-600"
                            />
                            <MetricRow
                                label="Rejection Rate"
                                value={applied > 0 ? Math.round((rejected / applied) * 100) : 0}
                                icon={<XCircle size={14} />}
                                color="bg-red-100 text-red-600"
                            />
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="rounded-xl border bg-white text-card-foreground shadow-sm p-6">
                        <h3 className="tracking-tight text-sm font-medium mb-4">Quick Actions</h3>
                        <div className="space-y-2">
                            <Link href="/jobs/new" className="w-full flex justify-start gap-2 items-center p-2 hover:bg-slate-50 rounded-md text-sm text-left border transition">
                                <span className="bg-blue-100 text-blue-600 p-1 rounded"><Briefcase size={16} /></span>
                                Add New Job
                            </Link>
                            <Link href="/documents" className="w-full flex justify-start gap-2 items-center p-2 hover:bg-slate-50 rounded-md text-sm text-left border transition">
                                <span className="bg-green-100 text-green-600 p-1 rounded"><FileText size={16} /></span>
                                Manage Resume Versions
                            </Link>
                            <Link href="/offers" className="w-full flex justify-start gap-2 items-center p-2 hover:bg-slate-50 rounded-md text-sm text-left border transition">
                                <span className="bg-emerald-100 text-emerald-600 p-1 rounded"><CheckCircle size={16} /></span>
                                Compare Offers
                            </Link>
                            <Link href="/network" className="w-full flex justify-start gap-2 items-center p-2 hover:bg-slate-50 rounded-md text-sm text-left border transition">
                                <span className="bg-purple-100 text-purple-600 p-1 rounded"><Briefcase size={16} /></span>
                                Manage Network
                            </Link>
                        </div>
                    </div>
                    <div className="rounded-xl border bg-white text-card-foreground shadow-sm p-6">
                        <h3 className="tracking-tight text-sm font-medium mb-4">Weekly Progress</h3>
                        <p className="text-xs text-slate-500 mb-3">Applications moved forward in last 7 days: <span className="font-semibold text-slate-800">{weeklyTotal}</span></p>
                        <div className="flex items-end gap-2 h-24">
                            {appliedByDay.map((item, idx) => (
                                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                                    <div
                                        className="w-full rounded-t bg-blue-500/80"
                                        style={{ height: `${Math.max(8, (item.count / maxDaily) * 100)}%` }}
                                        title={`${item.day.toLocaleDateString()}: ${item.count}`}
                                    />
                                    <span className="text-[10px] text-slate-500">
                                        {item.day.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-xl border bg-white text-card-foreground shadow-sm p-6">
                        <h3 className="tracking-tight text-sm font-medium mb-4">Follow-up Reminders</h3>
                        <div className="space-y-3">
                            {staleApplications.map((app) => {
                                const ageDays = Math.floor((now - new Date(app.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
                                return (
                                    <Link key={app.id} href={`/applications/${app.id}`} className="block rounded-md border p-2 hover:bg-slate-50">
                                        <p className="text-xs font-semibold text-slate-800">{app.job.title} @ {app.job.company}</p>
                                        <p className="text-[11px] text-slate-500">No update for {ageDays} days · status {app.status}</p>
                                    </Link>
                                );
                            })}
                            {staleApplications.length === 0 && <p className="text-xs text-slate-500">No stale applications right now.</p>}
                        </div>
                    </div>
                    <div className="rounded-xl border bg-white text-card-foreground shadow-sm p-6">
                        <h3 className="tracking-tight text-sm font-medium mb-4">Audit Activity</h3>
                        <div className="space-y-3">
                            {logs.slice(0, 5).map((log) => (
                                <div key={log.id} className="border rounded-md p-2">
                                    <p className="text-xs font-semibold text-slate-800">{log.action}</p>
                                    <p className="text-xs text-slate-500">{log.details}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">{new Date(log.timestamp).toLocaleString()}</p>
                                </div>
                            ))}
                            {logs.length === 0 && <p className="text-xs text-slate-500">No activity logged yet.</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatsCard({ title, value, icon: Icon, color }: { title: string, value: number, icon: any, color: string }) {
    return (
        <div className="rounded-xl border bg-white text-card-foreground shadow-sm hover:shadow-md transition">
            <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
                <h3 className="tracking-tight text-sm font-medium text-slate-500">{title}</h3>
                <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div className="p-6 pt-0">
                <div className="text-2xl font-bold">{value}</div>
            </div>
        </div>
    );
}

function MetricRow({ label, value, icon, color }: { label: string, value: number, icon: any, color: string }) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className={`p-1 rounded ${color}`}>{icon}</div>
                <span className="text-sm font-medium text-slate-700">{label}</span>
            </div>
            <span className="text-sm font-bold">{value}%</span>
        </div>
    );
}

function getStatusColor(status: string) {
    switch (status) {
        case 'INTERESTED': return 'bg-slate-100 text-slate-600';
        case 'APPLIED': return 'bg-blue-100 text-blue-600';
        case 'INTERVIEW':
        case 'RECRUITER_SCREEN':
        case 'TECHNICAL':
        case 'ONSITE': return 'bg-purple-100 text-purple-600';
        case 'OFFER': return 'bg-green-100 text-green-600';
        case 'REJECTED': return 'bg-red-100 text-red-600';
        default: return 'bg-slate-100 text-slate-600';
    }
}
