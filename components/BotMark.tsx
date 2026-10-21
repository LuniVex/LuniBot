/** Monogram in place of an icon: no emoji (A8), no decoration. */
export function BotMark({ name, size = "sm" }: { name: string; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "size-16 text-3xl" : "size-8 text-base";
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-sm border border-ink font-mono font-bold ${cls}`}>
      {name.charAt(0)}
    </span>
  );
}
