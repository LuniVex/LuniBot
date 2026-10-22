import { NextResponse, type NextRequest } from "next/server";
import { getVotes, toggleVote } from "@/lib/analytics";
import { failed, noStore, notFound } from "@/lib/api";
import { getBot } from "@/lib/bots";
import { visitorOf, withVisitor } from "@/lib/visitor";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const bot = getBot((await params).slug);
  if (!bot) return notFound();
  try {
    const visitor = visitorOf(req);
    return withVisitor(NextResponse.json(await getVotes(bot.slug, visitor.id), { headers: noStore }), visitor);
  } catch (err) {
    return failed(err);
  }
}

/** Casts or takes back this visitor's vote. Requests from other sites are refused. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const bot = getBot((await params).slug);
  if (!bot) return notFound();
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) {
    return NextResponse.json({ error: "Votes can only be cast from this site." }, { status: 403, headers: noStore });
  }
  try {
    const visitor = visitorOf(req);
    return withVisitor(NextResponse.json(await toggleVote(bot.slug, visitor.id), { headers: noStore }), visitor);
  } catch (err) {
    return failed(err);
  }
}
