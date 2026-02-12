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
        <div className="flex flex-col h-full bg-slate-900 text-white w-64 flex-shrink-0 border-r border-slate-800">
            <div className="p-6">
                <h1 className="text-xl font-bold tracking-tight text-blue-400 flex items-center gap-2">
                    <span className="bg-blue-500 text-white p-1 rounded-md text-xs">AP</span>
                    ApplyPilot
                </h1>
            </div>

            <div className="px-3 py-2 flex-1">
                <nav className="space-y-1">
                    {navigation.map((item) => {
                        const isActive = pathname?.startsWith(item.href);
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                                    isActive
                                        ? "bg-slate-800 text-blue-400"
                                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                )}
                            >
                                <item.icon className="h-5 w-5" />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="p-4 border-t border-slate-800">
                <Link
                    href="/jobs/new"
                    className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                >
                    <PlusCircle className="h-4 w-4" />
                    New Application
                </Link>
                <div className="mt-3">
                    <AccountActions />
                </div>
            </div>
        </div>
    );
}
