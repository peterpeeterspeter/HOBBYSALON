import type { Metadata } from "next";
import { Quicksand, Lato } from "next/font/google";
import "./globals.css";
import { getSiteUrl } from "@/lib/seo";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-quicksand",
  display: "swap",
});

const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  variable: "--font-lato",
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
    images: ["/logo.png"],
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
    <html lang="nl" className={`${quicksand.variable} ${lato.variable}`}>
      <body className="antialiased font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
