# Pencil tool (B)

Freehand drawing. Your pointer's path is sampled as a polyline of
line segments — each stroke becomes its own `shape` (path) layer.

## Drawing

- **Click + drag** to draw. Release to commit.
- The resulting layer is a vector `shape` (path kind) — same
  underlying data model as a Pen path, so you can edit it with
  [Direct Selection](#/help/tool-direct-select) afterwards (drag
  individual anchors, bow segments, etc).

## Tool options

The right-side **Tool options** pane has two inputs:

- **Stroke colour** — the line colour.
- **Stroke width** — in pixels.

Both apply at draw time. They're separate from any selected
layer's stroke settings.

## Tips

- Pencil strokes are stored as line-to segments (no smoothing in
  v1). For a smoothed curve, draw with the **Pen tool** instead and
  pull tangent handles where you want curves.
- Each release creates a new layer — for multi-stroke sketches you
  can group the layers later via the Layers panel.
- Trackpad input gives you smoother visual motion than a mouse, but
  the underlying path stays a polyline either way.
