"use client";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetchJson";

export interface Votes { count: number; voted: boolean }

type Phase = "loading" | "ready" | "busy" | "load-error" | "vote-error";

/**
 * Server-backed upvote. One vote per visitor cookie; clicking again removes it.
 * If the API is down the control never goes blank: it stays visible and disabled with a Retry link,
 * and a failed vote rolls back to the last count the server confirmed.
 */
export function VoteButton({ slug, initial }: { slug: string; initial?: Votes | null }) {
  // Precedence: the visitor's own latest action, then data passed in by the parent, then our own fetch.
  const [local, setLocal] = useState<Votes | null>(null);
  const [fetched, setFetched] = useState<Votes | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [attempt, setAttempt] = useState(0);
  const v = local ?? initial ?? fetched;

  useEffect(() => {
    if (initial) return;
    let live = true;
    fetchJson<Votes>(`/api/votes/${slug}`)
      .then((d) => { if (live) { setFetched(d); setPhase("ready"); } })
      .catch(() => { if (live) setPhase("load-error"); });
    return () => { live = false; };
  }, [slug, initial, attempt]);

  async function toggle() {
    if (!v || phase === "busy") return;
    const before = v;
    setLocal({ voted: !v.voted, count: v.count + (v.voted ? -1 : 1) }); // optimistic
    setPhase("busy");
    try {
      setLocal(await fetchJson<Votes>(`/api/votes/${slug}`, { method: "POST" }));
      setPhase("ready");
    } catch {
      setLocal(before);
      setPhase("vote-error");
    }
  }

  function retry() { setPhase("loading"); setAttempt((n) => n + 1); }

  const loadFailed = !v && phase === "load-error";
  return (
    <span className="inline-flex flex-col">
      <motion.button type="button" onClick={toggle} aria-pressed={v?.voted ?? false} disabled={!v}
        aria-busy={!v && !loadFailed} whileTap={{ scale: 0.96 }} whileHover={{ y: -1 }}
        className={`inline-flex items-center gap-2 rounded-sm border px-4 py-2 text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${v?.voted ? "border-accent text-accent" : "border-ink text-ink enabled:hover:border-accent enabled:hover:text-accent"}`}>
        <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3">
          <path d="M6 1.5 11 10H1z" fill={v?.voted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
        </svg>
        <span>{v?.voted ? "Upvoted" : "Upvote"}</span>
        <span className="font-mono text-sm tnum" aria-label={v ? `${v.count} votes` : "votes unavailable"}>{v ? v.count : "–"}</span>
      </motion.button>
      {loadFailed && (
        <span role="status" className="mt-1 text-xs text-muted">
          Votes are unavailable right now.{" "}
          <button type="button" onClick={retry} className="underline hover:text-accent">Retry</button>
        </span>
      )}
      {phase === "vote-error" && (
        <span role="alert" className="mt-1 text-xs text-accent">
          Couldn&apos;t save your vote, so the count was restored. Click Upvote to try again.
        </span>
      )}
    </span>
  );
}
