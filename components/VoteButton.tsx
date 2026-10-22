"use client";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { Votes } from "@/lib/analytics";
import { fetchJson } from "@/lib/fetch-json";
import { touch } from "@/lib/motion";
import { Count } from "./Count";

type Phase = "loading" | "ready" | "saving" | "load-failed" | "save-failed";

/**
 * One upvote per visitor, stored on the server; press again to take it back.
 * Updates instantly and rolls back if the server refuses.
 */
export function VoteButton({ slug, initial, size = "md" }: { slug: string; initial?: Votes; size?: "md" | "lg" }) {
  const [own, setOwn] = useState<Votes | null>(null);
  const [loaded, setLoaded] = useState<Votes | null>(null);
  const [phase, setPhase] = useState<Phase>(initial ? "ready" : "loading");
  const [attempt, setAttempt] = useState(0);
  const v = own ?? initial ?? loaded;

  useEffect(() => {
    if (initial) return;
    let live = true;
    fetchJson<Votes>(`/api/votes/${slug}`)
      .then((d) => { if (live) { setLoaded(d); setPhase("ready"); } })
      .catch(() => { if (live) setPhase("load-failed"); });
    return () => { live = false; };
  }, [slug, initial, attempt]);

  async function toggle() {
    if (!v || phase === "saving") return;
    const before = v;
    setOwn({ voted: !v.voted, count: v.count + (v.voted ? -1 : 1) });
    setPhase("saving");
    try {
      setOwn(await fetchJson<Votes>(`/api/votes/${slug}`, { method: "POST" }));
      setPhase("ready");
    } catch {
      setOwn(before);
      setPhase("save-failed");
    }
  }

  const voted = v?.voted ?? false;
  return (
    <span className="inline-flex flex-col items-center gap-1">
      <motion.button type="button" onClick={toggle} disabled={!v} aria-pressed={voted} whileTap={{ scale: 0.94 }} transition={touch}
        className={`smooth inline-flex items-center gap-2 rounded-full border disabled:opacity-50 ${size === "lg" ? "min-h-12 px-6 text-[17px]" : "min-h-9 px-4 text-[15px]"} ${
          voted ? "border-blue bg-blue text-white" : "border-line text-fg enabled:hover:border-fg-3"}`}>
        <motion.svg viewBox="0 0 12 12" aria-hidden="true" className="size-3" animate={{ y: voted ? -1 : 0 }} transition={touch}>
          <path d="M6 1.75 10.75 10H1.25z" fill={voted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </motion.svg>
        <span>{voted ? "Upvoted" : "Upvote"}</span>
        <span className="opacity-70" aria-label={v ? `${v.count} votes` : "votes unavailable"}>{v ? <Count value={v.count} /> : "–"}</span>
      </motion.button>
      {phase === "load-failed" && (
        <span role="status" className="t-tiny text-fg-3">
          Votes didn&apos;t load. <button type="button" className="link" onClick={() => { setPhase("loading"); setAttempt((n) => n + 1); }}>Try again</button>
        </span>
      )}
      {phase === "save-failed" && <span role="alert" className="t-tiny text-fg-3">Your vote wasn&apos;t saved. Try again.</span>}
    </span>
  );
}
