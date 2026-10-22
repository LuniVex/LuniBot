import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppIcon, iconColor } from "@/components/AppIcon";
import { Pill } from "@/components/Button";
import { Enter, Reveal, RevealChild, RevealGroup } from "@/components/Motion";
import { DiscordCta } from "@/components/Sections";
import { DownloadChart, StatsProvider, TotalDownloads } from "@/components/Stats";
import { GetIt } from "@/components/GetIt";
import { VoteButton } from "@/components/VoteButton";
import { bots, getBot, preview, siteUrl } from "@/lib/bots";
import { getFile } from "@/lib/files";
import { fmtDate, fmtSize } from "@/lib/format";
import { licenseInfo } from "@/lib/license";

// Only bots in data/bots.json exist; any other slug is a clean 404.
export const dynamicParams = false;
export const generateStaticParams = () => bots.map((b) => ({ slug: b.slug }));

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const bot = getBot((await params).slug);
  if (!bot) return {};
  const meta = preview(`/bots/${bot.slug}`, `${bot.name} · LuniBot`, `${bot.tagline} Free to download, ${licenseInfo(bot.license).short} licence, runs on your own machine.`);
  return { ...meta, title: bot.name, description: `${bot.tagline} ${bot.description}`.slice(0, 200) };
}

/** A centered section heading with an optional line under it. */
function Heading({ title, note }: { title: string; note?: string }) {
  return (
    <Reveal className="text-center">
      <h2 className="t-section">{title}</h2>
      {note && <p className="t-lead mx-auto mt-3 max-w-[40ch] text-fg-2">{note}</p>}
    </Reveal>
  );
}

export default async function BotPage({ params }: Props) {
  const bot = getBot((await params).slug);
  if (!bot) notFound();
  const file = getFile(bot);
  const lic = licenseInfo(bot.license);
  const color = iconColor(bot.icon);

  const jsonLd = {
    "@context": "https://schema.org", "@type": "SoftwareApplication", name: bot.name, description: bot.description,
    applicationCategory: "DeveloperApplication", operatingSystem: bot.runtime, softwareVersion: bot.version,
    datePublished: bot.released, dateModified: bot.updated, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    downloadUrl: `${siteUrl}${bot.download.file}`,
  };

  const facts: [string, React.ReactNode][] = [
    ["Version", bot.version],
    ["First release", fmtDate(bot.released)],
    ["Latest update", fmtDate(bot.updated)],
    ["Size", file ? fmtSize(file.size) : "–"],
    ["Licence", lic.short],
    ["Downloads", <TotalDownloads key="d" />],
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <StatsProvider slug={bot.slug}>
        <section className="px-5 pb-20 pt-23 text-center md:pt-27">
          <Enter className="mx-auto max-w-page text-left">
            <Link href="/" className="group inline-flex items-center gap-1 text-link">
              <svg viewBox="0 0 8 14" aria-hidden="true" className="smooth size-[0.7em] translate-y-px group-hover:-translate-x-0.5">
                <path d="M7 1 1 7l6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="group-hover:underline group-hover:underline-offset-[0.15em]">All bots</span>
            </Link>
          </Enter>
          <Enter delay={0.04} className="mt-12 flex justify-center md:mt-14"><AppIcon icon={bot.icon} name={bot.name} size="lg" /></Enter>
          <Enter delay={0.08}>
            <h1 className="t-hero mt-6">{bot.name}</h1>
            <p className="t-lead mx-auto mt-3 max-w-[30ch] text-fg-2">{bot.tagline}</p>
          </Enter>
          <Enter delay={0.14} className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Pill href={`/api/download/${bot.slug}`} download size="lg">Download v{bot.version}</Pill>
            <VoteButton slug={bot.slug} size="lg" />
          </Enter>
          <Enter delay={0.18}>
            <p className="t-small mt-4 text-fg-3"><span className="capitalize">{bot.status}</span> · {bot.language} · {bot.runtime} · {lic.short} licence</p>
          </Enter>
        </section>

        <section className="px-5">
          <Reveal className="mx-auto grid max-w-page grid-cols-2 gap-y-8 border-y border-line py-10 text-center sm:grid-cols-3 md:grid-cols-6">
            {facts.map(([k, v]) => (
              <div key={k}>
                <p className="whitespace-nowrap text-[19px] font-semibold tabular-nums md:text-[21px]">{v}</p>
                <p className="t-small mt-1 text-fg-2">{k}</p>
              </div>
            ))}
          </Reveal>
        </section>

        <section className="px-5 py-20 md:py-24">
          <Reveal className="mx-auto max-w-[720px]">
            <p className="t-lead">{bot.description}</p>
          </Reveal>
        </section>

        <section className="bg-alt px-5 py-20 md:py-28">
          <div className="mx-auto max-w-page">
            <Heading title="Features" />
            <RevealGroup className="mx-auto mt-12 grid max-w-[880px] gap-x-10 md:grid-cols-2" gap={0.05}>
              {bot.features.map((f) => (
                <RevealChild key={f} className="flex gap-3 border-t border-line py-4">
                  <svg viewBox="0 0 16 16" aria-hidden="true" className="mt-1 size-4 shrink-0" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3.5 8.5 3 3 6-7" /></svg>
                  <span>{f}</span>
                </RevealChild>
              ))}
            </RevealGroup>
          </div>
        </section>

        <section className="px-5 py-20 md:py-28">
          <div className="mx-auto max-w-page">
            <Heading title="Commands" note="Type these in Discord once the bot is in your server." />
            <Reveal className="mx-auto mt-12 max-w-[820px] overflow-hidden rounded-panel bg-tile">
              <ul className="divide-y divide-line/70">
                {bot.commands.map((c) => (
                  <li key={c.name} className="grid gap-1 px-6 py-4 md:grid-cols-2 md:gap-6">
                    <code className="break-words font-mono text-[14px]">{c.name}</code>
                    <span className="text-fg-2">{c.description}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        <section className="bg-alt px-5 py-20 md:py-28">
          <div className="mx-auto max-w-page">
            <Heading title="Download" />
            <Reveal className="mt-12"><GetIt bot={bot} file={file} /></Reveal>
          </div>
        </section>

        <section className="px-5 py-20 md:py-28">
          <div className="mx-auto max-w-page">
            <Heading title="Download stats" note="Counted on our server, once per visitor per hour." />
            <Reveal className="mt-12 rounded-tile bg-tile p-8 md:p-12"><DownloadChart /></Reveal>
          </div>
        </section>

        <section className="px-5 pb-24 md:pb-28">
          <div className="mx-auto max-w-page">
            <Heading title="Before you start" />
            <RevealGroup className="mx-auto mt-12 grid max-w-[820px] gap-5 md:grid-cols-2">
              <RevealChild className="rounded-tile bg-tile p-8">
                <h3 className="text-[21px] font-semibold">You&apos;ll need</h3>
                <ul className="mt-4 flex flex-col gap-3 text-fg-2">{bot.requirements.map((r) => <li key={r}>{r}</li>)}</ul>
              </RevealChild>
              <RevealChild className="rounded-tile bg-tile p-8">
                <h3 className="text-[21px] font-semibold">Good to know</h3>
                <dl className="mt-4 flex flex-col gap-3">
                  <div><dt className="t-small text-fg-3">Data it sends</dt><dd className="text-fg-2">{bot.telemetry === "none" ? "Nothing beyond Discord itself." : bot.telemetry}</dd></div>
                  <div><dt className="t-small text-fg-3">Licence</dt><dd className="text-fg-2">{lic.url ? <a href={lic.url} target="_blank" rel="noopener noreferrer" className="link">{lic.name}</a> : lic.name}. {lic.summary} The full text is in the LICENSE file inside the zip.</dd></div>
                  <div><dt className="t-small text-fg-3">Changelog</dt><dd className="text-fg-2">None published yet. Release notes will go on <a href={bot.download.github.releases} target="_blank" rel="noopener noreferrer" className="link">GitHub</a>.</dd></div>
                </dl>
              </RevealChild>
            </RevealGroup>
          </div>
        </section>

        <DiscordCta />
      </StatsProvider>
    </>
  );
}
