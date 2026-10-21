import "server-only";
import { getStore } from "./store";

const P = "lb";
const DAY_TTL = 60 * 60 * 24 * 400;
const DEDUPE_SECONDS = 60 * 60; // one counted download per visitor per bot per hour

export const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export async function recordDownload(slug: string, visitorId: string): Promise<boolean> {
  const store = getStore();
  const fresh = await store.setIfAbsent(`${P}:dlseen:${slug}:${visitorId}`, DEDUPE_SECONDS);
  if (!fresh) return false;
  await Promise.all([
    store.incr(`${P}:dl:total:${slug}`),
    store.incr(`${P}:dl:day:${slug}:${dayKey(new Date())}`, DAY_TTL),
  ]);
  return true;
}

export interface DownloadStats {
  total: number;
  today: number;
  last7: number;
  last30: number;
  /** Oldest to newest, 30 entries ending today (UTC). */
  series: { date: string; count: number }[];
}

export async function getDownloadStats(slug: string): Promise<DownloadStats> {
  const store = getStore();
  const days = Array.from({ length: 30 }, (_, i) => dayKey(new Date(Date.now() - (29 - i) * 86_400_000)));
  const [total, ...counts] = await store.getNumbers([`${P}:dl:total:${slug}`, ...days.map((d) => `${P}:dl:day:${slug}:${d}`)]);
  const series = days.map((date, i) => ({ date, count: counts[i] }));
  const sum = (n: number) => series.slice(-n).reduce((a, b) => a + b.count, 0);
  return { total, today: series[29].count, last7: sum(7), last30: sum(30), series };
}

export async function getVotes(slug: string, visitorId: string) {
  const store = getStore();
  const [count, voted] = await Promise.all([store.countMembers(`${P}:votes:${slug}`), store.hasMember(`${P}:votes:${slug}`, visitorId)]);
  return { count, voted };
}

/** One vote per visitor; calling again removes it. */
export async function toggleVote(slug: string, visitorId: string) {
  const store = getStore();
  const key = `${P}:votes:${slug}`;
  if (await store.hasMember(key, visitorId)) await store.removeMember(key, visitorId);
  else await store.addMember(key, visitorId);
  return getVotes(slug, visitorId);
}
