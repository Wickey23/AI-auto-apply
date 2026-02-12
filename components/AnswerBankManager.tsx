"use client";

import { AnswerBankItem } from "@/lib/types";
import { createAnswerBankItem, deleteAnswerBankItem } from "@/app/actions";
import { useState } from "react";
import { Plus, Trash2, MessageSquare, Tag } from "lucide-react";

export function AnswerBankManager({ items }: { items: AnswerBankItem[] }) {
    const [isAdding, setIsAdding] = useState(false);
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState("");
    const [tags, setTags] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const tagList = tags.split(",").map(t => t.trim()).filter(Boolean);
        await createAnswerBankItem(question, answer, tagList);
        setIsAdding(false);
        setQuestion("");
        setAnswer("");
        setTags("");
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Answer Bank</h2>
                    <p className="text-sm text-slate-500">Store STAR stories and FAQ answers for quick access.</p>
                </div>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition text-sm font-medium"
                >
                    <Plus size={16} /> Add Story
                </button>
            </div>

            {isAdding && (
                <form onSubmit={handleSubmit} className="bg-slate-50 p-6 rounded-lg border space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Question / Topic</label>
                        <input
                            type="text"
                            required
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                            placeholder="e.g. Tell me about a challenge..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Answer / Story (STAR Method)</label>
                        <textarea
                            required
                            rows={4}
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                            placeholder="Situation, Task, Action, Result..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Tags (comma separated)</label>
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                            placeholder="Behavioral, Leadership, Technical"
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
                            Save Answer
                        </button>
                    </div>
                </form>
            )}

            <div className="grid grid-cols-1 gap-4">
                {items.map((item) => (
                    <div key={item.id} className="bg-white p-6 rounded-lg border shadow-sm group relative">
                        <button
                            onClick={() => deleteAnswerBankItem(item.id)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                        >
                            <Trash2 size={16} />
                        </button>
                        <div className="flex items-start gap-3 mb-2">
                            <MessageSquare className="text-blue-500 mt-1 shrink-0" size={18} />
                            <h3 className="font-medium text-slate-900">{item.question}</h3>
                        </div>
                        <p className="text-sm text-slate-600 whitespace-pre-line pl-8 mb-3">{item.answer}</p>
                        <div className="pl-8 flex gap-2">
                            {item.tags.map(tag => (
                                <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                                    <Tag size={10} className="mr-1" /> {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
                {items.length === 0 && !isAdding && (
                    <div className="text-center py-12 text-slate-500 bg-slate-50 border-2 border-dashed rounded-lg">
                        No stories or answers saved yet.
                    </div>
                )}
            </div>
        </div>
    );
}
