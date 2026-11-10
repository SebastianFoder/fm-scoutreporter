import type { Metadata } from "next";
import { Sofia_Sans, Sofia_Sans_Semi_Condensed } from "next/font/google";
import "./globals.css";
import { AttributeColorProvider } from "@/components/AttributeColorConfig";
import { WeightProvider } from "@/components/WeightConfig";
import { PlayersDataProvider } from "@/components/PlayersDataProvider";
import { HighlightedAttributesProvider } from "@/components/HighlightedAttributesConfig";
import { SiteHeader } from "@/components/SiteHeader";

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
  title: {
    default: "FM26 Scout Reporter",
    template: "%s · FM26 Scout Reporter",
  },
  description:
    "Import Football Manager 26 player CSV exports, score players with weighted attributes, and compare them with configurable highlights and colour thresholds.",
  applicationName: "FM26 Scout Reporter",
  keywords: [
    "Football Manager 26",
    "FM26",
    "scouting",
    "player export",
    "CSV",
    "comparison",
    "analytics",
  ],
  authors: [{ name: "Sebastian Foder", url: "https://github.com/SebastianFoder" }],
  creator: "Sebastian Foder",
  publisher: "Sebastian Foder",
  openGraph: {
    title: "FM26 Scout Reporter",
    description:
      "Import FM26 player CSV exports, score players with weights, and compare attributes with highlights.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "FM26 Scout Reporter",
    description:
      "Import FM26 player CSV exports, score players with weights, and compare attributes.",
    creator: "@F1ngs",
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
    <html lang="en">
      <body className={`${ui.variable} ${uiCondensed.variable} antialiased`}>
        <AttributeColorProvider>
          <WeightProvider>
            <PlayersDataProvider>
              <HighlightedAttributesProvider>
                <div className="flex min-h-screen flex-col">
                  <SiteHeader />
                  <main className="flex-1">{children}</main>
                  <footer className="border-t border-line">
                    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4 text-[13px] text-muted">
                      <p>
                        Scout Reporter by <span className="font-semibold text-ink">Sebastian Foder</span>
                      </p>
                      <div className="flex items-center gap-4">
                        <a href="https://github.com/SebastianFoder" target="_blank" rel="noreferrer" className="link">
                          GitHub
                        </a>
                        <a href="https://x.com/F1ngs" target="_blank" rel="noreferrer" className="link">
                          Twitter
                        </a>
                      </div>
                    </div>
                  </footer>
                </div>
              </HighlightedAttributesProvider>
            </PlayersDataProvider>
          </WeightProvider>
        </AttributeColorProvider>
      </body>
    </html>
  );
}
