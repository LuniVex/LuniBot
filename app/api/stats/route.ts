import { NextRequest, NextResponse } from "next/server";
import { fail, noStore } from "../_http";
import { bots } from "@/lib/bots";
import { getDownloadStats, getVotes } from "@/lib/stats";
import { getVisitor, setVisitorCookie } from "@/lib/visitor";

export const dynamic = "force-dynamic";

/** Summary for the hub: totals and votes for every bot. */
export async function GET(req: NextRequest) {
  try {
    const visitor = getVisitor(req);
    const entries = await Promise.all(bots.map(async (b) => {
      const [d, v] = await Promise.all([getDownloadStats(b.slug), getVotes(b.slug, visitor.id)]);
      return [b.slug, { downloads: { total: d.total, last7: d.last7 }, votes: v }] as const;
    }));
    return setVisitorCookie(NextResponse.json(Object.fromEntries(entries), { headers: noStore }), visitor);
  } catch (err) { return fail(err); }
}
