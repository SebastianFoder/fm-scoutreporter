import type { Metadata } from "next";
import { Outfit, Space_Mono } from "next/font/google";
import "./globals.css";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import {
  AttributeColorConfig,
  AttributeColorProvider,
} from "@/components/AttributeColorConfig";
import Link from "next/link";
import { WeightProvider } from "@/components/WeightConfig";
import { PlayersDataProvider } from "@/components/PlayersDataProvider";
import { HighlightedAttributesProvider } from "@/components/HighlightedAttributesConfig";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
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
      <body className={`${outfit.variable} ${spaceMono.variable} antialiased`}>
        <AttributeColorProvider>
          <WeightProvider>
            <PlayersDataProvider>
                <HighlightedAttributesProvider>
                  <div className="flex min-h-screen flex-col">
                    <header className="flex items-center justify-end gap-2 border-b-3 border-[oklch(var(--border))] bg-[oklch(var(--surface))] px-4 py-2">
                        <Link
                          href="/"
                          className="rounded-lg border-2 border-transparent px-3 py-1 text-sm font-bold uppercase tracking-wide text-[oklch(var(--text))] hover:border-[oklch(var(--border))] hover:bg-[oklch(var(--background))]"
                        >
                          Home
                        </Link>
                        <Link
                          href="/attribute"
                          className="rounded-lg border-2 border-transparent px-3 py-1 text-sm font-bold uppercase tracking-wide text-[oklch(var(--text))] hover:border-[oklch(var(--border))] hover:bg-[oklch(var(--background))]"
                        >
                          Attribute
                        </Link>
                        <Link
                          href="/how-to-use"
                          className="rounded-lg border-2 border-transparent px-3 py-1 text-sm font-bold uppercase tracking-wide text-[oklch(var(--text))] hover:border-[oklch(var(--border))] hover:bg-[oklch(var(--background))]"
                        >
                          How to use
                        </Link>
                      <AttributeColorConfig />
                      <ThemeSwitcher />
                    </header>
                    <main className="flex-1">{children}</main>
                    <footer className="border-t-3 border-[oklch(var(--border))] bg-[oklch(var(--surface))] px-4 py-4">
                      <div className="mx-auto flex max-w-6xl flex-col gap-2 text-sm text-[oklch(var(--text))] sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          Developed by{" "}
                          <span className="font-bold">
                            Sebastian Foder
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <a
                            href="https://github.com/SebastianFoder"
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-[oklch(var(--primary))] underline decoration-2 underline-offset-2 hover:decoration-[oklch(var(--alt))]"
                          >
                            GitHub
                          </a>
                          <a
                            href="https://x.com/F1ngs"
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-[oklch(var(--primary))] underline decoration-2 underline-offset-2 hover:decoration-[oklch(var(--alt))]"
                          >
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
