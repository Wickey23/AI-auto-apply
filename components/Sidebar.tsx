"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Briefcase,
    FileText,
    User,
    Settings,
    PlusCircle,
    Search,
    BadgeDollarSign,
    Users
} from "lucide-react";
import { AccountActions } from "./AccountActions";

const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Find Jobs", href: "/find-jobs", icon: Search },
    { name: "Jobs Queue", href: "/jobs", icon: Briefcase },
    { name: "Offers", href: "/offers", icon: BadgeDollarSign },
    { name: "Documents", href: "/documents", icon: FileText },
    { name: "Network", href: "/network", icon: Users },
    { name: "Profile", href: "/profile", icon: User },
    { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="flex flex-col h-full w-72 flex-shrink-0 border-r border-slate-200 bg-slate-950 text-white">
            <div className="p-6 border-b border-white/10">
                <h1 className="text-xl font-bold tracking-tight text-cyan-300 flex items-center gap-2">
                    <span className="bg-gradient-to-r from-cyan-400 to-blue-500 text-white p-1 rounded-md text-xs">AP</span>
                    ApplyPilot
                </h1>
                <p className="mt-2 text-xs text-slate-300/80">Focused workflow for modern job search.</p>
            </div>

            <div className="px-3 py-4 flex-1">
                <p className="px-3 text-[11px] uppercase tracking-[0.16em] text-slate-400 font-semibold mb-2">Navigation</p>
                <nav className="space-y-1">
                    {navigation.map((item) => {
                        const isActive = pathname?.startsWith(item.href);
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors",
                                    isActive
                                        ? "bg-white/10 text-cyan-200 border border-cyan-300/25"
                                        : "text-slate-300 hover:bg-white/8 hover:text-white"
                                )}
                            >
                                <item.icon className="h-5 w-5" />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="p-4 border-t border-white/10">
                <Link
                    href="/jobs/new"
                    className="brand-btn flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold focus:outline-none"
                >
                    <PlusCircle className="h-4 w-4" />
                    New Application
                </Link>
                <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-2">
                    <AccountActions />
                </div>
            </div>
        </div>
    );
}
