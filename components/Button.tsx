import Link from "next/link";

type Kind = "primary" | "secondary" | "inverse";
const kinds: Record<Kind, string> = {
  primary: "bg-blue text-white hover:bg-blue-hover",
  secondary: "border border-blue text-link hover:bg-blue hover:text-white",
  inverse: "bg-bg text-fg hover:opacity-90",
};

export const pill = (kind: Kind = "primary", size: "md" | "lg" = "md", extra = "") =>
  `smooth inline-flex items-center justify-center gap-2 rounded-full font-normal active:scale-[0.97] ${
    size === "lg" ? "min-h-12 px-6 text-[17px]" : "min-h-9 px-4 text-[15px]"
  } ${kinds[kind]} ${extra}`;

/** Rounded pill buttons, filled blue for the main action. */
export function Pill({ href, kind = "primary", size = "md", download, external, className = "", children }: {
  href: string; kind?: Kind; size?: "md" | "lg"; download?: boolean; external?: boolean; className?: string; children: React.ReactNode;
}) {
  const cls = pill(kind, size, className);
  if (download) return <a href={href} download="" className={cls}>{children}</a>;
  if (external) return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{children}</a>;
  return <Link href={href} className={cls}>{children}</Link>;
}

/** Text link with a chevron that slides on hover, e.g. "Learn more ›". */
export function More({ href, external, children, className = "" }: { href: string; external?: boolean; children: React.ReactNode; className?: string }) {
  const inner = (
    <>
      <span className="group-hover:underline group-hover:underline-offset-[0.15em]">{children}</span>
      <svg viewBox="0 0 8 14" aria-hidden="true" className="smooth size-[0.7em] translate-y-px group-hover:translate-x-0.5">
        <path d="M1 1l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </>
  );
  const cls = `group inline-flex items-center gap-1 text-link ${className}`;
  if (external) return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>;
  return <Link href={href} className={cls}>{inner}</Link>;
}
