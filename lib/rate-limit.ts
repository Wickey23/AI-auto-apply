import { NextResponse } from "next/server";

type Bucket = {
    count: number;
    resetAt: number;
};

type RateLimitOptions = {
    key: string;
    limit: number;
    windowMs: number;
    message?: string;
};

const buckets = new Map<string, Bucket>();

function getClientIp(request: Request) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }
    return request.headers.get("x-real-ip") || "unknown";
}

function maybeCleanup(now: number) {
    if (buckets.size < 5000) return;
    for (const [key, bucket] of buckets.entries()) {
        if (bucket.resetAt <= now) {
            buckets.delete(key);
        }
    }
}

export function withIpKey(request: Request, scope: string) {
    return `${scope}:${getClientIp(request)}`;
}

export function checkRateLimit(request: Request, options: RateLimitOptions) {
    const now = Date.now();
    maybeCleanup(now);

    const bucket = buckets.get(options.key);
    if (!bucket || bucket.resetAt <= now) {
        buckets.set(options.key, { count: 1, resetAt: now + options.windowMs });
        return null;
    }

    if (bucket.count >= options.limit) {
        const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
        return NextResponse.json(
            { error: options.message || "Too many requests. Please try again shortly." },
            {
                status: 429,
                headers: {
                    "Retry-After": String(retryAfterSeconds),
                },
            }
        );
    }

    bucket.count += 1;
    return null;
}
