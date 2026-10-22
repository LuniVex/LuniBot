import { NextResponse, type NextRequest } from "next/server";
import { getDownloads, getVotes } from "@/lib/analytics";
import { failed, noStore } from "@/lib/api";
import { bots } from "@/lib/bots";
import { visitorOf, withVisitor } from "@/lib/visitor";

export const dynamic = "force-dynamic";

export interface HubStats { [slug: string]: { downloads: number; votes: { count: number; voted: boolean } } }

/** Totals and votes for every bot, for the hub. */
export async function GET(req: NextRequest) {
  try {
    const visitor = visitorOf(req);
    const rows = await Promise.all(bots.map(async (b) => {
      const [d, v] = await Promise.all([getDownloads(b.slug), getVotes(b.slug, visitor.id)]);
      return [b.slug, { downloads: d.total, votes: v }] as const;
    }));
    return withVisitor(NextResponse.json(Object.fromEntries(rows) as HubStats, { headers: noStore }), visitor);
  } catch (err) {
    return failed(err);
  }
}
