import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppIcon, iconTint } from "@/components/AppIcon";
import { Pill } from "@/components/Button";
import { Enter, Glow, Reveal, RevealChild, RevealGroup, Words } from "@/components/Motion";
import { DiscordCta } from "@/components/Sections";
import { DownloadChart, StatsProvider, TotalDownloads } from "@/components/Stats";
import { GetIt } from "@/components/GetIt";
import { VoteButton } from "@/components/VoteButton";
import { bots, getBot, siteUrl } from "@/lib/bots";
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
  return {
    title: bot.name,
    description: `${bot.tagline} ${bot.description}`.slice(0, 200),
    alternates: { canonical: `/bots/${bot.slug}` },
    openGraph: { title: `${bot.name} · LuniBots`, description: bot.tagline, url: `/bots/${bot.slug}` },
  };
}

/** A centered section heading, Apple-style: big, short, ends with a full stop. */
const Heading = ({ children }: { children: React.ReactNode }) => <Reveal className="text-center"><h2 className="t-section">{children}</h2></Reveal>;

export default async function BotPage({ params }: Props) {
  const bot = getBot((await params).slug);
  if (!bot) notFound();
  const file = getFile(bot);
  const lic = licenseInfo(bot.license);
  const tint = iconTint(bot.icon);
  const [firstSentence, ...rest] = bot.description.split(/(?<=\.)\s+/);
  // Features sit in a 3-column grid; the first tile is double width, and the last one widens to fill its row.
  const gap = (3 - ((bot.features.length + 1) % 3)) % 3;
  const featureSpan = (i: number) =>
    i === 0 ? "md:col-span-2" : i === bot.features.length - 1 && gap === 1 ? "md:col-span-2" : i === bot.features.length - 1 && gap === 2 ? "md:col-span-3" : "";

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

      <section className="relative overflow-hidden px-5 pb-20 pt-23 text-center md:pt-27">
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-alt/70 via-bg to-bg" />
        <Glow colors={iconTint(bot.icon)} strength={1.1} />
        <div className="relative">
        <Enter className="mx-auto max-w-page text-left">
          <Link href="/" className="group inline-flex items-center gap-1 text-link">
            <svg viewBox="0 0 8 14" aria-hidden="true" className="smooth size-[0.7em] translate-y-px group-hover:-translate-x-0.5">
              <path d="M7 1 1 7l6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="group-hover:underline group-hover:underline-offset-[0.15em]">All bots</span>
          </Link>
        </Enter>
        <Enter delay={0.05} className="mt-12 flex justify-center md:mt-16"><AppIcon icon={bot.icon} name={bot.name} size="lg" /></Enter>
        <Enter delay={0.12}><p className="t-eyebrow mt-8 text-fg-2"><span className="capitalize">{bot.status}</span> · {bot.language} · {bot.runtime}</p></Enter>
        <Words text={bot.name} className="t-hero mt-2" delay={0.16} />
        <Enter delay={0.24}><p className="t-lead mx-auto mt-4 max-w-[30ch] text-fg-2">{bot.tagline}</p></Enter>
        <Enter delay={0.3} className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Pill href={`/api/download/${bot.slug}`} download size="lg">Download v{bot.version}</Pill>
          <VoteButton slug={bot.slug} size="lg" />
        </Enter>
        <Enter delay={0.36}><p className="t-small mt-4 text-fg-3">Free · {lic.short} licence · {file ? `${fmtSize(file.size)} zip` : "zip"} · Source code only</p></Enter>
        </div>
      </section>

      <section className="px-5">
        <RevealGroup className="mx-auto grid max-w-page grid-cols-2 gap-y-8 border-y border-line py-10 text-center sm:grid-cols-3 md:grid-cols-6" gap={0.06}>
          {facts.map(([k, v]) => (
            <RevealChild key={k}>
              <p className="whitespace-nowrap text-[21px] font-semibold tabular-nums md:text-[24px]">{v}</p>
              <p className="t-small mt-1 text-fg-2">{k}</p>
            </RevealChild>
          ))}
        </RevealGroup>
      </section>

      <section className="px-5 py-24 md:py-32">
        <Reveal className="mx-auto max-w-[820px]">
          <p className="t-intro text-fg-2"><span className="text-fg">{firstSentence}</span> {rest.join(" ")}</p>
        </Reveal>
      </section>

      <section className="bg-alt px-5 py-24 md:py-32">
        <div className="mx-auto max-w-page">
          <Heading>What it does.</Heading>
          <RevealGroup className="mt-14 grid gap-5 md:grid-cols-3" gap={0.07}>
            {bot.features.map((f, i) => (
              <RevealChild key={f} className={`group ${featureSpan(i)}`}>
                <div className="flex h-full min-h-48 flex-col justify-between gap-8 rounded-tile bg-tile-alt p-8 ring-1 ring-transparent transition-[translate,box-shadow] duration-500 ease-[cubic-bezier(0.28,0.11,0.32,1)] group-hover:-translate-y-1 group-hover:shadow-[0_24px_60px_-30px_rgba(0,0,0,0.3)] dark:ring-white/[0.06]">
                <span aria-hidden="true" className="grid size-9 place-items-center rounded-full text-white shadow-[0_6px_16px_-6px_rgba(0,0,0,0.4)]"
                  style={{ background: `linear-gradient(160deg, ${tint[0]}, ${tint[1]})` }}>
                  <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3.5 8.5 3 3 6-7" /></svg>
                </span>
                <p className={`${i === 0 ? "text-[28px]" : "text-[21px]"} font-semibold leading-tight`}>{f}</p>
                </div>
              </RevealChild>
            ))}
          </RevealGroup>
        </div>
      </section>

      <section className="px-5 py-24 md:py-32">
        <div className="mx-auto max-w-page">
          <Heading>Commands.</Heading>
          <Reveal className="t-lead mx-auto mt-4 max-w-[36ch] text-center text-fg-2">Slash commands, typed straight into Discord.</Reveal>
          <Reveal className="mx-auto mt-12 max-w-[820px] overflow-hidden rounded-panel bg-tile">
            <ul className="divide-y divide-line/70">
              {bot.commands.map((c) => (
                <li key={c.name} className="grid gap-1 px-6 py-4 md:grid-cols-2 md:gap-6">
                  <code className="break-words font-mono text-[15px]">{c.name}</code>
                  <span className="text-fg-2">{c.description}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="bg-alt px-5 py-24 md:py-32">
        <div className="mx-auto max-w-page">
          <Heading>Get {bot.name}.</Heading>
          <Reveal className="mt-14"><GetIt bot={bot} file={file} /></Reveal>
        </div>
      </section>

      <section className="px-5 py-24 md:py-32">
        <div className="mx-auto max-w-page">
          <Heading>Downloads.</Heading>
          <Reveal className="t-lead mx-auto mt-4 max-w-[40ch] text-center text-fg-2">Counted on our server, once per visitor per hour.</Reveal>
          <Reveal className="mt-12 rounded-tile bg-tile p-8 md:p-12"><DownloadChart /></Reveal>
        </div>
      </section>

      <section className="px-5 pb-24 md:pb-32">
        <div className="mx-auto max-w-page">
          <Heading>Before you start.</Heading>
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
                <div><dt className="t-small text-fg-3">Changelog</dt><dd className="text-fg-2">None published yet. Release notes will appear on <a href={bot.download.github.releases} target="_blank" rel="noopener noreferrer" className="link">GitHub</a>.</dd></div>
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
