# Design principles

Apply to every UI task. Cite the rule ID (D1…) when justifying a choice. If a choice has no rule or reference behind it, don't make it.

- **D1 Function first.** Every element must do a job: inform, navigate, or act. If you can't say what it's for, delete it.
- **D2 Deliberate type scale.** One modular scale, defined as tokens (see typography.md). No ad-hoc font sizes.
- **D3 Density over padding.** Show real content (names, versions, dates, commands, file sizes). Whitespace separates groups; it never substitutes for content.
- **D4 Hierarchy from size and weight, not colour.** The page must read correctly in greyscale. Colour marks state or action only.
- **D5 Restrained colour.** Two neutrals (paper, ink) plus one accent, all CSS custom properties. Muted ink and rule colours are tints of those, not new hues. Status uses text labels, not a rainbow.
- **D6 Hairlines, not shadows.** Structure comes from 1px borders. Borders are 1px everywhere. No shadows.
- **D7 Small radii.** 0 by default; at most 2px for inputs and buttons. Nothing larger.
- **D8 Content is real.** Use actual data from the project. No lorem ipsum, no invented numbers or testimonials.
- **D9 Plain copy.** Say what it is and what it costs, in the fewest words. State limits honestly (e.g. "No release published yet").
- **D10 Tokens only.** Colour, type size, spacing, border width and radius come from tokens. No magic numbers in component CSS.
- **D11 Custom CSS.** No component libraries that impose a look.
