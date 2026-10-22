import { ogImage, ogSize } from "@/lib/og";

export const alt = "LuniBots: Discord bots you run yourself";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogImage({ title: "Discord bots you run yourself.", line: "Download a bot, add your bot token, and start it on your own computer or server." });
}
