# Eyedropper tool (I)

Samples a colour from anywhere on screen — Artstr canvas, another
browser tab, your desktop wallpaper, anywhere. Uses the browser's
native `window.EyeDropper` API.

## Behaviour

- Click the toolbar button (or press **I**) → the cursor changes to
  a crosshair and a magnified pixel-grid follows the pointer.
- Click anywhere on screen to sample that pixel's colour.
- The sampled hex value lands in the **currently-active colour
  swatch** — whichever fill / stroke / background slot last had
  focus (right-side panel).
- Press **Esc** to cancel without sampling.

## OS colour picker eyedropper

The browser's native colour picker (which opens when you click any
colour field in the right-side panels) also includes its own
eyedropper button in Chromium-based browsers — useful when you
want to sample a colour directly into a specific field instead of
the active slot. Behaviour differs by browser:

- **Chromium-based** (Chrome / Edge / Brave) — the native colour
  picker has an eyedropper inside.
- **Safari / Firefox** — no built-in eyedropper. Type a hex value
  by hand or use the dedicated toolbar tool to sample into the
  active swatch.

## Browser support

- Chromium-based browsers (Chrome / Edge / Brave / Arc) — full
  support.
- Safari / Firefox — `window.EyeDropper` isn't implemented; the
  button is disabled with a tooltip explaining the gap. Fall back
  to manually entering a hex value or copying one from another tool.

## Tips

- The pixel-grid magnifier shows a 3×3 zoomed view around the
  pointer so you can land on the exact pixel — useful when
  sampling thin lines or anti-aliased edges.
- The eyedropper is the easiest way to colour-match a logo or
  branded element on another tab — just pop the source open
  next to Artstr and sample directly.
