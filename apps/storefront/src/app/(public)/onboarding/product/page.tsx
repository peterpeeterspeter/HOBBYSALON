import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAuthUser } from "@/lib/auth/session";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { PageLayout } from "@/components/layout/page-layout";
import { CardShell } from "@/components/ui/card-shell";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Eerste creatie | Hobbysalon",
};

export default async function OnboardingProductPage() {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/onboarding/product");
  }

  const creator = await getCreatorByUserId(user.id);
  if (!creator) {
    redirect("/onboarding");
  }

  return (
    <PageLayout
      title="Voeg je eerste creatie toe"
      description="Maak een concept in je shop. Daarna kun je verder afronden en publiceren."
      size="narrow"
    >
      <CardShell padding="lg" className="space-y-4">
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          Je makerprofiel staat klaar. Voeg nu een creatie toe zodat bezoekers
          je kunnen vinden.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/dashboard/products?onboarding=1">Creatie toevoegen</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/onboarding/success?role=maker">Dit later doen</Link>
          </Button>
        </div>
      </CardShell>
    </PageLayout>
  );
}
