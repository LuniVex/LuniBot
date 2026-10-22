import { BotGallery } from "@/components/BotGallery";
import { Reveal } from "@/components/Motion";
import { DiscordCta, Facts, HowItWorks } from "@/components/Sections";
import { Hero } from "@/components/Hero";
import { allTags, bots } from "@/lib/bots";
import { getFile } from "@/lib/files";
import { fmtSize } from "@/lib/format";

export default function Hub() {
  const entries = bots.map((bot) => {
    const file = getFile(bot);
    return { bot, size: file ? fmtSize(file.size) : "no file" };
  });
  const zip = bots[0]?.download.file.split("/").pop() ?? "bot.zip";

  return (
    <>
      <Hero zip={zip} />
      <section id="bots" className="scroll-mt-14 px-5 pb-24 md:pb-32">
        <div className="mx-auto max-w-page">
          <Reveal className="mb-10 text-center"><h2 className="t-section">Meet the bots.</h2></Reveal>
          <BotGallery entries={entries} tags={allTags()} />
        </div>
      </section>
      <Facts count={bots.length} runtime={bots[0]?.runtime ?? "Node.js 18+"} />
      <HowItWorks zip={zip} />
      <DiscordCta />
    </>
  );
}
