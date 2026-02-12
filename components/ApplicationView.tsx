"use client";

import { Application, ApplicationStatus } from "@/lib/types";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { updateApplicationStatus } from "@/app/actions";
import { StepResearch } from "./steps/StepResearch";
import { StepTailor } from "./steps/StepTailor";
import { StepPrep } from "./steps/StepPrep";
import { StepApply } from "./steps/StepApply";
import { CheckCircle, Circle, ArrowRight } from "lucide-react";

export default function ApplicationView({ application }: { application: Application }) {
    const getInitialStep = (status: ApplicationStatus) => {
        if (status === "INTERESTED" || status === "DRAFTING") return 0;
        if (status === "READY") return 1;
        if (status === "APPLIED") return 2;
        if (["RECRUITER_SCREEN", "TECHNICAL", "ONSITE", "OFFER", "REJECTED", "WITHDRAWN"].includes(status)) return 3;
        return 0;
    };
    const [currentStep, setCurrentStep] = useState(getInitialStep(application.status));
    const [status, setStatus] = useState<ApplicationStatus>(application.status);

    const steps = [
        { id: "research", label: "Research", component: StepResearch },
        { id: "tailor", label: "Tailor", component: StepTailor },
        { id: "prep", label: "Prep", component: StepPrep },
        { id: "apply", label: "Apply", component: StepApply },
    ];

    const CurrentComponent = steps[currentStep].component;

    const handleStatusChange = async (newStatus: ApplicationStatus) => {
        setStatus(newStatus);
        await updateApplicationStatus(application.id, newStatus);
    };

    const handleNext = async () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            // Final step complete
            await handleStatusChange("APPLIED");
            // Maybe show celebration or redirect
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 h-full">
            {/* Left Sidebar: Workflow Steps */}
            <div className="md:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-xl border shadow-sm space-y-6">
                    <div>
                        <h1 className="text-xl font-bold mb-1">{application.job.title}</h1>
                        <p className="text-muted-foreground text-sm">{application.job.company}</p>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Status</label>
                        <select
                            value={status}
                            onChange={(e) => handleStatusChange(e.target.value as ApplicationStatus)}
                            className="mt-1 block w-full rounded-md border-slate-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm border"
                        >
                            <option value="INTERESTED">Interested</option>
                            <option value="DRAFTING">Drafting</option>
                            <option value="READY">Ready</option>
                            <option value="APPLIED">Applied</option>
                            <option value="RECRUITER_SCREEN">Recruiter Screen</option>
                            <option value="TECHNICAL">Technical</option>
                            <option value="ONSITE">Onsite</option>
                            <option value="OFFER">Offer</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                    </div>

                    <nav aria-label="Progress">
                        <ol role="list" className="overflow-hidden">
                            {steps.map((step, stepIdx) => (
                                <li key={step.id} className={cn(stepIdx !== steps.length - 1 ? "pb-10" : "", "relative")}>
                                    {stepIdx !== steps.length - 1 ? (
                                        <div className={cn(
                                            "absolute top-4 left-4 -ml-px mt-0.5 h-full w-0.5",
                                            stepIdx < currentStep ? "bg-blue-600" : "bg-slate-200"
                                        )} aria-hidden="true" />
                                    ) : null}
                                    <div
                                        className="group relative flex items-start cursor-pointer"
                                        onClick={() => setCurrentStep(stepIdx)} // Allow jumping for now
                                    >
                                        <span className="flex h-9 items-center">
                                            <span className={cn(
                                                "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2",
                                                stepIdx < currentStep ? "bg-blue-600 border-blue-600" :
                                                    stepIdx === currentStep ? "border-blue-600 bg-white" : "border-slate-300 bg-white"
                                            )}>
                                                {stepIdx < currentStep ? (
                                                    <CheckCircle className="h-5 w-5 text-white" aria-hidden="true" />
                                                ) : (
                                                    <span className={cn("h-2.5 w-2.5 rounded-full", stepIdx === currentStep ? "bg-blue-600" : "bg-transparent")} />
                                                )}
                                            </span>
                                        </span>
                                        <span className="ml-4 flex min-w-0 flex-col">
                                            <span className={cn("text-sm font-medium", stepIdx === currentStep ? "text-blue-600" : "text-slate-500")}>{step.label}</span>
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </nav>
                </div>
            </div>

            {/* Main Content Area: Active Step */}
            <div className="md:col-span-3">
                <div className="bg-white rounded-xl border shadow-sm p-8 min-h-[600px]">
                    <CurrentComponent
                        application={application}
                        onComplete={handleNext}
                    />
                </div>
            </div>
        </div>
    );
}

