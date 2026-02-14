"use client";

import { syncProfileFromLinkedInUrlAndResume } from "@/app/actions";
import { Loader2, Linkedin } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { pushToast } from "@/lib/client-toast";

export function UpdateFromResumeButton({ linkedinUrl }: { linkedinUrl?: string }) {
    const [isUpdating, setIsUpdating] = useState(false);
    const [value, setValue] = useState(linkedinUrl || "");
    const router = useRouter();

    const handleClick = async () => {
        setIsUpdating(true);
        try {
            const trimmed = value.trim();
            if (!trimmed) {
                throw new Error("Enter your LinkedIn profile URL first.");
            }
            if (!/^https?:\/\/(www\.)?linkedin\.com\/in\//i.test(trimmed)) {
                throw new Error("Please enter a valid LinkedIn profile URL (linkedin.com/in/...).");
            }

            const result = await syncProfileFromLinkedInUrlAndResume(trimmed);
            router.refresh();
            const warnings = (result.errors || []).length ? `\n\nNotes:\n- ${(result.errors || []).join("\n- ")}` : "";
            pushToast(
                `Profile sync complete. LinkedIn: ${result.linkedinUpdated ? "updated" : "not updated"}, Resume: ${result.resumeUpdated ? "updated" : "not updated"}.${warnings}`,
                "success"
            );
        } catch (error) {
            pushToast((error as Error).message || "Failed to sync from LinkedIn.", "error");
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <input
                type="url"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="https://www.linkedin.com/in/your-profile"
                className="w-[320px] rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
                onClick={handleClick}
                disabled={isUpdating}
                className="inline-flex items-center justify-center rounded-md bg-[#0077b5] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition disabled:opacity-50"
            >
                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Linkedin className="mr-2 h-4 w-4" />}
                {isUpdating ? "Syncing..." : "Update Profile"}
            </button>
        </div>
    );
}


