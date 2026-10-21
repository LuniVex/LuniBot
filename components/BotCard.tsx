"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import type { Bot } from "@/lib/bots";
import { fmtDate } from "@/lib/format";
import { BotMark } from "./BotMark";
import { Button } from "./Button";
import { StatusBadge } from "./StatusBadge";
import { Tag } from "./Tag";
import { VoteButton, type Votes } from "./VoteButton";

export interface CardStats { downloads: { total: number; last7: number }; votes: Votes }

export function BotCard({ bot, size, stats }: { bot: Bot; size: string; stats?: CardStats | null }) {
  return (
    <motion.article initial="rest" whileHover="hover" whileFocus="hover"
      variants={{ rest: { y: 0 }, hover: { y: -2 } }}
      className="relative flex h-full flex-col rounded-sm border border-rule bg-paper p-6 transition-colors hover:border-ink">
      {/* accent bar draws in on hover: transform only */}
      <motion.span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 origin-left bg-accent"
        variants={{ rest: { scaleX: 0 }, hover: { scaleX: 1 } }} />
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <BotMark name={bot.name} />
          <h3 className="text-xl font-bold">
            <Link href={`/bots/${bot.slug}`} className="no-underline after:absolute after:inset-0">{bot.name}</Link>
          </h3>
        </div>
        <StatusBadge status={bot.status} />
      </div>
      <p className="mt-4">{bot.tagline}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Tag>{bot.language}</Tag>
        {bot.tags.slice(0, 3).map((t) => <Tag key={t}>{t}</Tag>)}
      </div>
      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-muted tnum">
        <div><dt className="sr-only">Version</dt><dd>v{bot.version}</dd></div>
        <div><dt className="sr-only">Size</dt><dd>{size}</dd></div>
        <div><dt className="sr-only">Updated</dt><dd>Updated {fmtDate(bot.updated)}</dd></div>
        <div><dt className="sr-only">Downloads</dt><dd>{stats ? `${stats.downloads.total.toLocaleString("en-US")} downloads` : "– downloads"}</dd></div>
      </dl>
      <div className="relative z-10 mt-auto flex flex-wrap gap-3 pt-6">
        <Button href={`/api/download/${bot.slug}`} download>Download</Button>
        <Button href={`/bots/${bot.slug}`} variant="outline">Details</Button>
        <VoteButton slug={bot.slug} initial={stats?.votes ?? undefined} />
      </div>
    </motion.article>
  );
}
