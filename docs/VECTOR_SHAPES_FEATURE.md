# Vector Shapes, Fills, and Masking

## Goals
Expand the layer system from "image / text / color rectangle" into a real **vector design surface**: shape primitives, custom paths, solid + gradient fills, strokes, and clip/mask composition. All purely client-side, all JSON-serializable, all backwards-compatible with existing templates and the existing print/PDF/JPEG export.

### Product goals
1. Open the door to creative work that requires more than photos + text — accents, frames, geometric overlays, stylized backgrounds, branded shapes.
2. Make masking (circle crops, star-shaped photos, gradient-faded artwork) possible inside the editor without external tools.
3. Stay print-safe: vectors render crisply at any output resolution.
4. Round-trip through the existing project JSON and Nostr publish flow with no migration step.

### Non-goals (v1)
- A pen tool / interactive bezier editing surface. Users paste an SVG `d=` string for custom paths.
- SVG import as a whole (parsing `<svg>` files, handling nested groups). Single `<path d=…>` only.
- Conic gradients, mesh gradients, patterns, image-fill of shapes.
- Outside / inside stroke positions (center stroke only — outside-positioned strokes require path inflation).
- Stroke dash editing UI. v1 picks from a small preset list.
- Mask groups (multiple shapes union'd as a single mask). v1 supports a single shape clip per layer or a single layer-as-mask reference.
- Animated gradients or shapes.

---

## Current state

Layers today are objects in `state.layers[]`:

```js
{ id, type, name, target, x, y, w, h, rotate, opacity, z, locked, …type-specific }
```

with three concrete types:
- `image` → `src`, `fit?`
- `text` → `html`, `fontSize`, `color`, `align`, `bold`, `italic`, `fontFamily`
- `color` → `color` (flat rectangle fill, currently the closest we have to a shape primitive)

Renderers branch on `type` in roughly five places:
1. `renderLayers` (main editor canvas)
2. `renderTemplatePreviewDOM` (cover preview)
3. `renderDiscSheetPreviewDOM` (disc-sheet preview)
4. `renderJewelPreviewDOM` (jewel preview)
5. `renderDiscPreviewDOM` (disc-design preview)
6. `renderCustomArtPreviewDOM` (custom art preview)
7. Canvas rendering for PDF/JPEG export

Each renderer has the same shape:
```js
if (layer.type === 'text') { … }
else if (layer.type === 'image' && layer.src) { … }
else if (layer.type === 'color') { … }
```

Coordinates are in **inches** for `x`, `y`, `w`, `h`.

---

## Data model

### New layer type: `shape`

A single mega-type covers every primitive plus custom paths, with a discriminated `shape.kind` field. This keeps the number of renderer branches at one (not seven, one per primitive).

```js
{
  id: 'layer-…',
  type: 'shape',
  name: 'Star burst',
  target: 'cover-trim' | 'back' | 'spine' | 'front' | 'disc-top' | 'disc-bottom' | 'jewel-front' | 'jewel-tray' | 'designer-disc' | 'canvas',
  x, y, w, h, rotate, opacity, z, locked,
  shape: {
    kind: 'rect' | 'rounded-rect' | 'ellipse' | 'circle' | 'polygon' | 'star' | 'line' | 'path',
    // kind-specific (all optional except where noted):
    cornerRadius?: number,        // rounded-rect (in shape-local units, 0..min(w,h)/2)
    sides?: number,               // polygon (default 6)
    points?: number,              // star (default 5)
    innerRadiusRatio?: number,    // star (0..1, default 0.45)
    d?: string,                   // path — SVG path data normalized to a 0..1 viewbox
    x1?, y1?, x2?, y2?: number    // line endpoints (0..1 in shape-local)
  },
  fill: {
    type: 'none' | 'solid' | 'linear-gradient' | 'radial-gradient',
    color?: '#hex',               // solid
    stops?: [{ at: 0..1, color: '#hex' }, …],  // gradients, at least 2 stops
    angle?: number,               // linear gradient, degrees
    center?: { x: 0..1, y: 0..1 },// radial gradient center (in shape-local coords)
    radius?: number               // radial gradient radius (0..1)
  },
  stroke: {
    type: 'none' | 'solid',
    color?: '#hex',
    width?: number,               // inches
    dash?: 'solid' | 'dashed' | 'dotted' | string  // string = SVG dash array
  },
  clip?: {
    kind: 'inline-shape',
    shape: { /* full shape sub-object, same structure as `shape` above */ }
  } | {
    kind: 'layer-ref',
    layerId: 'layer-…'
  }
}
```

The `clip` field is **optional and can be applied to any layer type**, not just shapes. So an `image` layer can have `clip: { kind: 'inline-shape', shape: { kind: 'circle' } }` to mask a photo into a circle without needing a separate shape layer.

### Why one mega-type instead of one per primitive

- Keeps renderer code to a single `case 'shape':` branch in every renderer.
- Selected-layer controls dispatch on `shape.kind` for kind-specific params (corner radius, sides, etc.) but share the fill / stroke / clip panels.
- Easier to add a new `kind` later (e.g. `arrow`, `speech-bubble`) without touching every renderer.

### Why a discriminated `clip` object

- `kind: 'inline-shape'` covers 90% of users — "crop my photo to a circle / star / heart."
- `kind: 'layer-ref'` covers the power case — "let me use *that* hand-drawn vector shape as a mask for *this* image."
- A future `kind: 'union'` could combine multiple mask shapes; not v1.

### Backwards / forwards compat

- Existing `color` layers are untouched. A flat-color rectangle is now possible two ways: legacy `type: 'color'` (kept forever) and new `type: 'shape', shape: { kind: 'rect' }, fill: { type: 'solid' }`. The renderer handles both.
- Old clients seeing `type: 'shape'` skip the layer — the rest of the design still renders. Same fail-soft behavior as today's old clients ignoring `type: 'color'`.
- Future `shape.kind` values we haven't shipped yet are also skipped individually by clients that don't recognize them.
- `clip` on existing layer types is purely additive. Clients that don't know about it render the layer un-clipped, which is uglier but not broken.

### JSON example (one shape layer with a gradient and a clip)

```json
{
  "id": "layer-1742000000-001",
  "type": "shape",
  "name": "Accent burst",
  "target": "cover-trim",
  "x": 1.5, "y": 0.5, "w": 1.0, "h": 1.0,
  "rotate": 0, "opacity": 0.85, "z": 7,
  "shape": {
    "kind": "star",
    "points": 8,
    "innerRadiusRatio": 0.4
  },
  "fill": {
    "type": "linear-gradient",
    "angle": 135,
    "stops": [
      { "at": 0, "color": "#fbbf24" },
      { "at": 1, "color": "#dc2626" }
    ]
  },
  "stroke": {
    "type": "solid",
    "color": "#7f1d1d",
    "width": 0.01,
    "dash": "solid"
  }
}
```

That's it. No new top-level fields on the project JSON, no migration step, no external assets.

---

## Rendering

### DOM (editor + 6 preview surfaces)

Today each layer renders as a `<div>` positioned absolutely with `transform: translate() rotate()`. For shape layers, we keep the `<div>` wrapper (so the position / rotation / opacity / drag-handle code is unchanged), and inject an inline `<svg>` filling 100% of the wrapper.

The SVG sets `viewBox="0 0 100 100"` (a normalized coordinate space) so all shape math works in 0–100 units regardless of the actual layer w/h in inches. Stroke width converts: `(stroke.width / max(w_inches, h_inches)) * 100`.

```js
function renderShape(svgEl, layer) {
  const { shape, fill, stroke } = layer;
  const defs = [];

  if (fill.type === 'linear-gradient' || fill.type === 'radial-gradient') {
    defs.push(buildGradientDef(layer.id, fill));
  }

  const path = buildShapePath(shape);   // returns SVG <path> / <circle> / etc.
  applyFill(path, fill, layer.id);
  applyStroke(path, stroke, layer);

  svgEl.innerHTML = `<defs>${defs.join('')}</defs>${path}`;
}
```

`buildShapePath` is a switch on `shape.kind`:
- `rect`: `<rect width="100" height="100"/>` (with `rx` for rounded-rect)
- `circle` / `ellipse`: `<ellipse cx="50" cy="50" rx="50" ry="50"/>`
- `polygon`: compute `<polygon points="…">` from `sides`
- `star`: compute `<polygon points="…">` from `points` + `innerRadiusRatio`
- `line`: `<line x1=… y1=… x2=… y2=… />`
- `path`: `<path d="<sanitized d>" />`

Inline gradients are referenced via `fill="url(#grad-<layerId>)"`. The gradient `id` is namespaced by layer id so multiple shape layers don't collide.

### Canvas (PDF / JPEG export)

Canvas2D natively supports everything we need:
- `ctx.beginPath() / ellipse() / rect() / moveTo() / lineTo() / fill() / stroke()`
- `ctx.createLinearGradient(x0,y0,x1,y1) / addColorStop(...)`
- `ctx.createRadialGradient(...)` for radial
- `ctx.setLineDash([...])` for dash patterns
- `ctx.clip()` for masks (called after a fill or shape path is built but before the next layer draws — needs save/restore discipline)

The canvas renderer parallels the SVG renderer 1:1. Each shape kind has a "build the path on the context" function that the SVG renderer would translate to attributes.

### Print/PDF fidelity

- SVG renders crisply in `window.print()` PDF in all modern browsers. We've already verified this with the existing text layer rendering.
- `clip-path: path(…)` is well-supported in Chromium (Chrome, Edge, Brave) and Safari ≥ 16. Older Firefox versions had known bugs.
- Fallback: when print fidelity matters most (the JPEG export path), we route through canvas, where `ctx.clip()` is rock-solid.

---

## UX

### Adding shapes
Next to the existing "Add image / Add text / Add color block" buttons in each layer panel:

```
[ + Image ]  [ + Text ]  [ + Color ]  [ + Shape ▾ ]
                                        │
                                        ├─ Rectangle
                                        ├─ Rounded rect
                                        ├─ Circle
                                        ├─ Ellipse
                                        ├─ Triangle
                                        ├─ Polygon
                                        ├─ Star
                                        ├─ Line
                                        └─ Custom path (SVG)…
```

Clicking a primitive inserts a centered shape at 50% of the target bounds with a sensible default fill (the existing accent blue at 100% opacity).

"Custom path (SVG)" opens a small modal:
- Textarea for the `d=` data
- Live preview as the user pastes
- Validate: parse `d` and reject anything containing `<`, `>`, or `script` (defensive; we never `innerHTML` the raw data, only set it as a `d` attribute)
- "Add to canvas" inserts it as a path-kind shape layer

### Selected-layer controls
When a shape layer is selected, the existing "Selected layer" panel grows three sub-panels (in addition to the existing position/rotation/opacity controls):

1. **Shape** — kind-specific params:
   - rounded-rect: corner radius slider
   - polygon: sides number (3..12)
   - star: points number (3..12) + inner-radius slider
   - line: stroke-width is the visible attribute; the path is built from endpoints
   - path: a small "Edit path data…" button that reopens the SVG textarea modal

2. **Fill** — fill-type select (none / solid / linear / radial), with conditional sub-controls:
   - solid → one `<input type="color">`
   - linear → start color, end color, angle slider (0–360°)
   - radial → start color, end color, center XY (two sliders), radius slider
   - v1 limits gradients to **two stops** for UI simplicity; the JSON model supports N stops so a future picker can extend without a migration.

3. **Stroke** — stroke-type select (none / solid), with color, width (in inches with `.001` step), dash style (solid / dashed / dotted).

The same Fill/Stroke pattern can be added to existing `color` layers later as a quality-of-life pass, since the JSON already supports it.

### Clip / mask controls (any layer type)
A new "Clip to shape" toggle in the selected-layer controls applies to any layer:
- Off → render normally (default)
- On → small sub-panel:
  - "Inline shape" tab: pick a primitive, set its kind-specific params. Renders the chosen shape as a clip-path over the current layer.
  - "Another layer" tab: dropdown of other layers in the same target. The chosen layer's shape becomes the mask. Greyed-out if no other shape layer exists in the target.

### Discoverability
A small one-line hint under the layer list when no shape layer exists:
> "Tip: Shape layers let you make circular avatars, banner gradients, and custom vector accents."

---

## Engineering plan

### Pre-work (small refactor)
Each of the 6+ renderers branches on `type`. Adding a 7th branch for `shape` in each one is mechanical but expensive to maintain forever. Worth extracting a single `renderLayerVisualInto(el, layer, opts)` helper that all surface renderers call. The helper handles type-dispatch once; surface renderers handle bounds and positioning. Estimate ~1 day, no behavior change.

### Phase A — Shape primitives + solid fill
1. Add `type: 'shape'` to the layer schema.
2. `addShapeLayer(kind, targetOverride)` helper, mirroring `addColorLayer`.
3. "Add Shape" button + sub-menu in each layer panel.
4. Selected-layer controls: Shape sub-panel (kind-specific) + Fill (solid only) sub-panel.
5. SVG renderer that handles all 8 kinds with solid fill.
6. Canvas renderer that parallels the SVG one.
7. JSON round-trip — verify save/load and Nostr publish/import preserve everything.
8. The 6 preview surfaces all pick up shape rendering for free via the new `renderLayerVisualInto`.

**Ship gate**: a star with solid red fill drops onto a cover, gets resized + rotated, saves, reloads, exports to PDF, and ends up looking the same in all four places (editor / browser preview / saved JSON / PDF).

### Phase B — Gradients
1. Extend the Fill sub-panel with linear / radial pickers (start color, end color, angle / center / radius).
2. `buildGradientDef` for SVG, equivalent path on canvas.
3. v1: 2-stop only. JSON model already supports N stops for the future.

**Ship gate**: a linear-gradient circle exports to PDF without banding or color shift.

### Phase C — Strokes
1. Extend the Stroke sub-panel: color, width (inches), dash preset.
2. SVG renderer applies `stroke`, `stroke-width`, `stroke-dasharray`.
3. Canvas renderer applies `strokeStyle` + `lineWidth` + `setLineDash`.

**Ship gate**: a 0.05-inch dashed black stroke around a rounded rectangle renders identically in editor and PDF.

### Phase D — Custom SVG path
1. "Custom path (SVG)" modal with paste + validate.
2. Sanitization (only parse `d`; reject anything that looks like markup).
3. Render via SVG `<path d>` and Canvas2D `Path2D(d)`.
4. Optional: a small library of "shape presets" (heart, arrow, speech bubble, etc.) bundled as path data.

**Ship gate**: pasting a known SVG icon's `d` attribute produces a clean layer that exports correctly.

### Phase E — Masking
1. Add `clip` field to the universal layer schema (any layer type).
2. "Clip to shape" toggle + inline-shape picker in the controls panel.
3. SVG renderer: emit `<clipPath id="clip-<layerId>"><path d="…"/></clipPath>` in defs, set `clip-path: url(#clip-<layerId>)` via CSS on the wrapper.
4. Canvas renderer: `ctx.save() → buildShapePath → ctx.clip() → draw layer → ctx.restore()`.
5. "Layer reference" tab: resolves another layer's shape at render time. Reject reference cycles (defensive).

**Ship gate**: a photo of a person clipped to a circle exports as a circular thumbnail in PDF; same photo clipped to a custom heart `path` does too.

---

## Risks and tradeoffs

| Risk | Mitigation |
|---|---|
| Six renderers to update for one new type | Pre-refactor to a shared `renderLayerVisualInto` first. Cost is paid once, benefits every future type. |
| Print fidelity for `clip-path` varies across older browsers | All four supported browsers (recent Chrome/Edge/Brave/Safari) handle it. We document the browser-version floor in the README. |
| `path d=` from user input is a security surface | We only set it as a `d` attribute (never `innerHTML`), and validate it's a parseable path string. No script execution surface — `d` attributes can't carry JS. |
| Gradient picker is the meatiest UI piece | Start with 2-stop only. JSON allows N stops so a v2 picker is non-breaking. |
| Stroke "position" (inside/center/outside) | Center only in v1. Outside-stroke needs path inflation, which is heavy. Document the limitation. |
| 100+ shape layers in one design | SVG handles this well; we already do similar with text layers. Canvas export is the main perf risk and can be deferred via progress UI. |
| Old clients see and skip our shape layers | Acceptable. The rest of the design still renders. We could add a top-level `schemaVersion` bump but it's not strictly needed — `type` is the existing discriminator. |
| Reference cycles in layer-ref clips | Detect at render time and break the cycle (render unclipped + console.warn). |
| Two ways to make a rectangle (`color` and `shape`) | Live with it. Document the recommendation: new templates should prefer `shape`; old `color` layers keep working forever. |
| Gradient color picking (no eyedropper) | Standard `<input type="color">`. Out of scope to build a custom picker in v1. |

---

## Out of scope (future work)

- **SVG file import** — let users drop an `.svg` file and we parse it into one or more shape layers. Big can of worms (groups, transforms, embedded `<style>`, `<image>` refs). Future feature.
- **Boolean operations** — union / intersect / subtract two shapes into one. Useful for masks. Out of scope.
- **Pattern fills** — repeating image fills inside a shape. Future.
- **Mesh / conic gradients** — niche, browser support uneven.
- **Drop shadows / blur / glow** — own feature doc (`docs/LAYER_EFFECTS_FEATURE.md`).
- **Interactive bezier pen tool** — significant editor work. Out of scope.
- **Animated SVG / CSS animations** — these are print-oriented designs; animation isn't a fit.

---

## Open questions

1. **Should `shape` deprecate `color`?**
   No. Keep `color` as a shortcut. New templates can use either. Documenting the recommendation is enough.
2. **Should `clip` be on any layer or only image layers?**
   Any layer. The model is general; the UI surfaces it for image / shape / text alike. Text-clip is a small win nobody asked for, but it's free.
3. **Stroke widths in inches or pixels?**
   Inches, matching the rest of the coordinate system. Convert to SVG units at render time.
4. **Do we ship a curated shape preset library (heart, arrow, etc.)?**
   v1: no — the basic primitives are enough. A small JSON file of preset `d=` strings would be a tiny, decoupled v2.
5. **Should the gradient picker support N stops out of the gate?**
   No. 2-stop covers most real use. JSON supports N; UI grows later if asked.
6. **Should the layer panel show a small icon preview per layer (especially shapes)?**
   Nice-to-have. Not required for the feature to ship.

---

## Acceptance summary

### Phase A
- [ ] Adding a shape from the layer panel produces a JSON-serializable shape layer with sensible defaults.
- [ ] All 6 surface renderers (editor + 5 previews) render the shape.
- [ ] Canvas PDF/JPEG export renders the shape.
- [ ] Save → load round-trips the shape correctly.
- [ ] Publish → fork → load round-trips the shape correctly.
- [ ] Selected-layer controls let the user change kind-specific params.

### Phase B
- [ ] Linear and radial gradient fills work in editor + previews + canvas export.
- [ ] Gradient picker UI (2-stop) is intuitive and doesn't fight existing fill controls.

### Phase C
- [ ] Solid strokes with width and dash render in editor + previews + canvas export.
- [ ] Stroke and fill compose correctly (fill underneath, stroke on top).

### Phase D
- [ ] Pasting an SVG `d=` string adds a valid path layer.
- [ ] Bad input rejects with a friendly error, never throws.

### Phase E
- [ ] Inline-shape clip works on image, text, color, and shape layers.
- [ ] Layer-ref clip works and detects cycles.
- [ ] Clipped layers export to PDF and JPEG with the same visual result as in the editor.
