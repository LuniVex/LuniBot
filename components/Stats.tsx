"use client";
import { motion } from "framer-motion";
import { createContext, useContext, useEffect, useState } from "react";
import type { Downloads } from "@/lib/analytics";
import { fetchJson } from "@/lib/fetch-json";
import { fmtDate } from "@/lib/format";
import { glide } from "@/lib/motion";
import { Count } from "./Count";
import { Shimmer } from "./Motion";

type State = { data: Downloads | null; failed: boolean };
const Ctx = createContext<State>({ data: null, failed: false });

/** Loads one bot's download numbers once and shares them with the page. */
export function StatsProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const [state, setState] = useState<State>({ data: null, failed: false });
  useEffect(() => {
    let active = true;
    fetchJson<Downloads>(`/api/stats/${slug}`)
      .then((data) => active && setState({ data, failed: false }))
      .catch(() => active && setState({ data: null, failed: true }));
    return () => { active = false; };
  }, [slug]);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function TotalDownloads() {
  const { data } = useContext(Ctx);
  return data ? <Count value={data.total} /> : <span aria-label="Download count unavailable">–</span>;
}

/** Download totals and a bar chart of the last 7 or 30 days. */
export function DownloadChart() {
  const { data, failed } = useContext(Ctx);
  const [range, setRange] = useState<7 | 30>(30);

  if (failed) return <p className="text-fg-2">Download numbers aren&apos;t available right now. Downloading still works.</p>;
  if (!data) {
    return (
      <div aria-busy="true" aria-label="Loading download numbers">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i}><Shimmer className="h-10 w-16" /><Shimmer className="mt-3 h-4 w-24" /></div>)}</div>
        <Shimmer className="mt-10 h-40 w-full" />
      </div>
    );
  }

  const days = data.daily.slice(-range);
  const peak = Math.max(1, ...days.map((d) => d.count));

  return (
    <div>
      <dl className="grid grid-cols-2 gap-8 md:grid-cols-4">
        {([["All time", data.total], ["Today", data.today], ["Last 7 days", data.last7], ["Last 30 days", data.last30]] as const).map(([k, v]) => (
          <div key={k} className="flex flex-col-reverse">
            <dt className="t-small mt-2 text-fg-2">{k}</dt>
            <dd className="text-[40px] font-semibold leading-none tracking-[-0.02em]"><Count value={v} /></dd>
          </div>
        ))}
      </dl>

      <div className="mt-12 flex items-center justify-between gap-4">
        <p className="t-small text-fg-2">Downloads per day (UTC)</p>
        <div role="group" aria-label="Chart range" className="flex rounded-full bg-bg p-1 dark:bg-alt">
          {([7, 30] as const).map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}
              className={`smooth relative rounded-full px-3 py-1 text-[13px] ${range === r ? "text-bg" : "text-fg-2 hover:text-fg"}`}>
              {range === r && <motion.span layoutId="range-pill" transition={glide} className="absolute inset-0 rounded-full bg-fg" />}
              <span className="relative">{r} days</span>
            </button>
          ))}
        </div>
      </div>
      <div role="img" aria-label={`Downloads per day over the last ${range} days: ${days.reduce((a, d) => a + d.count, 0)} in total, at most ${peak} in one day.`}
        className={`mt-4 flex h-40 items-end ${range === 7 ? "gap-3" : "gap-1"}`}>
        {days.map((d, i) => (
          <motion.div key={`${range}-${d.day}`} title={`${fmtDate(d.day)}: ${d.count}`}
            className={`flex-1 origin-bottom rounded-t-[4px] ${i === days.length - 1 ? "bg-blue" : "bg-fg-3/40"}`}
            style={{ height: `${d.count === 0 ? 2 : Math.max(6, (d.count / peak) * 100)}%` }}
            initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 110, damping: 22, delay: i * 0.02 }} />
        ))}
      </div>
      <p className="t-tiny mt-2 flex justify-between text-fg-3 tabular-nums">
        <span>{fmtDate(days[0].day)}</span><span>Most in a day: {peak}</span><span>{fmtDate(days[days.length - 1].day)}</span>
      </p>
    </div>
  );
}
