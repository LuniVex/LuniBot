import { Button } from "./Button";

export function DiscordCta({ url }: { url: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-sm border border-ink p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-xl font-bold">Want features added?</h3>
        <p className="prose-measure mt-1">Suggest a feature, report a bug, or ask for help running a bot in the Discord server.</p>
      </div>
      <Button href={url} external className="shrink-0">Join the Discord</Button>
    </div>
  );
}
