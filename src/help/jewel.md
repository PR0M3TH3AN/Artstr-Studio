# Jewel-case insert

Front-cover + tray inserts for a standard CD jewel case.

## Geometry

- **Jewel front** — 4.72 × 4.72 in trim, sits behind the clear plastic
  front cover.
- **Jewel tray** — 5.91 × 4.72 in trim, sits under the disc tray (with
  vertical spine edges that wrap into the case sides).
- **Bleed** + **safe area** mirror the standard CD/DVD design.

## Slots

Both inserts pick up artwork the same way:

- Drop in a local image, or
- **Browse community →** to pick a published design from Nostr.

Per slot you can set fit / zoom / x / y / rotate independently.

## Spine labels

Left + right spine inputs feed the strips that wrap around the
tray-card sides — typically your album / movie title text.

## Publishing

Posts a `casewrap-jewel` event. Both inserts' images + the spine
labels live in the same event so a forker gets the complete jewel
package.

## Tips

- Test print at 100% on plain paper first; trim by hand and check the
  fit before printing on label stock.
- For double-sided printing, the tray usually needs a flipped layout
  on the back — print the same event twice with the front oriented
  correctly and you'll match most consumer printers.
