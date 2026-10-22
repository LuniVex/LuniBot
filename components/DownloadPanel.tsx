"use client";
import { useState } from "react";
import { type Bot, githubSourceUrl } from "@/lib/bots";
import type { DownloadInfo } from "@/lib/downloads";
import { fmtSize } from "@/lib/format";
import { Button } from "./Button";
import { VoteButton } from "./VoteButton";

export function DownloadPanel({ bot, file }: { bot: Bot; file: DownloadInfo | null }) {
  const [copied, setCopied] = useState(false);
  const verify = file?.sha256 ? `echo "${file.sha256}  ${file.fileName}" | shasum -a 256 -c` : "";
  const steps = file ? [`unzip ${file.fileName}`, "cp .env.example .env", "npm ci && npm start"] : [];

  return (
    <div id="download" role="region" aria-labelledby="dl-h" className="scroll-mt-16 border border-ink">
      <div className="p-6">
        <h2 id="dl-h" className="font-display text-2xl font-semibold">Download</h2>
        {file ? (
          <>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">File</dt><dd className="break-all font-mono text-xs">{file.fileName}</dd>
              <dt className="text-muted">Size</dt><dd className="font-mono text-xs tabular-nums">{fmtSize(file.size)}</dd>
              {file.sha256 && (<><dt className="text-muted">SHA-256</dt><dd className="break-all font-mono text-xs">{file.sha256}</dd></>)}
            </dl>
            <div className="mt-6 flex flex-col gap-2">
              <Button href={`/api/download/${bot.slug}`} download>Download v{bot.version}</Button>
              {verify && (
                <button type="button" onClick={() => { navigator.clipboard?.writeText(verify).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); }}
                  className="t-fast rounded-sm border border-rule px-4 py-2 text-sm hover:border-ink">
                  {copied ? "Copied to clipboard" : "Copy checksum command"}
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="mt-4">This build has no download file for {bot.name}. Run <span className="font-mono">npm run pack</span> and rebuild.</p>
        )}
      </div>

      {file && (
        <div className="border-t border-rule p-6">
          <p className="text-sm text-muted">After unzipping</p>
          <div className="mt-2 font-mono text-xs">
            {steps.map((l) => <p key={l} className="break-all"><span aria-hidden="true" className="select-none text-muted">$ </span>{l}</p>)}
          </div>
          <p className="mt-2 text-sm text-muted">Source only, no installer.</p>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-rule p-6">
        <VoteButton slug={bot.slug} />
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <a href={githubSourceUrl(bot)} target="_blank" rel="noopener noreferrer">Source on GitHub</a>
          <a href={bot.download.github.releases} target="_blank" rel="noopener noreferrer">Releases</a>
        </p>
      </div>
    </div>
  );
}
