import { db } from "@/lib/db";
import { NetworkManager } from "@/components/NetworkManager";

export default async function NetworkPage() {
    const contacts = await db.getContacts();
    const interactions = await db.getInteractions();

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Networking CRM</h2>
                <p className="text-muted-foreground">Track your professional relationships and outreach.</p>
            </div>

            <NetworkManager contacts={contacts} interactions={interactions} />
        </div>
    );
}
