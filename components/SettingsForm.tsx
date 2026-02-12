"use client";

import { saveSettings } from "@/app/actions";
import { useState } from "react";
import { Key, Loader2, Save } from "lucide-react";

interface SettingsFormProps {
    initialOpenAiKey?: string;
    initialGeminiKey?: string;
    initialProvider?: "openai" | "gemini" | "groq";
    initialImapHost?: string;
    initialImapUser?: string;
    initialImapPassword?: string;
    initialGroqKey?: string;
    initialPreferredLocation?: string;
    initialGmailConnected?: boolean;
    initialGmailEmail?: string;
    gmailStatus?: string;
    gmailReason?: string;
}

export function SettingsForm({ initialOpenAiKey, initialGeminiKey, initialProvider, initialImapHost, initialImapUser, initialImapPassword, initialGroqKey, initialPreferredLocation, initialGmailConnected, initialGmailEmail, gmailStatus, gmailReason }: SettingsFormProps) {
    const [openAiKey, setOpenAiKey] = useState(initialOpenAiKey || "");
    const [geminiKey, setGeminiKey] = useState(initialGeminiKey || "");
    const [provider, setProvider] = useState<"openai" | "gemini" | "groq">(initialProvider || "groq");
    const [groqKey, setGroqKey] = useState(initialGroqKey || "");

    const [imapHost, setImapHost] = useState(initialImapHost || "imap.gmail.com");
    const [imapUser, setImapUser] = useState(initialImapUser || "");
    const [imapPassword, setImapPassword] = useState(initialImapPassword || "");
    const [preferredLocation, setPreferredLocation] = useState(initialPreferredLocation || "");

    const [isSaving, setIsSaving] = useState(false);

    const getEmailProviderConfig = (email: string) => {
        const domain = (email.split("@")[1] || "").toLowerCase();

        if (domain.includes("gmail.com") || domain.includes("googlemail.com")) {
            return { provider: "Gmail", imapHost: "imap.gmail.com", inboxUrl: "https://mail.google.com" };
        }
        if (domain.includes("outlook.com") || domain.includes("hotmail.com") || domain.includes("live.com") || domain.includes("office365.com")) {
            return { provider: "Outlook", imapHost: "outlook.office365.com", inboxUrl: "https://outlook.live.com/mail" };
        }
        if (domain.includes("yahoo.com")) {
            return { provider: "Yahoo", imapHost: "imap.mail.yahoo.com", inboxUrl: "https://mail.yahoo.com" };
        }
        if (domain.includes("icloud.com") || domain.includes("me.com") || domain.includes("mac.com")) {
            return { provider: "iCloud", imapHost: "imap.mail.me.com", inboxUrl: "https://www.icloud.com/mail" };
        }
        if (domain.includes("aol.com")) {
            return { provider: "AOL", imapHost: "imap.aol.com", inboxUrl: "https://mail.aol.com" };
        }

        return null;
    };

    const providerConfig = getEmailProviderConfig(imapUser);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        await saveSettings({
            openaiApiKey: openAiKey,
            geminiApiKey: geminiKey,
            groqApiKey: groqKey,
            aiProvider: provider,
            imapHost,
            imapUser,
            imapPassword,
            preferredLocation
        });
        setIsSaving(false);
    };

    return (
        <form onSubmit={handleSave} className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                <Key className="text-yellow-500" /> AI Configuration
            </h3>

            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Preferred Provider</label>
                    <div className="grid grid-cols-3 gap-4">
                        <label className={`flex-1 border p-3 rounded-lg cursor-pointer flex items-center gap-2 ${provider === 'openai' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'hover:bg-slate-50'}`}>
                            <input type="radio" name="provider" value="openai" checked={provider === 'openai'} onChange={() => setProvider('openai')} className="sr-only" />
                            <div className="flex-1">
                                <div className="font-medium text-slate-900">OpenAI</div>
                                <div className="text-xs text-slate-500">Industry standard. Cost per token.</div>
                            </div>
                        </label>
                        <label className={`flex-1 border p-3 rounded-lg cursor-pointer flex items-center gap-2 ${provider === 'gemini' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'hover:bg-slate-50'}`}>
                            <input type="radio" name="provider" value="gemini" checked={provider === 'gemini'} onChange={() => setProvider('gemini')} className="sr-only" />
                            <div className="flex-1">
                                <div className="font-medium text-slate-900">Google Gemini</div>
                                <div className="text-xs text-slate-500">Free tier available. Fast & high quality.</div>
                            </div>
                        </label>
                        <label className={`flex-1 border p-3 rounded-lg cursor-pointer flex items-center gap-2 ${provider === 'groq' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'hover:bg-slate-50'}`}>
                            <input type="radio" name="provider" value="groq" checked={provider === 'groq'} onChange={() => setProvider('groq')} className="sr-only" />
                            <div className="flex-1">
                                <div className="font-medium text-slate-900">Groq</div>
                                <div className="text-xs text-slate-500">Free tier with key. If no key is set, app uses local no-key mode.</div>
                            </div>
                        </label>
                    </div>
                </div>

                {provider === 'openai' && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                        <label className="block text-sm font-medium text-slate-700 mb-1">OpenAI API Key</label>
                        <input
                            type="password"
                            value={openAiKey}
                            onChange={(e) => setOpenAiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full rounded-md border border-slate-300 p-2 text-sm"
                        />
                        <p className="text-xs text-slate-500 mt-1">Get your key from <a href="https://platform.openai.com" target="_blank" className="text-blue-600 hover:underline">platform.openai.com</a></p>
                    </div>
                )}

                {provider === 'gemini' && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Gemini API Key</label>
                        <input
                            type="password"
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                            placeholder="AIza..."
                            className="w-full rounded-md border border-slate-300 p-2 text-sm"
                        />
                        <p className="text-xs text-slate-500 mt-1">Get your free key from <a href="https://aistudio.google.com" target="_blank" className="text-blue-600 hover:underline">aistudio.google.com</a></p>
                    </div>
                )}

                {/* ... existing AI fields ... */}

                <div className="pt-6 border-t border-slate-100">
                    <h4 className="font-semibold text-slate-800 mb-4">Email Integration (IMAP)</h4>
                    {gmailStatus === "connected" && (
                        <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                            Gmail connected successfully{initialGmailEmail ? ` as ${initialGmailEmail}` : ""}.
                        </div>
                    )}
                    {gmailStatus === "missing_env" && (
                        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                            Gmail OAuth is not configured on the server. Add <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> to environment variables, then retry.
                        </div>
                    )}
                    {gmailStatus === "error" && (
                        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                            Gmail connection failed{gmailReason ? `: ${gmailReason}` : ""}. Check OAuth credentials, redirect URI, and test user access.
                        </div>
                    )}
                    <p className="text-sm text-slate-500 mb-4">
                        Connect your email to automatically scan for job application updates (Interviews, Rejections).
                        <br /><span className="text-red-500">Note: Use an App Password, not your login password.</span>
                    </p>

                    <div className="grid gap-4">
                        <div className="rounded-md border p-3 bg-slate-50">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-medium text-slate-800">Recommended: Connect Gmail</p>
                                    <p className="text-xs text-slate-500">
                                        OAuth-based connection avoids app-password issues.
                                    </p>
                                    {initialGmailConnected && (
                                        <p className="text-xs text-green-700 mt-1">
                                            Connected as {initialGmailEmail || "Gmail account"}
                                        </p>
                                    )}
                                </div>
                                <a
                                    href="/api/gmail/connect"
                                    className="px-3 py-2 text-xs font-medium rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                >
                                    {initialGmailConnected ? "Reconnect Gmail" : "Connect Gmail"}
                                </a>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">IMAP Host</label>
                            <input
                                type="text"
                                value={imapHost}
                                onChange={(e) => setImapHost(e.target.value)}
                                placeholder="imap.gmail.com"
                                className="w-full rounded-md border border-slate-300 p-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email User</label>
                            <input
                                type="email"
                                value={imapUser}
                                onChange={(e) => setImapUser(e.target.value)}
                                placeholder="you@gmail.com"
                                className="w-full rounded-md border border-slate-300 p-2 text-sm"
                            />
                            {providerConfig && (
                                <p className="text-xs text-slate-500 mt-1">
                                    Detected {providerConfig.provider}. Recommended IMAP host: <span className="font-medium">{providerConfig.imapHost}</span>
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">App Password</label>
                            <input
                                type="password"
                                value={imapPassword}
                                onChange={(e) => setImapPassword(e.target.value)}
                                placeholder="xkcd wxyz ..."
                                className="w-full rounded-md border border-slate-300 p-2 text-sm"
                            />
                        </div>
                        {providerConfig && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setImapHost(providerConfig.imapHost)}
                                    className="px-3 py-2 text-xs font-medium rounded border border-slate-300 bg-white hover:bg-slate-50"
                                >
                                    Use Recommended IMAP Host
                                </button>
                                <a
                                    href={providerConfig.inboxUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-2 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
                                >
                                    Open {providerConfig.provider} Inbox
                                </a>
                            </div>
                        )}
                    </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                    <h4 className="font-semibold text-slate-800 mb-4">Job Search Preferences</h4>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Location</label>
                        <input
                            type="text"
                            value={preferredLocation}
                            onChange={(e) => setPreferredLocation(e.target.value)}
                            placeholder="Remote, New York, Austin..."
                            className="w-full rounded-md border border-slate-300 p-2 text-sm"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Used to personalize Find Jobs analysis and default search filters.
                        </p>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-800 disabled:opacity-50 mt-4"
                >
                    {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    Save Configuration
                </button>
            </div>
        </form>
    );
}
