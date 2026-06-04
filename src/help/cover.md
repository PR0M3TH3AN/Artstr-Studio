# Case cover wrap

A printable wraparound for DVD, Blu-ray, softcover, or any
back + spine + front case format.

## Geometry

- **Trim** — outer cut line.
- **Bleed** — extends past the trim on each outer edge so the
  printer's cut tolerance doesn't reveal white.
- **Spine** — middle strip whose width depends on the case style
  (DVD = 14 mm, Blu-ray = 11 mm, etc).
- **Safe area** — interior margin you should keep text + key art
  inside.

Pick a preset in the sidebar (DVD / Blu-ray / U-Card / Custom) or
enter your own panel width + trim height + spine + bleed under the
**Custom** preset.

## Artwork modes

- **Combined wraparound** — one canvas spanning the full
  back+spine+front. Best for continuous artwork.
- **Slots** — separate back / spine / front layers. Best for posters
  + spine text + back-cover layout.

## Slots panel

When you're in slot mode, each panel exposes:

- A drop-zone for an image or a published cover design from Nostr.
- Fit (`cover` / `contain` / `fill` / `none`), zoom, position offsets,
  rotation.
- Show / hide for testing different layouts.

## Spine text

The **Spine label** input adds a vertical text caption along the
spine. Family + weight + colour controls in the right options pane.

## Common gotchas

- The **show guides** checkbox toggles trim + bleed lines on the
  canvas; **show crops** adds the cut marks. Both stay off in the
  exported file unless you also enable the matching **print** options.
- Switching presets resets panel widths to that preset's defaults —
  if you've customised, save first.
- Publishing posts a `casewrap-cover` event with the same flat
  payload anyone can fork.
