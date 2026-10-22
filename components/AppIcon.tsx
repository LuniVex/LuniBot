/**
 * App-style icon for each bot: a rounded square in the bot's colour with its logo drawn in white.
 * The logo is public/icons/<icon>.png, a white line drawing on transparency, used as a mask so it stays crisp.
 * Driven by the `icon` field in bots.json; unknown names fall back to the bot's first letter on graphite.
 */
const icons: Record<string, { from: string; to: string }> = {
  "shield-chat": { from: "#5ab6ff", to: "#0a66ff" },
  notebook: { from: "#ff8a65", to: "#ff2d55" },
};

/** The two colours of a bot's icon, for glows and accents that match it. */
export const iconTint = (icon: string): [string, string] => (icons[icon] ? [icons[icon].from, icons[icon].to] : ["#8e8e93", "#3a3a3c"]);

const sizes = { sm: "size-12 rounded-[11px]", md: "size-18 rounded-[16px]", lg: "size-28 rounded-[26px]" } as const;
const marks = { sm: "size-8", md: "size-12", lg: "size-[4.75rem]" } as const;

export function AppIcon({ icon, name, size = "md" }: { icon: string; name: string; size?: keyof typeof sizes }) {
  const [from, to] = iconTint(icon);
  const known = icon in icons;
  const mask = `url(/icons/${icon}.png) center / contain no-repeat`;
  return (
    <span aria-hidden="true"
      className={`relative grid shrink-0 place-items-center overflow-hidden shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)] ${sizes[size]}`}
      style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}>
      <span className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
      {known ? (
        <span className={`relative bg-white ${marks[size]}`} style={{ mask, WebkitMask: mask }} />
      ) : (
        <span className="relative text-2xl font-semibold text-white">{name.charAt(0)}</span>
      )}
    </span>
  );
}
