import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
    const res = NextResponse.json({ success: true }, { status: 200 });
    res.cookies.set(ADMIN_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
}

