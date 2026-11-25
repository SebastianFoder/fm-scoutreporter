import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import Script from "next/script";
import { Sofia_Sans, Sofia_Sans_Semi_Condensed } from "next/font/google";
import "@scoutreporter/ui/styles/globals.css";
import { AttributeColorProvider } from "@scoutreporter/ui/components/AttributeColorConfig";
import { WeightProvider } from "@scoutreporter/ui/components/WeightConfig";
import { PlayersDataProvider } from "@scoutreporter/ui/components/PlayersDataProvider";
import { StaffDataProvider } from "@scoutreporter/ui/components/StaffDataProvider";
import { SquadDataProvider } from "@scoutreporter/ui/components/SquadDataProvider";
import { HighlightedAttributesProvider } from "@scoutreporter/ui/components/HighlightedAttributesConfig";
import { SiteHeader } from "@scoutreporter/ui/components/SiteHeader";
import { DesktopProvider } from "@scoutreporter/ui/desktop/DesktopProvider";
import { PlayerPanelProvider } from "@scoutreporter/ui/components/PlayerPanel";
import { SettingsProvider } from "@scoutreporter/ui/components/Settings";
import { DESKTOP_BUILD } from "@scoutreporter/ui/desktop/target";
import { DesktopAnalytics } from "@scoutreporter/ui/desktop/DesktopAnalytics";
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

/** Sebastian Foder's project hub: serves the footer breadcrumb (`/badge.js`) and its live status. */
const PROJECT_HUB_ORIGIN = "https://sebastianfoder.com";
/** Breadcrumb highlight: the footer's ink color, not its muted text. */
const PROJECT_HUB_STYLE = { "--sf-hub-hi": "var(--color-ink)" } as CSSProperties;

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
                    {/* Desktop app only: scanning FM and stored scans. A pass-through on the website. */}
                    <DesktopProvider>
                    {/* Desktop app only: its own Umami site, behind the usage stats setting. */}
                    {DESKTOP_BUILD && <DesktopAnalytics />}
                    {/* Clicking a player opens them in a side panel (PlayerLink). */}
                    <PlayerPanelProvider>
                    {/* Settings (the gear in the header): weights, columns, look, and the desktop app's own. */}
                    <SettingsProvider>
                    <div className="flex min-h-screen flex-col">
                      <SiteHeader />
                      <main className="flex-1">{children}</main>
                      <footer className="border-t border-line">
                        <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-x-6 gap-y-2 px-5 py-4 text-[13px] text-muted">
                          {/* Breadcrumb to Sebastian Foder's other projects, from sebastianfoder.com/badge.js. */}
                          <sf-hub project="fm-scouting" style={PROJECT_HUB_STYLE} />
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
                      <Script src={`${PROJECT_HUB_ORIGIN}/badge.js`} strategy="lazyOnload" />
                    </div>
                    </SettingsProvider>
                    </PlayerPanelProvider>
                    </DesktopProvider>
                  </HighlightedAttributesProvider>
                </SquadDataProvider>
              </StaffDataProvider>
            </PlayersDataProvider>
          </WeightProvider>
        </AttributeColorProvider>
        {/* Self-hosted Umami analytics for the website (the desktop app's is DesktopAnalytics). data-domains
            skips localhost and Vercel previews; client-side navigations are tracked by the script itself. */}
        {!DESKTOP_BUILD && (
          <Script
            src="https://stats.sebastianfoder.com/app.js"
            data-website-id="465aa84c-1243-4e51-9bc5-b7b3691f71ce"
            data-domains="fmscouting.sebastianfoder.com"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
