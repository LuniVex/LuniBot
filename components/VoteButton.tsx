"use client";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export interface Votes { count: number; voted: boolean }

/** Server-backed upvote. One vote per visitor cookie; clicking again removes it. */
export function VoteButton({ slug, initial }: { slug: string; initial?: Votes | null }) {
  // Precedence: the visitor's own latest action, then data passed in by the parent, then our own fetch.
  const [local, setLocal] = useState<Votes | null>(null);
  const [fetched, setFetched] = useState<Votes | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "error" | "off">("idle");
  const v = local ?? initial ?? fetched;

  useEffect(() => {
    if (initial) return;
    let live = true;
    fetch(`/api/votes/${slug}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: Votes) => live && setFetched(d))
      .catch(() => live && setState("off"));
    return () => { live = false; };
  }, [slug, initial]);

  async function toggle() {
    if (!v || state === "busy") return;
    const before = v;
    setLocal({ voted: !v.voted, count: v.count + (v.voted ? -1 : 1) }); // optimistic
    setState("busy");
    try {
      const r = await fetch(`/api/votes/${slug}`, { method: "POST" });
      if (!r.ok) throw new Error(String(r.status));
      setLocal(await r.json());
      setState("idle");
    } catch {
      setLocal(before);
      setState("error");
    }
  }

  const unavailable = state === "off" || (!v && state !== "idle");
  return (
    <span className="inline-flex flex-col">
      <motion.button type="button" onClick={toggle} aria-pressed={v?.voted ?? false} disabled={!v || unavailable}
        whileTap={{ scale: 0.96 }} whileHover={{ y: -1 }}
        className={`inline-flex items-center gap-2 rounded-sm border px-4 py-2 text-base font-bold transition-colors disabled:opacity-50 ${v?.voted ? "border-accent text-accent" : "border-ink text-ink hover:border-accent hover:text-accent"}`}>
        <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3">
          <path d="M6 1.5 11 10H1z" fill={v?.voted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
        </svg>
        <span>{v?.voted ? "Upvoted" : "Upvote"}</span>
        <span className="font-mono text-sm tnum" aria-label={`${v?.count ?? 0} votes`}>{v ? v.count : "–"}</span>
      </motion.button>
      {state === "error" && <span role="alert" className="mt-1 text-xs text-accent">Couldn&apos;t save your vote. Try again.</span>}
      {unavailable && <span className="mt-1 text-xs text-muted">Votes unavailable right now.</span>}
    </span>
  );
}
