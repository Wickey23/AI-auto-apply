import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "applypilot_session";
const ADMIN_SESSION_COOKIE = "applypilot_admin_session";
const PROTECTED_PREFIXES = [
    "/dashboard",
    "/find-jobs",
    "/jobs",
    "/applications",
    "/documents",
    "/network",
    "/offers",
    "/profile",
    "/settings",
];

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
    const hasAdminSession = Boolean(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
    const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
    const isAdminLogin = pathname === "/admin/login";

    if (isProtected && !hasSession) {
        const url = req.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
    }

    if (pathname === "/login" && hasSession) {
        const url = req.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
    }

    if (isAdminPage && !isAdminLogin && !hasAdminSession) {
        const url = req.nextUrl.clone();
        url.pathname = "/admin/login";
        return NextResponse.redirect(url);
    }

    if (isAdminLogin && hasAdminSession) {
        const url = req.nextUrl.clone();
        url.pathname = "/admin";
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
