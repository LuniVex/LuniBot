/** Monogram in place of an icon: no emoji (A8), no decoration. */
export function BotMark({ name, size = "sm" }: { name: string; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "size-16 text-3xl" : "size-8 text-xl";
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center border border-ink font-display font-semibold ${cls}`}>
      {name.charAt(0)}
    </span>
  );
}
