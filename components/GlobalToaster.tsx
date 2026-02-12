"use client";

import { useEffect, useMemo, useState } from "react";

type ToastTone = "info" | "success" | "error";

type ToastItem = {
    id: string;
    message: string;
    tone: ToastTone;
};

function toneClass(tone: ToastTone) {
    if (tone === "success") return "border-emerald-300 bg-emerald-50 text-emerald-900";
    if (tone === "error") return "border-rose-300 bg-rose-50 text-rose-900";
    return "border-sky-300 bg-sky-50 text-sky-900";
}

export default function GlobalToaster() {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const addToast = useMemo(() => {
        return (message: string, tone: ToastTone = "info") => {
            const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            setToasts((prev) => [...prev, { id, message, tone }]);
            window.setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, 4200);
        };
    }, []);

    useEffect(() => {
        const originalAlert = window.alert.bind(window);

        window.alert = (msg?: any) => {
            const message = typeof msg === "string" ? msg : String(msg ?? "");
            const lower = message.toLowerCase();
            const tone: ToastTone =
                lower.includes("error") || lower.includes("failed") || lower.includes("invalid")
                    ? "error"
                    : lower.includes("saved") || lower.includes("success")
                        ? "success"
                        : "info";
            addToast(message, tone);
        };

        const onToast = (event: Event) => {
            const custom = event as CustomEvent<{ message?: string; tone?: ToastTone }>;
            const message = custom.detail?.message || "";
            if (!message) return;
            addToast(message, custom.detail?.tone || "info");
        };

        window.addEventListener("applypilot:toast", onToast as EventListener);
        return () => {
            window.alert = originalAlert;
            window.removeEventListener("applypilot:toast", onToast as EventListener);
        };
    }, [addToast]);

    return (
        <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-[min(92vw,420px)] flex-col gap-2">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-lg ${toneClass(toast.tone)}`}
                >
                    {toast.message}
                </div>
            ))}
        </div>
    );
}
