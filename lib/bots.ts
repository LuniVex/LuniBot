import data from "@/data/bots.json";

export type BotStatus = "active" | "beta" | "archived";

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
  icon: string;
  features: string[];
  commands: { name: string; description: string }[];
  requirements: string[];
  telemetry: string;
  released: string;
  updated: string;
  license: string;
  download: {
    file: string;
    sourceDir: string;
    github: { repo: string; path: string; releases: string };
  };
}

export const site = data.site;
export const bots = data.bots as Bot[];

export const githubSourceUrl = (b: Bot) =>
  `https://github.com/${b.download.github.repo}/tree/main/${b.download.github.path}`;

export const getBot = (slug: string) => bots.find((b) => b.slug === slug);
export const allTags = () => [...new Set(bots.flatMap((b) => b.tags))].sort();

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/$/, "");
