import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };

/** Flat paper/ink card, matching the site tokens: no gradient, no shadow. */
export function ogImage(title: string, subtitle: string, eyebrow: string) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72,
        background: "#f7f3ea", color: "#1a1814", fontFamily: "serif", border: "2px solid #1a1814" }}>
        <div style={{ display: "flex", fontSize: 28, color: "#a3341d", fontFamily: "monospace" }}>{eyebrow}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 104, fontWeight: 700, lineHeight: 1.1 }}>{title}</div>
          <div style={{ marginTop: 24, fontSize: 38, maxWidth: 940 }}>{subtitle}</div>
        </div>
        <div style={{ display: "flex", fontSize: 26, fontFamily: "monospace" }}>Free · Open source · Download the source</div>
      </div>
    ),
    ogSize,
  );
}
