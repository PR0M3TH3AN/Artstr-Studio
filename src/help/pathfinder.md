# Pathfinder

Boolean combine operations for vector shapes. Lives in the right-
side **Pathfinder** panel, which becomes available when ≥2 vector
shapes are selected.

## The four ops

- **Unite** — merges every selected shape into one combined fill
  (boolean OR). Outer outlines join; interior overlaps disappear.
- **Subtract** — removes every shape behind the topmost selected
  shape from the topmost. Use this to "punch holes".
- **Intersect** — keeps only the area common to every selected
  shape (boolean AND). Hairline overlaps result in a hairline
  output.
- **Exclude** — XOR. Areas covered by an odd number of shapes
  stay filled; even-coverage areas are removed.

## How it works

Powered by the vendored **polygon-clipping** library (~29 KB).
Each Bézier shape gets flattened into polygon segments at a
tolerance that keeps curves visually identical, the boolean op
runs in flat-polygon space, and the result re-encodes as a
single path layer.

## Layer behaviour

- The result is a new layer that **replaces** the selected shapes —
  the originals are removed (use undo if you regret it).
- The new layer inherits the fill / stroke / opacity of the
  **frontmost** selected shape (highest z).
- The new layer's position is the bounding box of all inputs,
  so re-selection handles cover the combined region.

## Tips

- For complex multi-step ops (e.g., "subtract A from B then unite
  with C"), do them one pair at a time — pathfinder operates on
  the current selection.
- The result is still an editable path. [Direct Selection](#/help/tool-direct-select)
  lets you tweak the resulting anchors after the boolean.
- Pathfinder ops on shapes with very dense curves (hundreds of
  control points) can take a noticeable beat — large logos with
  fine detail are the slow case.
