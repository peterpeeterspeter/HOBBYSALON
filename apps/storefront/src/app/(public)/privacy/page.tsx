import { Container } from "@/components/ui/container";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Privacybeleid | Hobbysalon",
  description: "Privacybeleid van Hobbysalon - hoe wij omgaan met jouw gegevens.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <Container className="py-16 md:py-24">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold font-[family-name:var(--font-heading)] md:text-4xl">
          Privacybeleid
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Laatst bijgewerkt: juni 2026
        </p>

        <div className="mt-10 space-y-8 text-[var(--foreground)]">
          <section>
            <h2 className="text-xl font-semibold">1. Wie zijn wij</h2>
            <p className="mt-2 text-muted-foreground">
              Hobbysalon is het inspiratieplatform voor creatieve hobby&apos;s in
              België en Nederland. Onze website: www.hobbysalon.be
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Welke gegevens verzamelen we</h2>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>
                <strong>Contactgegevens:</strong> e-mailadres bij aanmelding voor
                nieuwsbrief
              </li>
              <li>
                <strong>Technische gegevens:</strong> IP-adres, browsertype,
                bezochte pagina&apos;s (via Google Analytics)
              </li>
              <li>
                <strong>Cookies:</strong> functionele en analytische cookies
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. Hoe gebruiken we je gegevens</h2>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>Om je onze content en diensten te leveren</li>
              <li>Om inzicht te krijgen in websitegebruik (Google Analytics)</li>
              <li>Om inhoud te delen op sociale media, waaronder Pinterest</li>
              <li>
                Om je op de hoogte te houden via nieuwsbrief (alleen met
                toestemming)
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Delen van gegevens</h2>
            <p className="mt-2 text-muted-foreground">
              We delen geen persoonlijke gegevens met derden, behalve:
            </p>
            <ul className="mt-1 space-y-1 text-muted-foreground">
              <li>Google Analytics (geanonimiseerd)</li>
              <li>
                Sociale media platforms (Pinterest) wanneer we content publiceren
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Pinterest API</h2>
            <p className="mt-2 text-muted-foreground">
              We gebruiken de Pinterest API v5 om artikelinhoud van onze website
              automatisch te pinnen naar onze Pinterest-boards. Hierbij delen we:
            </p>
            <ul className="mt-1 space-y-1 text-muted-foreground">
              <li>Openbare artikelafbeeldingen en -teksten</li>
              <li>Links naar onze artikelen</li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              We verzamelen geen gegevens van Pinterest-gebruikers. Onze app maakt
              alleen pins aan met onze eigen content.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Cookies</h2>
            <p className="mt-2 text-muted-foreground">
              We gebruiken functionele cookies en Google Analytics cookies. Je kunt
              cookies beheren via je browserinstellingen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Jouw rechten</h2>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>Recht op inzage van je gegevens</li>
              <li>Recht op correctie of verwijdering</li>
              <li>Recht om je terug te trekken uit nieuwsbrief</li>
              <li>
                Klachtrecht bij de Gegevensbeschermingsautoriteit (België) of
                Autoriteit Persoonsgegevens (Nederland)
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Beveiliging</h2>
            <p className="mt-2 text-muted-foreground">
              We nemen redelijke maatregelen om je gegevens te beschermen tegen
              onbevoegde toegang.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Contact</h2>
            <p className="mt-2 text-muted-foreground">
              Vragen over dit privacybeleid? Mail naar:{" "}
              <a
                href="mailto:info@hobbysalon.be"
                className="text-[var(--accent)] underline"
              >
                info@hobbysalon.be
              </a>
            </p>
          </section>
        </div>
      </div>
    </Container>
  );
}
