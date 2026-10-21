// Builds one zip per bot into public/downloads/<slug>/ from the bot's source folder,
// plus a .sha256 file. Run automatically before `dev` and `build`.
// The zips are committed. If a bot's source folder is not present (this repo does not
// contain bots/), the committed zip is used as is; a missing zip is an error.
import { zipSync } from "fflate";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { bots } = JSON.parse(readFileSync(join(root, "data/bots.json"), "utf8"));
const SKIP = new Set(["node_modules", ".git", ".env", "data", "transcripts", "recordings", "notes", "cache", "logs", ".DS_Store"]);
const FIXED_TIME = new Date("2000-01-01T00:00:00Z"); // keeps the zip, and so its checksum, reproducible

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    if (SKIP.has(name) || name.endsWith(".log")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

for (const bot of bots) {
  const src = join(root, bot.download.sourceDir);
  const out = join(root, "public", bot.download.file);
  if (!existsSync(src)) {
    if (!existsSync(out)) throw new Error(`No source folder (${bot.download.sourceDir}) and no committed zip at ${bot.download.file}`);
    console.log(`kept   ${bot.download.file}  (no ${bot.download.sourceDir}/ here, using committed zip)`);
    continue;
  }
  rmSync(dirname(out), { recursive: true, force: true }); // drop zips of older versions
  const top = `${bot.slug}-${bot.version}`;
  const files = {};
  for (const f of walk(src)) {
    files[posix.join(top, relative(src, f).split("\\").join("/"))] = [new Uint8Array(readFileSync(f)), { mtime: FIXED_TIME }];
  }
  const zip = zipSync(files, { level: 9 });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, zip);
  const sha = createHash("sha256").update(zip).digest("hex");
  writeFileSync(`${out}.sha256`, `${sha}  ${out.split("/").pop()}\n`);
  console.log(`packed ${bot.download.file}  ${(zip.length / 1024).toFixed(0)} KB  ${Object.keys(files).length} files`);
}
