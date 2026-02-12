import { NextResponse } from "next/server";
import { SESSION_COOKIE, USER_COOKIE } from "@/lib/auth";

export async function POST() {
    const res = NextResponse.json({ success: true }, { status: 200 });
    res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    res.cookies.set(USER_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
}

