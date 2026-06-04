# Designer tab

The **Designer** tab opens a dedicated single-disc canvas — one
13.5 cm circular disc face, optimised for designing the kind of
reusable disc artwork you'd drop into multiple disc-label sheets.

## When to use the Designer tab

- You want one disc artwork to publish + reuse across many disc-label
  sheets (Top / Bottom of a single sheet, or shared across multiple
  releases).
- The geometry is a single circle, not a sheet. Bleed + safe-area
  rings render dedicated to the circular trim instead of the
  rectangular cover/jewel layout.

## Compared to Template > Disc-label sheet

- **Template / Disc** = a sheet with *two* disc slots side-by-side,
  printed on full-page label stock.
- **Designer** = one disc design, publishable as `disc-design`. Import
  it later into a sheet via the Disc-label slot picker.

## Layers

Layers target `designer-disc`. The single disc surface scales them in
its native pixel space (the same `discTemplate.discD` constant used
by sheet rendering), so a disc design opened standalone vs dropped
into a sheet slot renders identically.

## Publish

- Title + Category in **Project Metadata** are required.
- The publish event type is `casewrap-disc-design`. Other authors can
  fork it or drop it into their own disc-label sheets via the sheet's
  slot picker → *Browse community*.

## Tips

- The **Spine label** input in the sidebar applies to Disc-label
  sheets, not Designer mode — leave it alone here.
- Use **Print / Save as PDF** to get a circular vector cut sheet for
  test prints. Most consumer printers won't print full bleed on a
  disc; check your printer's safe area before mass printing.
