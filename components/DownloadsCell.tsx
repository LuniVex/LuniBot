"use client";
import { Count } from "./Count";
import { useStats } from "./StatsContext";

/** Total downloads for the metadata row; shows a dash until the numbers arrive or if they can't. */
export function DownloadsCell() {
  const { stats } = useStats();
  return stats ? <Count value={stats.total} /> : <span aria-label="Download count unavailable">–</span>;
}
