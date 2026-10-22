import { bots, getBot } from "@/lib/bots";
import { ogImage, ogSize } from "@/lib/og";

export const alt = "A LuniBot Discord bot: its logo, name and what it does";
export const size = ogSize;
export const contentType = "image/png";
export const generateStaticParams = () => bots.map((b) => ({ slug: b.slug }));

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const bot = getBot((await params).slug);
  return ogImage({ title: bot?.name ?? "LuniBot", line: bot?.tagline ?? "Discord bots you run yourself.", icon: bot?.icon });
}
