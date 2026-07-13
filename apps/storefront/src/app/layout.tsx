import type { Metadata } from "next";
import Script from "next/script";
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
  title: {
    default: "Hobbysalon | Creatief platform voor workshops, makers en inspiratie",
    template: "%s | Hobbysalon",
  },
  description:
    "Ontdek workshops, makers, hobbywinkels, evenementen, materialen en creatieve inspiratie in België en Nederland.",
  metadataBase: new URL(getSiteUrl()),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    title:
      "Hobbysalon | Creatief platform voor workshops, makers en inspiratie",
    description:
      "Ontdek workshops, makers, hobbywinkels, evenementen, materialen en creatieve inspiratie in België en Nederland.",
    url: "/",
    siteName: "Hobbysalon",
    locale: "nl_BE",
    images: [{ url: "/landing/hero.jpg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Hobbysalon | Creatief platform voor workshops, makers en inspiratie",
    description:
      "Ontdek workshops, makers, hobbywinkels, evenementen, materialen en creatieve inspiratie in België en Nederland.",
    images: ["/landing/hero.jpg"],
  },
  robots: {
    index: true,
    follow: true,
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
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-KP9BXCEF2Z"
          strategy="afterInteractive"
        />
        <Script id="ga4-hobbysalon" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-KP9BXCEF2Z');
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
