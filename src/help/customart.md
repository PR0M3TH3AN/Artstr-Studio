# Custom art

A freeform flat canvas you can size to anything from a Twitter banner
(1500×500) to a poster. The most general-purpose Artstr surface — if
your design doesn't fit one of the other modes, start here.

## Sizing the canvas

In the sidebar:

- **Preset** — common social / print sizes.
- **W × H (px)** — manual override.
- **Background** — solid colour or `#ffffff` for transparent-on-export.

The canvas is rendered at 96 DPI; the PDF/PNG export upscales to your
chosen DPI on the way out.

## Layer types

Custom Art accepts every layer kind in the app:

- **Text** — full HTML rich text with bold / italic / underline /
  strikethrough / link, inline-marks-aware.
- **Image** — drag-drop or pick; fit (cover / contain / fill / none),
  rotate, opacity, optional clip.
- **Shape** — rectangle / ellipse / polygon / star + Pen-tool path
  (full SVG-path support with anchors + handles).
- **Color block** — solid fill.
- **QR code** — input a string, choose ECC + style.
- **Pixel art** — sub-grid pixel art layer, edited via the Pixel
  editor.
- **Linked design** — embeds another author's published Artstr design
  as a live-resolving layer (Linked Designs feature). Right-click the
  layer to expand into the linked event's full layer list and edit
  pieces inline.

## Tools

The vertical tool palette has:
- **Select (V)** — move / scale / rotate whole layers.
- **Direct Selection (A)** — edit anchors + handles on a path.
- **Pen (P)** — Illustrator-parity pen tool (auto-add/delete anchors,
  spacebar reposition, alt-drag asymmetric handles, Cmd+J join,
  Cmd+Alt+J average).
- **Eyedropper (I)** — uses `window.EyeDropper` to sample any colour
  on screen.
- **Pathfinder** — Unite / Subtract / Intersect / Exclude on selected
  vector shapes.
- **Align / Distribute** — left/center/right + top/middle/bottom +
  even-distribute.
- **Free Transform** — handles around the selection bbox for scale +
  rotate.

## Publish

Posts a `casewrap-customart` event. Public, private (encrypted), or
premium (zap-gated) — selected in the publish-confirm modal.
