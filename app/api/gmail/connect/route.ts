import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
        return NextResponse.redirect(new URL("/settings?gmail=missing_env", request.url));
    }

    const origin = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    const redirectUri = `${origin}/api/gmail/callback`;
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
