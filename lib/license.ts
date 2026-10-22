/** Human names and official texts for the SPDX licence IDs used in bots.json. Unknown IDs are shown as written. */
const known: Record<string, { short: string; name: string; url: string; summary: string }> = {
  "GPL-3.0-only": {
    short: "GPL-3.0",
    name: "GNU General Public License v3.0",
    url: "https://www.gnu.org/licenses/gpl-3.0.html",
    summary: "Free to use, study, change and share. If you share a changed version, it must stay under GPL-3.0 with its source available.",
  },
  "GPL-3.0-or-later": {
    short: "GPL-3.0+",
    name: "GNU General Public License v3.0 or later",
    url: "https://www.gnu.org/licenses/gpl-3.0.html",
    summary: "Free to use, study, change and share. If you share a changed version, it must stay under the GPL with its source available.",
  },
  MIT: { short: "MIT", name: "MIT License", url: "https://opensource.org/license/mit", summary: "Free to use, change and share, keeping the copyright notice." },
};

export function licenseInfo(id: string) {
  return known[id] ?? { short: id, name: id, url: "", summary: "" };
}
