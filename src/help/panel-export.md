# Export options panel

Lives below the metadata + above the print/save panel. Controls
what print marks render on the canvas + what gets included in the
exported file.

## Show / hide toggles

These affect the **on-screen** display only — they're separate
from the `print*` toggles below.

- **Show guides** — trim lines around the artwork.
- **Show bleed** — outer bleed boundary line.
- **Show safe area** — interior safe zone.
- **Show crops** — corner cut marks outside the trim.
- **Show fold** — for cover wrap, the back↔spine + spine↔front
  fold lines.

## Print toggles

These affect what gets included in the **exported** file
(JPEG / PNG / PDF / print-dialog output):

- **Print guides** — embed the trim guides in the output.
- **Print crops** — embed corner cut marks in the output.
- **Print bleed** — extend the output to include the bleed area.

Printers usually want crop marks ON + bleed ON; production
PDF + JPEG usually wants both OFF.

## Mode interaction

- The toggles are global per project; they apply to whichever mode
  is active.
- Pixel-art mode hides the export options entirely (pixel-art has
  its own PNG / sprite-sheet / GIF exporters in the pixel toolbox).
- Book mode hides them too while editing chapter markdown (chapter
  pagination has its own controls); they reappear in the per-page
  canvas editor + cover editor.

## Tips

- Toggle "Show crops" ON while designing to leave room around the
  trim edges; toggle "Print crops" ON only when exporting for a
  printer.
- For social-media exports, leave every print* off — the output is
  pixel-perfect to the trim.
