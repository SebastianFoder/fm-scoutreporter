import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const ALLOWED = new Set(["attribute", "attribute-fm27-hidden", "staff", "squad", "squad-hidden"]);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;

  if (!ALLOWED.has(name)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const filePath = path.join(process.cwd(), "fixtures", `${name}.csv`);

  try {
    const csv = await readFile(filePath, "utf-8");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new NextResponse("Fixture not found", { status: 404 });
  }
}
