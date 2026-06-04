# Save / Print / Export panel

The bottom panel in the left sidebar. Local-only output —
publishing to Nostr lives in the top-right Publish flow, not here.

## Save / Open (project JSON)

- **Save project** — downloads a `.json` file containing the
  entire project state (every layer, every mode's data, the
  metadata, the visibility setting). One file per active design.
- **Open project** — pick a saved JSON file. Loads it into the
  current session, replacing the active project. Use case: round-
  trip a design via email / a cloud-drive sync without going
  through Nostr.

## Print

- **Print / Save as PDF** — opens the browser print dialog. Pick
  **Save as PDF** in the destination dropdown to export to PDF.
- The print toggles in the Export options panel above control
  what gets included (bleed, crop marks, guides).

### Print-dialog tips

- Set **scale to 100%** — anything else changes the trim
  dimensions.
- Disable **headers and footers** — your browser may add page
  numbers / URLs otherwise.
- For double-sided cover wraps, print the same event twice
  with a blank back the second time if your printer doesn't
  duplex the spine correctly.

## Export

- **Export JPEG** — direct rasterised export at the artboard's
  natural pixel size, JPEG-compressed. The resolution dropdown
  picks between **Low (96 DPI)**, **Standard (150 DPI)**, and
  **Print (300 DPI)**.
- **Export PNG** — same but as PNG (lossless). Sometimes available
  only for modes that support transparent backgrounds.
- Pixel-art mode has its own dedicated exports (PNG at multiple
  scales, sprite sheet, animated GIF) in the pixel toolbox; the
  panel here is hidden.
- Book mode has its own dedicated **Export PDF…** flow (page range,
  bleed, crop marks, split output) from the Pages overview toolbar.

### Why JPEG sometimes routes through PDF

The direct-JPEG path renders every layer onto a hidden canvas, then
extracts the canvas as a JPEG. That fails in three cases:

1. **CORS-blocked images** — if any image layer's source server
   doesn't send `Access-Control-Allow-Origin: *`, the browser
   refuses to embed the pixels in the canvas. The "Render canvas"
   path can't bypass this; the print engine can.
2. **Tainted canvas** — the canvas accepted the image but flagged it
   "tainted" once it tried to read pixels. Same root cause as #1
   but caught at a different stage.
3. **Unsupported modes** — pixel-art (uses its own dedicated
   exporter) and standalone decks (which have a multi-slide
   exporter elsewhere) don't go through this path.

In any of those cases, the JPEG button automatically opens the
**Print → PDF** flow: the browser's print engine has a separate
image pipeline that handles cross-origin embeds the canvas can't
touch. You'll see a toast explaining the switch ("N image(s)
couldn't be embedded directly — switching to the PDF route"). Save
the resulting PDF, then re-export it as JPEG from a PDF viewer if
you specifically need a flat JPEG.

## Designer tab

The Designer tab has a separate `designerPrintSaveFieldset` with
the same buttons but scoped to the single-disc surface.

## Tips

- The JSON save is the fastest way to back up a draft you don't
  want to publish yet — drop the file in a private cloud folder
  + reopen anywhere.
- For mass production, use the JPEG export at 300 DPI by tweaking
  the artboard's pixel dimensions to `<inches> × 300` before
  exporting.
