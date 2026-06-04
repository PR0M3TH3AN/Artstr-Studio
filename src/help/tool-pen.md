# Pen tool (P)

Illustrator-parity Bézier path tool. Click to drop anchors,
click-drag for tangent handles. Outputs a vector `shape` layer
(path kind) — editable later with [Direct Selection](#/help/tool-direct-select).

## Drawing a new path

- **Click** to drop a corner anchor.
- **Click-drag** to drop an anchor and pull tangent handles for a
  smooth curve.
- **Shift+click** constrains the segment to a 45° angle (horizontal,
  vertical, or diagonal).
- **Close the path** by clicking the first anchor (the cursor shows
  a small ○ when you're over it).
- **Esc** or switching tools commits the draft as an open path.

## Modifying mid-draw

- **Spacebar (hold)** — reposition the anchor you're currently
  placing without dropping it. Release to commit.
- **Alt+drag** while pulling a handle — break symmetry so the
  outgoing and incoming handles can point in different directions
  (corner-with-handles).
- **Click the most recent anchor** before clicking elsewhere to
  delete just that handle, switching it from smooth to corner.

## Editing an existing path

When the Pen tool's cursor hovers over an existing path of the
selected layer:

- **Click a segment** between two anchors → adds a new anchor at
  that point.
- **Click an anchor** → removes it (auto-rejoin neighbours).
- **Click an endpoint** when the path is open → continues drawing
  from that endpoint.

When hovering an anchor on a path **not** currently selected, the
Pen cursor stays as the normal pen — click only selects the layer.

## Multi-path operations

With ≥2 vector shapes selected, the **Pathfinder** panel becomes
available:

- **Unite** — boolean OR.
- **Subtract** — front minus back.
- **Intersect** — boolean AND.
- **Exclude** — XOR.

See [Pathfinder](#/help/pathfinder) for the full ops list.

## Joining and averaging anchors (Cmd+J / Cmd+Alt+J)

With **multiple anchors selected via the Direct Selection tool**:

- **Cmd+J** — join the two endpoints into a single anchor (or
  bridge two open paths into one). If the two endpoints are
  coincident, they merge; otherwise a connecting straight segment
  is added.
- **Cmd+Alt+J** — average (move both anchors to the midpoint
  between them). Combined with **Cmd+J** afterwards, gives you a
  literal Illustrator-style merge.

## Tips

- The Pen tool's options pane has its own **Fill colour**, **Stroke
  colour**, and **Stroke width** inputs — set them before you start
  drawing for immediate visual feedback. They're separate from any
  layer's existing stroke settings.
- The **Fill closed path** checkbox in the options pane controls
  whether a closed path renders with its fill colour or stays
  outline-only.
- Pen and Pencil store the same underlying path data, so a Pencil
  sketch can be opened with Direct Selection + edited with the Pen
  ops without conversion.
