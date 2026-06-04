# Select tool (V)

The default tool. Moves, scales, and rotates whole layers.

## Single-layer interactions

- **Click** a layer to select it. Eight handles appear around the
  bounding box.
- **Drag** the layer body to move it.
- **Drag a corner handle** to scale on both axes.
- **Drag a side handle** to scale on one axis.
- **Drag the rotate handle** above the top edge to rotate.
- **Cmd/Ctrl + D** duplicates the selected layer.

## Multi-select

- **Shift+click** (or Cmd / Ctrl + click) another layer to add it to
  the selection.
- **Marquee box-select** — click an empty area of the canvas and drag.
  Every layer whose bounding box intersects the marquee joins the
  selection. Hold **Shift / Cmd / Ctrl** while marqueeing to add to
  the existing selection instead of replacing it.

With ≥2 layers selected, the **Align & Distribute** panel + the
**Pathfinder** ops (for vector shapes) become available.

## Dive into a path

- **Double-click** a vector shape with Select active to flip to
  Direct Selection on that path. The path's anchors + handles
  appear so you can edit them.
- Clicking outside the shape with Direct Selection active deselects
  and pops you back to Select.

## Tips

- A locked layer (lock icon in the Layers panel) refuses drag input
  on the canvas; the row in the list still highlights on hover.
- Hidden layers (eye icon off) don't intercept canvas clicks at all.
