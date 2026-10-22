import Link from "next/link";
import { AppIcon } from "@/components/AppIcon";
import { Pill } from "@/components/Button";
import { bots } from "@/lib/bots";

export default function NotFound() {
  return (
    <section className="relative isolate px-5 pb-24 pt-37 text-center md:pb-32 md:pt-45">
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-alt/70 to-bg" />
      <p className="t-eyebrow text-fg-2">Error 404</p>
      <h1 className="t-hero mx-auto mt-3 max-w-[16ch]">This page can&apos;t be found.</h1>
      <p className="t-lead mx-auto mt-5 max-w-[34ch] text-fg-2">The link may be old, or the bot may have been renamed. Try one of these.</p>
      <ul className="mx-auto mt-12 grid max-w-[640px] gap-4 sm:grid-cols-2">
        {bots.map((b) => (
          <li key={b.slug}>
            <Link href={`/bots/${b.slug}`} className="smooth flex items-center gap-4 rounded-panel bg-tile p-4 text-left hover:bg-line/40">
              <AppIcon icon={b.icon} name={b.name} size="sm" />
              <span><span className="block font-semibold">{b.name}</span><span className="t-small text-fg-2">{b.tagline}</span></span>
            </Link>
          </li>
        ))}
      </ul>
      <Pill href="/" size="lg" className="mt-12">Back to all bots</Pill>
    </section>
  );
}
