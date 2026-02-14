import { db } from "@/lib/db";
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
    const code = request.nextUrl.searchParams.get("code");
    const error = request.nextUrl.searchParams.get("error");
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const publicOrigin = getPublicOrigin(request);

    if (error) {
        return NextResponse.redirect(`${publicOrigin}/settings?gmail=error&reason=${encodeURIComponent(error)}`);
    }

    if (!code || !clientId || !clientSecret) {
        return NextResponse.redirect(`${publicOrigin}/settings?gmail=error&reason=missing_code_or_env`);
    }

    const redirectUri = `${publicOrigin}/api/gmail/callback`;

    try {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: "authorization_code",
            }),
        });

        if (!tokenRes.ok) {
            const raw = await tokenRes.text();
            let reason = `token_exchange_failed_${tokenRes.status}`;
            try {
                const parsed = JSON.parse(raw);
                reason = parsed.error_description || parsed.error || reason;
            } catch {
                if (raw) reason = raw;
            }
            return NextResponse.redirect(`${publicOrigin}/settings?gmail=error&reason=${encodeURIComponent(String(reason).slice(0, 180))}`);
        }

        const tokens = await tokenRes.json();
        const accessToken = tokens.access_token as string | undefined;
        const refreshToken = tokens.refresh_token as string | undefined;
        const expiresIn = Number(tokens.expires_in || 3600);

        if (!accessToken || !refreshToken) {
            return NextResponse.redirect(`${publicOrigin}/settings?gmail=error&reason=missing_access_or_refresh_token`);
        }

        let gmailEmail = "";
        const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (profileRes.ok) {
            const profile = await profileRes.json();
            gmailEmail = profile.emailAddress || "";
        }

        await db.updateData((data) => {
            data.settings.gmailAccessToken = accessToken;
            data.settings.gmailRefreshToken = refreshToken;
            data.settings.gmailAccessTokenExpiresAt = Date.now() + expiresIn * 1000;
            data.settings.gmailEmail = gmailEmail;
        });

        return NextResponse.redirect(`${publicOrigin}/settings?gmail=connected`);
    } catch (error) {
        const reason = encodeURIComponent(((error as Error).message || "callback_exception").slice(0, 180));
        return NextResponse.redirect(`${publicOrigin}/settings?gmail=error&reason=${reason}`);
    }
}
