import Link from "next/link";
import type { Metadata } from "next";
import { AccountChoiceCards } from "@/components/auth/AccountChoiceCards";
import { PageLayout } from "@/components/layout/page-layout";
import {
  getAccountRegistrationHref,
  getSafeInternalPath,
} from "@/lib/auth/account-paths";

export const metadata: Metadata = {
  title: "Aanbieden op Hobbysalon",
  description:
    "Geef workshops, toon je creaties, organiseer een evenement of bied je winkel aan op Hobbysalon.",
};

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function RegisterAanbiedenPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const nextPath = getSafeInternalPath(next, "");

  return (
    <div className="bg-[var(--section-alt)]">
      <PageLayout
        title="Aanbieden op Hobbysalon"
        description="Kies wat je wil doen. Je account is gratis."
        size="narrow"
      >
        <AccountChoiceCards
          nextPath={nextPath}
          title="Wat wil je aanbieden?"
          lead="Je kunt later altijd iets toevoegen."
        />
        <p className="mt-6 text-base leading-relaxed text-[var(--muted)]">
          Alleen ontdekken?{" "}
          <Link
            href={getAccountRegistrationHref("member", nextPath)}
            className="font-semibold text-[var(--accent)] underline underline-offset-4"
          >
            Maak een gewoon account
          </Link>
        </p>
      </PageLayout>
    </div>
  );
}
