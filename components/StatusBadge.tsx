import type { BotStatus } from "@/lib/bots";

/** Plain text label, not a pill; accent marks the one state needing attention (D4, A10). */
const tone: Record<BotStatus, string> = { active: "text-ink", beta: "text-accent", archived: "text-muted" };

export function StatusBadge({ status }: { status: BotStatus }) {
  return <span className={`font-mono text-sm ${tone[status]}`}><span className="sr-only">Status: </span>{status}</span>;
}
