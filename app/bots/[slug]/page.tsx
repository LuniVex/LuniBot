import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotStats } from "@/components/BotStats";
import { BotMark } from "@/components/BotMark";
import { DiscordCta } from "@/components/DiscordCta";
import { DownloadPanel } from "@/components/DownloadPanel";
import { Item, Stagger } from "@/components/Motion";
import { Section } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import { Tag } from "@/components/Tag";
import { VoteButton } from "@/components/VoteButton";
import { bots, getBot, site, siteUrl } from "@/lib/bots";
import { getDownload } from "@/lib/downloads";
import { fmtDate } from "@/lib/format";

export const dynamicParams = false;
export const generateStaticParams = () => bots.map((b) => ({ slug: b.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const bot = getBot((await params).slug);
  if (!bot) return {};
  return {
    title: bot.name,
    description: `${bot.tagline} ${bot.description}`.slice(0, 200),
    alternates: { canonical: `/bots/${bot.slug}` },
    openGraph: { title: bot.name, description: bot.tagline, url: `/bots/${bot.slug}` },
  };
}

export default async function BotPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const bot = getBot(slug);
  if (!bot) {
    console.warn(`[bots/[slug]] no bot for slug "${slug}"; available: ${bots.map((b) => b.slug).join(", ")}`);
    notFound();
  }
  const file = getDownload(bot);

  const ld = {
    "@context": "https://schema.org", "@type": "SoftwareApplication", name: bot.name, description: bot.description,
    applicationCategory: "DeveloperApplication", operatingSystem: bot.runtime, softwareVersion: bot.version,
    datePublished: bot.released, dateModified: bot.updated, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    downloadUrl: `${siteUrl}${bot.download.file}`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <Section label={bot.name} aside={
        <>
          <BotMark name={bot.name} size="lg" />
          <p className="mt-4 font-mono">v{bot.version} · <StatusBadge status={bot.status} /></p>
          <p className="mt-1 font-mono tnum">Released {fmtDate(bot.released)}</p>
          <p className="font-mono tnum">Updated {fmtDate(bot.updated)}</p>
          <div className="mt-4 text-ink"><VoteButton slug={bot.slug} /></div>
          <p className="mt-4"><Link href="/">← All bots</Link></p>
        </>
      }>
        <h1 className="sr-only">{bot.name}</h1>
        <Stagger>
          <Item><p className="prose-measure text-xl">{bot.tagline}</p></Item>
          <Item><p className="prose-measure mt-4">{bot.description}</p></Item>
          <Item className="mt-4 flex flex-wrap gap-2"><Tag>{bot.language}</Tag><Tag>{bot.runtime}</Tag>{bot.tags.map((t) => <Tag key={t}>{t}</Tag>)}</Item>
          <Item className="mt-8"><DownloadPanel bot={bot} file={file} /></Item>
        </Stagger>
      </Section>

      <Section label="Downloads" aside="Counted on this server, once per visitor per hour.">
        <BotStats slug={bot.slug} />
      </Section>

      <Section label="Features">
        <Stagger gap={0.04}>
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {bot.features.map((f) => (
              <Item key={f}><li className="border-t border-rule py-3 text-base">{f}</li></Item>
            ))}
          </ul>
        </Stagger>
      </Section>

      <Section label="Commands" aside="Slash commands.">
        <table className="w-full border-collapse text-left max-md:block">
          <thead className="max-md:sr-only"><tr><th className="border-b border-ink py-2 pr-3 text-sm font-semibold text-muted">Command</th><th className="border-b border-ink py-2 text-sm font-semibold text-muted">What it does</th></tr></thead>
          <tbody className="max-md:block">
            {bot.commands.map((c) => (
              <tr key={c.name} className="max-md:block max-md:border-b max-md:border-rule max-md:py-3">
                <td className="py-3 pr-3 align-baseline font-mono text-sm [overflow-wrap:anywhere] max-md:block max-md:py-0 md:border-b md:border-rule">{c.name}</td>
                <td className="py-3 align-baseline max-md:block max-md:py-0 md:border-b md:border-rule">{c.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section label="Requirements" aside="What you need before running it.">
        <ul className="prose-measure list-disc pl-6">{bot.requirements.map((r) => <li key={r} className="py-1">{r}</li>)}</ul>
        <dl className="mt-8 grid max-w-3xl gap-x-6 gap-y-3 sm:grid-cols-[11rem_1fr]">
          <dt className="font-bold">Data and telemetry</dt>
          <dd>{bot.telemetry === "none" ? "None. The bot sends data only to Discord." : bot.telemetry}</dd>
          <dt className="font-bold">Licence</dt>
          <dd>{bot.license}</dd>
          <dt className="font-bold">Changelog</dt>
          <dd>None yet. <a href={bot.download.github.releases} target="_blank" rel="noopener noreferrer">Release notes on GitHub</a> will appear there once published.</dd>
        </dl>
      </Section>

      <Section label="Feature requests">
        <DiscordCta url={site.discord} />
      </Section>
    </>
  );
}
