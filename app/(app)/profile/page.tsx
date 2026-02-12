import { db } from "@/lib/db";
import ProfileForm from "@/components/ProfileForm";
import { AnswerBankManager } from "@/components/AnswerBankManager";
import { UpdateFromResumeButton } from "@/components/UpdateFromResumeButton";
import { ProfileAutofillUpload } from "@/components/ProfileAutofillUpload";

export default async function ProfilePage() {
    const profile = await db.getProfile();
    const answerBank = await db.getAnswerBank();

    return (
        <div className="max-w-4xl mx-auto space-y-12">
            <div className="space-y-8">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Profile</h2>
                        <p className="text-muted-foreground">Manage your personal information and skills.</p>
                    </div>
                    <div className="flex flex-col gap-2 items-start md:items-end">
                        <UpdateFromResumeButton linkedinUrl={profile.linkedin} />
                        <ProfileAutofillUpload />
                    </div>
                </div>

                <ProfileForm initialProfile={profile} />
            </div>

            <div className="border-t pt-8">
                <AnswerBankManager items={answerBank} />
            </div>
        </div>
    );
}
