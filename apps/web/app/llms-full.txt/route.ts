import { llmsFullTxt } from "@/lib/llms";

/** llms.txt plus every FAQ answer and the comparison tables, in one file (lib/llms.ts). */
export const dynamic = "force-static";

export async function GET() {
  return new Response(await llmsFullTxt(), { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}
