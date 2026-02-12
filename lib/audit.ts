import { db } from "./db";

export interface AuditLog {
    id: string;
    action: string;
    details: string;
    timestamp: Date;
    userId: string;
}

export async function logAction(action: string, details: string, userId: string = "user-1") {
    const newLog = {
        id: `log-${Date.now()}`,
        action,
        details,
        timestamp: new Date().toISOString(),
        userId,
    };
    await db.updateData((data) => {
        if (!Array.isArray(data.auditLogs)) data.auditLogs = [];
        data.auditLogs.unshift(newLog);
        data.auditLogs = data.auditLogs.slice(0, 300);
    });
}

export async function getAuditLogs(): Promise<AuditLog[]> {
    const data = await db.getData();
    const logs = Array.isArray(data.auditLogs) ? data.auditLogs : [];
    return logs.map((log: any) => ({
        id: String(log.id || `log-${Date.now()}`),
        action: String(log.action || "UNKNOWN"),
        details: String(log.details || ""),
        timestamp: new Date(log.timestamp || Date.now()),
        userId: String(log.userId || "user-1"),
    }));
}
