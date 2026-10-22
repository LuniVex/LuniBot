/**
 * App-style icon for each bot: a rounded square in the bot's colour with its logo drawn in white.
 * Logos are solid shapes drawn on a 24-unit grid, so they stay crisp and readable at every size.
 * Driven by the `icon` field in bots.json; unknown names fall back to the bot's first letter.
 */
const icons: Record<string, { color: string; glyph: (tile: string) => React.ReactNode }> = {
  // Modmail: a chat bubble with an envelope fold cut into it (Discord DMs that become support mail).
  "mail-bubble": {
    color: "#1f6feb",
    glyph: (tile) => (
      <>
        <path fill="currentColor" d="M6.5 4.5h11a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-6.2l-4.1 3.1c-.5.4-1.2 0-1.2-.6v-2.5h.5a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3z" />
        <path d="m7.2 8.6 4.8 3.6 4.8-3.6" stroke={tile} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    ),
  },
  // DiscMeet: voice bars turning into lines of text (a recorded meeting becoming notes).
  "voice-notes": {
    color: "#e8590c",
    glyph: () => (
      <>
        <g fill="currentColor">
          <rect x="3.4" y="9.25" width="2.1" height="5.5" rx="1.05" />
          <rect x="6.7" y="6" width="2.1" height="12" rx="1.05" />
          <rect x="10" y="8" width="2.1" height="8" rx="1.05" />
        </g>
        <path d="M15.2 8.2h5.4M15.2 12h5.4M15.2 15.8h3.4" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      </>
    ),
  },
};

/** The bot's colour, for accents that should match its icon. */
export const iconColor = (icon: string) => icons[icon]?.color ?? "#6e6e73";

/** The logo's SVG contents (24×24 viewBox), or null for an unknown icon. Also used by the link-preview images. */
export const iconGlyph = (icon: string) => icons[icon]?.glyph(iconColor(icon)) ?? null;

const sizes = { sm: "size-12 rounded-[11px]", md: "size-18 rounded-[16px]", lg: "size-28 rounded-[25px]" } as const;
const glyphs = { sm: "size-8", md: "size-12", lg: "size-19" } as const;

export function AppIcon({ icon, name, size = "md" }: { icon: string; name: string; size?: keyof typeof sizes }) {
  const def = icons[icon];
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center text-white ring-1 ring-inset ring-black/10 ${sizes[size]}`}
      style={{ background: iconColor(icon) }}>
      {def ? (
        <svg viewBox="0 0 24 24" fill="none" className={glyphs[size]}>{iconGlyph(icon)}</svg>
      ) : (
        <span className="text-2xl font-semibold">{name.charAt(0)}</span>
      )}
    </span>
  );
}
