import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";
import { updatePasswordAction } from "@/app/actions/auth";
import { getAuthUser } from "@/lib/auth/session";
import { getSafeInternalPath } from "@/lib/auth/account-paths";
import { PageLayout } from "@/components/layout/page-layout";
import { CardShell } from "@/components/ui/card-shell";

export const metadata: Metadata = {
  title: "Nieuw wachtwoord | Hobbysalon",
  description: "Kies een nieuw wachtwoord voor je Hobbysalon-account.",
};

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function UpdatePasswordPage({ searchParams }: Props) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/auth/update-password");
  }

  const { next } = await searchParams;
  const nextPath = getSafeInternalPath(next, "/dashboard");

  return (
    <PageLayout
      title="Nieuw wachtwoord kiezen"
      description="Kies een sterk wachtwoord van minimaal 8 tekens."
      size="narrow"
    >
      <CardShell variant="default" padding="lg">
        <UpdatePasswordForm action={updatePasswordAction} nextPath={nextPath} />
      </CardShell>
    </PageLayout>
  );
}
