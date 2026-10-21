import { getBot } from "@/lib/bots";
import { ogImage, ogSize } from "@/lib/og";

export const size = ogSize;
export const contentType = "image/png";
export const alt = "Bot preview";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const bot = getBot((await params).slug);
  return ogImage(bot?.name ?? "LuniBots", bot?.tagline ?? "", `Discord bot · ${bot?.language ?? ""}`);
}
