"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const jobSchema = z.object({
    company: z.string().min(1, "Company name is required"),
    title: z.string().min(1, "Job title is required"),
    link: z.string().url("Must be a valid URL").optional().or(z.literal("")),
    description: z.string().optional(),
});

type JobFormValues = z.infer<typeof jobSchema>;

export default function NewJobPage() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { register, handleSubmit, formState: { errors } } = useForm<JobFormValues>({
        resolver: zodResolver(jobSchema),
    });

    const onSubmit = async (data: JobFormValues) => {
        setIsSubmitting(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log("Job data:", data);
        setIsSubmitting(false);
        router.push("/jobs"); // In real app, would redirect to the new job page
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Add New Job</h2>
                <p className="text-muted-foreground">Manually add a job to your queue.</p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm border">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid gap-6 sm:grid-cols-2">
                        <div className="space-y-2">
                            <label htmlFor="company" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Company Name
                            </label>
                            <input
                                id="company"
                                {...register("company")}
                                className={cn(
                                    "flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50",
                                    errors.company && "border-red-500 focus:ring-red-500"
                                )}
                                placeholder="e.g. Acme Corp"
                            />
                            {errors.company && <p className="text-sm text-red-500">{errors.company.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="title" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Job Title
                            </label>
                            <input
                                id="title"
                                {...register("title")}
                                className={cn(
                                    "flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50",
                                    errors.title && "border-red-500 focus:ring-red-500"
                                )}
                                placeholder="e.g. Senior Engineer"
                            />
                            {errors.title && <p className="text-sm text-red-500">{errors.title.message}</p>}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="link" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Job Link (Optional)
                        </label>
                        <input
                            id="link"
                            {...register("link")}
                            className={cn(
                                "flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50",
                                errors.link && "border-red-500 focus:ring-red-500"
                            )}
                            placeholder="https://ApplyPilot.com/careers/..."
                        />
                        {errors.link && <p className="text-sm text-red-500">{errors.link.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="description" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Job Description
                        </label>
                        <textarea
                            id="description"
                            {...register("description")}
                            className="flex min-h-[150px] w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Paste the full job description here..."
                        />
                    </div>

                    <div className="flex justify-end gap-4 pt-4">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background hover:bg-slate-100 h-10 py-2 px-4"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-blue-600 text-white hover:bg-blue-700 h-10 py-2 px-4 min-w-[100px]"
                        >
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Add Job"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
