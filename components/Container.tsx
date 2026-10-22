/** One max width and one 16px gutter (L1, L8). */
export function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-page px-4 ${className}`}>{children}</div>;
}
