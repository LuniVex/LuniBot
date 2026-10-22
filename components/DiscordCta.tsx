import { Button } from "./Button";

export function DiscordCta({ url }: { url: string }) {
  return (
    <div className="flex flex-col gap-6 border border-ink p-6 md:flex-row md:items-end md:justify-between">
      <div>
        <h3 className="font-display text-2xl font-semibold">Missing something?</h3>
        <p className="mt-2 max-w-measure">Feature requests, bug reports and help getting a bot running all go through the Discord server. Say what you need and which bot it&apos;s for.</p>
      </div>
      <Button href={url} external className="shrink-0">Join the Discord</Button>
    </div>
  );
}
