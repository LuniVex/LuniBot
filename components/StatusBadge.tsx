import type { BotStatus } from "@/lib/bots";

/** Quiet metadata: a plain word in muted mono, not a pill (D4, A10). */
export function StatusBadge({ status }: { status: BotStatus }) {
  return <span className="font-mono text-xs text-muted"><span className="sr-only">Status: </span>{status}</span>;
}
