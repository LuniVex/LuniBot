import { BotGrid } from "@/components/BotGrid";
import { DiscordCta } from "@/components/DiscordCta";
import { Hero } from "@/components/Hero";
import { Section } from "@/components/Section";
import { allTags, bots, site } from "@/lib/bots";
import { getDownload } from "@/lib/downloads";
import { fmtSize } from "@/lib/format";

export default function Home() {
  const items = bots.map((bot) => {
    const f = getDownload(bot);
    return { bot, size: f ? fmtSize(f.size) : "n/a" };
  });
  return (
    <>
      <Hero count={bots.length} sample={{ zip: bots[0].download.file.split("/").pop()! }} />
      <Section id="bots" label="Bots" aside={`${bots.length} listed. Each has its own page and download.`}>
        <BotGrid items={items} tags={allTags()} />
      </Section>
      <Section label="Feature requests" aside="Tell us what to build next.">
        <DiscordCta url={site.discord} />
      </Section>
    </>
  );
}
