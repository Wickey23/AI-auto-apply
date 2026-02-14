"use client";

import { Job, Resume } from "@/lib/types";
import { addWorkshopResumeToLibrary, applyResumeParseToProfileAction, applyWorkshopResumeVariant, autoPopulateWorkshopFromJobs, createCoverLetterTemplate, deleteResume, generateWorkshopCoverLetter, generateWorkshopResumePreview, getWorkshopInsights, previewResumeParseAction, saveWorkshopAnswersAndSyncProfile, updateResumeWorkshopMetadata, uploadResume } from "@/app/actions";
import { AiModeBadge } from "@/components/AiModeBadge";
import { pushToast } from "@/lib/client-toast";
import { useRef, useState } from "react";
import { FileText, Upload, Trash2, Loader2, Wrench, FolderOpen, Save, Sparkles, Check, Wand2, BarChart3, Download } from "lucide-react";
import { useRouter } from "next/navigation";

type TabKey = "library" | "workshop" | "coverletters";
type WorkshopInsights = {
    topJobFits: Array<{ jobId: string; company: string; title: string; fitScore: number }>;
    missingSkills: string[];
    suggestedRole: string;
    suggestedSkills: string[];
    suggestedPreferences: string;
    note?: string;
};
type PreviewMode = "pretty" | "raw";
type CoverPreviewMode = "pretty" | "raw";
type WorkshopAnswersDraft = {
    yearsExperience: string;
    topAchievements: string;
    coreStrengths: string;
    toolsAndTech: string;
    certifications: string;
    targetIndustries: string;
    desiredRoles: string;
    preferredLocations: string;
    additionalNotes: string;
    targetLevel: string;
    leadershipScope: string;
    strongestTech: string;
    achievementMetric: string;
    workModePreference: string;
};
type WorkshopAnswerField = keyof WorkshopAnswersDraft;
type WorkshopQuestion = {
    key: WorkshopAnswerField;
    prompt: string;
    help: string;
    placeholder: string;
    multiline?: boolean;
    rows?: number;
    followUp?: {
        key: WorkshopAnswerField;
        prompt: string;
        help: string;
        placeholder: string;
        multiline?: boolean;
        rows?: number;
        shouldAsk: (answers: WorkshopAnswersDraft) => boolean;
    };
};
type CoverLetterDraft = {
    company: string;
    title: string;
    hiringManager: string;
    tone: "confident" | "warm" | "direct";
    format: "standard" | "email";
    whyCompany: string;
    jobDescription: string;
    additionalInfo: string;
};

type ResumeParsePreview = {
    resumeId: string;
    resumeName: string;
    confidence: number;
    parsed: {
        contact?: {
            name?: string;
            email?: string;
            phone?: string;
            linkedin?: string;
            portfolio?: string;
            location?: string;
        };
        summary?: string;
        experience?: Array<{ title?: string; company?: string; startDate?: string; endDate?: string; bullets?: string[] }>;
        education?: Array<{ school?: string; degree?: string; startYear?: string; endYear?: string }>;
        skills?: Array<{ name?: string }>;
        projects?: Array<{ name?: string; description?: string }>;
    };
    stats: {
        experience: number;
        education: number;
        skills: number;
        projects: number;
    };
};

const WORKSHOP_QUESTION_FLOW: WorkshopQuestion[] = [
    {
        key: "desiredRoles",
        prompt: "What exact roles are you targeting in this resume?",
        help: "Be specific so the resume headline, summary, and wording match job titles recruiters search.",
        placeholder: "Example: Backend Engineer, Platform Engineer, API Engineer",
        followUp: {
            key: "targetLevel",
            prompt: "What seniority level are you targeting?",
            help: "This helps position your resume correctly (entry, mid, senior, lead).",
            placeholder: "Example: Mid-level to Senior",
            shouldAsk: (answers) => Boolean(answers.desiredRoles.trim()),
        },
    },
    {
        key: "yearsExperience",
        prompt: "How many years of relevant professional experience do you have?",
        help: "Use an accurate total; this is used in summary framing and seniority positioning.",
        placeholder: "Example: 3",
        followUp: {
            key: "leadershipScope",
            prompt: "What is your leadership scope (if any)?",
            help: "If you mentor, lead projects, or manage people, include team size or ownership scope.",
            placeholder: "Example: Led 4 engineers and owned backend roadmap for payments",
            shouldAsk: (answers) => {
                const years = Number((answers.yearsExperience || "").replace(/[^\d.]/g, ""));
                return Number.isFinite(years) && years >= 4;
            },
        },
    },
    {
        key: "coreStrengths",
        prompt: "What are your strongest capabilities for this target role?",
        help: "List 5-8 strengths that differentiate you (technical + execution + collaboration).",
        placeholder: "Example: API design, performance optimization, debugging, stakeholder communication",
    },
    {
        key: "toolsAndTech",
        prompt: "What tools, languages, frameworks, and platforms should be highlighted?",
        help: "Include stack depth recruiters filter on (languages, cloud, data, frontend/backend).",
        placeholder: "Example: TypeScript, Node.js, Python, AWS, PostgreSQL, Docker, React",
        followUp: {
            key: "strongestTech",
            prompt: "Which one technology/domain is your strongest differentiator?",
            help: "Pick the single strongest area to shape summary and highlight bullets.",
            placeholder: "Example: Distributed backend systems in Node.js",
            shouldAsk: (answers) => Boolean(answers.toolsAndTech.trim()),
        },
    },
    {
        key: "topAchievements",
        prompt: "What are your top measurable achievements?",
        help: "One achievement per line. Use metrics, scope, and outcomes for strong resume bullets.",
        placeholder: "Reduced deployment time by 35% by automating CI/CD\nBuilt an internal dashboard used by 200+ users\nImproved API p95 latency by 42%",
        multiline: true,
        rows: 4,
        followUp: {
            key: "achievementMetric",
            prompt: "Which metric/result do you want highlighted first?",
            help: "Choose your highest-impact metric to anchor the strongest bullet.",
            placeholder: "Example: 42% latency reduction and 99.95% uptime improvement",
            shouldAsk: (answers) => Boolean(answers.topAchievements.trim()),
        },
    },
    {
        key: "targetIndustries",
        prompt: "Which industries or company types are you targeting?",
        help: "This helps tailor resume language and project emphasis for employer context.",
        placeholder: "Example: SaaS, Fintech, Healthtech, B2B Platforms, Early-stage startups",
    },
    {
        key: "preferredLocations",
        prompt: "What locations are acceptable for your job search?",
        help: "Include remote preferences and any location constraints.",
        placeholder: "Example: Remote (US), Austin, New York",
        followUp: {
            key: "workModePreference",
            prompt: "What work mode do you prefer?",
            help: "Clarify remote/hybrid/onsite preference so job targeting is accurate.",
            placeholder: "Example: Remote preferred, open to hybrid in Austin",
            shouldAsk: (answers) => Boolean(answers.preferredLocations.trim()),
        },
    },
    {
        key: "certifications",
        prompt: "Any certifications, licenses, or formal credentials to include?",
        help: "List only relevant credentials that strengthen role alignment.",
        placeholder: "Example: AWS Certified Cloud Practitioner, Scrum Master",
    },
    {
        key: "additionalNotes",
        prompt: "Anything else we should emphasize in your resume?",
        help: "Add context like leadership scope, domain expertise, visa/work authorization, or portfolio priorities.",
        placeholder: "Example: Led cross-functional team of 6; strong healthcare domain knowledge; open to hybrid.",
        multiline: true,
        rows: 3,
    },
];

const RESUME_SECTIONS = new Set([
    "TARGET ROLE",
    "PROFESSIONAL SUMMARY",
    "CORE SKILLS",
    "PROFESSIONAL EXPERIENCE",
    "PROJECTS",
    "EDUCATION",
]);

function parseResumeForPreview(content: string) {
    const lines = (content || "").split(/\r?\n/);
    const name = (lines[0] || "").trim();
    const contact = (lines[1] || "").trim();
    const sections: Array<{ title: string; lines: string[] }> = [];
    let current: { title: string; lines: string[] } | null = null;

    for (const rawLine of lines.slice(2)) {
        const line = rawLine.trimEnd();
        if (!line.trim()) continue;
        const normalized = line.trim().toUpperCase();
        if (RESUME_SECTIONS.has(normalized)) {
            if (current) sections.push(current);
            current = { title: normalized, lines: [] };
            continue;
        }
        if (!current) {
            current = { title: "PROFESSIONAL SUMMARY", lines: [] };
        }
        current.lines.push(line);
    }
    if (current) sections.push(current);

    return { name, contact, sections };
}

function isAnswered(value: string) {
    return Boolean((value || "").trim());
}

function buildResumeDiff(left: string, right: string) {
    const leftLines = (left || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    const rightLines = (right || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

    const leftSet = new Set(leftLines);
    const rightSet = new Set(rightLines);

    const removed = leftLines.filter((line) => !rightSet.has(line));
    const added = rightLines.filter((line) => !leftSet.has(line));

    return {
        added: added.slice(0, 80),
        removed: removed.slice(0, 80),
        addedCount: added.length,
        removedCount: removed.length,
    };
}

export default function DocumentsManager({ initialResumes, initialJobs }: { initialResumes: Resume[]; initialJobs: Job[] }) {
    const [activeTab, setActiveTab] = useState<TabKey>("library");
    const [isUploading, setIsUploading] = useState(false);
    const [deletingResumeId, setDeletingResumeId] = useState<string | null>(null);
    const [savingResumeId, setSavingResumeId] = useState<string | null>(null);
    const [generatingResumeId, setGeneratingResumeId] = useState<string | null>(null);
    const [applyingResumeId, setApplyingResumeId] = useState<string | null>(null);
    const [autofillingResumeId, setAutofillingResumeId] = useState<string | null>(null);
    const [insightsLoadingResumeId, setInsightsLoadingResumeId] = useState<string | null>(null);
    const [savingAnswersResumeId, setSavingAnswersResumeId] = useState<string | null>(null);
    const [generatingCoverLetterResumeId, setGeneratingCoverLetterResumeId] = useState<string | null>(null);
    const [savingCoverTemplateResumeId, setSavingCoverTemplateResumeId] = useState<string | null>(null);
    const [addingResumeLibraryId, setAddingResumeLibraryId] = useState<string | null>(null);
    const [addingCoverLibraryId, setAddingCoverLibraryId] = useState<string | null>(null);
    const [reviewingParseResumeId, setReviewingParseResumeId] = useState<string | null>(null);
    const [applyingParseResumeId, setApplyingParseResumeId] = useState<string | null>(null);
    const [parseReviewByResumeId, setParseReviewByResumeId] = useState<Record<string, ResumeParsePreview>>({});
    const [replaceModeByResumeId, setReplaceModeByResumeId] = useState<Record<string, boolean>>({});
    const [generatedPreviewByResumeId, setGeneratedPreviewByResumeId] = useState<Record<string, string>>({});
    const [insightsByResumeId, setInsightsByResumeId] = useState<Record<string, WorkshopInsights>>({});
    const [previewModeByResumeId, setPreviewModeByResumeId] = useState<Record<string, PreviewMode>>({});
    const [coverLetterPreviewByResumeId, setCoverLetterPreviewByResumeId] = useState<Record<string, string>>({});
    const [coverPreviewModeByResumeId, setCoverPreviewModeByResumeId] = useState<Record<string, CoverPreviewMode>>({});
    const [selectedJobIdByResumeId, setSelectedJobIdByResumeId] = useState<Record<string, string>>({});
    const [coverLetterDrafts, setCoverLetterDrafts] = useState<Record<string, CoverLetterDraft>>(
        Object.fromEntries(
            initialResumes.map((r) => [
                r.id,
                {
                    company: "",
                    title: r.targetRole || "",
                    hiringManager: "",
                    tone: "confident",
                    format: "standard",
                    whyCompany: "",
                    jobDescription: "",
                    additionalInfo: "",
                },
            ])
        )
    );
    const [currentQuestionByResumeId, setCurrentQuestionByResumeId] = useState<Record<string, number>>({});
    const [diffLeftResumeId, setDiffLeftResumeId] = useState<string>("");
    const [diffRightResumeId, setDiffRightResumeId] = useState<string>("");
    const [answersDrafts, setAnswersDrafts] = useState<Record<string, WorkshopAnswersDraft>>(
        Object.fromEntries(
            initialResumes.map((r) => [
                r.id,
                {
                    yearsExperience: r.workshopAnswers?.yearsExperience || "",
                    topAchievements: r.workshopAnswers?.topAchievements || "",
                    coreStrengths: r.workshopAnswers?.coreStrengths || "",
                    toolsAndTech: r.workshopAnswers?.toolsAndTech || "",
                    certifications: r.workshopAnswers?.certifications || "",
                    targetIndustries: r.workshopAnswers?.targetIndustries || "",
                    desiredRoles: r.workshopAnswers?.desiredRoles || "",
                    preferredLocations: r.workshopAnswers?.preferredLocations || "",
                    additionalNotes: r.workshopAnswers?.additionalNotes || "",
                    targetLevel: r.workshopAnswers?.targetLevel || "",
                    leadershipScope: r.workshopAnswers?.leadershipScope || "",
                    strongestTech: r.workshopAnswers?.strongestTech || "",
                    achievementMetric: r.workshopAnswers?.achievementMetric || "",
                    workModePreference: r.workshopAnswers?.workModePreference || "",
                },
            ])
        )
    );
    const [workshopDrafts, setWorkshopDrafts] = useState<Record<string, { targetRole: string; focusSkills: string; jobPreferences: string }>>(
        Object.fromEntries(
            initialResumes.map((r) => [
                r.id,
                {
                    targetRole: r.targetRole || "",
                    focusSkills: (r.focusSkills || []).join(", "),
                    jobPreferences: r.jobPreferences || "",
                },
            ])
        )
    );
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setIsUploading(true);
            const formData = new FormData();
            formData.append("file", e.target.files[0]);
            try {
                await uploadResume(formData);
                pushToast("Resume uploaded successfully.", "success");
                router.refresh();
            } catch {
                pushToast("Upload failed.", "error");
            } finally {
                setIsUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        }
    };

    const handleDeleteResume = async (resumeId: string) => {
        setDeletingResumeId(resumeId);
        try {
            await deleteResume(resumeId);
            pushToast("Resume deleted.", "success");
            router.refresh();
        } catch {
            pushToast("Delete failed.", "error");
        } finally {
            setDeletingResumeId(null);
        }
    };

    const handleReviewParse = async (resumeId: string) => {
        setReviewingParseResumeId(resumeId);
        try {
            const preview = await previewResumeParseAction(resumeId);
            setParseReviewByResumeId((prev) => ({ ...prev, [resumeId]: preview as ResumeParsePreview }));
            pushToast("Resume parse generated.", "success");
        } catch (error) {
            pushToast((error as Error).message || "Failed to parse resume.", "error");
        } finally {
            setReviewingParseResumeId(null);
        }
    };

    const handleApplyParse = async (resumeId: string) => {
        setApplyingParseResumeId(resumeId);
        try {
            const replace = Boolean(replaceModeByResumeId[resumeId]);
            await applyResumeParseToProfileAction(resumeId, replace ? "replace" : "merge");
            pushToast(replace ? "Profile replaced from parsed resume." : "Parsed resume merged into profile.", "success");
            router.refresh();
        } catch (error) {
            pushToast((error as Error).message || "Failed to apply parsed resume.", "error");
        } finally {
            setApplyingParseResumeId(null);
        }
    };

    const handleSaveWorkshop = async (resumeId: string) => {
        const draft = workshopDrafts[resumeId] || { targetRole: "", focusSkills: "", jobPreferences: "" };
        setSavingResumeId(resumeId);
        try {
            const skills = draft.focusSkills.split(",").map((s) => s.trim()).filter(Boolean);
            await updateResumeWorkshopMetadata(resumeId, draft.targetRole, skills, draft.jobPreferences);
            pushToast("Workshop metadata saved.", "success");
            router.refresh();
        } catch {
            pushToast("Failed to save workshop metadata.", "error");
        } finally {
            setSavingResumeId(null);
        }
    };

    const handleGeneratePreview = async (resumeId: string) => {
        setGeneratingResumeId(resumeId);
        try {
            const generated = await generateWorkshopResumePreview(resumeId);
            setGeneratedPreviewByResumeId((prev) => ({ ...prev, [resumeId]: generated }));
            pushToast("Resume preview generated.", "success");
        } catch (error) {
            pushToast((error as Error).message || "Failed to generate resume.", "error");
        } finally {
            setGeneratingResumeId(null);
        }
    };

    const handleApplyGenerated = async (resumeId: string) => {
        const content = generatedPreviewByResumeId[resumeId];
        if (!content || !content.trim()) {
            pushToast("Generate a preview first.", "info");
            return;
        }

        setApplyingResumeId(resumeId);
        try {
            await applyWorkshopResumeVariant(resumeId, content);
            router.refresh();
            pushToast("Saved as new resume version.", "success");
        } catch (error) {
            pushToast((error as Error).message || "Failed to save generated resume.", "error");
        } finally {
            setApplyingResumeId(null);
        }
    };

    const handleAutoFillWorkshop = async (resumeId: string) => {
        setAutofillingResumeId(resumeId);
        try {
            await autoPopulateWorkshopFromJobs(resumeId);
            pushToast("Workshop fields auto-filled from jobs.", "success");
            router.refresh();
        } catch (error) {
            pushToast((error as Error).message || "Failed to auto-fill workshop fields.", "error");
        } finally {
            setAutofillingResumeId(null);
        }
    };

    const handleGenerateInsights = async (resumeId: string) => {
        setInsightsLoadingResumeId(resumeId);
        try {
            const insights = await getWorkshopInsights(resumeId);
            setInsightsByResumeId((prev) => ({ ...prev, [resumeId]: insights }));
            pushToast("Workshop insights generated.", "success");
        } catch (error) {
            pushToast((error as Error).message || "Failed to generate workshop insights.", "error");
        } finally {
            setInsightsLoadingResumeId(null);
        }
    };

    const handleSaveAnswersAndSync = async (resumeId: string) => {
        const draft = answersDrafts[resumeId];
        if (!draft) return;
        setSavingAnswersResumeId(resumeId);
        try {
            await saveWorkshopAnswersAndSyncProfile(resumeId, draft);
            pushToast("Workshop answers saved and profile synced.", "success");
            router.refresh();
        } catch (error) {
            pushToast((error as Error).message || "Failed to save answers.", "error");
        } finally {
            setSavingAnswersResumeId(null);
        }
    };

    const handleGenerateCoverLetter = async (resumeId: string) => {
        const draft = coverLetterDrafts[resumeId];
        if (!draft) return;
        const selectedJob = initialJobs.find((j) => j.id === selectedJobIdByResumeId[resumeId]);
        const company = (draft.company || selectedJob?.company || "").trim();
        const title = (draft.title || selectedJob?.title || "").trim();
        const jobDescription = (draft.jobDescription || selectedJob?.description || "").trim();
        if (!company || !title) {
            pushToast("Add company and role title first.", "info");
            return;
        }

        setGeneratingCoverLetterResumeId(resumeId);
        try {
            const result = await generateWorkshopCoverLetter(resumeId, {
                ...draft,
                company,
                title,
                jobDescription,
            });
            setCoverLetterPreviewByResumeId((prev) => ({ ...prev, [resumeId]: result.content }));
            pushToast("Cover letter generated.", "success");
        } catch (error) {
            pushToast((error as Error).message || "Failed to generate cover letter.", "error");
        } finally {
            setGeneratingCoverLetterResumeId(null);
        }
    };

    const handleSaveCoverTemplate = async (resumeId: string) => {
        const draft = coverLetterDrafts[resumeId];
        const content = coverLetterPreviewByResumeId[resumeId] || "";
        if (!draft || !content.trim()) {
            pushToast("Generate a cover letter first.", "info");
            return;
        }

        setSavingCoverTemplateResumeId(resumeId);
        try {
            await createCoverLetterTemplate(
                `${draft.company || "Company"} - ${draft.title || "Role"} Cover Letter`,
                content,
                "Workshop"
            );
            router.refresh();
            pushToast("Cover letter template saved.", "success");
        } catch (error) {
            pushToast((error as Error).message || "Failed to save template.", "error");
        } finally {
            setSavingCoverTemplateResumeId(null);
        }
    };

    const handleAddResumeToLibrary = async (resumeId: string) => {
        const content = generatedPreviewByResumeId[resumeId] || "";
        if (!content.trim()) {
            pushToast("Generate a resume preview first.", "info");
            return;
        }
        setAddingResumeLibraryId(resumeId);
        try {
            await addWorkshopResumeToLibrary(resumeId, content);
            pushToast("Resume added to library.", "success");
            router.refresh();
        } catch (error) {
            pushToast((error as Error).message || "Failed to add resume to library.", "error");
        } finally {
            setAddingResumeLibraryId(null);
        }
    };

    const handleAddCoverLetterToLibrary = async (resumeId: string) => {
        const draft = coverLetterDrafts[resumeId];
        const content = coverLetterPreviewByResumeId[resumeId] || "";
        if (!draft || !content.trim()) {
            pushToast("Generate a cover letter first.", "info");
            return;
        }
        setAddingCoverLibraryId(resumeId);
        try {
            await createCoverLetterTemplate(
                `${draft.company || "Company"} - ${draft.title || "Role"} Library Cover Letter`,
                content,
                "Library"
            );
            router.refresh();
            pushToast("Cover letter added to library.", "success");
        } catch (error) {
            pushToast((error as Error).message || "Failed to add cover letter to library.", "error");
        } finally {
            setAddingCoverLibraryId(null);
        }
    };

    const downloadPdfFile = async (filename: string, content: string) => {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF({ unit: "pt", format: "letter" });
        const margin = 48;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const maxWidth = pageWidth - margin * 2;
        const lineHeight = 16;
        let y = margin;

        doc.setFont("times", "normal");
        doc.setFontSize(11);

        const lines = doc.splitTextToSize(content || "", maxWidth) as string[];
        for (const line of lines) {
            if (y > pageHeight - margin) {
                doc.addPage();
                y = margin;
            }
            doc.text(line, margin, y);
            y += lineHeight;
        }

        doc.save(filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`);
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Documents</h2>
                    <p className="text-muted-foreground">Manage resumes and prep job-specific versions.</p>
                    <div className="mt-2">
                        <AiModeBadge />
                    </div>
                </div>
                <div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.txt"
                    />
                    <button
                        onClick={handleUploadClick}
                        disabled={isUploading}
                        className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
                    >
                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Upload Resume
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2 border-b">
                <button
                    onClick={() => setActiveTab("library")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === "library" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-600 hover:text-slate-900"}`}
                >
                    <FolderOpen className="inline h-4 w-4 mr-1" />
                    Library
                </button>
                <button
                    onClick={() => setActiveTab("workshop")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === "workshop" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-600 hover:text-slate-900"}`}
                >
                    <Wrench className="inline h-4 w-4 mr-1" />
                    Workshop
                </button>
                <button
                    onClick={() => setActiveTab("coverletters")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === "coverletters" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-600 hover:text-slate-900"}`}
                >
                    <FileText className="inline h-4 w-4 mr-1" />
                    Cover Letters
                </button>
            </div>

            {activeTab === "library" && (
                <div className="space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <FileText className="text-blue-500" /> Resumes ({initialResumes.length})
                    </h3>
                    <div className="grid gap-4">
                        {initialResumes.map((resume) => {
                            const review = parseReviewByResumeId[resume.id];
                            const confidenceTone =
                                (review?.confidence || 0) >= 75
                                    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                    : (review?.confidence || 0) >= 50
                                        ? "text-amber-700 bg-amber-50 border-amber-200"
                                        : "text-red-700 bg-red-50 border-red-200";
                            return (
                                <div key={resume.id} className="space-y-2">
                                    <div className="bg-white p-4 rounded-lg border shadow-sm flex items-start justify-between group hover:border-blue-300 transition">
                                        <div className="flex gap-4">
                                            <div className="h-10 w-10 bg-red-50 text-red-600 rounded flex items-center justify-center">
                                                <span className="text-xs font-bold">PDF</span>
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-slate-900">{resume.name}</h4>
                                                <p className="text-xs text-slate-500">Added {new Date(resume.createdAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleReviewParse(resume.id)}
                                                disabled={reviewingParseResumeId === resume.id}
                                                className="px-2.5 py-1.5 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                            >
                                                {reviewingParseResumeId === resume.id ? "Parsing..." : "Review Parse"}
                                            </button>
                                            {resume.originalFileBase64 ? (
                                                <a
                                                    href={`/api/resumes/${resume.id}/download`}
                                                    className="p-2 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded"
                                                    aria-label={`Download original file ${resume.name}`}
                                                >
                                                    <Download size={16} />
                                                </a>
                                            ) : (
                                                <button
                                                    onClick={() => downloadPdfFile(`${resume.name.replace(/\.[^.]+$/, "")}.pdf`, resume.content || "")}
                                                    className="p-2 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded"
                                                    aria-label={`Download ${resume.name} as PDF`}
                                                >
                                                    <Download size={16} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDeleteResume(resume.id)}
                                                disabled={deletingResumeId === resume.id}
                                                className="p-2 hover:bg-red-50 text-slate-500 hover:text-red-500 rounded disabled:opacity-50"
                                                aria-label={`Delete ${resume.name}`}
                                            >
                                                {deletingResumeId === resume.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    {review && (
                                        <div className="rounded-lg border bg-slate-50 p-3 space-y-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-semibold text-slate-900">Parse Review</p>
                                                    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${confidenceTone}`}>
                                                        Confidence {review.confidence}%
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="inline-flex items-center gap-1 text-xs text-slate-700">
                                                        <input
                                                            type="checkbox"
                                                            checked={Boolean(replaceModeByResumeId[resume.id])}
                                                            onChange={(e) =>
                                                                setReplaceModeByResumeId((prev) => ({ ...prev, [resume.id]: e.target.checked }))
                                                            }
                                                            className="h-3.5 w-3.5 rounded border-slate-300"
                                                        />
                                                        Replace profile sections
                                                    </label>
                                                    <button
                                                        onClick={() => handleApplyParse(resume.id)}
                                                        disabled={applyingParseResumeId === resume.id}
                                                        className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                                                    >
                                                        {applyingParseResumeId === resume.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                                                        Apply to Profile
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="grid gap-2 md:grid-cols-4">
                                                <StatPill label="Experience" value={review.stats.experience} />
                                                <StatPill label="Education" value={review.stats.education} />
                                                <StatPill label="Skills" value={review.stats.skills} />
                                                <StatPill label="Projects" value={review.stats.projects} />
                                            </div>
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <div className="rounded-md border bg-white p-2">
                                                    <p className="text-xs font-semibold text-slate-700">Contact</p>
                                                    <p className="text-xs text-slate-600 mt-1">
                                                        {(review.parsed.contact?.name || "No name")} | {(review.parsed.contact?.email || "No email")}
                                                    </p>
                                                    <p className="text-xs text-slate-500">{review.parsed.contact?.linkedin || review.parsed.contact?.portfolio || "No profile links"}</p>
                                                </div>
                                                <div className="rounded-md border bg-white p-2">
                                                    <p className="text-xs font-semibold text-slate-700">Summary</p>
                                                    <p className="text-xs text-slate-600 mt-1 line-clamp-3">{review.parsed.summary || "No summary extracted."}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {initialResumes.length === 0 && (
                            <div className="text-center py-8 text-slate-500 bg-slate-50 rounded border border-dashed hover:bg-slate-100 cursor-pointer" onClick={handleUploadClick}>
                                Click to upload a resume
                            </div>
                        )}
                    </div>
                    {initialResumes.length >= 2 && (
                        <div className="mt-4 rounded-lg border bg-white p-4 space-y-3">
                            <div>
                                <h4 className="font-semibold text-slate-900">Resume Diff Viewer</h4>
                                <p className="text-xs text-slate-500">Compare two resume versions to see what changed.</p>
                            </div>
                            <div className="grid gap-2 md:grid-cols-2">
                                <select
                                    value={diffLeftResumeId}
                                    onChange={(e) => setDiffLeftResumeId(e.target.value)}
                                    className="w-full rounded-md border border-slate-300 p-2 text-sm"
                                >
                                    <option value="">Select base resume</option>
                                    {initialResumes.map((r) => (
                                        <option key={`left-${r.id}`} value={r.id}>
                                            {r.name} (v{r.version || 1})
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={diffRightResumeId}
                                    onChange={(e) => setDiffRightResumeId(e.target.value)}
                                    className="w-full rounded-md border border-slate-300 p-2 text-sm"
                                >
                                    <option value="">Select compare resume</option>
                                    {initialResumes.map((r) => (
                                        <option key={`right-${r.id}`} value={r.id}>
                                            {r.name} (v{r.version || 1})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {(() => {
                                const left = initialResumes.find((r) => r.id === diffLeftResumeId);
                                const right = initialResumes.find((r) => r.id === diffRightResumeId);
                                if (!left || !right) return null;
                                const diff = buildResumeDiff(left.content || "", right.content || "");
                                return (
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div className="rounded-md border bg-green-50 p-3">
                                            <p className="text-xs font-semibold text-green-800 mb-2">Added Lines ({diff.addedCount})</p>
                                            <div className="space-y-1 max-h-64 overflow-auto">
                                                {diff.added.length ? diff.added.map((line, idx) => (
                                                    <p key={`a-${idx}`} className="text-xs text-green-800">+ {line}</p>
                                                )) : <p className="text-xs text-green-700">No added lines.</p>}
                                            </div>
                                        </div>
                                        <div className="rounded-md border bg-red-50 p-3">
                                            <p className="text-xs font-semibold text-red-800 mb-2">Removed Lines ({diff.removedCount})</p>
                                            <div className="space-y-1 max-h-64 overflow-auto">
                                                {diff.removed.length ? diff.removed.map((line, idx) => (
                                                    <p key={`r-${idx}`} className="text-xs text-red-800">- {line}</p>
                                                )) : <p className="text-xs text-red-700">No removed lines.</p>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>
            )}

            {activeTab === "workshop" && (
                <div className="space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Wrench className="text-emerald-600" /> Resume Workshop
                    </h3>
                    <p className="text-sm text-slate-600">
                        For each resume, define target role + skills + job preferences, then generate a full tailored resume variant.
                    </p>
                    <div className="grid gap-4">
                        {initialResumes.map((resume) => {
                            const draft = workshopDrafts[resume.id] || { targetRole: "", focusSkills: "", jobPreferences: "" };
                            const answers = answersDrafts[resume.id] || {
                                yearsExperience: "",
                                topAchievements: "",
                                coreStrengths: "",
                                toolsAndTech: "",
                                certifications: "",
                                targetIndustries: "",
                                desiredRoles: "",
                                preferredLocations: "",
                                additionalNotes: "",
                                targetLevel: "",
                                leadershipScope: "",
                                strongestTech: "",
                                achievementMetric: "",
                                workModePreference: "",
                            };
                            const questionIndex = Math.min(
                                currentQuestionByResumeId[resume.id] || 0,
                                WORKSHOP_QUESTION_FLOW.length - 1
                            );
                            const currentQuestion = WORKSHOP_QUESTION_FLOW[questionIndex];
                            const totalAsked = WORKSHOP_QUESTION_FLOW.reduce((count, q) => {
                                const addFollowup = q.followUp?.shouldAsk(answers) ? 1 : 0;
                                return count + 1 + addFollowup;
                            }, 0);
                            const answeredCount = WORKSHOP_QUESTION_FLOW.reduce((count, q) => {
                                let c = count + (isAnswered(answers[q.key]) ? 1 : 0);
                                if (q.followUp?.shouldAsk(answers) && isAnswered(answers[q.followUp.key])) c += 1;
                                return c;
                            }, 0);
                            const progressPercent = totalAsked ? Math.round((answeredCount / totalAsked) * 100) : 0;
                            const currentFollowUp = currentQuestion.followUp?.shouldAsk(answers) ? currentQuestion.followUp : null;
                            const canGoNext = isAnswered(answers[currentQuestion.key]) && (!currentFollowUp || isAnswered(answers[currentFollowUp.key]));
                            return (
                                <div key={resume.id} className="bg-white p-4 rounded-lg border shadow-sm space-y-3">
                                    <div>
                                        <h4 className="font-medium text-slate-900">{resume.name}</h4>
                                        <p className="text-xs text-slate-500">
                                            Added {new Date(resume.createdAt).toLocaleDateString()} | Version {resume.version || 1}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Target Job Type / Role</label>
                                        <input
                                            value={draft.targetRole}
                                            onChange={(e) =>
                                                setWorkshopDrafts((prev) => ({
                                                    ...prev,
                                                    [resume.id]: { ...draft, targetRole: e.target.value },
                                                }))
                                            }
                                            placeholder="e.g. Backend Engineer, Data Analyst"
                                            className="w-full rounded-md border border-slate-300 p-2 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Focus Skills</label>
                                        <input
                                            value={draft.focusSkills}
                                            onChange={(e) =>
                                                setWorkshopDrafts((prev) => ({
                                                    ...prev,
                                                    [resume.id]: { ...draft, focusSkills: e.target.value },
                                                }))
                                            }
                                            placeholder="e.g. Python, SQL, React, AWS"
                                            className="w-full rounded-md border border-slate-300 p-2 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Job Preferences</label>
                                        <textarea
                                            value={draft.jobPreferences}
                                            onChange={(e) =>
                                                setWorkshopDrafts((prev) => ({
                                                    ...prev,
                                                    [resume.id]: { ...draft, jobPreferences: e.target.value },
                                                }))
                                            }
                                            placeholder="e.g. Remote-first US roles, product-focused companies, fintech/data platforms..."
                                            className="w-full rounded-md border border-slate-300 p-2 text-sm"
                                            rows={3}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleAutoFillWorkshop(resume.id)}
                                            disabled={autofillingResumeId === resume.id}
                                            className="inline-flex items-center rounded-md bg-slate-700 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                                        >
                                            {autofillingResumeId === resume.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-2 h-3.5 w-3.5" />}
                                            Auto-fill From Jobs
                                        </button>
                                    <button
                                        onClick={() => handleSaveWorkshop(resume.id)}
                                        disabled={savingResumeId === resume.id}
                                        className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                        {savingResumeId === resume.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
                                        Save Workshop Settings
                                    </button>
                                        <button
                                            onClick={() => handleGeneratePreview(resume.id)}
                                            disabled={generatingResumeId === resume.id}
                                            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {generatingResumeId === resume.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}
                                            Generate Preview
                                        </button>
                                        <button
                                            onClick={() => handleApplyGenerated(resume.id)}
                                            disabled={applyingResumeId === resume.id}
                                            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                                        >
                                            {applyingResumeId === resume.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-2 h-3.5 w-3.5" />}
                                            Save As New Version
                                        </button>
                                        <button
                                            onClick={() => handleGenerateInsights(resume.id)}
                                            disabled={insightsLoadingResumeId === resume.id}
                                            className="inline-flex items-center rounded-md bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                                        >
                                            {insightsLoadingResumeId === resume.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="mr-2 h-3.5 w-3.5" />}
                                            Analyze Fit
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        Uses your Profile, added Jobs queue, target role, and preferences to rewrite this resume version.
                                    </p>
                                    <div className="pt-3 border-t space-y-2">
                                        <h5 className="text-sm font-semibold text-slate-900">Guided Questions (Build Full Resume + Update Profile)</h5>
                                        <p className="text-xs text-slate-500">Answer one question at a time. This feeds both profile data and a stronger full-resume draft.</p>
                                        <div className="rounded-md border bg-slate-50 p-3">
                                            <div className="flex items-center justify-between text-[11px] text-slate-600 mb-2">
                                                <span>Question {questionIndex + 1} of {WORKSHOP_QUESTION_FLOW.length}</span>
                                                <span>{progressPercent}% complete</span>
                                            </div>
                                            <div className="h-2 rounded bg-slate-200 overflow-hidden mb-3">
                                                <div className="h-full bg-emerald-600 transition-all" style={{ width: `${progressPercent}%` }} />
                                            </div>
                                            <label className="block text-xs font-semibold text-slate-800 mb-1">{currentQuestion.prompt}</label>
                                            <p className="text-[11px] text-slate-500 mb-2">{currentQuestion.help}</p>
                                            {currentQuestion.multiline ? (
                                                <textarea
                                                    value={answers[currentQuestion.key]}
                                                    onChange={(e) =>
                                                        setAnswersDrafts((prev) => ({
                                                            ...prev,
                                                            [resume.id]: { ...answers, [currentQuestion.key]: e.target.value },
                                                        }))
                                                    }
                                                    placeholder={currentQuestion.placeholder}
                                                    className="w-full rounded-md border border-slate-300 p-2 text-xs"
                                                    rows={currentQuestion.rows || 3}
                                                />
                                            ) : (
                                                <input
                                                    value={answers[currentQuestion.key]}
                                                    onChange={(e) =>
                                                        setAnswersDrafts((prev) => ({
                                                            ...prev,
                                                            [resume.id]: { ...answers, [currentQuestion.key]: e.target.value },
                                                        }))
                                                    }
                                                    placeholder={currentQuestion.placeholder}
                                                    className="w-full rounded-md border border-slate-300 p-2 text-xs"
                                                />
                                            )}
                                            {currentFollowUp && (
                                                <div className="mt-3 pt-3 border-t border-slate-200">
                                                    <label className="block text-xs font-semibold text-slate-800 mb-1">{currentFollowUp.prompt}</label>
                                                    <p className="text-[11px] text-slate-500 mb-2">{currentFollowUp.help}</p>
                                                    {currentFollowUp.multiline ? (
                                                        <textarea
                                                            value={answers[currentFollowUp.key]}
                                                            onChange={(e) =>
                                                                setAnswersDrafts((prev) => ({
                                                                    ...prev,
                                                                    [resume.id]: { ...answers, [currentFollowUp.key]: e.target.value },
                                                                }))
                                                            }
                                                            placeholder={currentFollowUp.placeholder}
                                                            className="w-full rounded-md border border-slate-300 p-2 text-xs"
                                                            rows={currentFollowUp.rows || 3}
                                                        />
                                                    ) : (
                                                        <input
                                                            value={answers[currentFollowUp.key]}
                                                            onChange={(e) =>
                                                                setAnswersDrafts((prev) => ({
                                                                    ...prev,
                                                                    [resume.id]: { ...answers, [currentFollowUp.key]: e.target.value },
                                                                }))
                                                            }
                                                            placeholder={currentFollowUp.placeholder}
                                                            className="w-full rounded-md border border-slate-300 p-2 text-xs"
                                                        />
                                                    )}
                                                </div>
                                            )}
                                            {!canGoNext && (
                                                <p className="text-[11px] text-amber-700 mt-2">
                                                    Answer this question{currentFollowUp ? " and follow-up" : ""} to continue.
                                                </p>
                                            )}
                                            <div className="mt-3 flex items-center justify-between">
                                                <button
                                                    onClick={() =>
                                                        setCurrentQuestionByResumeId((prev) => ({
                                                            ...prev,
                                                            [resume.id]: Math.max(0, questionIndex - 1),
                                                        }))
                                                    }
                                                    disabled={questionIndex === 0}
                                                    className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                                                >
                                                    Previous
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        setCurrentQuestionByResumeId((prev) => ({
                                                            ...prev,
                                                            [resume.id]: Math.min(WORKSHOP_QUESTION_FLOW.length - 1, questionIndex + 1),
                                                        }))
                                                    }
                                                    disabled={questionIndex >= WORKSHOP_QUESTION_FLOW.length - 1 || !canGoNext}
                                                    className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                                                >
                                                    {questionIndex >= WORKSHOP_QUESTION_FLOW.length - 1 ? "Last Question" : "Next Question"}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 pt-1">
                                            <button
                                                onClick={() => handleSaveAnswersAndSync(resume.id)}
                                                disabled={savingAnswersResumeId === resume.id}
                                                className="inline-flex items-center rounded-md bg-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                                            >
                                                {savingAnswersResumeId === resume.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
                                                Save Answers + Update Profile
                                            </button>
                                        </div>
                                    </div>
                                    {generatedPreviewByResumeId[resume.id] && (
                                        <div className="pt-2 border-t">
                                            <div className="mb-2 flex items-center justify-between">
                                                <label className="block text-sm font-medium text-slate-700">Generated Resume Preview</label>
                                                <div className="inline-flex rounded-md border overflow-hidden">
                                                    <button
                                                        onClick={() => setPreviewModeByResumeId((prev) => ({ ...prev, [resume.id]: "pretty" }))}
                                                        className={`px-2 py-1 text-xs ${((previewModeByResumeId[resume.id] || "pretty") === "pretty") ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}
                                                    >
                                                        Pretty
                                                    </button>
                                                    <button
                                                        onClick={() => setPreviewModeByResumeId((prev) => ({ ...prev, [resume.id]: "raw" }))}
                                                        className={`px-2 py-1 text-xs ${((previewModeByResumeId[resume.id] || "pretty") === "raw") ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}
                                                    >
                                                        Raw Edit
                                                    </button>
                                                </div>
                                            </div>
                                            {(previewModeByResumeId[resume.id] || "pretty") === "pretty" ? (
                                                <div className="rounded-lg border bg-white p-6">
                                                    {(() => {
                                                        const parsed = parseResumeForPreview(generatedPreviewByResumeId[resume.id]);
                                                        return (
                                                            <div className="space-y-4">
                                                                <div>
                                                                    <h4 className="text-xl font-bold tracking-wide text-slate-900">{parsed.name || "CANDIDATE NAME"}</h4>
                                                                    <p className="text-xs text-slate-600 mt-1">{parsed.contact || "Email | Phone | LinkedIn | Portfolio"}</p>
                                                                </div>
                                                                {parsed.sections.map((section) => (
                                                                    <div key={section.title} className="space-y-2">
                                                                        <h5 className="text-[11px] font-bold tracking-[0.18em] text-slate-700 border-b pb-1">{section.title}</h5>
                                                                        <div className="space-y-1">
                                                                            {section.lines.map((line, idx) => (
                                                                                line.trim().startsWith("-") ? (
                                                                                    <p key={idx} className="text-sm text-slate-800 pl-4 relative">
                                                                                        <span className="absolute left-0 top-0 text-slate-500">-</span>
                                                                                        {line.replace(/^\-\s*/, "")}
                                                                                    </p>
                                                                                ) : (
                                                                                    <p key={idx} className="text-sm text-slate-800">{line}</p>
                                                                                )
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            ) : (
                                                <textarea
                                                    value={generatedPreviewByResumeId[resume.id]}
                                                    onChange={(e) =>
                                                        setGeneratedPreviewByResumeId((prev) => ({
                                                            ...prev,
                                                            [resume.id]: e.target.value,
                                                        }))
                                                    }
                                                    className="w-full rounded-md border border-slate-300 p-2 text-xs font-mono"
                                                    rows={16}
                                                />
                                            )}
                                            <div className="mt-3 flex items-center gap-2">
                                                <button
                                                    onClick={() => downloadPdfFile(`${resume.name.replace(/\.[^.]+$/, "")}-workshop-resume.pdf`, generatedPreviewByResumeId[resume.id])}
                                                    className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                                >
                                                    <Download className="mr-2 h-3.5 w-3.5" />
                                                    Download PDF
                                                </button>
                                                <button
                                                    onClick={() => handleApplyGenerated(resume.id)}
                                                    disabled={applyingResumeId === resume.id}
                                                    className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                                                >
                                                    {applyingResumeId === resume.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
                                                    Save
                                                </button>
                                                <button
                                                    onClick={() => handleAddResumeToLibrary(resume.id)}
                                                    disabled={addingResumeLibraryId === resume.id}
                                                    className="inline-flex items-center rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                                                >
                                                    {addingResumeLibraryId === resume.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="mr-2 h-3.5 w-3.5" />}
                                                    Add to Library
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {insightsByResumeId[resume.id] && (
                                        <div className="pt-3 border-t space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h5 className="text-sm font-semibold text-slate-900">Workshop Insights</h5>
                                                <button
                                                    onClick={() =>
                                                        setWorkshopDrafts((prev) => ({
                                                            ...prev,
                                                            [resume.id]: {
                                                                targetRole: insightsByResumeId[resume.id].suggestedRole,
                                                                focusSkills: insightsByResumeId[resume.id].suggestedSkills.join(", "),
                                                                jobPreferences: insightsByResumeId[resume.id].suggestedPreferences,
                                                            },
                                                        }))
                                                    }
                                                    className="text-xs rounded border px-2 py-1 bg-white hover:bg-slate-50"
                                                >
                                                    Use Suggestions
                                                </button>
                                            </div>
                                            <p className="text-xs text-slate-500">{insightsByResumeId[resume.id].note}</p>
                                            <div>
                                                <p className="text-xs font-medium text-slate-700 mb-1">Top Job Fits</p>
                                                <div className="space-y-1">
                                                    {insightsByResumeId[resume.id].topJobFits.map((fit) => (
                                                        <div key={fit.jobId} className="text-xs text-slate-700 flex items-center justify-between bg-slate-50 border rounded px-2 py-1">
                                                            <span>{fit.title} @ {fit.company}</span>
                                                            <span className="font-semibold">{fit.fitScore}%</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-xs font-medium text-slate-700 mb-1">Likely Missing Skills</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {insightsByResumeId[resume.id].missingSkills.length ? insightsByResumeId[resume.id].missingSkills.map((skill) => (
                                                        <span key={skill} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                                            {skill}
                                                        </span>
                                                    )) : <span className="text-xs text-slate-500">No major gaps found.</span>}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {initialResumes.length === 0 && (
                            <div className="text-center py-8 text-slate-500 bg-slate-50 rounded border border-dashed">
                                Upload resumes first to start workshop.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === "coverletters" && (
                <div className="space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <FileText className="text-indigo-600" /> Cover Letter Workshop
                    </h3>
                    <p className="text-sm text-slate-600">
                        Generate high-quality, targeted cover letters based on your resume workshop data and job context.
                    </p>
                    <div className="grid gap-4">
                        {initialResumes.map((resume) => {
                            const draft = coverLetterDrafts[resume.id] || {
                                company: "",
                                title: resume.targetRole || "",
                                hiringManager: "",
                                tone: "confident" as const,
                                format: "standard" as const,
                                whyCompany: "",
                                jobDescription: "",
                                additionalInfo: "",
                            };
                            const selectedJob = initialJobs.find((j) => j.id === selectedJobIdByResumeId[resume.id]);
                            const preview = coverLetterPreviewByResumeId[resume.id] || "";
                            return (
                                <div key={`cl-${resume.id}`} className="bg-white p-4 rounded-lg border shadow-sm space-y-3">
                                    <div>
                                        <h4 className="font-medium text-slate-900">{resume.name}</h4>
                                        <p className="text-xs text-slate-500">Build a targeted cover letter for a specific role.</p>
                                    </div>
                                    <div className="rounded-md border bg-slate-50 p-3 space-y-2">
                                        <label className="block text-xs font-medium text-slate-700">Use Job From Queue</label>
                                        <select
                                            value={selectedJobIdByResumeId[resume.id] || ""}
                                            onChange={(e) => {
                                                const jobId = e.target.value;
                                                const job = initialJobs.find((j) => j.id === jobId);
                                                setSelectedJobIdByResumeId((prev) => ({ ...prev, [resume.id]: jobId }));
                                                if (job) {
                                                    setCoverLetterDrafts((prev) => ({
                                                        ...prev,
                                                        [resume.id]: {
                                                            ...draft,
                                                            company: job.company || draft.company,
                                                            title: job.title || draft.title,
                                                            jobDescription: (job.description || draft.jobDescription || "").toString(),
                                                        },
                                                    }));
                                                }
                                            }}
                                            className="w-full rounded-md border border-slate-300 p-2 text-sm"
                                        >
                                            <option value="">Select a queued job (optional)</option>
                                            {initialJobs.map((job) => (
                                                <option key={job.id} value={job.id}>
                                                    {job.title} @ {job.company}
                                                </option>
                                            ))}
                                        </select>
                                        {selectedJob && (
                                            <p className="text-[11px] text-slate-600">
                                                Using: {selectedJob.title} @ {selectedJob.company}
                                            </p>
                                        )}
                                    </div>
                                    <div className="grid gap-2 md:grid-cols-2">
                                        <input
                                            value={draft.company}
                                            onChange={(e) => setCoverLetterDrafts((prev) => ({ ...prev, [resume.id]: { ...draft, company: e.target.value } }))}
                                            placeholder="Company name"
                                            className="w-full rounded-md border border-slate-300 p-2 text-sm"
                                        />
                                        <input
                                            value={draft.title}
                                            onChange={(e) => setCoverLetterDrafts((prev) => ({ ...prev, [resume.id]: { ...draft, title: e.target.value } }))}
                                            placeholder="Role title"
                                            className="w-full rounded-md border border-slate-300 p-2 text-sm"
                                        />
                                        <input
                                            value={draft.hiringManager}
                                            onChange={(e) => setCoverLetterDrafts((prev) => ({ ...prev, [resume.id]: { ...draft, hiringManager: e.target.value } }))}
                                            placeholder="Hiring manager (optional)"
                                            className="w-full rounded-md border border-slate-300 p-2 text-sm"
                                        />
                                        <select
                                            value={draft.tone}
                                            onChange={(e) => setCoverLetterDrafts((prev) => ({ ...prev, [resume.id]: { ...draft, tone: e.target.value as CoverLetterDraft["tone"] } }))}
                                            className="w-full rounded-md border border-slate-300 p-2 text-sm"
                                        >
                                            <option value="confident">Confident</option>
                                            <option value="warm">Warm</option>
                                            <option value="direct">Direct</option>
                                        </select>
                                        <select
                                            value={draft.format}
                                            onChange={(e) => setCoverLetterDrafts((prev) => ({ ...prev, [resume.id]: { ...draft, format: e.target.value as CoverLetterDraft["format"] } }))}
                                            className="w-full rounded-md border border-slate-300 p-2 text-sm"
                                        >
                                            <option value="standard">Standard Letter</option>
                                            <option value="email">Email Style</option>
                                        </select>
                                    </div>
                                    <textarea
                                        value={draft.whyCompany}
                                        onChange={(e) => setCoverLetterDrafts((prev) => ({ ...prev, [resume.id]: { ...draft, whyCompany: e.target.value } }))}
                                        placeholder="Why this company? (mission, product, team, culture)"
                                        rows={2}
                                        className="w-full rounded-md border border-slate-300 p-2 text-sm"
                                    />
                                    <textarea
                                        value={draft.jobDescription}
                                        onChange={(e) => setCoverLetterDrafts((prev) => ({ ...prev, [resume.id]: { ...draft, jobDescription: e.target.value } }))}
                                        placeholder="Paste key parts of the job description for stronger alignment"
                                        rows={4}
                                        className="w-full rounded-md border border-slate-300 p-2 text-sm"
                                    />
                                    <textarea
                                        value={draft.additionalInfo}
                                        onChange={(e) => setCoverLetterDrafts((prev) => ({ ...prev, [resume.id]: { ...draft, additionalInfo: e.target.value } }))}
                                        placeholder="Extra points to include (visa/work auth, notice period, domain expertise, leadership context, etc.)"
                                        rows={2}
                                        className="w-full rounded-md border border-slate-300 p-2 text-sm"
                                    />
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleGenerateCoverLetter(resume.id)}
                                            disabled={generatingCoverLetterResumeId === resume.id}
                                            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                                        >
                                            {generatingCoverLetterResumeId === resume.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}
                                            Generate Cover Letter
                                        </button>
                                        <button
                                            onClick={() => handleSaveCoverTemplate(resume.id)}
                                            disabled={savingCoverTemplateResumeId === resume.id}
                                            className="inline-flex items-center rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                                        >
                                            {savingCoverTemplateResumeId === resume.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
                                            Save as Template
                                        </button>
                                    </div>
                                    {preview && (
                                        <div className="pt-2 border-t">
                                            <div className="mb-2 flex items-center justify-between">
                                                <label className="block text-sm font-medium text-slate-700">Cover Letter Preview</label>
                                                <div className="inline-flex rounded-md border overflow-hidden">
                                                    <button
                                                        onClick={() => setCoverPreviewModeByResumeId((prev) => ({ ...prev, [resume.id]: "pretty" }))}
                                                        className={`px-2 py-1 text-xs ${((coverPreviewModeByResumeId[resume.id] || "pretty") === "pretty") ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}
                                                    >
                                                        Pretty
                                                    </button>
                                                    <button
                                                        onClick={() => setCoverPreviewModeByResumeId((prev) => ({ ...prev, [resume.id]: "raw" }))}
                                                        className={`px-2 py-1 text-xs ${((coverPreviewModeByResumeId[resume.id] || "pretty") === "raw") ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}
                                                    >
                                                        Raw Edit
                                                    </button>
                                                </div>
                                            </div>
                                            {(coverPreviewModeByResumeId[resume.id] || "pretty") === "pretty" ? (
                                                <div className="rounded-lg border bg-white p-6">
                                                    <div className="whitespace-pre-line text-sm leading-relaxed text-slate-800">
                                                        {preview}
                                                    </div>
                                                </div>
                                            ) : (
                                                <textarea
                                                    value={preview}
                                                    onChange={(e) => setCoverLetterPreviewByResumeId((prev) => ({ ...prev, [resume.id]: e.target.value }))}
                                                    className="w-full rounded-md border border-slate-300 p-3 text-sm font-mono"
                                                    rows={16}
                                                />
                                            )}
                                            <div className="mt-3 flex items-center gap-2">
                                                <button
                                                    onClick={() => downloadPdfFile(`${(draft.company || "company").replace(/\s+/g, "-")}-${(draft.title || "role").replace(/\s+/g, "-")}-cover-letter.pdf`, preview)}
                                                    className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                                >
                                                    <Download className="mr-2 h-3.5 w-3.5" />
                                                    Download PDF
                                                </button>
                                                <button
                                                    onClick={() => handleSaveCoverTemplate(resume.id)}
                                                    disabled={savingCoverTemplateResumeId === resume.id}
                                                    className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                                                >
                                                    {savingCoverTemplateResumeId === resume.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
                                                    Save
                                                </button>
                                                <button
                                                    onClick={() => handleAddCoverLetterToLibrary(resume.id)}
                                                    disabled={addingCoverLibraryId === resume.id}
                                                    className="inline-flex items-center rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                                                >
                                                    {addingCoverLibraryId === resume.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="mr-2 h-3.5 w-3.5" />}
                                                    Add to Library
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

function StatPill({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
            <p className="text-sm font-semibold text-slate-900">{value}</p>
        </div>
    );
}



