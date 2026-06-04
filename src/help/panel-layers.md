# Layers panel

The persistent layer list on the left sidebar. Lists every layer
on the **current surface** — switches automatically based on the
active mode + which sub-surface you're editing.

## How the layer list scopes per mode

| Mode | Surfaces |
|------|----------|
| **Cover** | Back / Spine / Front (or one combined wrap). |
| **Disc-label sheet** | Disc 1 / Disc 2. |
| **Jewel inserts** | Jewel front / Jewel tray. |
| **Custom Art / Slide** | One Canvas. |
| **Deck (editing a slide)** | The slide's canvas. |
| **Pixel art** | The pixel grid. |
| **Book — page editor** | The current book page (master layers shown underneath as a translucent underlay). |
| **Book — master editor** | The current master. |
| **Book — cover editor** | Cover front / Spine / Back, switchable via the dropdown at the top of the panel. |
| **Designer tab** | The single disc surface. |

The **Target** dropdown at the top of the layer list picks which
sub-surface a *new layer* gets added to. Adding from the canvas
(drop image, draw shape, etc) automatically tags the new layer
with the active surface.

## Per-row controls

Each row in the layer list shows:

- **Visibility (eye)** — hide / show without removing.
- **Lock** — refuse pointer input on the canvas. The row still
  highlights but drag / select skip it.
- **Name** — auto-named on creation; double-click to rename.
- **Type chip** — small label showing image / text / shape / QR /
  pixel-art / linked-design.

## Reorder + group

- **Drag** rows to reorder. Z-order on the canvas follows the
  list order (top of the list = top of the stack).
- **Cmd/Ctrl + ]** / **Cmd/Ctrl + [** sends selected layers
  forward / backward.
- **Shift+click** to multi-select; then drag a contiguous block.
- **Group** — select multiple rows + click the Group button (or
  Cmd/Ctrl + G) to collapse them under a single expandable row.
  Groups have their own visibility / lock toggles that cascade.

## Layer options (the per-layer right-side pane)

Clicking a layer in the list (or selecting it on the canvas)
populates a contextual options block in the right-side floating
pane. Common controls:

- **Position** — x / y / w / h in inches (or px in screen-DPI
  modes). Aspect-ratio lock keeps width + height proportional.
- **Rotation** — 0–360°.
- **Opacity** — 0–1.
- **Fit** — for image layers: cover / contain / fill / none.
- **Clip** — clip-to-shape pulls another layer's path as the clip
  source. Useful for clipping an image to an arbitrary outline.
- **Color** — solid colour with the eyedropper inline.
- **Premium gating** — per-layer paywall hint (gating intent only
  in v1; full encrypted-publish path lives elsewhere).

The exact fields differ by layer type — text layers show font /
size / alignment, image layers show fit + src, shape layers show
fill / stroke / per-anchor counts, etc.

## Tips

- Locking layers is the easiest way to prevent accidental moves
  while you adjust adjacent ones.
- The Layers panel hides in pixel-edit mode (the pixel editor has
  its own frames + onion-skin controls) and in Book Pages overview
  (no active surface).
- For complex multi-layer art, group early — moving a group of
  five layers as one is much faster than clicking them one at a
  time.
