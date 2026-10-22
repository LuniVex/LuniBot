import Link from "next/link";
import type { Bot } from "@/lib/bots";
import { fmtDate } from "@/lib/format";
import { BotMark } from "./BotMark";
import { Button } from "./Button";
import { Count } from "./Count";
import { StatusBadge } from "./StatusBadge";
import { TagList } from "./TagList";
import { VoteButton, type Votes } from "./VoteButton";

export interface CardStats { downloads: { total: number; last7: number }; votes: Votes }

/** Hover: border and background change, the arrow nudges 2px. No lift, no glow (M6, A16). */
const Arrow = () => <span aria-hidden="true" className="t-fast inline-block group-hover:translate-x-0.5">→</span>;

/** Featured bot at large scale (L10). The whole card is the link; the buttons sit above it. */
export function BotCard({ bot, size, stats }: { bot: Bot; size: string; stats?: CardStats | null }) {
  return (
    <article className="t-fast group relative flex h-full flex-col border border-rule bg-paper p-6 hover:border-ink hover:bg-tint md:p-8">
      <div className="flex items-start justify-between gap-4">
        <BotMark name={bot.name} size="lg" />
        <p className="flex gap-3 font-mono text-xs text-muted tabular-nums"><span>v{bot.version}</span><StatusBadge status={bot.status} /></p>
      </div>
      <h3 className="mt-6 font-display text-3xl font-semibold md:text-4xl">
        <Link href={`/bots/${bot.slug}`} className="no-underline after:absolute after:inset-0 hover:text-ink">{bot.name}</Link>
      </h3>
      <p className="mt-2 text-xl">{bot.tagline}</p>

      <ul className="mt-6 text-sm">
        {bot.features.slice(0, 3).map((f) => <li key={f} className="border-t border-rule py-2">{f}</li>)}
      </ul>

      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-muted tabular-nums">
        <div><dt className="sr-only">Language</dt><dd>{bot.language}</dd></div>
        <div><dt className="sr-only">Size</dt><dd>{size}</dd></div>
        <div><dt className="sr-only">Updated</dt><dd>Updated {fmtDate(bot.updated)}</dd></div>
        <div><dt className="sr-only">Downloads</dt><dd>{stats ? <><Count value={stats.downloads.total} /> downloads</> : "– downloads"}</dd></div>
      </dl>
      <TagList tags={bot.tags.slice(0, 4)} className="mt-2" />

      <div className="relative z-10 mt-auto flex flex-wrap items-center gap-3 pt-8">
        <Button href={`/api/download/${bot.slug}`} download>Download</Button>
        <VoteButton slug={bot.slug} initial={stats?.votes ?? undefined} />
        <Link href={`/bots/${bot.slug}`} className="text-sm">Details <Arrow /></Link>
      </div>
    </article>
  );
}

/** Every other bot: one ruled row (L5). Name and line left, data in the middle, actions right. */
export function BotRow({ bot, size, stats }: { bot: Bot; size: string; stats?: CardStats | null }) {
  return (
    <article className="t-fast group relative grid gap-x-6 gap-y-3 border-t border-rule px-2 py-4 hover:bg-tint md:grid-cols-12 md:items-center">
      <div className="md:col-span-5">
        <h3 className="font-display text-xl font-semibold">
          <Link href={`/bots/${bot.slug}`} className="no-underline after:absolute after:inset-0 hover:text-ink">{bot.name}</Link>
        </h3>
        <p className="text-sm">{bot.tagline}</p>
      </div>
      <div className="font-mono text-xs text-muted tabular-nums md:col-span-3">
        <p>v{bot.version} · {size} · <StatusBadge status={bot.status} /></p>
        <TagList tags={bot.tags.slice(0, 3)} className="mt-1" />
      </div>
      <div className="relative z-10 flex flex-wrap items-center gap-3 md:col-span-4 md:justify-end">
        <Button href={`/api/download/${bot.slug}`} download>Download</Button>
        <VoteButton slug={bot.slug} initial={stats?.votes ?? undefined} />
      </div>
    </article>
  );
}
