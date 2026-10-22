"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetchJson";

export interface Stats { total: number; today: number; last7: number; last30: number; series: { date: string; count: number }[] }
type State = { stats: Stats | null; error: boolean };

const Ctx = createContext<State>({ stats: null, error: false });
export const useStats = () => useContext(Ctx);

/** One fetch of a bot's download statistics, shared by the metadata row and the chart. */
export function StatsProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const [state, setState] = useState<State>({ stats: null, error: false });
  useEffect(() => {
    let live = true;
    fetchJson<{ downloads: Stats }>(`/api/stats/${slug}`)
      .then((d) => live && setState({ stats: d.downloads, error: false }))
      .catch(() => live && setState({ stats: null, error: true }));
    return () => { live = false; };
  }, [slug]);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}
