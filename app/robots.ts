import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/bots";

export default function robots(): MetadataRoute.Robots {
  // The API routes count downloads and votes; crawlers have no reason to call them.
  return { rules: { userAgent: "*", allow: "/", disallow: "/api/" }, sitemap: `${siteUrl}/sitemap.xml` };
}
