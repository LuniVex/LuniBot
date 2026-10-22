"use client";
import { useState } from "react";
import { type Bot, sourceUrl } from "@/lib/bots";
import type { DownloadFile } from "@/lib/files";
import { fmtDate, fmtSize } from "@/lib/format";
import { licenseInfo } from "@/lib/license";
import { More, Pill, pill } from "./Button";

/** The download section of a bot page: the file's details on the left, how to run it on the right. */
export function GetIt({ bot, file }: { bot: Bot; file: DownloadFile | null }) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const verify = file?.sha256 ? `echo "${file.sha256}  ${file.fileName}" | shasum -a 256 -c` : "";
  const copy = () => {
    navigator.clipboard.writeText(verify).then(() => setCopied("done"), () => setCopied("failed"));
    setTimeout(() => setCopied("idle"), 2200);
  };

  if (!file) {
    return <p className="rounded-tile bg-tile-alt p-8 text-center text-fg-2">The zip for this version isn&apos;t on the server yet. Check back soon, or use the GitHub release.</p>;
  }

  const rows: [string, React.ReactNode][] = [
    ["File", <span key="f" className="font-mono text-[14px]">{file.fileName}</span>],
    ["Version", bot.version],
    ["Size", fmtSize(file.size)],
    ["Last updated", fmtDate(bot.updated)],
    ["Licence", licenseInfo(bot.license).short],
  ];

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="flex flex-col rounded-tile bg-tile-alt p-8 md:p-10">
        <h3 className="text-[24px] font-semibold">The file</h3>
        <dl className="mt-6 divide-y divide-line/70 border-y border-line/70">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-6 py-3">
              <dt className="text-fg-2">{k}</dt><dd className="min-w-0 truncate text-right tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        {file.sha256 && (
          <>
            <p className="t-small mt-6 text-fg-2">SHA-256 checksum</p>
            <p className="mt-1 break-all font-mono text-[13px] leading-relaxed">{file.sha256}</p>
            <button type="button" onClick={copy} className={pill("secondary", "md", "mt-6 self-start")}>
              {copied === "done" ? "Copied" : copied === "failed" ? "Couldn't copy. Select the checksum above." : "Copy check command"}
            </button>
          </>
        )}
      </div>

      <div className="flex flex-col rounded-tile bg-tile-alt p-8 md:p-10">
        <h3 className="text-[24px] font-semibold">Run it</h3>
        <ol className="mt-6 flex flex-col gap-4">
          {[`unzip ${file.fileName}`, "cp .env.example .env", "npm ci && npm start"].map((c, i) => (
            <li key={c} className="flex gap-4">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-fg text-[13px] font-semibold text-bg">{i + 1}</span>
              <code className="break-all pt-0.5 font-mono text-[14px]">{c}</code>
            </li>
          ))}
        </ol>
        <p className="t-small mt-6 text-fg-2">Put your Discord bot token in <code className="font-mono">.env</code> before starting.</p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Pill href={`/api/download/${bot.slug}`} download size="lg">Download v{bot.version}</Pill>
        </div>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
          <More href={sourceUrl(bot)} external>View source</More>
          <More href={bot.download.github.releases} external>Latest release</More>
        </div>
      </div>
    </div>
  );
}
