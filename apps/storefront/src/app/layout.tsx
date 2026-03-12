import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { getSiteUrl } from "@/lib/seo";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

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
    <html lang="nl" className={`${fraunces.variable} ${sourceSans.variable}`}>
      <body className="antialiased font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
