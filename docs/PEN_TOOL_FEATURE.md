# Pen & Pencil Tools

## Goals
Add freehand and Bézier path drawing directly on the canvas, plus an editor
tool-mode system with flanking toolbars to host it.

### Product goals
1. A **Pencil** tool for freehand strokes — markup, scribbles, hand-drawn
   accents, tracing over placed artwork.
2. A **Pen** tool for precise Bézier paths — clean cut lines, custom
   silhouettes, editable curves.
3. Pen/pencil output reuses the existing `shape` layer system, so a drawn
   path is a first-class vector layer: solid / gradient fill, stroke,
   opacity, transform, clip, undo, JSON round-trip, Nostr publish, and
   PDF / JPEG export — all free.
4. A canvas tool-mode system with a left tool palette and a right
   contextual options toolbar, styled to match the existing bottom zoom
   toolbar.

### Implementation status — 2026-05-19
- **Phase A** — done. `_editorTool` UI state, left tool palette, right
  contextual options toolbar, pen overlay element, V/P/B + Esc shortcuts.
- **Phase B** — done. Pencil freehand capture, raw polyline, open-path
  shape-layer commit.
- **Phase C** — done. Pen click/drag anchors, rubber-band preview, close /
  Enter / dbl-click / Esc, closed-fill-on-close, `shape.pen.nodes` stored.
- **Phase D** — partial. Editable anchors + Bézier handles for selected
  `tool:'pen'` paths; drag-to-move anchor (carries handles) and drag-to-move
  handle, regenerates `d`, one undo per drag. *Deferred:* add/delete anchor,
  corner↔smooth toggle, click-segment-to-insert, and bbox-refit when an
  anchor is dragged past the original 0–100 viewBox (path clips at the box
  edge until refit lands). Rotated paths are not node-editable in v1.
- **Phase E** — done. `layer.hidden` flag, eye toggle in the layer list, all
  six renderers + Canvas2D export skip hidden layers.
- **Unified vector editing** — done. With the Pen tool active, the options
  panel edits the *selected* shape's fill/stroke (any kind, not just pen
  paths). A **"Make editable path"** button converts a selected primitive
  (rect / rounded-rect / circle / ellipse / triangle / polygon / star /
  line) or single-path uploaded SVG into a `tool:'pen'` editable path, after
  which Phase D anchor editing applies. Primitives convert via exact node
  generators; SVG `d` strings are parsed (M/L/H/V/C/S/Q/T/Z + elliptical
  arcs, abs & rel). *Not convertible:* multi-element SVGs and compound
  (multi-subpath) paths — the panel shows a hint instead.

### Non-goals (v1)
- A raster paint layer (true pixel buffers). Explicitly out of scope — the
  app's design-as-JSON model and Nostr-friendliness depend on storing
  instructions, not bitmaps. A `paint` layer type could be a separate future
  feature; this doc does not pursue it.
- Pressure / tilt / velocity-sensitive brushes.
- Boolean path operations (union / subtract / intersect).
- Moving the existing shape-primitive menu into the left toolbar. The
  sidebar "+ Shape" menu stays; pen/pencil are additive.

---

## Why this fits the repo

The vector-shapes feature already shipped these, all of which a pen path
inherits with zero new renderer code:

- `shape.kind: 'path'` with a `d` string + `viewBox`, rendered on the editor
  canvas, all five preview surfaces, and Canvas2D export.
- `fill`: `none` / `solid` / `linear-gradient` / `radial-gradient`.
- `stroke`: solid, width, dash.
- `clip`: `inline-shape` and `layer-ref` (one shape layer masks another).
- Layer transform (x/y/w/h/rotate/opacity), aspect-lock, lock toggle,
  clipboard, and undo/redo.

So the pen tool is **a path-authoring UI feeding the existing shape model**.
The render/save/export side is essentially done. The new work is: the tool
mode system, the canvas pointer interaction, and an optional editable-node
representation.

### Current-state facts the plan is built on
- Schema version is **5**; this feature bumps it to **6** (additive only).
- Layer types today: `image`, `text`, `color`, `shape`, `qr`.
- Shape kinds: `rect`, `rounded-rect`, `circle`, `ellipse`, `triangle`,
  `polygon`, `star`, `line`, `path`, `svg`.
- There is **no per-layer visibility flag** — only `locked`. This feature
  adds `hidden` (needed for mask-source shapes).
- `shape.kind: 'path'` `d` data lives in its own `viewBox`; the renderer
  already maps that viewBox to the layer box via a `<g transform>`. The pen
  tool exploits this — it can emit `d` in any coordinate space as long as
  `viewBox` matches.
- Layer drag is `startLayerDrag` on a layer wrapper's `pointerdown`. It
  already does the screen-px → sheet-inch math the pen tool needs.

---

## Data model

### Pen/pencil output is a `shape` path layer

```js
{
  id: 'layer-…',
  type: 'shape',
  name: 'Pen path',
  target: 'cover-trim' | 'canvas' | …,
  x, y, w, h, rotate, opacity, z, locked,
  hidden: false,                      // NEW — see "Layer visibility" below
  shape: {
    kind: 'path',
    d: 'M … C … Z',                   // canonical render/export path string
    viewBox: { x, y, w, h },          // the d-string's coordinate space
    pen: {                            // NEW — optional editor metadata
      closed: true,                   // pen-closed path vs open pencil stroke
      tool: 'pen' | 'pencil',         // which tool authored it
      nodes: [                        // anchors with optional Bézier handles
        { x, y, hIn: { x, y } | null, hOut: { x, y } | null },
        …
      ]
    }
  },
  fill: { type: 'solid', color: '#…' },          // pen-closed default
  // or fill: { type: 'none' } for pencil strokes
  stroke: { type: 'solid', color: '#…', width, dash }
}
```

- `d` is the **canonical** value — render, export, and old clients use only
  `d` + `viewBox`. Everything else is editor convenience.
- `shape.pen` is optional metadata. It lets the pen tool reconstruct
  editable anchors later. A path imported via SVG upload won't have it, and
  that's fine — it just isn't node-editable (consistent with today).
- When the user drags an anchor or handle, regenerate `d` from `nodes`.

### Why store `nodes` separately instead of parsing `d`
Parsing an arbitrary SVG path `d` string back into editable Bézier anchors
is fiddly and lossy (arcs, relative commands, shorthand). Keeping `nodes` as
the source of truth for pen-authored paths — and `d` as the derived render
string — sidesteps all of it. SVG-uploaded paths simply have no `nodes` and
stay non-node-editable.

### Layer visibility (`hidden`)
New optional boolean `layer.hidden`. When `true`:
- All six visual renderers and the Canvas2D export **skip** the layer.
- `clip: { kind: 'layer-ref' }` still resolves the hidden layer's geometry —
  so a pen shape drawn purely as a mask can be hidden while still masking.
- The layer list shows an eye toggle.
- `hidden` is in the undo snapshot and the JSON payload (additive — old
  clients ignore it and render the layer, which is acceptable).

This is small but touches every renderer; it ships as its own phase so it
can be verified independently.

---

## Tool-mode system + toolbars

### Editor tool state
New `state.editorTool: 'select' | 'pen' | 'pencil'`, default `'select'`.
- **select** — today's behavior exactly: click/drag layers, click to
  select. Nothing changes.
- **pen** / **pencil** — canvas pointer events route to the drawing handler;
  layer drag/select is suppressed while drawing.
- `editorTool` is **UI state, not design state** — it is NOT part of the
  undo snapshot and NOT saved to JSON.
- `Esc` always returns to `select` (and cancels an in-progress path).

### Left toolbar — tool palette
A thin vertical strip floating on the **left edge** of the preview area
(absolute-positioned inside `previewShell`, same visual language as the
sticky bottom zoom toolbar). Visible in template modes **and** Disc
Designer mode.

```
┌──┐
│ ▸│  Select   (V)
│ ✎│  Pen      (P)
│ ✐│  Pencil   (B)
└──┘
```

Each button sets `state.editorTool`. The active tool is highlighted.
Single-key shortcuts (V / P / B) when no input is focused.

### Right toolbar — contextual tool options
A floating panel on the **right edge** of the preview area, **visible only
when `editorTool !== 'select'`**. Shows the active tool's configuration:

- **Pencil options**: stroke color and stroke width. No smoothing control —
  pencil strokes are intentionally raw polylines. A Done / Cancel pair.
- **Pen options**: fill on/off + fill color, stroke color + width,
  "close path" toggle, and Finish / Cancel. While editing an existing
  path's nodes: Add point / Delete point / toggle corner-smooth hints.

Defaults persist across drawings in a session (so you don't re-pick red
every stroke) but are NOT design state.

### Why floating toolbars, not sidebar panels
The user specifically wants Figma/Illustrator-style flanking toolbars, and
the bottom zoom toolbar already established the floating-over-canvas
pattern. The left/right bars reuse that CSS treatment (translucent panel,
rounded, subtle shadow). Keeps the sidebar focused on layer/project
controls.

---

## Pointer interaction

A dedicated **pen overlay** — an absolutely-positioned, full-bleed SVG layer
on top of the active canvas host — captures pointer events while a drawing
tool is active. It renders the in-progress path, anchors, and handles, and
on finish commits a real shape layer. When `editorTool === 'select'` the
overlay has `pointer-events: none` and is invisible.

The overlay attaches to whichever canvas host is active: `#sheet` in
template modes (cover / disc / jewel / customart) or `#designerDiscWrap` in
Disc Designer mode. The Disc Designer canvas is circular only as visual
framing — paths are still drawn in the disc's square bounding box, so the
pen tool works there with no special-casing beyond the coordinate scale.

All coordinates are captured in **canvas-inch space** by reusing the
screen-px → inch math from `startLayerDrag`, which already branches
`isDesignerLayer ? discTemplate.discD : sheetW()/sheetH()` and accounts for
the current zoom scale. Paths committed in Disc Designer mode get
`target: 'designer-disc'`; template-mode paths get the active sub-mode's
target.

### Pencil (freehand)
1. `pointerdown` on the overlay → start a stroke, push the first point.
2. `pointermove` → append points (minimum-distance filtered so a single
   stroke doesn't capture thousands of near-identical points).
3. `pointerup` → finish:
   - **No smoothing.** The stroke is a raw polyline through the captured
     points — straight `L` segments, deliberately a little jaggy (the
     "early-web" look the project wants). Light distance-decimation only,
     to keep the `d` string a sane length; no Bézier fitting, no
     Catmull-Rom, no smoothing slider.
   - Compute the bounding box → that's the new layer's `x/y/w/h` (inches)
     and the shape `viewBox`.
   - Build the `d` string (open path: `M` + `L` segments, no `Z`).
   - Commit a `shape` layer: `fill: { type: 'none' }`,
     `stroke: { type: 'solid', … }`, `shape.pen = { closed: false,
     tool: 'pencil', nodes }`.
   - One `pushHistory('draw pencil stroke')` snapshot for the whole stroke.
4. Tool stays `pencil` so the user can keep drawing strokes.

### Pen (Bézier)
1. `pointerdown` → place an anchor. If it's a quick click → corner anchor
   (no handles). If the user `pointermove`s before `pointerup` → drag out
   symmetric Bézier handles (smooth anchor).
2. The overlay live-previews the path through the placed anchors plus a
   "rubber-band" segment to the cursor.
3. Finish the path by any of: clicking the first anchor (closes it),
   pressing `Enter` (open path) or double-click, or `Esc` (cancel).
4. On finish:
   - Build `d` from `nodes` (`M` + `C`/`L` segments, `Z` if closed).
   - bbox → layer `x/y/w/h` + `viewBox`.
   - Commit a `shape` layer: closed → `fill: { type: 'solid', … }`;
     open → `fill: { type: 'none' }` + stroke. `shape.pen = { closed,
     tool: 'pen', nodes }`.
   - One `pushHistory('draw pen path')` snapshot.
5. Tool stays `pen` for the next path.

### Editing an existing pen path
With the Pen tool active and a `shape` layer that has `shape.pen.nodes`
selected, the overlay shows the editable anchors + handles:
- Drag an anchor → move it; drag a handle → reshape the curve.
- Click an anchor to select; `Delete` removes it.
- Click a segment to insert an anchor.
- Alt-click an anchor toggles corner ↔ smooth.
- Every committed edit regenerates `d` and pushes one undo snapshot.

SVG-uploaded paths (no `nodes`) are not node-editable — selecting one with
the Pen tool shows a hint to that effect.

---

## Masking with pen shapes

Already supported by `clip: { kind: 'layer-ref', layerId }` — any layer can
point at a shape layer (including a pen path) and use its geometry as a
mask. The pen tool needs **no new mask code**; it just produces shape layers
that the existing clip system can reference.

What this feature adds for a clean mask workflow:
1. The `hidden` flag (above), so a pen shape used purely as a mask can be
   hidden while still masking.
2. A convenience action — "Use as clip for selected layer" — in the pen
   path's controls or a right-click affordance. Optional polish.

**Known caveat** (carried over from the vector-shapes design): a `layer-ref`
clip uses the referenced shape's path geometry normalized to the *clipped
layer's* bounding box — it is not yet a Photoshop-style absolute-canvas
mask. For v1 that's fine. A future `clip.mode: 'absolute'` could compute the
mask layer's transform relative to the clipped layer at render time; out of
scope here.

---

## Rendering & export

Essentially free. A committed pen/pencil layer is a `shape.kind: 'path'`
layer, so:
- `buildShapeSvgInner` already renders path kinds on all six surfaces.
- `drawShapeLayerToCanvas` already draws path kinds via `Path2D` for
  PDF / JPEG export.
- Fill / gradient / stroke / clip / opacity / rotate all already apply.

The only renderer change in the whole feature is the `hidden` skip, which is
one early-`continue` per renderer.

---

## Phased delivery

### Phase A — Tool-mode system + toolbars
- `state.editorTool` + Esc-to-select.
- Left tool palette (Select / Pen / Pencil) floating on the canvas, with
  V / P / B shortcuts.
- Right contextual options toolbar shell, shown only for non-select tools.
- The pen overlay element (inert for now).
- No drawing yet — just mode plumbing and the UI shell.

**Ship gate**: switching tools highlights the palette and shows/hides the
right toolbar; Esc returns to Select; nothing else regresses.

### Phase B — Pencil tool
- Freehand capture on the overlay; raw polyline, distance-decimation only,
  no smoothing.
- Commit an open-path `shape` layer with stroke, no fill.
- Right toolbar: stroke color / width.
- One undo snapshot per stroke.

**Ship gate**: draw a stroke, it becomes a selectable shape layer that
round-trips through save/load and exports to PDF.

### Phase C — Pen tool (create)
- Click = corner anchor, click-drag = smooth anchor.
- Live rubber-band preview overlay.
- Close via first-anchor click; finish via Enter / double-click; cancel
  via Esc.
- Commit a closed (fillable) or open `shape` layer; store `shape.pen.nodes`.
- Right toolbar: fill on/off + color, stroke, close-path.

**Ship gate**: draw a closed Bézier shape, fill it with a gradient using the
existing fill controls, export it.

### Phase D — Pen path editing
- Editable anchors/handles overlay for layers with `shape.pen.nodes`.
- Move / add / delete anchors; corner ↔ smooth toggle; regenerate `d`.
- One undo snapshot per committed edit.

**Ship gate**: re-open a pen path, drag an anchor, the path updates and
re-exports correctly.

### Phase E — Layer visibility + mask polish
- `layer.hidden` flag; eye toggle in the layer list; all renderers + export
  skip hidden layers; `layer-ref` clips still resolve hidden geometry.
- "Use as clip for selected layer" convenience action.

**Ship gate**: a hidden pen shape masks an image and doesn't render itself;
toggling the eye shows it again.

---

## Risks & tradeoffs

| Risk | Mitigation |
|---|---|
| Tool-mode changes the canvas pointer contract — could regress layer drag/select | `select` mode keeps the exact current code path; pen/pencil only intercept when active. Heavy regression testing on Phase A. |
| Coordinate mapping under zoom / scroll | Reuse the proven screen-px → inch math from `startLayerDrag`; capture in inch space throughout. |
| Freehand strokes produce huge `d` strings | RDP simplification on `pointerup`; tune epsilon so visual fidelity holds while node count stays modest. |
| Pen path `d` ↔ `nodes` drift | `nodes` is the source of truth for pen-authored paths; `d` is always regenerated from `nodes`, never hand-edited. |
| `hidden` flag touches all 6 renderers + export | Isolated as Phase E; one-line skip per renderer; explicit acceptance test. |
| Old clients ignore `hidden` and render a mask-only shape | Acceptable — the design still reads; a future schemaVersion bump can formalize it. |
| Disc Designer uses a different canvas host + coordinate scale | Overlay attaches to `#designerDiscWrap`; coordinate capture branches on `isDesignerLayer` exactly like `startLayerDrag` already does. |
| Mask geometry is normalized-to-clipped-layer, not absolute | Documented caveat; `clip.mode: 'absolute'` is future work. |
| Two new floating toolbars crowd the canvas on small screens | Collapse/auto-hide on narrow viewports; the right toolbar is already conditional on tool mode. |

---

## Open questions

1. **Pencil smoothing** — DECIDED: no smoothing. Pencil strokes are raw
   polylines (straight segments through captured points). Deliberately a
   bit jaggy — matches the project's early-web aesthetic. No smoothing
   slider, no Bézier fitting on freehand strokes.
2. **Pencil node-editability** — DECIDED: no. Only pen paths are
   node-editable. A pencil stroke commits as a plain `kind: 'path'` layer
   (no `shape.pen`); "Make editable path" still works on it by parsing the
   `d` string. The pencil path is stored in a **pixel-space viewBox**
   (1 unit = 1px) rather than a 0–100 one, so its `stroke-width` is a true
   on-screen thickness — constant regardless of stroke length or direction.
3. **Closed pen path default fill** — DECIDED: yes, fill it on close with a
   solid accent color, so a finished closed path is immediately visible.
   The user can switch to none / gradient via the existing fill controls.
4. **Disc Designer support** — DECIDED: yes, pen + pencil work in Disc
   Designer mode too. The overlay attaches to `#designerDiscWrap`; the
   circular canvas is just visual framing.
5. **Touch / stylus** — capture works via Pointer Events (already used for
   layer drag), so basic touch drawing is free. Pressure is a non-goal.
6. **Schema bump** — set `schemaVersion` to 6 when this lands. Old payloads
   (v5) still load; `shape.pen` and `hidden` are additive.
7. **Where do the shape primitives ultimately live?** Long-term they could
   move from the sidebar "+ Shape" menu into the left tool palette. Out of
   scope for v1.

### Noted for later (out of scope here)
The project owner is considering merging the **Custom Art** layout into the
**Disc Designer** tab and renaming the tab to just **"Designer"**, with
*disc* becoming one of several artboard layout options inside it — so the
designer tab becomes a fully-featured surface rather than a disc-only one.
The pen tool does not depend on or block this: it produces plain `shape`
layers keyed by `target`, so it works regardless of how the tabs are
ultimately organized. Flagged here only so the eventual restructure keeps
the pen tool's per-mode overlay-host logic in mind.

---

## Acceptance summary

### Phase A
- [ ] Left tool palette switches `state.editorTool`; active tool highlighted.
- [ ] V / P / B shortcuts work when no input is focused; Esc → Select.
- [ ] Right options toolbar appears only for Pen/Pencil.
- [ ] Select mode behaves exactly as before — no drag/select regression.

### Phase B
- [ ] Freehand pencil stroke commits an open-path shape layer.
- [ ] Stroke round-trips through save/load and Nostr publish/fork.
- [ ] Exports correctly to PDF / JPEG.
- [ ] One undo entry per stroke.

### Phase C
- [ ] Pen places corner + smooth anchors; live preview is accurate.
- [ ] Closing / finishing / cancelling all work.
- [ ] Closed path is fillable with the existing solid/gradient controls.
- [ ] `shape.pen.nodes` persists through save/load.

### Phase D
- [ ] A pen path re-opens with editable anchors/handles.
- [ ] Move / add / delete anchors regenerates `d` and re-exports.
- [ ] SVG-uploaded paths show a "not node-editable" hint.

### Phase E
- [ ] `hidden` layers are skipped by every renderer and the export.
- [ ] A hidden pen shape still works as a `layer-ref` clip.
- [ ] Eye toggle in the layer list flips `hidden`.
