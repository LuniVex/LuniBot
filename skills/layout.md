# Layout

- **L1 Grid:** 12-column grid, one max width (`--page: 72rem`), one gutter token. Everything aligns to it.
- **L2 Spacing scale:** 4, 8, 12, 16, 24, 32, 48, 64 (px) as tokens. No other values.
- **L3 Left alignment.** Content starts at the left edge of the grid. Asymmetric splits (e.g. 3/9 columns: label left, content right) are preferred to centered stacks.
- **L4 Structure by rules.** Sections are divided by 1px horizontal rules; tables and definition lists carry the content. Cards are used only when items are truly independent, and then are bordered boxes with no shadow.
- **L5 Lists beat grids for catalogues.** Where users compare items (name, language, status, version), use a ruled table with aligned columns.
- **L6 Above the fold = useful.** The first screen shows what the site is, the actual items, and the primary action. No decorative hero.
- **L7 Pacing:** dense blocks (tables) alternate with short prose, separated by 48–64px. Keep vertical rhythm on the spacing scale.
- **L8 Responsive:** columns collapse to one at ≤ 48rem; tables become stacked rows with labels. 16px minimum side gutter. No horizontal page scroll.
- **L9 Accessibility:** visible focus ring (2px accent outline), skip link, semantic landmarks, 4.5:1 contrast for text.
- **L10 Lead with a focal point.** The hub opens with one headline block and the featured items at a larger scale, then the catalogue (L6).
- **L11 Unequal spans on one grid.** Featured items take 7 of 12 columns, the rest 5; the catalogue is a ruled list. Uneven by design, aligned to the same 12 columns (L1).
