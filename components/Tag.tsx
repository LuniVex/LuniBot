export function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-sm border border-rule px-2 font-mono text-xs text-muted">{children}</span>;
}
