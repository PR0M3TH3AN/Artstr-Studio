# Shape tool (S)

Drops vector primitives by drag-creating a bounding box on the
canvas. The right-side **Tool options** pane picks which primitive +
its fill / stroke before you drag.

## Primitives

The options pane's **Shape** dropdown:

- **Rectangle** — drag a bounding box.
- **Rounded rectangle** — same but with a configurable corner radius.
- **Circle** — perfect circle inscribed in the drag bbox.
- **Ellipse** — ellipse inscribing the drag bbox.
- **Triangle** — equilateral-ish triangle inscribed in the bbox.
- **Polygon** — N-sided regular polygon.
- **Star** — M-pointed star.
- **Line** — line from drag start to drag end.

## Tool options

- **Shape** — the dropdown above.
- **Fill** checkbox — toggle whether the new shape gets a solid fill.
- **Fill colour** — picker when Fill is on.
- **Stroke colour** + **Stroke width** — applies as the new shape's
  stroke. Setting Stroke width to 0 + Fill on = filled-only.

## Why these are vector

Every primitive stores an internal `shape.kind` plus parameter data
(point count, inner radius, corner radius, etc). You can tweak those
parameters later from the layer-options pane. Switching to **Direct
Selection** on a primitive auto-converts it into an editable
anchors-plus-handles path, after which the primitive parameters are
replaced by the raw path data.

## Tips

- For non-rectangular text containers: draw a shape, then add a text
  layer on top + use the text layer's **Clip** option (in the layer-
  options pane) to clip the text to the shape.
- The **line** primitive's endpoints are anchors — switching to
  Direct Selection lets you move each endpoint independently.
- A drag shorter than ~0.08 in drops a default-sized shape at the
  cursor (so a click without dragging still creates something).
