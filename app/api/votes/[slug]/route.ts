import { NextRequest, NextResponse } from "next/server";
import { fail, noStore } from "../../_http";
import { getBot } from "@/lib/bots";
import { getVotes, toggleVote } from "@/lib/stats";
import { getVisitor, setVisitorCookie } from "@/lib/visitor";

export const dynamic = "force-dynamic";

/** Toggles the visitor's vote. Same-origin requests only. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const bot = getBot((await params).slug);
  if (!bot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const visitor = getVisitor(req);
    const votes = await toggleVote(bot.slug, visitor.id);
    return setVisitorCookie(NextResponse.json(votes, { headers: noStore }), visitor);
  } catch (err) { return fail(err); }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const bot = getBot((await params).slug);
  if (!bot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const visitor = getVisitor(req);
    return setVisitorCookie(NextResponse.json(await getVotes(bot.slug, visitor.id), { headers: noStore }), visitor);
  } catch (err) { return fail(err); }
}
