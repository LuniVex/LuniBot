"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { Bot } from "@/lib/bots";
import { fetchJson } from "@/lib/fetchJson";
import { spring } from "@/lib/motion";
import { BotCard, type CardStats } from "./BotCard";

export interface GridItem { bot: Bot; size: string }

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

  return (
    <div>
      <div className="flex flex-col gap-4">
        <label className="block max-w-80">
          <span className="mb-1 block text-sm font-bold">Search</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, tag, language"
            className="w-full rounded-sm border border-ink bg-paper px-3 py-2 font-mono text-sm placeholder:text-muted" />
        </label>
        <div role="group" aria-label="Filter by tag" className="flex flex-wrap gap-2">
          {[null, ...tags].map((t) => (
            <button key={t ?? "all"} type="button" aria-pressed={tag === t} onClick={() => setTag(t)}
              className="relative rounded-sm border border-rule px-2 py-1 font-mono text-xs hover:border-ink">
              {tag === t && <motion.span layoutId="tag-active" transition={spring} className="absolute inset-0 rounded-sm bg-ink" />}
              <span className={`relative ${tag === t ? "text-paper" : "text-ink"}`}>{t ?? "all"}</span>
            </button>
          ))}
        </div>
      </div>

      <p role="status" className="mt-6 text-sm text-muted">{shown.length} of {items.length} bots</p>

      {/* Each card owns its enter/exit, so a card that re-matches a filter always re-mounts visible.
          (Before, cards relied on the list's variant state and stayed at opacity 0 once the list had revealed.) */}
      <motion.ul layout className="mt-4 grid gap-4 sm:grid-cols-2">
        <AnimatePresence>
          {shown.map((it, i) => (
            <motion.li key={it.bot.slug} layout
              initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-48px" }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={{ ...spring, delay: Math.min(i, 3) * 0.07 }}>
              <BotCard {...it} stats={stats?.[it.bot.slug]} />
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>
      {shown.length === 0 && <p className="mt-6">No bots match. Clear the search or pick another tag.</p>}
    </div>
  );
}
