# Reference library

Sites whose style we're aiming at, grouped by what to steal.

**How much of this is verified.** Every URL below returned HTTP 200 on 2026-10-21 (checked with curl). Visual details (type, borders, spacing) could **not** be machine-verified: no browser was available to take screenshots and the page fetcher returns text only. Tags used:

- `[checked]`: a fact confirmed from the page text.
- `[memory]`: technique recalled from familiarity with the site. Open it and confirm before copying.

`references/shots/` is empty for the same reason. Add screenshots there when you can, named `<site>.png`.

**HIFI:** I couldn't identify a site or design system called "HIFI" (web search found nothing by that name). Send the URL and I'll add it. Until then, the ink-and-cream direction is covered by entries 1–3. Entry 3 comes from a search result describing its palette, not from the live site.

---

## A. Warm minimalism / ink and cream

1. **Kinfolk**: https://kinfolk.com
   Feel: quiet magazine, lots of paper-colour space.
   Copy: a warm off-white page with near-black text instead of pure white/black; photography carries the colour so the UI can stay neutral. `[memory]`

2. **Craig Mod**: https://craigmod.com
   Feel: a writer's site, calm and personal.
   Copy: long-form text at a comfortable measure on a plain page; navigation as a short row of plain text links. `[memory]`

3. **Northbound (superdesign library entry)**: https://superdesign.dev/library/northbound-we-design-the-startup-before-it-exists
   Feel: cream paper, black ink, one hot accent.
   Copy: the three-colour discipline. A search result reports cream `#faf6ef`, ink `#16130f` and one magenta accent `#d6246e`, with a serif (Fraunces) for headings and Inter for body. Use the *structure* (paper / ink / one accent) and pick our own accent. `[checked: via search snippet only]`

## B. Editorial and print-inspired

4. **Stripe Press**: https://stripe.press
   Feel: a publisher's catalogue.
   Copy: each item presented like a book on a shelf: cover, title, one-line description, plain link. Strong serif titles, little else. `[memory]`

5. **Gwern.net**: https://gwern.net
   Feel: dense, scholarly, unapologetic.
   Copy: very high information density with a readable measure; sidenotes and tables instead of decoration. Proof that density and legibility coexist. `[memory]`

6. **Pentagram**: https://www.pentagram.com
   Feel: established design studio, image-led but typographically strict.
   Copy: a rigid grid of work with captions in one small type size; hierarchy by placement and scale only. `[memory]`

7. **Are.na**: https://www.are.na
   Feel: tool for collecting, restrained and structural.
   Copy: the site is set entirely in one custom typeface (Areal by Dinamo), so hierarchy comes from size and weight alone. `[checked]` Numbered "how it works" steps in plain text. `[checked]`

## C. Honest typography and plain pages

8. **Tonsky**: https://tonsky.me
   Feel: a developer's personal site that is just a list.
   Copy: the index is posts grouped under year headings, each line a title plus a short date (e.g. "6/13"), year stated once. `[checked]` Reuse this for a changelog or release list.

9. **Typewolf**: https://www.typewolf.com
   Feel: working reference for choosing type.
   Copy: use it to pick and pair faces from real examples; it is a tool for us rather than a style model. `[memory]`

## D. Developer tools

10. **Sourcehut**: https://sourcehut.org
    Feel: engineers writing for engineers.
    Copy: one column, a short bullet list per feature, concrete claims ("Two-factor authentication with TOTP"), and plain statements of stance: "No AI features whatsoever", "All features work without JavaScript". `[checked]` This is the model for our trust copy.

11. **Oxide Computer**: https://oxide.computer
    Feel: serious hardware company that writes like an engineering firm.
    Copy: figures labelled "Fig. 1 / Fig. 2" and real product UI shown as evidence instead of illustrations. `[checked: figure labels]` Content-heavy sections of short labelled blocks. `[checked]`

12. **Zed**: https://zed.dev
    Feel: editor with a calm, documentation-like site.
    Copy: product screenshots as the main visual, minimal chrome around them. `[memory]`

13. **Ghostty**: https://ghostty.org
    Feel: terminal emulator, unadorned.
    Copy: small, direct landing page; monospace used for commands and config rather than decoration. `[memory]`

14. **Linear**: https://linear.app
    Feel: precise, dense, product-first.
    Copy: thin 1px dividers between regions and tight typographic scale; modular bento-style blocks of unequal size on one grid. `[memory]`

15. **Vercel**: https://vercel.com
    Feel: infrastructure brand, monochrome.
    Copy: sections divided by hairline borders on a visible grid, with 1px-outlined buttons; the system-wide use of borders in place of shadows. `[memory]`

16. **Resend**: https://resend.com
    Feel: developer product with a code-first pitch.
    Copy: real code samples as the hero content, in a monospace block. `[memory]`

## E. Studios and personal craft sites

17. **Basement Studio**: https://basement.studio
    Feel: studio portfolio with a strong point of view.
    Copy: oversized, plain type for project names and a list-like index of work. `[memory]`

18. **Rauno Freiberg**: https://rauno.me
    Feel: designer-engineer's personal site; small and exact.
    Copy: restraint and fine interaction detail on a very small amount of content. `[memory]`

---

## Quick map: what to take from where

| Need | Take from |
| --- | --- |
| Paper / ink / one accent palette | 1, 2, 3 |
| Plain, honest copy and trust statements | 10 |
| Catalogue as a list or table | 4, 8, 5 |
| Hierarchy with one typeface | 7, 6 |
| 1px hairlines instead of shadows | 14, 15 |
| Code and commands in monospace | 13, 16 |
| Figures and real evidence over illustration | 11, 12 |

---

## Direction (committed 2026-10-22)

**Warm ink-and-cream minimalism with a single accent, set like a small press catalogue.** Paper `#f7f3ea`, ink `#1a1814`, one oxblood accent `#a3341d` (dark: ink and paper swap, accent `#e8836a`). Structure from 1px rules on a visible 12-column grid; hierarchy from size and weight. Fraunces for titles, Inter for text, system mono for data.

## Take-from map by technique

| Technique | Take | From |
| --- | --- | --- |
| **Typography** | A serif display face with character paired with a plain sans for text (Fraunces + Inter) | 3 |
| Typography | One scale, hierarchy by size and weight only | 6, 7 |
| Typography | Short date lines, year/context stated once; tabular mono for versions and sizes | 8, 13 |
| **Layout / grid** | Hairline rules on a visible grid, outlined buttons, no shadows | 14, 15 |
| Layout / grid | Unequal blocks on one grid: featured items wide, the rest narrower | 14 |
| Layout / grid | Catalogue as a ruled list of items: cover mark, title, one line, plain link | 4, 8 |
| **Pacing** | Dense data blocks alternating with short prose; 48-64px between sections | 5, 10 |
| Pacing | "Fig. 1" style labelled blocks on the bot page (Downloads, Commands, Requirements) | 11 |
| Pacing | Very small amount of content with exact interaction detail | 18 |
| **Colour** | Paper / ink / one accent; accent only for state and action | 1, 3 |
| Colour | Near-black on warm off-white, never pure black on pure white | 1, 2 |
| Colour | Monochrome chrome so the content carries colour | 15 |
