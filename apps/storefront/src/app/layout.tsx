import type { Metadata } from "next";
import "./globals.css";
import { getSiteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Hobbysalon",
  description: "Creatief platform voor hobbyisten — handmade, workshops, evenementen",
  metadataBase: new URL(getSiteUrl()),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    title: "Hobbysalon",
    description: "Creatief platform voor hobbyisten — handmade, workshops, evenementen",
    url: "/",
    siteName: "Hobbysalon",
    locale: "nl_BE",
  },
  twitter: {
    card: "summary",
    title: "Hobbysalon",
    description: "Creatief platform voor hobbyisten — handmade, workshops, evenementen",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
