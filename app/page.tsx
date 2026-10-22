import { BotGrid } from "@/components/BotGrid";
import { Container } from "@/components/Container";
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
  const runtimes = [...new Set(bots.map((b) => b.runtime))].join(", ");
  return (
    <>
      <Hero count={bots.length} runtimes={runtimes} zip={bots[0].download.file.split("/").pop()!} />
      <section id="bots" aria-labelledby="bots-h" className="scroll-mt-16 border-b border-rule py-12 md:py-16">
        <Container><BotGrid items={items} tags={allTags()} /></Container>
      </section>
      <Section label="Feature requests" aside="Tell us what to build next.">
        <DiscordCta url={site.discord} />
      </Section>
    </>
  );
}
