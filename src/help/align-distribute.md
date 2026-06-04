# Align & Distribute

Lines up multiple selected layers along a shared axis; spaces them
evenly. Lives in the right-side **Align** panel, available whenever
≥2 layers are selected.

## Align ops

Six alignment ops, organised in two rows. Each acts on every layer
in the current selection:

### Horizontal align (uses each layer's left / center / right edge)

- **Align left** — every layer's left edge sets to the leftmost
  selected layer's left.
- **Align horizontal center** — every layer's horizontal center
  sets to the midpoint of the selection's combined bounding box.
- **Align right** — every layer's right edge sets to the
  rightmost selected layer's right.

### Vertical align (uses each layer's top / middle / bottom edge)

- **Align top** — every layer's top sets to the topmost selected
  layer's top.
- **Align vertical middle** — every layer's vertical middle sets
  to the midpoint of the selection's combined bounding box.
- **Align bottom** — every layer's bottom sets to the bottommost
  selected layer's bottom.

## Distribute ops

Spread three or more selected layers so their spacing is even.
The outermost two layers stay put; intermediate layers redistribute.

- **Distribute horizontal centers** — equal horizontal-center
  spacing.
- **Distribute vertical centers** — equal vertical-center spacing.
- **Distribute horizontal gap** — equal *gap* between layer
  bounding boxes horizontally (different from center-spacing when
  layers have different widths).
- **Distribute vertical gap** — equal vertical gap.

## Behaviour notes

- A locked layer in the selection is **ignored** by both align and
  distribute — it stays put while everything else rearranges
  around it.
- The selection's combined bounding box is the reference for the
  "center" ops. If you want to align to the canvas centre, select
  every layer + the canvas margin first (or use a background-spanning
  color layer).

## Tips

- For evenly-spaced rows of cards / chapters / icons: layout the
  first and last positions, then **Distribute horizontal gap** with
  the row of layers selected — the middles snap into place.
- Combine with **Free Transform** to scale + align in two steps:
  free-transform-scale to size everything to a common dimension,
  then align.
