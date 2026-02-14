"use client";

import { uploadResume } from "@/app/actions";
import { Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { pushToast } from "@/lib/client-toast";

export function ProfileAutofillUpload() {
    const [isUploading, setIsUploading] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const router = useRouter();

    const handleUpload = async (file: File) => {
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            await uploadResume(formData);
            router.refresh();
            pushToast("Resume uploaded and profile autofill started.", "success");
        } catch (error) {
            pushToast((error as Error).message || "Failed to upload resume.", "error");
        } finally {
            setIsUploading(false);
            if (inputRef.current) inputRef.current.value = "";
        }
    };

    return (
        <div className="flex items-center gap-2">
            <input
                ref={inputRef}
                type="file"
                accept=".pdf,.txt,.doc,.docx"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUpload(file);
                }}
                disabled={isUploading}
                className="w-[250px] rounded-md border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs"
            />
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
                className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition disabled:opacity-50"
            >
                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {isUploading ? "Uploading..." : "Upload Resume"}
            </button>
        </div>
    );
}



