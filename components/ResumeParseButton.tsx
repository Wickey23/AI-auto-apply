"use client";

import { useState } from "react";
import { parseResumeContent } from "@/lib/ai";
import { Sparkles, Loader2, Check, X, FileText } from "lucide-react";

interface ParsedData {
    contact?: any;
    summary?: string;
    experience?: any[];
    education?: any[];
    skills?: any[];
    projects?: any[];
}

interface ResumeParseButtonProps {
    resumeContent: string;
    onParseComplete?: () => void;
}

export function ResumeParseButton({ resumeContent, onParseComplete }: ResumeParseButtonProps) {
    const [isParsing, setIsParsing] = useState(false);
    const [parsedData, setParsedData] = useState<ParsedData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleParse = async () => {
        setIsParsing(true);
        setError(null);
        try {
            const data = await parseResumeContent(resumeContent);
            setParsedData(data);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsParsing(false);
        }
    };

    return (
        <div className="space-y-4">
            <button
                onClick={handleParse}
                disabled={isParsing}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            >
                {isParsing ? (
                    <>
                        <Loader2 size={16} className="animate-spin" />
                        Parsing Resume...
                    </>
                ) : (
                    <>
                        <Sparkles size={16} />
                        Parse & Update Profile
                    </>
                )}
            </button>

            {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                    <X size={16} />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            {parsedData && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2 text-green-700 font-medium">
                        <Check size={18} />
                        Resume Parsed Successfully!
                    </div>
                    <div className="text-sm text-green-600 space-y-1">
                        {parsedData.contact && <p>✓ Contact info extracted</p>}
                        {parsedData.experience && parsedData.experience.length > 0 && (
                            <p>✓ {parsedData.experience.length} work experience(s) found</p>
                        )}
                        {parsedData.education && parsedData.education.length > 0 && (
                            <p>✓ {parsedData.education.length} education entry(ies) found</p>
                        )}
                        {parsedData.skills && parsedData.skills.length > 0 && (
                            <p>✓ {parsedData.skills.length} skill(s) identified</p>
                        )}
                        {parsedData.projects && parsedData.projects.length > 0 && (
                            <p>✓ {parsedData.projects.length} project(s) found</p>
                        )}
                    </div>
                    <p className="text-xs text-green-600">
                        Your profile has been automatically updated. Visit the Profile page to review.
                    </p>
                </div>
            )}
        </div>
    );
}
