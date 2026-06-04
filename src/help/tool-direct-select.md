# Direct Selection tool (A)

Edits anchors + Bézier handles on a single vector path. The
counterpart to Select, which moves the whole layer.

## Engaging a path

- Switch to the tool (press **A**) and click a vector shape — every
  anchor + handle appears.
- Or with Select active, **double-click** the shape to dive in.
- Non-pen primitives (rectangle, ellipse, polygon, star) auto-convert
  to an editable path when you enter Direct Selection on them.

## Single-anchor interactions

- **Click** an anchor to select it (filled square).
- **Drag** to move just that anchor; the segments connected to it
  follow.
- **Shift+click** more anchors to multi-select.
- **Drag the small handle dot** off an anchor to adjust its tangent.
  By default both handles move symmetrically (smooth point).
- **Alt+drag** a handle to break symmetry — corner point with
  independent handles per side.
- **Click an anchor without dragging, then Alt+click** to flip
  between smooth point and corner point.

## Multi-anchor edits

- Marquee around the path with empty-space drag — every anchor
  inside the marquee selects.
- **Arrow keys** nudge every selected anchor by 1 px. **Shift+Arrow**
  by 10 px.
- **Backspace / Delete** removes selected anchors. Adjacent segments
  rejoin if the removed anchor was interior; the path opens if the
  removed anchor was an endpoint.

## Segment edits

- **Drag a segment** between two anchors to bow it without moving
  the anchors themselves (curve-direct-edit).
- **Click an endpoint** when the path is open to continue drawing
  from it (auto-flips you to the Pen tool with the path's last
  anchor pre-selected).

## Tips

- The tool icon is light blue (vs. the Select tool's black arrow)
  so you can tell at a glance which mode you're in.
- Clicking off-canvas (or pressing **Esc**) deselects all anchors
  and flips back to Select.
- See also: [Pen tool](#/help/tool-pen) for drawing new paths from
  scratch.
