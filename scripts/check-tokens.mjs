// Fails if UI code uses values outside the tokens (design-principles D10, layout L2, anti-patterns A2/A3/A4/A5).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["app", "components"];
const okSpace = new Set(["0", "px", "1", "2", "3", "4", "6", "8", "12", "16", "auto", "full"]);
const spaceRe = /(?:^|[\s"'`:])-?(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y|top|bottom|left|right|inset)-(\d+(?:\.\d+)?)(?=[\s"'`]|$)/g;
const banned = [
  [/\bshadow(?:-\w+)?\b/, "shadow (A2)"], [/\bblur(?:-\w+)?\b|backdrop-/, "blur (A4)"], [/\bbg-(?:gradient|linear|radial|conic)/, "gradient (A5)"],
  [/\brounded(?:-(?!sm\b)\w+)\b/, "radius over 2px (A3)"], [/\btext-\[|\bp[xytblr]?-\[|\bm[xytblr]?-\[|\bgap-\[/, "arbitrary size (D10)"],
  [/\bborder-(?:2|4|8)\b/, "border wider than 1px (D6)"],
];
const files = [];
const walk = (d) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|css)$/.test(n)) files.push(p);
  }
};
roots.forEach(walk);

let bad = 0;
for (const f of files) {
  if (f.endsWith("tokens.css")) continue;
  readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    if (/^\s*(\/\*|\*|\/\/)/.test(line)) return; // comments
    for (const m of line.matchAll(spaceRe)) if (!okSpace.has(m[1])) { console.log(`${f}:${i + 1}: spacing ${m[0].trim()} not on the 4/8/12/16/24/32/48/64 scale`); bad++; }
    for (const [re, why] of banned) if (re.test(line)) { console.log(`${f}:${i + 1}: ${why}: ${line.trim().slice(0, 90)}`); bad++; }
  });
}
console.log(bad ? `${bad} token violation(s)` : "tokens ok");
process.exit(bad ? 1 : 0);
