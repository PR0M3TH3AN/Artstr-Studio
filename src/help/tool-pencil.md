# Pencil tool (B)

Freehand drawing. Your pointer's path is recorded as a sequence of
points then smoothed into a Bézier path on release.

## Drawing

- **Click + drag** to draw. Release to commit.
- The resulting layer is a vector `shape` (path kind) — identical
  data model to a path drawn with the Pen tool, so you can edit it
  with [Direct Selection](#/help/tool-direct-select) afterwards.

## Smoothing

The pencil applies a default smoothing pass that:

- Drops every Nth point to reduce noise.
- Fits Bézier handles to the remaining points using a curvature-
  preserving algorithm.
- Closes the path automatically if your release point is within a
  short distance of the start (configurable threshold).

The right-side **Tool options** pane has a smoothing slider — drop
it to 0 to get every raw input point preserved; crank it up for
sketch-style smoothed strokes.

## Modifiers

- **Alt+drag** — add to the currently-selected path (extends it
  from the closest endpoint).
- **Shift+click** an endpoint of the currently-selected path to
  continue from that endpoint with a single straight segment.

## Stroke + fill

Like the Pen, the active **Stroke** panel + **Fill** panel apply at
draw time. A pencil layer with a fill becomes a closed-shape fill;
with stroke only it stays a single drawn line.

## Tips

- Trackpad input gives you nicer curves than a mouse — natural
  micro-jitter feeds the smoother better.
- For a pixel-perfect path, switch to the **Pen** tool instead —
  Pencil is for organic strokes, Pen for deliberate Bézier work.
