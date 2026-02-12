import { db } from "@/lib/db";
import OffersComparisonClient from "@/components/OffersComparisonClient";

export default async function OffersPage() {
    const applications = await db.getApplications();
    const offers = applications.filter((a) => a.status === "OFFER");
    return <OffersComparisonClient offers={offers} />;
}

