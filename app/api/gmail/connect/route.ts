import { NextRequest, NextResponse } from "next/server";

function getPublicOrigin(request: NextRequest) {
    const explicit =
        process.env.APP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXTAUTH_URL ||
        process.env.RENDER_EXTERNAL_URL;
    if (explicit) {
        const base = explicit.startsWith("http") ? explicit : `https://${explicit}`;
        return base.replace(/\/+$/, "");
    }

    const forwardedProto = request.headers.get("x-forwarded-proto");
    const forwardedHost = request.headers.get("x-forwarded-host");
    if (forwardedHost) {
        const proto = forwardedProto || "https";
        return `${proto}://${forwardedHost}`.replace(/\/+$/, "");
    }

    return `${request.nextUrl.protocol}//${request.nextUrl.host}`.replace(/\/+$/, "");
}

export async function GET(request: NextRequest) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const publicOrigin = getPublicOrigin(request);
    if (!clientId) {
        return NextResponse.redirect(`${publicOrigin}/settings?gmail=missing_env`);
    }

    const redirectUri = `${publicOrigin}/api/gmail/callback`;
    const scope = encodeURIComponent("https://www.googleapis.com/auth/gmail.readonly");
    const state = encodeURIComponent("applypilot_gmail_connect");

    const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&scope=${scope}` +
        `&state=${state}`;

    return NextResponse.redirect(authUrl);
}
