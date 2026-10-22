// Writes a .sha256 file next to every zip in public/downloads that lacks one (or is out of date).
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const root = join(process.cwd(), "public", "downloads");
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));

for (const zip of walk(root).filter((f) => f.endsWith(".zip"))) {
  const hash = createHash("sha256").update(readFileSync(zip)).digest("hex");
  const line = `${hash}  ${basename(zip)}\n`;
  const out = `${zip}.sha256`;
  if (existsSync(out) && readFileSync(out, "utf8") === line) continue;
  writeFileSync(out, line);
  console.log(`wrote ${out.replace(process.cwd() + "/", "")}`);
}
