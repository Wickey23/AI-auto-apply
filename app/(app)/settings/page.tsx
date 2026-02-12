import { getAuditLogs } from "@/lib/audit";
import { db } from "@/lib/db";
import { SettingsForm } from "@/components/SettingsForm";
import { Shield, Lock, History } from "lucide-react";

export default async function SettingsPage({ searchParams }: { searchParams?: Promise<{ gmail?: string; reason?: string }> }) {
    const logs = await getAuditLogs();
    const data = await db.getData();
    const params = (await searchParams) || {};

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
                <p className="text-muted-foreground">Manage application settings and view audit logs.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-6">
                    <SettingsForm
                        initialOpenAiKey={data.settings.openaiApiKey}
                        initialGeminiKey={data.settings.geminiApiKey}
                        initialGroqKey={data.settings.groqApiKey}
                        initialProvider={data.settings.aiProvider}
                        initialImapHost={data.settings.imapHost}
                        initialImapUser={data.settings.imapUser}
                        initialImapPassword={data.settings.imapPassword}
                        initialPreferredLocation={data.settings.preferredLocation}
                        initialGmailConnected={Boolean(data.settings.gmailRefreshToken)}
                        initialGmailEmail={data.settings.gmailEmail}
                        gmailStatus={params.gmail}
                        gmailReason={params.reason}
                    />

                    <div className="bg-white p-6 rounded-xl border shadow-sm">
                        <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                            <Shield className="text-blue-500" /> Security
                        </h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <label className="text-sm font-medium">Two-Factor Authentication</label>
                                    <p className="text-xs text-slate-500">Add an extra layer of security.</p>
                                </div>
                                <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-200">
                                    <span className="translate-x-1 inline-block h-4 w-4 transform rounded-full bg-white transition" />
                                </button>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <label className="text-sm font-medium">Data Encryption</label>
                                    <p className="text-xs text-slate-500">All data is encrypted at rest.</p>
                                </div>
                                <div className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">ACTIVE</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border shadow-sm">
                        <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                            <Lock className="text-purple-500" /> Guardrails
                        </h3>
                        <div className="space-y-2 text-sm text-slate-600">
                            <p className="bg-slate-50 p-2 rounded border border-slate-100">
                                ✅ Never auto-submit applications
                            </p>
                            <p className="bg-slate-50 p-2 rounded border border-slate-100">
                                ✅ No credential harvesting
                            </p>
                            <p className="bg-slate-50 p-2 rounded border border-slate-100">
                                ✅ Strict rate limiting enabled
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col h-[500px]">
                    <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                        <History className="text-slate-500" /> Audit Log
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                        {logs.map((log) => (
                            <div key={log.id} className="flex gap-3 text-sm border-b pb-3 last:border-0">
                                <div className="mt-1 font-mono text-xs text-slate-400 w-24 flex-shrink-0">
                                    {new Date(log.timestamp).toLocaleTimeString()} <br />
                                    {new Date(log.timestamp).toLocaleDateString()}
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900">{log.action}</p>
                                    <p className="text-slate-500">{log.details}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
