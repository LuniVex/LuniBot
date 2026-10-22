"use client";
import { AnimatePresence, LayoutGroup, motion, useInView } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Votes } from "@/lib/analytics";
import type { Bot } from "@/lib/bots";
import { fetchJson } from "@/lib/fetch-json";
import { fmtDate } from "@/lib/format";
import { licenseInfo } from "@/lib/license";
import { ease, fadeUp, glide } from "@/lib/motion";
import { AppIcon } from "./AppIcon";
import { More, pill } from "./Button";
import { Count } from "./Count";
import { VoteButton } from "./VoteButton";

export interface Entry { bot: Bot; size: string }

/** Tags are stored lowercase in bots.json; these need their proper spelling on screen. */
const SPELLING: Record<string, string> = { ai: "AI", sqlite: "SQLite" };
const label = (t: string) => SPELLING[t] ?? t.charAt(0).toUpperCase() + t.slice(1);
interface Live { downloads: number; votes: Votes }

/** Search, tag filters and the bot tiles. The visible list is recomputed from state on every change. */
export function BotGallery({ entries, tags }: { entries: Entry[]; tags: string[] }) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [live, setLive] = useState<Record<string, Live>>({});

  useEffect(() => {
    let active = true;
    fetchJson<Record<string, Live>>("/api/stats").then((d) => active && setLive(d)).catch(() => { /* counts show a dash */ });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter(({ bot }) =>
      (!tag || bot.tags.includes(tag)) &&
      (!q || [bot.name, bot.tagline, bot.description, bot.language, ...bot.tags].join(" ").toLowerCase().includes(q)));
  }, [entries, query, tag]);

  // Tiles reveal once: when the grid first scrolls into view, or as soon as someone searches or filters.
  // `shown` never turns back off, so tiles that mount later go straight to fully visible.
  const gridRef = useRef<HTMLUListElement>(null);
  const inView = useInView(gridRef, { once: true, margin: "0px 0px -60px 0px" });
  const [used, setUsed] = useState(false);
  const shown = inView || used;
  const [settled, setSettled] = useState(false); // after the first wave, new tiles don't wait for a stagger slot
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setSettled(true), 1200);
    return () => clearTimeout(t);
  }, [shown]);

  return (
    <div>
      <div className="flex flex-col items-center gap-5">
        <label className="relative w-full max-w-md">
          <span className="sr-only">Search bots</span>
          <svg viewBox="0 0 16 16" aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-fg-3">
            <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="m11 11 3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setUsed(true); }} placeholder="Search by name, tag or language"
            className="smooth h-12 w-full rounded-full border border-transparent bg-tile pl-11 pr-5 text-[17px] placeholder:text-fg-3 focus:border-blue focus:bg-bg focus:outline-none" />
        </label>

        <div role="group" aria-label="Filter by tag" className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-tile p-1 [scrollbar-width:none]">
          {[null, ...tags].map((t) => {
            const on = tag === t;
            return (
              <button key={t ?? "all"} type="button" aria-pressed={on} onClick={() => { setTag(t); setUsed(true); }}
                className={`smooth relative shrink-0 rounded-full px-4 py-1.5 text-[14px] ${on ? "text-bg" : "text-fg-2 hover:text-fg"}`}>
                {on && <motion.span layoutId="tag-pill" transition={glide} className="absolute inset-0 rounded-full bg-fg" />}
                <span className="relative">{t ? label(t) : "All"}</span>
              </button>
            );
          })}
        </div>
        <p role="status" className="t-small text-fg-3">{visible.length === entries.length ? `${entries.length} bots` : `${visible.length} of ${entries.length} bots`}</p>
      </div>

      <LayoutGroup>
        <motion.ul ref={gridRef} layout transition={glide} className="relative mt-10 grid gap-5 md:grid-cols-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((e, i) => (
              <motion.li key={e.bot.slug} layout transition={glide}
                initial={{ opacity: 0, y: 28, scale: 0.98 }}
                animate={shown ? { opacity: 1, y: 0, scale: 1, transition: fadeUp(settled ? 0 : i * 0.1) } : { opacity: 0, y: 28, scale: 0.98 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.35, ease } }}
                className="min-w-0">
                <Tile {...e} live={live[e.bot.slug]} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      </LayoutGroup>

      <AnimatePresence>
        {visible.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={fadeUp()}
            className="mt-10 rounded-tile bg-tile px-8 py-16 text-center">
            <p className="t-tile">No bots match{query.trim() ? ` “${query.trim()}”` : ""}{tag ? ` in ${tag}` : ""}.</p>
            <p className="mt-3 text-fg-2">Search looks at names, descriptions, languages and tags.</p>
            <button type="button" onClick={() => { setQuery(""); setTag(null); }} className={pill("secondary", "md", "mt-6")}>Show all bots</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** One bot: icon, name and line on a soft rounded tile. The whole tile opens the bot's page. */
function Tile({ bot, size, live }: Entry & { live?: Live }) {
  // The article is the hover target and never moves; only the card inside lifts. If the moving card were
  // the target, a cursor near its bottom edge would fall off it as it rose and the hover would stutter.
  return (
    <article className="group relative h-full">
      <div className="relative flex h-full flex-col items-center rounded-tile bg-tile px-8 pb-10 pt-12 text-center ring-1 ring-transparent transition-[translate,box-shadow] duration-500 ease-[cubic-bezier(0.28,0.11,0.32,1)] group-hover:-translate-y-[3px] group-hover:shadow-[0_20px_50px_-30px_rgba(0,0,0,0.45)] dark:ring-white/[0.06]">
        <AppIcon icon={bot.icon} name={bot.name} />
        <p className="t-small mt-6 text-fg-3"><span className="capitalize">{bot.status}</span> · {bot.language} · {licenseInfo(bot.license).short}</p>
        <h3 className="t-tile mt-1">
          <Link href={`/bots/${bot.slug}`} className="after:absolute after:inset-0 after:rounded-tile">{bot.name}</Link>
        </h3>
        <p className="t-lead mt-3 max-w-[22ch] text-fg-2">{bot.tagline}</p>
        <p className="t-small mt-5 text-fg-3 tabular-nums">
          v{bot.version} · {size} · Updated {fmtDate(bot.updated)} · {live ? <><Count value={live.downloads} /> {live.downloads === 1 ? "download" : "downloads"}</> : "– downloads"}
        </p>
        <div className="relative z-10 mt-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-3 pt-8">
          <a href={`/api/download/${bot.slug}`} download="" className={pill("primary")}>Download</a>
          <VoteButton slug={bot.slug} initial={live?.votes} />
          <More href={`/bots/${bot.slug}`}>Learn more</More>
        </div>
      </div>
    </article>
  );
}
