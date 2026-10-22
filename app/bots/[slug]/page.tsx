import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotMark } from "@/components/BotMark";
import { BotStats } from "@/components/BotStats";
import { Container } from "@/components/Container";
import { DiscordCta } from "@/components/DiscordCta";
import { DownloadPanel } from "@/components/DownloadPanel";
import { Item, Stagger } from "@/components/Motion";
import { StatsProvider } from "@/components/StatsContext";
import { StatusBadge } from "@/components/StatusBadge";
import { TagList } from "@/components/TagList";
import { DownloadsCell } from "@/components/DownloadsCell";
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

/** A heading that opens a block of the reading column on a hairline (L4). */
function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 border-t border-rule pt-6 first:mt-0">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      {note && <p className="mt-1 text-sm text-muted">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
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

  const meta: [string, React.ReactNode][] = [
    ["Version", <span key="v">{bot.version}</span>],
    ["Status", <StatusBadge key="s" status={bot.status} />],
    ["First release", <span key="r">{fmtDate(bot.released)}</span>],
    ["Latest update", <span key="u">{fmtDate(bot.updated)}</span>],
    ["Downloads", <DownloadsCell key="d" />],
  ];

  return (
    <StatsProvider slug={bot.slug}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />

      <Container className="pt-6"><Link href="/" className="text-sm">← All bots</Link></Container>

      <header className="pb-8 pt-8 md:pb-12">
        <Container>
          <Stagger gap={0.08}>
            <Item><BotMark name={bot.name} size="lg" /></Item>
            <Item><h1 className="mt-6 font-display text-5xl font-normal md:text-6xl">{bot.name}</h1></Item>
            <Item><p className="mt-4 max-w-measure text-xl">{bot.tagline}</p></Item>
          </Stagger>
        </Container>
      </header>

      <div className="border-y border-rule">
        <Container>
          <dl className="grid grid-cols-2 md:grid-cols-5">
            {meta.map(([k, v], i) => (
              <div key={k} className={`py-4 ${i > 0 ? "md:border-l md:border-rule md:pl-4" : ""} ${i % 2 === 1 ? "max-md:border-l max-md:border-rule max-md:pl-4" : ""}`}>
                <dt className="text-sm text-muted">{k}</dt>
                <dd className="font-mono text-base tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </div>

      <Container className="grid gap-x-6 gap-y-12 py-12 md:grid-cols-12 md:py-16">
        <aside className="max-md:order-first md:col-span-4 md:col-start-9 md:row-start-1">
          <div className="md:sticky md:top-16"><DownloadPanel bot={bot} file={file} /></div>
        </aside>

        <div className="min-w-0 md:col-span-7 md:col-start-1 md:row-start-1">
          <Block title="What it does">
            <p className="max-w-measure">{bot.description}</p>
            <p className="mt-4 font-mono text-xs text-muted">{bot.language} · {bot.runtime}</p>
            <TagList tags={bot.tags} className="mt-1" />
          </Block>

          <Block title="Features">
            <ul className="max-w-measure">
              {bot.features.map((f) => <li key={f} className="border-t border-rule py-3">{f}</li>)}
            </ul>
          </Block>

          <Block title="Commands" note="Slash commands, as registered with Discord.">
            <table className="w-full border-collapse text-left max-md:block">
              <thead className="max-md:sr-only"><tr><th className="border-b border-ink py-2 pr-4 text-sm font-semibold text-muted">Command</th><th className="border-b border-ink py-2 text-sm font-semibold text-muted">What it does</th></tr></thead>
              <tbody className="max-md:block">
                {bot.commands.map((c) => (
                  <tr key={c.name} className="max-md:block max-md:border-b max-md:border-rule max-md:py-3">
                    <td className="py-3 pr-4 align-baseline font-mono text-sm [overflow-wrap:anywhere] max-md:block max-md:py-0 md:border-b md:border-rule">{c.name}</td>
                    <td className="py-3 align-baseline max-md:block max-md:py-0 md:border-b md:border-rule">{c.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Block>

          <Block title="Downloads" note="Counted on this server, once per visitor per hour.">
            <BotStats />
          </Block>

          <Block title="Before you run it">
            <ul className="max-w-measure">
              {bot.requirements.map((r) => <li key={r} className="border-t border-rule py-2">{r}</li>)}
            </ul>
            <dl className="mt-6 grid max-w-measure gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
              <dt className="font-semibold">Data it sends</dt>
              <dd>{bot.telemetry === "none" ? "None. The bot talks to Discord and nothing else." : bot.telemetry}</dd>
              <dt className="font-semibold">Licence</dt>
              <dd>{bot.license}</dd>
              <dt className="font-semibold">Changelog</dt>
              <dd>None published yet. Notes will appear in the <a href={bot.download.github.releases} target="_blank" rel="noopener noreferrer">GitHub releases</a>.</dd>
            </dl>
          </Block>
        </div>
      </Container>

      <Container className="pb-16"><DiscordCta url={site.discord} /></Container>
    </StatsProvider>
  );
}
