import { NextResponse, type NextRequest } from "next/server";
import { countDownload } from "@/lib/analytics";
import { getBot } from "@/lib/bots";
import { visitorOf, withVisitor } from "@/lib/visitor";

export const dynamic = "force-dynamic";

const CRAWLER = /bot|crawl|spider|slurp|preview|facebookexternalhit/i;

/** Counts the download, then redirects to the zip in public/downloads. The file is never fetched from GitHub. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const bot = getBot((await params).slug);
  if (!bot) return new NextResponse("No bot with that name.", { status: 404 });

  const visitor = visitorOf(req);
  if (!CRAWLER.test(req.headers.get("user-agent") ?? "")) {
    try { await countDownload(bot.slug, visitor.id); }
    catch (err) { console.error("[download] not counted", err); } // a datastore problem never blocks the file
  }
  const res = NextResponse.redirect(new URL(bot.download.file, req.url), 302);
  res.headers.set("Cache-Control", "no-store");
  return withVisitor(res, visitor);
}
