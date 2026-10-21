import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MotionProvider } from "@/components/Motion";
import { ThemeProvider } from "@/components/ThemeToggle";
import { site, siteUrl } from "@/lib/bots";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${site.name}: ${site.tagline}`, template: `%s · ${site.name}` },
  description: "Free, open-source Discord bots you host yourself. Download the source straight from this site.",
  openGraph: { type: "website", siteName: site.name, title: site.name, description: site.tagline },
  twitter: { card: "summary_large_image" },
};
export const viewport: Viewport = { themeColor: "#f7f3ea" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh">
        <ThemeProvider>
          <MotionProvider>
            <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">Skip to content</a>
            <Header />
            <main id="main">{children}</main>
            <Footer />
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
