"use client";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { fmtDate } from "@/lib/format";
import { spring } from "@/lib/motion";
import { Skeleton } from "./Motion";

interface Stats { total: number; today: number; last7: number; last30: number; series: { date: string; count: number }[] }

export function BotStats({ slug }: { slug: string }) {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState(false);
  const [range, setRange] = useState<7 | 30>(30);

  useEffect(() => {
    let live = true;
    fetch(`/api/stats/${slug}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => live && setS(d.downloads))
      .catch(() => live && setErr(true));
    return () => { live = false; };
  }, [slug]);

  if (err) return <p>Download statistics are unavailable right now.</p>;
  if (!s) return (
    <div aria-busy="true" aria-label="Loading download statistics">
      <Skeleton className="h-10 w-40" /><Skeleton className="mt-4 h-16 w-full" />
    </div>
  );

  const data = s.series.slice(-range);
  const max = Math.max(1, ...data.map((d) => d.count));
  const W = 600, H = 72, gap = range === 7 ? 12 : 4, bw = (W - gap * (range - 1)) / range;

  return (
    <div>
      <dl className="grid max-w-xl grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {([["Total", s.total], ["Today", s.today], ["Last 7 days", s.last7], ["Last 30 days", s.last30]] as const).map(([k, v]) => (
          <div key={k}><dt className="text-sm text-muted">{k}</dt><dd className="font-mono text-xl font-bold tnum">{v.toLocaleString("en-US")}</dd></div>
        ))}
      </dl>

      <div className="mt-6 flex max-w-3xl items-center justify-between gap-4">
        <p className="text-sm text-muted">Downloads per day (UTC)</p>
        <div role="group" aria-label="Chart range" className="flex gap-2">
          {([7, 30] as const).map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}
              className={`rounded-sm border px-2 py-1 font-mono text-xs ${range === r ? "border-ink bg-ink text-paper" : "border-rule hover:border-ink"}`}>{r}d</button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" preserveAspectRatio="none" className="mt-2 h-20 w-full max-w-3xl border-b border-ink"
        aria-label={`Downloads per day over the last ${range} days: ${data.reduce((a, d) => a + d.count, 0)} in total, peak ${max} in a day.`}>
        {data.map((d, i) => {
          const h = d.count === 0 ? 1 : Math.max(2, (d.count / max) * (H - 4));
          return (
            <motion.rect key={`${range}-${d.date}`} x={i * (bw + gap)} y={H - h} width={bw} height={h}
              className={i === data.length - 1 ? "fill-accent" : "fill-ink"} opacity={d.count === 0 ? 0.25 : 1}
              style={{ transformBox: "fill-box", transformOrigin: "bottom" }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
              transition={{ ...spring, delay: i * 0.012 }}>
              <title>{`${fmtDate(d.date)}: ${d.count}`}</title>
            </motion.rect>
          );
        })}
      </svg>
      <p className="mt-1 flex max-w-3xl justify-between font-mono text-xs text-muted tnum">
        <span>{fmtDate(data[0].date)}</span><span>peak {max}/day</span><span>{fmtDate(data[data.length - 1].date)}</span>
      </p>
    </div>
  );
}
