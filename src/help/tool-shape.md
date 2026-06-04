# Shape tool (S)

Drops vector primitives — rectangle, ellipse, polygon, star, line.
The right-side **Tool options** pane picks the primitive + per-shape
parameters before you drag.

## Primitives

- **Rectangle** — drag a bounding box.
- **Ellipse** — drag a bounding box; the ellipse inscribes it.
- **Polygon** — N-sided regular polygon. The options pane sets the
  side count (3 – 32) before you drag.
- **Star** — M-pointed star. Options pane sets points + inner-radius
  ratio.
- **Line** — drag from start to end.

## Drag modifiers

- **Shift** — constrain to a perfect square / circle, snap polygon
  rotation to 15°, lock line to 45° angles.
- **Alt** — draw from the centre outward instead of corner-to-corner.

## Why these are vector

Every shape is stored as a Bézier path under the hood. Switching to
**Direct Selection** on any of them auto-converts the primitive into
an editable anchors-plus-handles path. You can then add / remove /
modify anchors like any other path.

## Fill + stroke

The right-side **Fill** and **Stroke** panels apply at draw time:

- Solid colour, gradient, or "none".
- Stroke width, dash pattern, line cap.
- The active settings render live in the preview while you drag.

## Tips

- For non-rectangular text containers, draw a shape, then add a text
  layer on top + use the layer's **Clip** option to clip the text
  to the shape.
- The **line** primitive's endpoints are anchors — they show up under
  Direct Selection and can be moved independently.
