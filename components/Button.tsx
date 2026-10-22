import Link from "next/link";

type Variant = "solid" | "outline";
const styles: Record<Variant, string> = {
  solid: "bg-ink text-paper border-ink hover:bg-accent hover:border-accent hover:text-paper",
  outline: "bg-transparent text-ink border-ink hover:text-accent hover:border-accent",
};
const base = "t-fast inline-flex items-center justify-center gap-2 rounded-sm border px-4 py-2 text-base font-semibold no-underline active:translate-y-px";

/** Flat: solid fill or 1px outline, colour change on hover, no lift, no shadow (A1, A16). */
export function Button({ href, variant = "solid", download, external, className = "", children }: {
  href: string; variant?: Variant; download?: boolean; external?: boolean; className?: string; children: React.ReactNode;
}) {
  const cls = `${base} ${styles[variant]} ${className}`;
  if (download) return <a href={href} download="" className={cls}>{children}</a>;
  if (external || /^https?:/.test(href)) return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{children}</a>;
  return <Link href={href} className={cls}>{children}</Link>;
}
