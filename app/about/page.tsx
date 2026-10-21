import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { bots } from "@/lib/bots";

export const metadata: Metadata = {
  title: "About, safety and licensing",
  description: "What LuniBots is, how downloads work and how to check them, and what licence each bot has.",
  alternates: { canonical: "/about" },
};

export default function About() {
  return (
    <>
      <Section label="About">
        <h1 className="max-w-[22ch] text-3xl font-bold md:text-4xl">What this is</h1>
        <p className="prose-measure mt-6">LuniBots is a catalogue of Discord bots written and maintained by LuniVex. Each bot is a Node.js program. You download its source, run it on your own computer or server, and add it to your own Discord server. Nothing here runs on our infrastructure on your behalf.</p>
        <p className="prose-measure mt-4">It costs nothing and needs no account. The site has no analytics and sets no tracking cookies; the only thing stored in your browser is your light or dark theme choice.</p>
      </Section>

      <Section label="Safety" aside="How to check what you downloaded.">
        <div className="prose-measure space-y-4">
          <p>Downloads are zip files built from the same source you can read on GitHub. They are served by this site, not a third party. They contain code only: no binaries, no installers, and no <span className="font-mono">.env</span> secrets.</p>
          <p>Each download shows a SHA-256 checksum. To check a file, run the command shown on the bot page, or compare the output of <span className="font-mono">shasum -a 256 file.zip</span> with the value listed.</p>
          <p>Read the code before you run it. A Discord bot token gives full control of the bot, so keep it in <span className="font-mono">.env</span> and never share it.</p>
          <p>Some bots use outside services. {bots.filter((b) => b.telemetry !== "none").map((b) => `${b.name}: ${b.telemetry}`).join(" ")} Those services bill you directly.</p>
        </div>
      </Section>

      <Section label="Licensing" aside="Check before reusing the code.">
        <table className="w-full max-w-3xl border-collapse text-left">
          <thead><tr><th className="border-b border-ink py-2 pr-3 text-sm font-semibold text-muted">Bot</th><th className="border-b border-ink py-2 text-sm font-semibold text-muted">Licence status</th></tr></thead>
          <tbody>
            {bots.map((b) => (
              <tr key={b.slug}><td className="border-b border-rule py-3 pr-3 align-baseline font-bold">{b.name}</td><td className="border-b border-rule py-3 align-baseline">{b.license}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="prose-measure mt-6">Where no licence file is present, the default under copyright law is that you may run the software but not redistribute or modify it without the author&apos;s permission. Ask the author if you need more.</p>
      </Section>
    </>
  );
}
