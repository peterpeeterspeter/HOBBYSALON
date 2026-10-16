import type { Metadata } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import "./globals.css";
import { AuthHashRedirect } from "@/components/auth/AuthHashRedirect";
import { getSiteUrl, DEFAULT_OG_IMAGE, DEFAULT_OG_IMAGE_ALT, DEFAULT_OG_IMAGE_HEIGHT, DEFAULT_OG_IMAGE_WIDTH } from "@/lib/seo";

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
