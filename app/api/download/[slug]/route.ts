import { NextRequest, NextResponse } from "next/server";
import { getBot } from "@/lib/bots";
import { recordDownload } from "@/lib/stats";
import { getVisitor, setVisitorCookie } from "@/lib/visitor";

export const dynamic = "force-dynamic";
const CRAWLER = /bot|crawl|spider|slurp|preview|facebookexternalhit/i;

/** Counts the download on the server, then redirects to the static file in /public/downloads. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const bot = getBot((await params).slug);
  if (!bot) return new NextResponse("Not found", { status: 404 });

  const visitor = getVisitor(req);
  if (!CRAWLER.test(req.headers.get("user-agent") ?? "")) {
    try { await recordDownload(bot.slug, visitor.id); }
    catch (err) { console.error("[download] could not count", err); } // never block the file because stats are down
  }
  const res = NextResponse.redirect(new URL(bot.download.file, req.url), 302);
  res.headers.set("Cache-Control", "no-store");
  return setVisitorCookie(res, visitor);
}
