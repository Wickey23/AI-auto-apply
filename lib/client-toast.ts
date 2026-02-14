"use client";

export type ToastTone = "info" | "success" | "error";

export function pushToast(message: string, tone: ToastTone = "info") {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
        new CustomEvent("applypilot:toast", {
            detail: { message, tone },
        })
    );
}
