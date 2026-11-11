import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Sofia_Sans, Sofia_Sans_Semi_Condensed } from "next/font/google";
import "./globals.css";
import { AttributeColorProvider } from "@/components/AttributeColorConfig";
import { WeightProvider } from "@/components/WeightConfig";
import { PlayersDataProvider } from "@/components/PlayersDataProvider";
import { StaffDataProvider } from "@/components/StaffDataProvider";
import { SquadDataProvider } from "@/components/SquadDataProvider";
import { HighlightedAttributesProvider } from "@/components/HighlightedAttributesConfig";
import { SiteHeader } from "@/components/SiteHeader";
import {
  AUTHOR,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/site";

/* Sofia Sans: a UI face with sporty proportions and good tabular figures.
   The semi-condensed cut is used for table headers and section titles. */
const ui = Sofia_Sans({
  variable: "--font-ui",
  subsets: ["latin", "latin-ext"],
});

const uiCondensed = Sofia_Sans_Semi_Condensed({
  variable: "--font-ui-condensed",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  category: "games",
  authors: [{ name: AUTHOR.name, url: AUTHOR.url }],
  creator: AUTHOR.name,
  publisher: AUTHOR.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_GB",
    url: "/",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    creator: AUTHOR.twitter,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5f6" },
    { media: "(prefers-color-scheme: dark)", color: "#162232" },
  ],
};

const FOOTER_LINKS = [
  { href: "/how-to-use", label: "Setup guide" },
  { href: "/faq", label: "FAQ" },
] as const;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
      <body className={`${ui.variable} ${uiCondensed.variable} antialiased`}>
        <AttributeColorProvider>
          <WeightProvider>
            <PlayersDataProvider>
              <StaffDataProvider>
                <SquadDataProvider>
                  <HighlightedAttributesProvider>
                    <div className="flex min-h-screen flex-col">
                      <SiteHeader />
                      <main className="flex-1">{children}</main>
                      <footer className="border-t border-line">
                        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4 text-[13px] text-muted">
                          <p>
                            Scout Reporter by <span className="font-semibold text-ink">Sebastian Foder</span>
                          </p>
                          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            {FOOTER_LINKS.map((l) => (
                              <Link key={l.href} href={l.href} className="link">
                                {l.label}
                              </Link>
                            ))}
                            <a href={AUTHOR.url} target="_blank" rel="noreferrer" className="link">
                              GitHub
                            </a>
                            <a href="https://x.com/F1ngs" target="_blank" rel="noreferrer" className="link">
                              Twitter
                            </a>
                          </nav>
                        </div>
                      </footer>
                    </div>
                  </HighlightedAttributesProvider>
                </SquadDataProvider>
              </StaffDataProvider>
            </PlayersDataProvider>
          </WeightProvider>
        </AttributeColorProvider>
      </body>
    </html>
  );
}
