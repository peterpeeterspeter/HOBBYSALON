import Link from "next/link";
import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { forgotPasswordAction } from "@/app/actions/auth";
import { PageLayout } from "@/components/layout/page-layout";
import { CardShell } from "@/components/ui/card-shell";

export const metadata: Metadata = {
  title: "Wachtwoord vergeten | Hobbysalon",
  description: "Vraag een link aan om je wachtwoord opnieuw in te stellen.",
};

export default function ForgotPasswordPage() {
  return (
    <PageLayout
      title="Wachtwoord vergeten"
      description="We sturen je een e-mail met een link om een nieuw wachtwoord te kiezen."
      size="narrow"
    >
      <CardShell variant="default" padding="lg">
        <ForgotPasswordForm action={forgotPasswordAction} />
        <p className="mt-6 text-sm text-[var(--muted)]">
          Weet je je wachtwoord weer?{" "}
          <Link href="/login" className="font-semibold text-[var(--accent)] underline">
            Terug naar aanmelden
          </Link>
        </p>
      </CardShell>
    </PageLayout>
  );
}
