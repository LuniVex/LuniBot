"use client";
import { AnimatePresence, LayoutGroup, motion, useInView } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Bot } from "@/lib/bots";
import { fetchJson } from "@/lib/fetchJson";
import { ease, tFast, tLayout } from "@/lib/motion";
import { BotCard, BotRow, type CardStats } from "./BotCard";

export interface GridItem { bot: Bot; size: string }

/** The first FEATURED bots in data/bots.json are shown large; the rest are ruled rows (L10, L11). */
const FEATURED = 2;
const SPANS = ["md:col-span-7", "md:col-span-5"];

export function BotGrid({ items, tags }: { items: GridItem[]; tags: string[] }) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, CardStats> | null>(null);

  useEffect(() => {
    let live = true;
    fetchJson<Record<string, CardStats>>("/api/stats").then((d) => live && setStats(d)).catch(() => {});
    return () => { live = false; };
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter(({ bot }) =>
      (!tag || bot.tags.includes(tag)) &&
      (!needle || [bot.name, bot.tagline, bot.description, bot.language, ...bot.tags].join(" ").toLowerCase().includes(needle)));
  }, [items, q, tag]);

  const rank = (it: GridItem) => items.indexOf(it);
  const featured = shown.filter((it) => rank(it) < FEATURED);
  const rest = shown.filter((it) => rank(it) >= FEATURED);

  // The grid reveals once, as it scrolls into view (M3). `revealed` never goes back to false,
  // so cards that leave and re-enter on a filter change always animate back to "show" (M5).
  const gridRef = useRef<HTMLDivElement>(null);
  const revealed = useInView(gridRef, { once: true, margin: "0px 0px -64px 0px" });
  const [settled, setSettled] = useState(false); // after the first wave, re-entering cards skip the stagger delay
  useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(() => setSettled(true), 900);
    return () => clearTimeout(t);
  }, [revealed]);

  const cardMotion = (i: number) => ({
    layout: "position" as const,
    initial: { opacity: 0, y: 8 },
    animate: revealed ? { opacity: 1, y: 0, transition: { duration: 0.32, ease, delay: settled ? 0 : i * 0.07 } } : { opacity: 0, y: 8 },
    exit: { opacity: 0, transition: tFast },
    transition: tLayout,
  });

  return (
    <div>
      <div className="grid gap-x-6 gap-y-4 md:grid-cols-12">
        <div className="md:col-span-3">
          <h2 id="bots-h" className="font-display text-xl font-semibold">Bots</h2>
          <p role="status" className="mt-2 text-sm text-muted tabular-nums">{shown.length} of {items.length} shown</p>
        </div>
        <div className="flex flex-col gap-4 md:col-span-9">
          <label className="block max-w-field">
            <span className="mb-1 block text-sm font-semibold">Search</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, tag, language"
              className="t-fast w-full rounded-sm border border-rule bg-paper px-3 py-2 font-mono text-sm placeholder:text-muted hover:border-ink focus:border-ink" />
          </label>
          <div role="group" aria-label="Filter by tag" className="flex flex-wrap gap-2">
            {[null, ...tags].map((t) => (
              <button key={t ?? "all"} type="button" aria-pressed={tag === t} onClick={() => setTag(t)}
                className="t-fast relative rounded-sm border border-rule px-2 py-1 font-mono text-xs hover:border-ink">
                {tag === t && <motion.span layoutId="tag-active" transition={tFast} className="absolute inset-0 rounded-sm bg-ink" />}
                <span className={`relative ${tag === t ? "text-paper" : "text-ink"}`}>{t ?? "all"}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div ref={gridRef} className="mt-8">
        <LayoutGroup>
          <motion.ul layout="position" className="relative grid gap-6 md:grid-cols-12">
            <AnimatePresence mode="popLayout" initial={false}>
              {featured.map((it, i) => (
                <motion.li key={it.bot.slug} {...cardMotion(i)} className={`min-w-0 ${SPANS[i] ?? "md:col-span-6"}`}>
                  <BotCard {...it} stats={stats?.[it.bot.slug]} />
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>

          {rest.length > 0 && (
            <motion.ul layout="position" className="relative mt-12 border-b border-rule">
              <AnimatePresence mode="popLayout" initial={false}>
                {rest.map((it, i) => (
                  <motion.li key={it.bot.slug} {...cardMotion(featured.length + i)}>
                    <BotRow {...it} stats={stats?.[it.bot.slug]} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ul>
          )}
        </LayoutGroup>

        {shown.length === 0 && (
          <div className="mt-6 flex flex-col items-start gap-4 border border-rule p-6 md:p-8">
            <p className="font-display text-2xl font-semibold">Nothing matches{q.trim() ? ` “${q.trim()}”` : ""}{tag ? ` under “${tag}”` : ""}.</p>
            <p className="max-w-measure text-muted">The list searches names, taglines, languages and tags. Clear the filters to see all {items.length} bots.</p>
            <button type="button" onClick={() => { setQ(""); setTag(null); }}
              className="t-fast rounded-sm border border-ink px-4 py-2 font-semibold hover:border-accent hover:text-accent">Clear filters</button>
          </div>
        )}
      </div>
    </div>
  );
}
