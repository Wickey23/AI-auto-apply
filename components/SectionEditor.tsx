"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionEditorProps<T> {
    title: string;
    icon: React.ReactNode;
    items: T[];
    renderItem: (item: T, index: number, onChange: (updated: T) => void, onDelete: () => void) => React.ReactNode;
    onAdd: () => void;
    description?: string;
}

export function SectionEditor<T extends { id: string }>({
    title,
    icon,
    items,
    renderItem,
    onAdd,
    description
}: SectionEditorProps<T>) {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div
                className="flex items-center justify-between p-6 bg-slate-50 border-b cursor-pointer hover:bg-slate-100 transition"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    {icon}
                    <div>
                        <h3 className="font-semibold text-lg text-slate-900">{title}</h3>
                        {description && <p className="text-sm text-slate-500">{description}</p>}
                    </div>
                </div>
                {isExpanded ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
            </div>

            {isExpanded && (
                <div className="p-6 space-y-6">
                    {items.length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed rounded-lg bg-slate-50">
                            <p className="text-slate-500 mb-2">No entries yet.</p>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onAdd(); }}
                                className="text-sm font-medium text-blue-600 hover:underline"
                            >
                                Add your first {title.toLowerCase()}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {items.map((item, index) => (
                                <div key={item.id} className="relative group">
                                    {renderItem(
                                        item,
                                        index,
                                        (updated) => {
                                            // Logic handled by parent to update array
                                        },
                                        () => {
                                            // Logic handled by parent to remove
                                        }
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {items.length > 0 && (
                        <button
                            type="button"
                            onClick={onAdd}
                            className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-md transition"
                        >
                            <Plus size={16} /> Add Another
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
