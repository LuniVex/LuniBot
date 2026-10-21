export function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[72rem] px-4 ${className}`}>{children}</div>;
}
