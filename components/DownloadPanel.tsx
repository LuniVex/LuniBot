"use client";
import { useState } from "react";
import { type Bot, githubSourceUrl } from "@/lib/bots";
import type { DownloadInfo } from "@/lib/downloads";
import { fmtDate, fmtSize } from "@/lib/format";
import { Button } from "./Button";

export function DownloadPanel({ bot, file }: { bot: Bot; file: DownloadInfo | null }) {
  const [copied, setCopied] = useState(false);
  const verify = file ? `echo "${file.sha256}  ${file.fileName}" | shasum -a 256 -c` : "";

  return (
    <div id="download" aria-labelledby="dl-h" role="region" className="scroll-mt-16 rounded-sm border border-ink p-6">
      <h3 id="dl-h" className="text-xl font-bold">Download {bot.name}</h3>
      {file ? (
        <>
          <dl className="mt-4 grid grid-cols-[8rem_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted">File</dt><dd className="font-mono break-all">{file.fileName}</dd>
            <dt className="text-muted">Version</dt><dd className="font-mono">{bot.version}</dd>
            <dt className="text-muted">Size</dt><dd className="font-mono tnum">{fmtSize(file.size)}</dd>
            <dt className="text-muted">First released</dt><dd className="font-mono tnum">{fmtDate(bot.released)}</dd>
            <dt className="text-muted">Last updated</dt><dd className="font-mono tnum">{fmtDate(bot.updated)}</dd>
            {file.sha256 && (<><dt className="text-muted">SHA-256</dt><dd className="font-mono break-all">{file.sha256}</dd></>)}
          </dl>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button href={`/api/download/${bot.slug}`} download>Download .zip</Button>
            {file.sha256 && (
              <button type="button" onClick={() => { navigator.clipboard?.writeText(verify).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); }}
                className="rounded-sm border border-rule px-4 py-2 text-sm hover:border-ink">
                {copied ? "Copied" : "Copy verify command"}
              </button>
            )}
          </div>
          <p className="mt-4 text-sm text-muted">Served from this site. Source only, no installer: unzip, copy <span className="font-mono">.env.example</span> to <span className="font-mono">.env</span>, then <span className="font-mono">npm ci &amp;&amp; npm start</span>.</p>
        </>
      ) : (
        <p className="mt-4">The download file is missing from this build. Run <span className="font-mono">npm run pack</span>.</p>
      )}
      <p className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-rule pt-4 text-sm">
        <a href={githubSourceUrl(bot)} target="_blank" rel="noopener noreferrer">View source on GitHub</a>
        <a href={bot.download.github.releases} target="_blank" rel="noopener noreferrer">Latest release</a>
      </p>
    </div>
  );
}
