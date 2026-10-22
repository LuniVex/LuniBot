import data from "@/data/bots.json";

export type BotStatus = "active" | "beta" | "archived";

/** One entry in data/bots.json. Add a bot by adding an object of this shape. */
export interface Bot {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  language: string;
  runtime: string;
  tags: string[];
  status: BotStatus;
  version: string;
  /** Logo name, drawn in components/AppIcon.tsx ("mail-bubble", "voice-notes"). Unknown names show the first letter. */
  icon: string;
  features: string[];
  commands: { name: string; description: string }[];
  requirements: string[];
  /** "none", or a sentence saying what leaves the user's machine. */
  telemetry: string;
  released: string;
  updated: string;
  license: string;
  download: {
    /** Path under public/, e.g. /downloads/my-bot/my-bot-1.0.0.zip */
    file: string;
    sourceDir: string;
    github: { repo: string; path: string; releases: string };
  };
}

export const site = data.site;
export const bots = data.bots as Bot[];

export const getBot = (slug: string) => bots.find((b) => b.slug === slug);
export const allTags = () => [...new Set(bots.flatMap((b) => b.tags))].sort();
export const sourceUrl = (b: Bot) => `https://github.com/${b.download.github.repo}/tree/main/${b.download.github.path}`;

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3001")
).replace(/\/$/, "");
