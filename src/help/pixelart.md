# Pixel art

Palette-indexed grid editor for sprite work + simple animation.

## Canvas

- Grid sizes from 8×8 up to 128×128.
- Palette-indexed (not RGB) — every pixel is an index into the
  palette block, which means animations + colour-cycling are cheap.
- Pencil / eraser / fill / eyedropper / line / rect / ellipse tools.
- Mirror X / Y for symmetric sprites.
- Flip / rotate / resize transforms.

## Animation

- Multi-frame timeline at the bottom of the canvas.
- Per-frame duration (ms).
- Playback preview with onion-skin of the previous frame.
- Reorder frames by drag.

## Palette

- HSV picker inline.
- **Eyedropper (I)** uses `window.EyeDropper` to sample any colour
  on screen.
- Up to 256 palette entries; unused entries don't cost anything in
  the export.

## Import

- **Browse community** — pulls a published pixel-art design from
  Nostr as a layer.
- **Import from file** — JSON design export.
- **From image…** — pick any image, then the live side-by-side
  preview tunes target W/H, colour count, and fit mode (Cover /
  Fit / Stretch) before applying. Uses median-cut quantization.

## Export

- **PNG** at 1× / 2× / 4× / 8× / 16× / 32× (transparent or solid bg,
  optional grid lines).
- **Sprite sheet PNG** — every frame tiled in a Grid or Row layout.
- **Animated GIF** — inline GIF89a encoder, no vendored dependency
  (palette-indexed input is what GIF expects natively).

## Embed

Published pixel-art animations play back live in the embed iframe.
Embed URL params: `?play=0` starts paused; `?fps=N` overrides
frame rate; reduced-motion users get static start unless `?play=1`
opts in.

## Publish

Posts a `casewrap-pixelart` event with the palette + per-frame
pixel data (run-length encoded). Forks land with the full
animation intact.
