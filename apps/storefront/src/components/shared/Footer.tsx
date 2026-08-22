import Link from "next/link";
import { FOOTER_SECTIONS } from "@/config/nav";
import { NewsletterSignupForm } from "./NewsletterSignupForm";

export async function Footer() {
  const columns = [
    { title: "Ontdekken", links: FOOTER_SECTIONS.ontdekken },
    { title: "Meedoen", links: FOOTER_SECTIONS.meedoen },
    { title: "Zakelijk", links: FOOTER_SECTIONS.zakelijk },
    { title: "Info", links: FOOTER_SECTIONS.info },
  ];

  return (
    <footer className="mt-auto bg-[var(--foreground)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        <div>
          <Link
            href="/"
            className="font-[family-name:var(--font-heading)] text-2xl font-black tracking-[-0.04em] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            aria-label="Hobbysalon - ga naar home"
          >
            Hobbysalon
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/55">
            Dé creatieve marketplace voor workshops, handwerk, materialen en hobby-inspiratie in België en Nederland.
          </p>
          <div className="mt-6 max-w-sm">
            <p className="mb-2 text-sm font-semibold text-white">
              Creatieve inspiratie in je inbox
            </p>
            <NewsletterSignupForm variant="footer" />
          </div>
        </div>

        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h3 className="font-[family-name:var(--font-heading)] text-sm font-bold tracking-wide text-white">
              {col.title}
            </h3>
            <ul className="mt-3 space-y-2">
              {col.links.map((link) => (
                <li key={`${col.title}-${link.href}-${link.label}`}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/60 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <span className="text-xs text-white/40" suppressHydrationWarning>
            © {new Date().getFullYear()} Hobbysalon. Alle rechten voorbehouden.
          </span>
          <span className="text-xs text-white/40">België &amp; Nederland</span>
        </div>
      </div>
    </footer>
  );
}
