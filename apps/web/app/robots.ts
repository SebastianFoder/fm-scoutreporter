import type { MetadataRoute } from "next";
import { SITE_URL, absoluteUrl } from "@/lib/site";

/**
 * Search engines and AI assistants' search and user-triggered fetchers, named so they are welcome
 * even if a blanket rule is added later. AI *training* crawlers (GPTBot, ClaudeBot, Google-Extended,
 * Applebot-Extended, ...) are deliberately not listed: Cloudflare's managed robots.txt, which is put
 * in front of this file, decides those, and a second group for the same bot would be ambiguous.
 */
const SEARCH_AND_ASSISTANT_AGENTS = [
  "Googlebot",
  "Bingbot",
  "DuckDuckBot",
  "Applebot",
  // OpenAI: ChatGPT search, and pages a ChatGPT user asks it to open.
  "OAI-SearchBot",
  "ChatGPT-User",
  // Anthropic: Claude's search index, and pages a Claude user asks it to open.
  "Claude-SearchBot",
  "Claude-User",
  // Perplexity: its index, and user-triggered fetches.
  "PerplexityBot",
  "Perplexity-User",
  "DuckAssistBot",
  "MistralAI-User",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: SEARCH_AND_ASSISTANT_AGENTS, allow: "/", disallow: ["/api/"] },
      { userAgent: "*", allow: "/", disallow: ["/api/"] },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
