import { site } from "@/lib/bots";
import { Pill } from "./Button";
import { Reveal } from "./Motion";

/** The feature-request section, on the hub and every bot page. */
export function DiscordCta() {
  return (
    <section className="border-t border-line px-5 py-24 md:py-28">
      <Reveal className="mx-auto max-w-page text-center">
        <h2 className="t-section">Want features added?</h2>
        <p className="t-lead mx-auto mt-4 max-w-[38ch] text-fg-2">Join the Discord and tell us what you&apos;d like a bot to do. It&apos;s also where to report bugs or ask for help setting one up.</p>
        <Pill href={site.discord} external size="lg" className="mt-8">Join the Discord</Pill>
      </Reveal>
    </section>
  );
}
