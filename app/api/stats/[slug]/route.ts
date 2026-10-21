import { NextRequest, NextResponse } from "next/server";
import { fail, noStore } from "../../_http";
import { getBot } from "@/lib/bots";
import { getDownloadStats, getVotes } from "@/lib/stats";
import { getVisitor, setVisitorCookie } from "@/lib/visitor";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const bot = getBot((await params).slug);
  if (!bot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const visitor = getVisitor(req);
    const [downloads, votes] = await Promise.all([getDownloadStats(bot.slug), getVotes(bot.slug, visitor.id)]);
    return setVisitorCookie(NextResponse.json({ downloads, votes }, { headers: noStore }), visitor);
  } catch (err) { return fail(err); }
}
