import { ogImage, ogSize } from "@/lib/og";

export const alt = "About LuniBot: safety, what the site counts, and licensing";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogImage({ title: "About LuniBot", line: "What the site counts, how to check a download, and how the bots are licensed." });
}
