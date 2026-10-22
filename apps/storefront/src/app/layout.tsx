import type { Metadata } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import "./globals.css";
import { AuthHashRedirect } from "@/components/auth/AuthHashRedirect";
import { getRequestMarket } from "@/lib/markets/request";
import { marketSeoDecision } from "@/lib/markets/seo-policy";
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_ALT,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_WIDTH,
  getSiteUrl,
} from "@/lib/seo";

const quicksand = localFont({
  src: [
    {
      path: "../fonts/quicksand/quicksand-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/quicksand/quicksand-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../fonts/quicksand/quicksand-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../fonts/quicksand/quicksand-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-quicksand",
  display: "swap",
});

const lato = localFont({
  src: [
    {
      path: "../fonts/lato/lato-latin-300-normal.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../fonts/lato/lato-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/lato/lato-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../fonts/lato/lato-latin-900-normal.woff2",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-lato",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const resolution = await getRequestMarket();
  const seo = marketSeoDecision(resolution);
  const site = seo.canonicalOrigin || getSiteUrl();

  return {
    title: {
      default: "Hobbysalon | Creatief platform voor workshops, makers en inspiratie",
      template: "%s | Hobbysalon",
    },
    description:
      "Ontdek workshops, makers, hobbywinkels, evenementen, materialen en creatieve inspiratie in België en Nederland.",
    metadataBase: new URL(site),
    // No root canonical — child pages own their path so `/` does not cascade.
    openGraph: {
      type: "website",
      title:
        "Hobbysalon | Creatief platform voor workshops, makers en inspiratie",
      description:
        "Ontdek workshops, makers, hobbywinkels, evenementen, materialen en creatieve inspiratie in België en Nederland.",
      siteName: "Hobbysalon",
      locale: seo.ogLocale,
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          width: DEFAULT_OG_IMAGE_WIDTH,
          height: DEFAULT_OG_IMAGE_HEIGHT,
          alt: DEFAULT_OG_IMAGE_ALT,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title:
        "Hobbysalon | Creatief platform voor workshops, makers en inspiratie",
      description:
        "Ontdek workshops, makers, hobbywinkels, evenementen, materialen en creatieve inspiratie in België en Nederland.",
      images: [DEFAULT_OG_IMAGE],
    },
    robots: {
      index: seo.index,
      follow: seo.follow,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const resolution = await getRequestMarket();
  const seo = marketSeoDecision(resolution);

  return (
    <html lang={seo.htmlLang} className={`${quicksand.variable} ${lato.variable}`}>
      <body className="antialiased font-sans" suppressHydrationWarning>
        <AuthHashRedirect />
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
