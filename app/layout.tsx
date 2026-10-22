import "@fontsource-variable/inter/wght.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MotionProvider } from "@/components/Motion";
import { ThemeProvider } from "@/components/Theme";
import { site, siteUrl } from "@/lib/bots";

const description = "Discord bots you download and run yourself. Free, no account, source code included.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${site.name}: Discord bots you run yourself`, template: `%s · ${site.name}` },
  description,
  openGraph: { type: "website", siteName: site.name, title: site.name, description },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <MotionProvider>
            <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-blue focus:px-4 focus:py-2 focus:text-white">Skip to content</a>
            <Header />
            <main id="main">{children}</main>
            <Footer />
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
