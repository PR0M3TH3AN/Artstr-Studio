# Disc-label sheet

Two-up disc-label sheet, sized for full-page label stock with two disc
circles arranged vertically (Disc 1 / Disc 2).

## Geometry

- **Sheet** — full-page (Letter / A4) with two disc cut-outs.
- **Disc diameter** — standard CD/DVD ~118 mm with a centre hole.
- **Safe area** — interior ring that printers and label stock
  tolerances tend to respect.

## Slots: Disc 1 + Disc 2

Each slot accepts:

- A local image (drop or pick).
- A previously-published **disc design** from Nostr (the standalone
  `disc-design` from the Designer tab). Click **Browse community →**
  inside the slot.
- Disc-level meta: title, IMDb id, language. Used for both publish
  tagging and the layout's text decoration.

You can also leave a slot empty — only the populated disc(s) emit
output.

## Spine labels

The **Spine labels** inputs apply to a CD/DVD spine running between
the two discs (some label stocks include a spine strip). Top label
+ bottom label render in the small strip between the two discs.

## Publishing

Posts a `casewrap-disc` event with both disc slot images +
spine-label text. Forks land with the full sheet preserved.

## Tips

- For ONE disc only, use the Designer tab instead — that's the
  standalone-publishable single-disc surface.
- The Crop marks toggle in the Export fieldset adds printer cut
  marks at the trim corners of each disc.
