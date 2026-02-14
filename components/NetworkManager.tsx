"use client";

import { Contact, Interaction } from "@/lib/types";
import { createContact, deleteContact, generateNetworkSearchPlanAction, logInteraction } from "@/app/actions";
import { useState } from "react";
import { Plus, Trash2, Linkedin, MessageCircle, Loader2, Search, ExternalLink } from "lucide-react";

type NetworkQuery = {
    id: string;
    label: string;
    query: string;
    linkedinUrl: string;
    googleUrl: string;
    xUrl: string;
};

type NetworkPlan = {
    generatedAt: string;
    roleFocus: string;
    location: string;
    coreSkills: string[];
    companies: string[];
    queries: NetworkQuery[];
};

export function NetworkManager({ contacts, interactions }: { contacts: Contact[], interactions: Interaction[] }) {
    const [isAdding, setIsAdding] = useState(false);
    const [name, setName] = useState("");
    const [company, setCompany] = useState("");
    const [role, setRole] = useState("");
    const [email, setEmail] = useState("");
    const [linkedin, setLinkedin] = useState("");
    const [tags, setTags] = useState("");

    // Interaction Logging State
    const [loggingStatsId, setLoggingStatsId] = useState<string | null>(null);
    const [intType, setIntType] = useState("Email");
    const [intNotes, setIntNotes] = useState("");
    const [findingNetwork, setFindingNetwork] = useState(false);
    const [networkError, setNetworkError] = useState<string | null>(null);
    const [networkPlan, setNetworkPlan] = useState<NetworkPlan | null>(null);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const tagList = tags.split(",").map(t => t.trim()).filter(Boolean);
        await createContact(name, company, role, email, linkedin, tagList);
        setIsAdding(false);
        resetForm();
    };

    const resetForm = () => {
        setName(""); setCompany(""); setRole(""); setEmail(""); setLinkedin(""); setTags("");
    }

    const handleLogInteraction = async (contactId: string) => {
        if (!intNotes) return;
        await logInteraction(contactId, intType, intNotes, new Date());
        setLoggingStatsId(null);
        setIntNotes("");
    };

    const handleFindNetwork = async () => {
        setFindingNetwork(true);
        setNetworkError(null);
        try {
            const plan = await generateNetworkSearchPlanAction();
            setNetworkPlan(plan as NetworkPlan);
        } catch (error) {
            setNetworkError((error as Error).message || "Failed to generate network search plan.");
        } finally {
            setFindingNetwork(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <p className="text-sm font-semibold text-slate-900">Network Finder</p>
                        <p className="text-xs text-slate-500">Generate targeted people-search queries from your resume and profile.</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleFindNetwork}
                        disabled={findingNetwork}
                        className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                        {findingNetwork ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                        {findingNetwork ? "Searching..." : "Find Network"}
                    </button>
                </div>
                {networkError && (
                    <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        {networkError}
                    </p>
                )}
                {networkPlan && (
                    <div className="mt-3 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                        <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full border border-slate-300 bg-white px-2 py-1 text-slate-700">Role: {networkPlan.roleFocus}</span>
                            <span className="rounded-full border border-slate-300 bg-white px-2 py-1 text-slate-700">Location: {networkPlan.location}</span>
                            {networkPlan.coreSkills.slice(0, 4).map((s) => (
                                <span key={s} className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700">
                                    {s}
                                </span>
                            ))}
                        </div>
                        <div className="space-y-2">
                            {networkPlan.queries.map((q) => (
                                <div key={q.id} className="rounded-md border border-slate-200 bg-white p-3">
                                    <p className="text-xs font-semibold text-slate-800">{q.label}</p>
                                    <p className="mt-1 text-xs text-slate-600">{q.query}</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <a href={q.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                                            LinkedIn <ExternalLink size={11} />
                                        </a>
                                        <a href={q.googleUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                                            Google <ExternalLink size={11} />
                                        </a>
                                        <a href={q.xUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                                            X <ExternalLink size={11} />
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">My Network</h3>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition text-sm font-medium"
                >
                    <Plus size={16} /> Add Contact
                </button>
            </div>

            {isAdding && (
                <form onSubmit={handleSubmit} className="bg-slate-50 p-6 rounded-lg border space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Name</label>
                            <input required type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full rounded-md border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Company</label>
                            <input required type="text" value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1 block w-full rounded-md border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Role</label>
                            <input required type="text" value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 block w-full rounded-md border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Tags</label>
                            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className="mt-1 block w-full rounded-md border p-2" placeholder="Recruiter, Referral" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Email (Optional)</label>
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full rounded-md border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">LinkedIn URL (Optional)</label>
                            <input type="text" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} className="mt-1 block w-full rounded-md border p-2" />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm font-medium text-slate-700 border rounded-md">Cancel</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md">Save Contact</button>
                    </div>
                </form>
            )}

            <div className="grid grid-cols-1 gap-4">
                {contacts.map((contact) => (
                    <div key={contact.id} className="bg-white p-6 rounded-lg border shadow-sm group relative">
                        <button onClick={() => deleteContact(contact.id)} className="absolute top-4 right-4 text-slate-300 hover:text-red-600 transition">
                            <Trash2 size={16} />
                        </button>

                        <div className="flex gap-4">
                            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-lg">
                                {contact.name.charAt(0)}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-lg text-slate-900">{contact.name}</h3>
                                    {contact.linkedin && <a href={contact.linkedin} target="_blank" className="text-blue-600 hover:underline"><Linkedin size={16} /></a>}
                                </div>
                                <p className="text-slate-600">{contact.role} at {contact.company}</p>

                                <div className="flex gap-2 mt-2">
                                    {contact.tags.map(tag => (
                                        <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                                            {tag}
                                        </span>
                                    ))}
                                </div>

                                {/* Quick Interaction Logger */}
                                <div className="mt-4 pt-4 border-t">
                                    {loggingStatsId === contact.id ? (
                                        <div className="bg-slate-50 p-3 rounded-md animate-in fade-in zoom-in duration-200">
                                            <div className="flex gap-2 mb-2">
                                                {["Email", "LinkedIn", "Call", "Coffee"].map(t => (
                                                    <button key={t} onClick={() => setIntType(t)} className={`text-xs px-2 py-1 rounded border ${intType === t ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-white'}`}>
                                                        {t}
                                                    </button>
                                                ))}
                                            </div>
                                            <textarea
                                                value={intNotes}
                                                onChange={(e) => setIntNotes(e.target.value)}
                                                placeholder="What did you discuss?"
                                                className="w-full text-sm p-2 border rounded-md mb-2"
                                                rows={2}
                                            />
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => setLoggingStatsId(null)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                                                <button onClick={() => handleLogInteraction(contact.id)} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">Log Activity</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setLoggingStatsId(contact.id)}
                                            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                                        >
                                            <MessageCircle size={14} /> Log Interaction
                                        </button>
                                    )}

                                    {/* Recent History */}
                                    <div className="mt-3 space-y-2">
                                        {interactions.filter(i => i.contactId === contact.id).slice(0, 3).map(i => (
                                            <div key={i.id} className="text-xs text-slate-500 flex gap-2">
                                                <span className="font-mono text-slate-400">{new Date(i.date).toLocaleDateString()}</span>
                                                <span className="font-semibold text-slate-700">[{i.type}]</span>
                                                <span>{i.notes}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                {contacts.length === 0 && !isAdding && (
                    <div className="text-center py-12 text-slate-500 bg-slate-50 border-2 border-dashed rounded-lg">
                        No contacts found. Start building your network!
                    </div>
                )}
            </div>
        </div>
    );
}
