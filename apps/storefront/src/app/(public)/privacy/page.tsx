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
          Laatst bijgewerkt: november 2026
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
                <strong>Websitegebruik:</strong> bezoeken aan openbare pagina&apos;s
                via PostHog. Alleen met toestemming meten we ook handelingen,
                zoals een aanmelding of een klik op een product.
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
              <li>Om inzicht te krijgen in websitegebruik met PostHog</li>
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
              <li>PostHog voor websitestatistieken, met verwerking in de Verenigde Staten</li>
              <li>
                Sociale media platforms (Pinterest) wanneer we content publiceren
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Pinterest-koppeling</h2>
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

          <section id="facebook" className="scroll-mt-24">
            <h2 className="text-xl font-semibold">6. Aanmelden met Facebook</h2>
            <p className="mt-2 text-muted-foreground">
              Je kan je aanmelden met je Facebook-account. Facebook geeft ons dan
              alleen je naam, je e-mailadres en je profielfoto. We gebruiken die
              enkel om je account aan te maken en je aan te melden. We posten
              niets op Facebook en lezen je vrienden of berichten niet.
            </p>
            <h3 className="mt-4 font-semibold">Je gegevens laten verwijderen</h3>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>
                Stuur een e-mail naar{" "}
                <a
                  href="mailto:info@hobbysalon.be?subject=Gegevens%20verwijderen"
                  className="font-semibold text-[var(--accent)] underline"
                >
                  info@hobbysalon.be
                </a>{" "}
                met als onderwerp &quot;Gegevens verwijderen&quot; en het
                e-mailadres van je account.
              </li>
              <li>
                We verwijderen je account en je gegevens binnen 30 dagen en
                bevestigen dat per e-mail.
              </li>
              <li>
                Je kan de koppeling ook zelf stoppen op Facebook: Instellingen en
                privacy → Instellingen → Apps en websites → Hobbysalon →
                Verwijderen.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Cookies</h2>
            <p className="mt-2 text-muted-foreground">
              Functionele cookies zijn nodig voor de werking van de website en om
              je cookievoorkeur te onthouden. Met PostHog meten we bezoeken aan openbare
              pagina&apos;s ook zonder toestemming, maar dan zonder analytische cookies
              of een blijvende analytische identificatie in je browser.
              PostHog gebruikt daarbij de datum, je browserkenmerken, je IP-adres
              en de bezochte Hobbysalon-website om een dagelijks wisselende code
              te berekenen. Je IP-adres en de oorspronkelijke browserkenmerken
              worden bij deze cookieless verwerking niet in de meetgegevens bewaard.
            </p>
            <p className="mt-2 text-muted-foreground">
              Kies je voor &lsquo;Toestaan&rsquo;, dan mogen we analytische cookies en
              lokale opslag gebruiken en extra handelingen meten. We sturen geen namen,
              e-mailadressen, ingevulde zoektermen of formulierinhoud mee naar PostHog.
              We maken geen gebruikersprofielen en nemen geen sessies op.
            </p>
            <p className="mt-2 text-muted-foreground">
              Je kunt je keuze altijd aanpassen via &lsquo;Cookievoorkeuren wijzigen&rsquo;
              onderaan de website. Bij weigering verwijderen we de analytische opslag
              van PostHog en blijven alleen de beperkte paginastatistieken over.
              Je keuze geldt afzonderlijk voor elke website van Hobbysalon.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Jouw rechten</h2>
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
            <h2 className="text-xl font-semibold">9. Beveiliging</h2>
            <p className="mt-2 text-muted-foreground">
              We nemen redelijke maatregelen om je gegevens te beschermen tegen
              onbevoegde toegang.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">10. Contact</h2>
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
