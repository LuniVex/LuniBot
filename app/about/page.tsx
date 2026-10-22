import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { bots, site } from "@/lib/bots";

export const metadata: Metadata = {
  title: "About, safety and licensing",
  description: "What LuniBots is, what the site counts, how to check a download, and what licence each bot has.",
  alternates: { canonical: "/about" },
};

const mono = "font-mono text-sm";

function Part({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-16 border-t border-rule py-12 first:border-t-0 md:py-16">
      <Container className="grid gap-x-6 gap-y-4 md:grid-cols-12">
        <h2 id={`${id}-h`} className="font-display text-2xl font-semibold md:col-span-3">{title}</h2>
        <div className="min-w-0 space-y-4 md:col-span-7">{children}</div>
      </Container>
    </section>
  );
}

export default function About() {
  const external = bots.filter((b) => b.telemetry !== "none");
  return (
    <>
      <header className="pb-4 pt-12 md:pt-16">
        <Container className="grid gap-x-6 md:grid-cols-12">
          <h1 className="max-w-title font-display text-5xl font-normal md:col-span-9 md:text-6xl">What this site is, and what it isn&apos;t.</h1>
        </Container>
      </header>

      <Part id="about" title="The short version">
        <p className="text-xl">{site.name} is a small catalogue of Discord bots written and kept up by {site.owner}. Each one is a Node.js program. You download the source, run it on your own computer or server, and add it to your own Discord server.</p>
        <p>Nothing here runs on our machines on your behalf, which is why there is no sign-up and nothing to cancel. The bots are free. If one needs an outside service, it says so on its page, and that service bills you directly.</p>
      </Part>

      <Part id="data" title="What the site counts">
        <p>We count two things per bot: how many times it has been downloaded and how many people have upvoted it. To stop one browser from counting twice, the site sets a single cookie called <span className={mono}>lb_vid</span> that holds a random ID. It has no name or email in it, it can&apos;t be read by scripts on the page, and it isn&apos;t shared with anyone.</p>
        <p>Your choice of light or dark theme is kept in your browser&apos;s local storage. There is no other analytics, advertising or tracking on the site.</p>
      </Part>

      <Part id="checking" title="Checking a download">
        <p>Downloads are zip files built from the same source you can read on GitHub, and this site serves them directly. They hold code only: no binaries, no installers, and no <span className={mono}>.env</span> secrets.</p>
        <p>Every bot page shows the file&apos;s SHA-256 checksum next to a button that copies the command to verify it. By hand, run <span className={mono}>shasum -a 256 file.zip</span> and compare the result with the value on the page. If they differ, don&apos;t run it.</p>
        <p>Read the code before you run it. A Discord bot token gives full control of the bot, so keep it in <span className={mono}>.env</span> and never share it.{external.length > 0 && <> {external.map((b) => `${b.name}: ${b.telemetry}`).join(" ")}</>}</p>
      </Part>

      <Part id="licensing" title="Licensing">
        <table className="w-full border-collapse text-left">
          <thead><tr><th className="border-b border-ink py-2 pr-4 text-sm font-semibold text-muted">Bot</th><th className="border-b border-ink py-2 text-sm font-semibold text-muted">Licence status</th></tr></thead>
          <tbody>
            {bots.map((b) => (
              <tr key={b.slug}><td className="border-b border-rule py-3 pr-4 align-baseline font-display text-xl font-semibold">{b.name}</td><td className="border-b border-rule py-3 align-baseline">{b.license}</td></tr>
            ))}
          </tbody>
        </table>
        <p>Where there is no licence file, copyright law&apos;s default applies: you may run the software, but you may not redistribute or modify it without the author&apos;s permission. If you want more than that, ask.</p>
      </Part>
    </>
  );
}
