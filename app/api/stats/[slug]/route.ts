import { NextResponse, type NextRequest } from "next/server";
import { getDownloads } from "@/lib/analytics";
import { failed, noStore, notFound } from "@/lib/api";
import { getBot } from "@/lib/bots";

export const dynamic = "force-dynamic";

/** Total, today, last 7 and 30 days, and a 30-day daily series for one bot. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const bot = getBot((await params).slug);
  if (!bot) return notFound();
  try {
    return NextResponse.json(await getDownloads(bot.slug), { headers: noStore });
  } catch (err) {
    return failed(err);
  }
}
