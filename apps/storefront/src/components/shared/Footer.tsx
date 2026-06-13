import Link from "next/link";
import { FOOTER_SECTIONS } from "@/config/nav";

export async function Footer() {
  const columns = [
    { title: "Ontdekken", links: FOOTER_SECTIONS.ontdekken },
    { title: "Meedoen", links: FOOTER_SECTIONS.meedoen },
    { title: "Info", links: FOOTER_SECTIONS.info },
  ];

  return (
    <footer className="mt-auto bg-[var(--foreground)]">
      {/* 4-column grid: brand col + 3 link cols */}
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        {/* Brand column */}
        <div>
          <Link
            href="/"
            className="font-[family-name:var(--font-heading)] text-xl font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Hobbysalon
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/50">
            Dé creatieve marketplace voor workshops, handwerk, materialen en hobby-inspiratie in België en Nederland.
          </p>
        </div>

        {/* Link columns */}
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-white/85">
              {col.title}
            </h3>
            <ul className="mt-3 space-y-2">
              {col.links.map((link) => (
                <li key={`${col.title}-${link.href}-${link.label}`}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/55 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* Copyright bar */}
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
