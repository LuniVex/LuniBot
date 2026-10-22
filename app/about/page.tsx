import type { Metadata } from "next";
import { Enter, Reveal } from "@/components/Motion";
import { DiscordCta } from "@/components/Sections";
import { bots, preview, site } from "@/lib/bots";
import { licenseInfo } from "@/lib/license";

export const metadata: Metadata = preview(
  "/about",
  "About, safety and licensing",
  "What LuniBot is, what the site counts, how to check a download, and the licence of each bot.",
);

const code = "rounded-md bg-tile px-1.5 py-0.5 font-mono text-[0.85em]";

function Part({ id, title, children, alt = false }: { id: string; title: string; children: React.ReactNode; alt?: boolean }) {
  return (
    <section id={id} className={`scroll-mt-14 px-5 py-24 md:py-28 ${alt ? "bg-alt" : ""}`}>
      <div className="mx-auto max-w-[720px]">
        <Reveal><h2 className="t-section">{title}</h2></Reveal>
        <Reveal delay={0.08} className="mt-8 flex flex-col gap-5 text-[19px] leading-relaxed text-fg-2">{children}</Reveal>
      </div>
    </section>
  );
}

export default function About() {
  const external = bots.filter((b) => b.telemetry !== "none");
  return (
    <>
      <section className="px-5 pb-8 pt-33 text-center md:pt-41">
        <Enter><h1 className="t-hero mx-auto max-w-[16ch]">About LuniBot</h1></Enter>
        <Enter delay={0.08}><p className="t-lead mx-auto mt-5 max-w-[40ch] text-fg-2">What the site is, what it counts, how to check a download, and how the bots are licensed.</p></Enter>
      </section>

      <Part id="what" title="What this is">
        <p><span className="text-fg">{site.name} is a small collection of Discord bots written and kept up by {site.owner}.</span> Each one is a Node.js program that you run yourself.</p>
        <p>You download a bot&apos;s source code from its page, run it on your own computer or server, and invite it to your Discord. Nothing runs on our machines for you, so there&apos;s nothing to sign up for and nothing to cancel. The bots are free.</p>
        <p>If a bot relies on an outside service, its page says so, and that service bills you directly.</p>
      </Part>

      <Part id="counting" title="What the site counts" alt>
        <p><span className="text-fg">Two numbers per bot: downloads and upvotes.</span> They&apos;re stored on our server so everyone sees the same totals.</p>
        <p>To stop one browser counting twice, the site sets a single cookie, <code className={code}>lb_vid</code>, holding a random ID. It has no name or email in it, scripts on the page can&apos;t read it, and it isn&apos;t shared with anyone. A download counts at most once an hour per browser.</p>
        <p>Your light or dark choice is kept in your browser. There&apos;s no other analytics, advertising or tracking.</p>
      </Part>

      <Part id="checking" title="Checking a download">
        <p><span className="text-fg">Every download is a zip of source code, served from this site.</span> No installers, no compiled programs, and no <code className={code}>.env</code> secrets.</p>
        <p>Each bot page shows the file&apos;s SHA-256 checksum and a button that copies a command to check it. By hand, run <code className={code}>shasum -a 256</code> on the zip and compare the result with the page. If they differ, don&apos;t run it, and let us know in the Discord.</p>
        <p>Read the code before you run it. Your Discord bot token gives full control of the bot, so keep it in <code className={code}>.env</code> and never share it.</p>
        {external.map((b) => <p key={b.slug}><span className="text-fg">{b.name}</span> sends data to an outside service. {b.telemetry}</p>)}
      </Part>

      <Part id="licensing" title="Licensing" alt>
        <p><span className="text-fg">Every bot is released under the GNU General Public License, version 3.</span> Each download includes the full licence text in a <code className={code}>LICENSE</code> file.</p>
        <div className="overflow-hidden rounded-panel bg-tile-alt">
          <dl className="divide-y divide-line/70">
            {bots.map((b) => {
              const lic = licenseInfo(b.license);
              return (
                <div key={b.slug} className="grid gap-1 px-6 py-4 sm:grid-cols-[10rem_1fr]">
                  <dt className="font-semibold text-fg">{b.name}</dt>
                  <dd className="text-[17px]">{lic.url ? <a href={lic.url} target="_blank" rel="noopener noreferrer" className="link">{lic.name}</a> : lic.name}</dd>
                </div>
              );
            })}
          </dl>
        </div>
        <p>In plain words: you can use the bots for anything, read and change the code, and share it. If you share a changed version, it has to stay under GPL-3.0 and you have to make its source available too. The bots come with no warranty.</p>
      </Part>

      <div className="pt-24 md:pt-32"><DiscordCta /></div>
    </>
  );
}
