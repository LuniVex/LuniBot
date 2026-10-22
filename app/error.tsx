"use client";
import Link from "next/link";
import { useEffect } from "react";
import { pill } from "@/components/Button";

/** Shown if a page fails to render. Offers a retry and a way back to the bots. */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <section className="px-5 pb-24 pt-37 text-center md:pb-32 md:pt-45">
      <h1 className="t-hero mx-auto max-w-[16ch]">Something went wrong.</h1>
      <p className="t-lead mx-auto mt-5 max-w-[36ch] text-fg-2">This page didn&apos;t load properly. Trying again usually fixes it. If it keeps happening, tell us in the Discord.</p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={() => retry()} className={pill("primary", "lg")}>Try again</button>
        <Link href="/" className={pill("secondary", "lg")}>Back to all bots</Link>
      </div>
    </section>
  );
}
