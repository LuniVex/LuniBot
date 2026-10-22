import { ImageResponse } from "next/og";
import { iconColor, iconGlyph } from "@/components/AppIcon";

export const ogSize = { width: 1200, height: 630 };

/** Link-preview image: the site's dark look, with the bot's logo when there is one. */
export function ogImage({ title, line, icon }: { title: string; line: string; icon?: string }) {
  const glyph = icon ? iconGlyph(icon) : null;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 96px", background: "#000", color: "#f5f5f7", fontFamily: "sans-serif" }}>
        {glyph && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 132, height: 132, borderRadius: 30, background: iconColor(icon!), marginBottom: 44 }}>
            <svg width="88" height="88" viewBox="0 0 24 24" fill="none">{glyph}</svg>
          </div>
        )}
        <div style={{ display: "flex", fontSize: 92, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.05 }}>{title}</div>
        <div style={{ display: "flex", marginTop: 22, fontSize: 38, color: "#a1a1a6", maxWidth: 940, lineHeight: 1.3 }}>{line}</div>
        <div style={{ display: "flex", marginTop: 48, fontSize: 26, color: "#86868b" }}>LuniBot · Free · GPL-3.0 · Runs on your own machine</div>
      </div>
    ),
    ogSize,
  );
}
