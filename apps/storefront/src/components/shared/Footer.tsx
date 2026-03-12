import Link from "next/link";
import Image from "next/image";
import { listDomainsBySort } from "@/lib/platform/queries/domains";
import { NewsletterSignupForm } from "@/components/shared/NewsletterSignupForm";

export async function Footer() {
  let domainLinks: Array<{ id: string; slug: string; name: string }> = [];
  try {
    const domains = await listDomainsBySort();
    domainLinks = domains.map((domain) => ({
      id: domain.id,
      slug: domain.slug,
      name: domain.name,
    }));
  } catch {
    domainLinks = [
      { id: "f-crochet", slug: "crochet", name: "Crochet" },
      { id: "f-knitting", slug: "knitting", name: "Breien" },
      { id: "f-pottery", slug: "pottery", name: "Keramiek" },
    ];
  }

  const sections = [
    {
      title: "Ontdek",
      links: [
        { href: "/", label: "Home" },
        { href: "/materials", label: "Materialen" },
        { href: "/agenda", label: "Agenda" },
        { href: "/workshops", label: "Workshops" },
        { href: "/creators", label: "Creators" },
        { href: "/favorites", label: "Favorieten" },
      ],
    },
    {
      title: "Domeinen",
      links: domainLinks.map((d) => ({ href: `/${d.slug}`, label: d.name })),
    },
    {
      title: "Info",
      links: [
        { href: "/landing", label: "Over Hobbysalon" },
        { href: "/register", label: "Account aanmaken" },
        { href: "/login", label: "Inloggen" },
      ],
    },
  ];

  return (
    <footer className="mt-auto border-t-[3px] border-t-[var(--accent)]/30 bg-[var(--section-alt)]">
      <div className="mx-auto max-w-6xl px-4 py-12">
        {/* Main footer grid */}
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand column */}
          <div className="lg:col-span-1">
            <Link href="/" className="inline-block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
              <Image
                src="/logo.png"
                alt="Hobbysalon"
                width={140}
                height={40}
                className="h-9 w-auto object-contain opacity-90"
              />
            </Link>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Creatief platform voor hobbyisten — handmade, workshops en events.
            </p>
            <p className="mt-2 text-xs italic text-[var(--muted)]/70 font-[family-name:var(--font-heading)]">
              Handgemaakt met liefde in Belgi&euml;
            </p>
          </div>

          {/* Link columns */}
          {sections.map((section) => (
            <nav key={section.title} aria-label={section.title}>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--foreground)]">
                {section.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Newsletter — highlighted card */}
        <div className="mt-10 rounded-xl bg-[var(--section-highlight)] p-6 md:p-8">
          <div className="max-w-md">
            <h3 className="text-lg font-semibold text-[var(--foreground)] font-[family-name:var(--font-heading)]">
              Nieuwsbrief
            </h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Blijf op de hoogte van workshops, events en inspiratie.
            </p>
            <div className="mt-3">
              <NewsletterSignupForm />
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border)] pt-6">
          <p className="text-xs text-[var(--muted)]" suppressHydrationWarning>
            © {new Date().getFullYear()} Hobbysalon. Alle rechten voorbehouden.
          </p>
        </div>
      </div>
    </footer>
  );
}
