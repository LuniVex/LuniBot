import { site } from "@/lib/bots";
import { ogImage, ogSize } from "@/lib/og";

export const alt = site.name;
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogImage(site.name, site.tagline, "discord bots");
}
