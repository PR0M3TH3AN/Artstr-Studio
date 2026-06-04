# Free Transform

Rotation + scale handles wrapped around the combined bounding box of
the current selection. Lets you transform multiple layers as a group
without flipping tools.

## When the handles appear

- Select any layer with the [Select tool](#/help/tool-select) — the
  eight bounding-box handles + the small rotation handle appear
  automatically.
- Multi-select two or more layers — the handles wrap the combined
  bounding box.
- Press the **Free Transform** button (right-side toolbox) explicitly
  to refresh the handles after a manual property edit.

## Handles

- **Eight bbox handles** — corners scale on both axes; sides scale
  on one axis. Hold **Shift** to keep the aspect ratio on a corner
  drag.
- **Rotation handle** — small dot above the top edge. Drag to
  rotate around the bbox centre. Hold **Shift** to snap to 15°
  increments.

## Multi-layer behaviour

When two or more layers are selected:

- Scaling proportionally rescales each layer's `x`, `y`, `w`, `h`
  relative to the combined bounding box. Layers far from the
  pivoted handle move and resize more than layers near it (the
  intuitive result).
- Rotating rotates each layer around the **group** centre. Each
  layer's individual `rotate` value increments by the rotation
  amount, and its `x/y` recompute to walk the orbit.

## Tips

- Free Transform composes well with [Align & Distribute](#/help/align-distribute) —
  resize a row of layers to a common size with the scale handles
  first, then align them.
- For a single layer, the same handles + behaviour are available
  via plain Select. Free Transform's value is the multi-layer
  group transform.
- Locked layers in the selection are ignored — they stay put while
  the rest of the group transforms around them.
