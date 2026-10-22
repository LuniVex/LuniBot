import "server-only";
import { getStore } from "./store";

const DAY = 86_400;
const KEEP_DAYS = 400;        // daily counters expire after about 13 months
const DEDUPE_SECONDS = 3_600; // one counted download per visitor, per bot, per hour

const k = {
  total: (slug: string) => `lb:dl:${slug}:total`,
  day: (slug: string, day: string) => `lb:dl:${slug}:${day}`,
  seen: (slug: string, visitor: string) => `lb:dl:${slug}:seen:${visitor}`,
  votes: (slug: string) => `lb:votes:${slug}`,
};

export const utcDay = (d: Date) => d.toISOString().slice(0, 10);

/** Counts a download unless this visitor already downloaded this bot in the last hour. */
export async function countDownload(slug: string, visitor: string): Promise<boolean> {
  const s = getStore();
  if (!(await s.claim(k.seen(slug, visitor), DEDUPE_SECONDS))) return false;
  await Promise.all([s.incr(k.total(slug)), s.incr(k.day(slug, utcDay(new Date())), KEEP_DAYS * DAY)]);
  return true;
}

export interface Downloads {
  total: number;
  today: number;
  last7: number;
  last30: number;
  /** 30 days, oldest first, ending today (UTC). */
  daily: { day: string; count: number }[];
}

export async function getDownloads(slug: string): Promise<Downloads> {
  const days = Array.from({ length: 30 }, (_, i) => utcDay(new Date(Date.now() - (29 - i) * DAY * 1000)));
  const [total, ...counts] = await getStore().read([k.total(slug), ...days.map((d) => k.day(slug, d))]);
  const daily = days.map((day, i) => ({ day, count: counts[i] }));
  const sum = (n: number) => daily.slice(-n).reduce((a, d) => a + d.count, 0);
  return { total, today: daily[29].count, last7: sum(7), last30: sum(30), daily };
}

export interface Votes { count: number; voted: boolean }

export async function getVotes(slug: string, visitor: string): Promise<Votes> {
  const s = getStore();
  const [count, voted] = await Promise.all([s.setSize(k.votes(slug)), s.setHas(k.votes(slug), visitor)]);
  return { count, voted };
}

/** One vote per visitor. Voting again takes it back. */
export async function toggleVote(slug: string, visitor: string): Promise<Votes> {
  const s = getStore();
  if (await s.setHas(k.votes(slug), visitor)) await s.setRemove(k.votes(slug), visitor);
  else await s.setAdd(k.votes(slug), visitor);
  return getVotes(slug, visitor);
}
