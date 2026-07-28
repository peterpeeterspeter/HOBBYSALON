import Link from "next/link";
import type { ReactNode } from "react";
import {
  ListingHeroBand,
} from "@/components/shared/ListingHeroBand";
import { Container } from "@/components/ui/container";
import { getDomainPlaceholderImage } from "@/components/ui/ai-generated-image";
import type { Domain } from "@/types/platform";

type DomainBreadcrumbProps = {
  domain: Domain;
  current: string;
};

export function DomainBreadcrumb({ domain, current }: DomainBreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-white/75">
      <ol className="flex flex-wrap gap-2">
        <li>
          <Link href="/" className="hover:text-white">
            Home
          </Link>
        </li>
        <li aria-hidden>/</li>
        <li>
          <Link href={`/${domain.slug}`} className="hover:text-white">
            {domain.name}
          </Link>
        </li>
        <li aria-hidden>/</li>
        <li className="text-white">{current}</li>
      </ol>
    </nav>
  );
}

type DomainSubListingShellProps = {
  domain: Domain;
  title: string;
  lead?: string;
  breadcrumbLabel: string;
  children: ReactNode;
};

/** Compact ListingHeroBand + content container for /[domain]/* sub-listings. */
export function DomainSubListingShell({
  domain,
  title,
  lead,
  breadcrumbLabel,
  children,
}: DomainSubListingShellProps) {
  const imageSrc =
    domain.hero_image_url?.trim() || getDomainPlaceholderImage(domain.slug);

  return (
    <>
      <ListingHeroBand
        title={title}
        lead={lead}
        imageSrc={imageSrc}
        size="compact"
        breadcrumb={
          <DomainBreadcrumb domain={domain} current={breadcrumbLabel} />
        }
      />
      <Container className="py-8 sm:py-10">{children}</Container>
    </>
  );
}
