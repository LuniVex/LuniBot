/** Tags as quiet metadata: one muted mono line separated by slashes, no boxes (D4, A13). */
export function TagList({ tags, className = "" }: { tags: string[]; className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-2 font-mono text-xs text-muted ${className}`}>
      {tags.map((t, i) => (
        <li key={t}>{t}{i < tags.length - 1 && <span aria-hidden="true" className="pl-2">/</span>}</li>
      ))}
    </ul>
  );
}
