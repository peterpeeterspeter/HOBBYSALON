import Link from "next/link";

export const metadata = { title: "Nieuwsbrief bevestigd | Hobbysalon", robots: { index: false, follow: false } };

export default async function NewsletterResult({ searchParams }: {
  searchParams: Promise<{ mail?: string }>
}) {
  const failed = (await searchParams).mail === "mislukt";
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold">Je inschrijving is bevestigd</h1>
      <p className="mt-4 text-lg">{failed
        ? "De downloadmail kon niet worden verstuurd. Open de bevestigingslink in je e-mail opnieuw om het nog eens te proberen."
        : "Bedankt! Je downloadlink is naar je inbox gestuurd."}</p>
      <Link className="mt-6 inline-block text-lg underline" href="/">Terug naar Hobbysalon</Link>
    </main>
  );
}
