"use client";

import { Profile, Experience, Education, Project } from "@/lib/types";
import { updateProfile } from "@/app/actions";
import { useEffect, useState } from "react";
import { Save, User, Briefcase, GraduationCap, Code, Loader2, Link as LinkIcon, Plus, Trash2 } from "lucide-react";
import { SectionEditor } from "./SectionEditor";
import { pushToast } from "@/lib/client-toast";

export default function ProfileForm({ initialProfile }: { initialProfile: Profile }) {
    const [isSaving, setIsSaving] = useState(false);
    const [profile, setProfile] = useState<Profile>(initialProfile);

    useEffect(() => {
        setProfile(initialProfile);
    }, [initialProfile]);

    // Helper to update deeply nested state
    const updateSection = (
        section: keyof Profile,
        id: string,
        field: string,
        value: any
    ) => {
        setProfile(prev => {
            const list = (prev[section] as any[]) || [];
            return {
                ...prev,
                [section]: list.map(item => item.id === id ? { ...item, [field]: value } : item)
            };
        });
    };

    const addItem = (section: keyof Profile, newItem: any) => {
        setProfile(prev => ({
            ...prev,
            [section]: [...(prev[section] as any[]), newItem]
        }));
    };

    const removeItem = (section: keyof Profile, id: string) => {
        setProfile(prev => ({
            ...prev,
            [section]: (prev[section] as any[]).filter(item => item.id !== id)
        }));
    };
    const updateCustomField = (id: string, field: "label" | "value", value: string) => {
        setProfile(prev => ({
            ...prev,
            customFields: (prev.customFields || []).map((item) => item.id === id ? { ...item, [field]: value } : item),
        }));
    };
    const addCustomField = () => {
        setProfile(prev => ({
            ...prev,
            customFields: [...(prev.customFields || []), {
                id: `custom-${Date.now()}`,
                label: "",
                value: "",
                source: "Manual",
                updatedAt: new Date(),
            }],
        }));
    };
    const removeCustomField = (id: string) => {
        setProfile(prev => ({
            ...prev,
            customFields: (prev.customFields || []).filter((item) => item.id !== id),
        }));
    };

    const handleSubmit = async () => {
        setIsSaving(true);
        await updateProfile(profile); // We send the whole profile object now
        setIsSaving(false);
        pushToast("Profile saved.", "success");
    };

    return (
        <div className="space-y-8">

            {/* Contact Info */}
            <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
                <div className="flex items-center gap-2 font-semibold text-lg text-slate-900 border-b pb-2">
                    <User size={20} className="text-blue-500" />
                    <span>Identity & Contact</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Contact Details</label>
                        <textarea
                            value={profile.contactInfo || ""}
                            onChange={(e) => setProfile({ ...profile, contactInfo: e.target.value })}
                            rows={4}
                            className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            placeholder="Name, Phone, Email, Location..."
                        />
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">LinkedIn URL</label>
                            <input
                                type="text"
                                value={profile.linkedin || ""}
                                onChange={(e) => setProfile({ ...profile, linkedin: e.target.value })}
                                className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Portfolio URL</label>
                            <input
                                type="text"
                                value={profile.portfolio || ""}
                                onChange={(e) => setProfile({ ...profile, portfolio: e.target.value })}
                                className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Experience Section */}
            <SectionEditor<Experience>
                title="Experience"
                icon={<Briefcase className="text-orange-500" />}
                items={profile.experience || []}
                onAdd={() => addItem("experience", {
                    id: `exp-${Date.now()}`, title: "", company: "", startDate: "", bullets: []
                })}
                renderItem={(item, index, _, __) => (
                    <div className="p-4 border rounded-lg bg-white relative space-y-4">
                        <button
                            onClick={() => removeItem("experience", item.id)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-red-500"
                        >
                            <Trash2 size={16} />
                        </button>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase">Title</label>
                                <input
                                    value={item.title}
                                    onChange={(e) => updateSection("experience", item.id, "title", e.target.value)}
                                    className="block w-full border-b focus:border-blue-500 focus:outline-none py-1"
                                    placeholder="Senior Engineer"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase">Company</label>
                                <input
                                    value={item.company}
                                    onChange={(e) => updateSection("experience", item.id, "company", e.target.value)}
                                    className="block w-full border-b focus:border-blue-500 focus:outline-none py-1"
                                    placeholder="Tech Corp"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase">Dates</label>
                                <input
                                    value={item.startDate}
                                    onChange={(e) => updateSection("experience", item.id, "startDate", e.target.value)}
                                    className="block w-full border-b focus:border-blue-500 focus:outline-none py-1"
                                    placeholder="Jan 2020 - Present"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase">Location</label>
                                <input
                                    value={item.location || ""}
                                    onChange={(e) => updateSection("experience", item.id, "location", e.target.value)}
                                    className="block w-full border-b focus:border-blue-500 focus:outline-none py-1"
                                    placeholder="Remote"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">Description (Bullets)</label>
                            <textarea
                                value={item.description || ""}
                                onChange={(e) => updateSection("experience", item.id, "description", e.target.value)}
                                rows={3}
                                className="block w-full mt-1 border rounded-md p-2 text-sm focus:border-blue-500 focus:outline-none"
                                placeholder="• Led development of..."
                            />
                        </div>
                    </div>
                )}
            />

            {/* Education Section */}
            <SectionEditor<Education>
                title="Education"
                icon={<GraduationCap className="text-green-500" />}
                items={profile.education || []}
                onAdd={() => addItem("education", {
                    id: `edu-${Date.now()}`, school: "", degree: ""
                })}
                renderItem={(item) => (
                    <div className="p-4 border rounded-lg bg-white relative space-y-4">
                        <button
                            onClick={() => removeItem("education", item.id)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-red-500"
                        >
                            <Trash2 size={16} />
                        </button>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase">School</label>
                                <input
                                    value={item.school}
                                    onChange={(e) => updateSection("education", item.id, "school", e.target.value)}
                                    className="block w-full border-b focus:border-blue-500 focus:outline-none py-1"
                                    placeholder="University of X"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase">Degree</label>
                                <input
                                    value={item.degree}
                                    onChange={(e) => updateSection("education", item.id, "degree", e.target.value)}
                                    className="block w-full border-b focus:border-blue-500 focus:outline-none py-1"
                                    placeholder="BS Computer Science"
                                />
                            </div>
                        </div>
                    </div>
                )}
            />

            {/* Projects Section */}
            <SectionEditor<Project>
                title="Projects"
                icon={<Code className="text-purple-500" />}
                items={profile.projects || []}
                onAdd={() => addItem("projects", {
                    id: `proj-${Date.now()}`, name: "", description: "", bullets: [], skills: []
                })}
                renderItem={(item) => (
                    <div className="p-4 border rounded-lg bg-white relative space-y-4">
                        <button
                            onClick={() => removeItem("projects", item.id)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-red-500"
                        >
                            <Trash2 size={16} />
                        </button>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase">Project Name</label>
                                <input
                                    value={item.name}
                                    onChange={(e) => updateSection("projects", item.id, "name", e.target.value)}
                                    className="block w-full border-b focus:border-blue-500 focus:outline-none py-1"
                                    placeholder="AI Job Applier"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase">Description</label>
                                <textarea
                                    value={item.description || ""}
                                    onChange={(e) => updateSection("projects", item.id, "description", e.target.value)}
                                    rows={2}
                                    className="block w-full mt-1 border rounded-md p-2 text-sm focus:border-blue-500 focus:outline-none"
                                    placeholder="Built a full stack app using..."
                                />
                            </div>
                        </div>
                    </div>
                )}
            />

            <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                    <div>
                        <p className="font-semibold text-lg text-slate-900">Custom Fields</p>
                        <p className="text-xs text-slate-500">Auto-imported data that does not fit default sections.</p>
                    </div>
                    <button
                        onClick={addCustomField}
                        className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
                    >
                        <Plus size={14} />
                        Add Field
                    </button>
                </div>
                {(profile.customFields || []).length === 0 ? (
                    <p className="text-sm text-slate-500">No custom fields yet.</p>
                ) : (
                    <div className="space-y-3">
                        {(profile.customFields || []).map((item) => (
                            <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                                <input
                                    value={item.label || ""}
                                    onChange={(e) => updateCustomField(item.id, "label", e.target.value)}
                                    className="md:col-span-3 rounded-md border border-slate-300 px-3 py-2 text-sm"
                                    placeholder="Field name (e.g. Certifications)"
                                />
                                <textarea
                                    value={item.value || ""}
                                    onChange={(e) => updateCustomField(item.id, "value", e.target.value)}
                                    className="md:col-span-8 rounded-md border border-slate-300 px-3 py-2 text-sm"
                                    rows={2}
                                    placeholder="Field content"
                                />
                                <button
                                    onClick={() => removeCustomField(item.id)}
                                    className="md:col-span-1 inline-flex justify-center rounded-md border px-3 py-2 text-slate-500 hover:text-red-600 hover:border-red-200"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-end gap-4 z-10 md:static md:bg-transparent md:border-0 md:p-0">
                <button
                    onClick={handleSubmit}
                    disabled={isSaving}
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-700 transition shadow-lg disabled:opacity-50"
                >
                    {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                    {isSaving ? "Saving..." : "Save All Changes"}
                </button>
            </div>
        </div>
    );
}


