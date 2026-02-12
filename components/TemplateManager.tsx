"use client";

import { CoverLetterTemplate } from "@/lib/types";
import { createCoverLetterTemplate, deleteCoverLetterTemplate } from "@/app/actions";
import { useState } from "react";
import { Plus, Trash2, FileText, Variable } from "lucide-react";

export function TemplateManager({ templates }: { templates: CoverLetterTemplate[] }) {
    const [isAdding, setIsAdding] = useState(false);
    const [name, setName] = useState("");
    const [content, setContent] = useState("");
    const [category, setCategory] = useState("General");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await createCoverLetterTemplate(name, content, category);
        setIsAdding(false);
        setName("");
        setContent("");
        setCategory("General");
    };

    const insertVariable = (variable: string) => {
        setContent(prev => prev + `{{${variable}}}`);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Cover Letter Templates</h2>
                    <p className="text-sm text-slate-500">Create reusable templates with dynamic variables.</p>
                </div>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition text-sm font-medium"
                >
                    <Plus size={16} /> New Template
                </button>
            </div>

            {isAdding && (
                <form onSubmit={handleSubmit} className="bg-slate-50 p-6 rounded-lg border space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Template Name</label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                                placeholder="e.g. Startup Focusing"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Category</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                            >
                                <option>General</option>
                                <option>Startup</option>
                                <option>Corporate</option>
                                <option>Remote</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-slate-700">Template Content</label>
                            <div className="flex gap-2">
                                {["Company", "Title", "MyName", "MyEmail"].map(v => (
                                    <button
                                        key={v}
                                        type="button"
                                        onClick={() => insertVariable(v)}
                                        className="text-xs bg-white border px-2 py-1 rounded hover:bg-slate-50 flex items-center gap-1"
                                    >
                                        <Variable size={10} /> {v}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <textarea
                            required
                            rows={8}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 font-mono"
                            placeholder="Dear Hiring Manager at {{Company}}, ..."
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setIsAdding(false)}
                            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-md"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                        >
                            Save Template
                        </button>
                    </div>
                </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((t) => (
                    <div key={t.id} className="bg-white p-6 rounded-lg border shadow-sm group relative flex flex-col h-full">
                        <button
                            onClick={() => deleteCoverLetterTemplate(t.id)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                        >
                            <Trash2 size={16} />
                        </button>
                        <div className="flex items-center gap-2 mb-3">
                            <FileText className="text-purple-500" size={20} />
                            <div>
                                <h3 className="font-medium text-slate-900">{t.name}</h3>
                                <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-100 rounded-full">{t.category}</span>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-3 rounded text-xs text-slate-600 font-mono overflow-hidden flex-1 relative">
                            {t.content.substring(0, 150)}...
                            <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-50 to-transparent" />
                        </div>
                    </div>
                ))}
                {templates.length === 0 && !isAdding && (
                    <div className="col-span-full text-center py-12 text-slate-500 bg-slate-50 border-2 border-dashed rounded-lg">
                        No templates created yet.
                    </div>
                )}
            </div>
        </div>
    );
}
