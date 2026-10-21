import "server-only";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Bot } from "./bots";

export interface DownloadInfo {
  href: string;
  fileName: string;
  size: number;
  sha256: string | null;
}

/** Reads the packed zip from public/ (built by scripts/pack-bots.mjs). */
export function getDownload(bot: Bot): DownloadInfo | null {
  const abs = join(process.cwd(), "public", bot.download.file);
  try {
    const size = statSync(abs).size;
    let sha256: string | null = null;
    try { sha256 = readFileSync(`${abs}.sha256`, "utf8").split(/\s+/)[0] || null; } catch {}
    return { href: bot.download.file, fileName: bot.download.file.split("/").pop()!, size, sha256 };
  } catch {
    return null;
  }
}
