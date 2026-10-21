import type { MetadataRoute } from "next";
import { bots, siteUrl } from "@/lib/bots";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, priority: 1 },
    { url: `${siteUrl}/about`, priority: 0.5 },
    ...bots.map((b) => ({ url: `${siteUrl}/bots/${b.slug}`, lastModified: b.updated, priority: 0.8 })),
  ];
}
