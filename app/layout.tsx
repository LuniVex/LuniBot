import "@fontsource-variable/inter/wght.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MotionProvider } from "@/components/Motion";
import { ThemeProvider } from "@/components/Theme";
import { preview, site, siteUrl } from "@/lib/bots";

const description = "Discord bots you download and run yourself. Free, no account, source code included.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  ...preview("/", `${site.name}: Discord bots you run yourself`, description),
  title: { default: `${site.name}: Discord bots you run yourself`, template: `%s · ${site.name}` },
};

export const viewport: Viewport = {
  // Also the colour of the stripe on Discord link embeds. Discord ignores pure #000000, so this is #010101 (looks identical).
  themeColor: "#010101",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
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
