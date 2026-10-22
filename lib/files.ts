import "server-only";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Bot } from "./bots";

export interface DownloadFile { fileName: string; size: number; sha256: string | null }

/** Size and checksum of a bot's zip in public/downloads, read at build time. Null if the file is missing. */
export function getFile(bot: Bot): DownloadFile | null {
  const abs = join(process.cwd(), "public", bot.download.file);
  try {
    const size = statSync(abs).size;
    let sha256: string | null = null;
    try { sha256 = readFileSync(`${abs}.sha256`, "utf8").trim().split(/\s+/)[0] || null; } catch { /* no checksum file */ }
    return { fileName: abs.split("/").pop()!, size, sha256 };
  } catch {
    return null;
  }
}
