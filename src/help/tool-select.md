# Select tool (V)

The default tool. Moves, scales, and rotates whole layers.

## Single-layer interactions

- **Click** a layer to select it. Eight handles appear around the
  bounding box.
- **Drag** to move. Hold **Shift** to constrain to the nearest 45°
  axis (horizontal, vertical, or diagonal).
- **Drag a corner handle** to scale. Hold **Shift** to keep the
  aspect ratio.
- **Drag a side handle** to scale on one axis.
- **Drag the small rotate handle** above the top edge to rotate. Hold
  **Shift** to snap to 15° increments.
- **Hold Alt while dragging** to duplicate the layer in place.

## Multi-select

- **Shift+click** another layer to add it to the selection.
- **Cmd/Ctrl+A** selects every layer on the current surface.
- **Marquee box-select** — click an empty area of the canvas and drag.
  Every layer whose bounding box intersects the marquee joins the
  selection.

With ≥2 layers selected, the **Align & Distribute** panel + the
**Pathfinder** ops (for vector shapes) become available.

## Dive into a path

- **Double-click** a vector shape with Select active to flip to
  Direct Selection on that path. The path's anchors + handles
  appear so you can edit them.
- Clicking outside the shape with Direct Selection active deselects
  and pops you back to Select.

## Tips

- The Select tool ignores the per-layer visibility / lock state set
  in the Layers panel. A locked layer still highlights on hover but
  refuses drag input.
- Hold **Cmd/Ctrl** while clicking to pick up a layer that's behind
  another layer at the click point (z-stack walk).
