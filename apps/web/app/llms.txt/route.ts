import { llmsTxt } from "@/lib/llms";

/** https://llmstxt.org: a Markdown map of the site for AI assistants (lib/llms.ts). */
export const dynamic = "force-static";

export function GET() {
  return new Response(llmsTxt(), { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}
