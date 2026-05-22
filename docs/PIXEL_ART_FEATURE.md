# Pixel Art — editable pixel layers & raster export

## Goals

Make Artstr a genuine, Nostr-native **pixel-art editor**. The user paints
on a hard-edged pixel grid; the editable grid lives in the project JSON
as compact palette-indexed data; PNG (and later GIF) are produced as
**exports**, never as the source of truth.

### The core realisation

Pixel art fits Artstr's JSON/Nostr model *better* than ordinary raster
editing does. A 64×64 sprite is a tiny indexed grid — compact, portable,
forkable, replaceable as a `kind:30078` event. The rule:

> Never store pixel art as a PNG while editing. Store it as an editable
> palette-indexed grid in the Artstr JSON; rasterise to PNG/GIF on export.

### Two faces — the disc-design / slide pattern, generalised

Pixel art has the same dual nature as a disc design or a slide — a
standalone publishable thing *and* an embeddable component — but
generalised: because it is a **layer type**, its host is not one specific
template, it is *any design*.

| Standalone design | Embeds into | As a… |
|---|---|---|
| Disc design | a disc-label sheet | disc **slot** |
| Slide | a slide deck | **card** |
| **Pixel art** | **any design** | **layer** |

- **Standalone** — a `kind:30078` event, `casewrap-pixelart`, a "Pixel
  Art" layout on the **Designer tab** beside Custom Art / Slide / Disc
  Design. Forkable, editable-in-place, `naddr`-shareable, encryptable.
- **Embedded** — a `pixelart` layer inside *any* design (cover, custom
  art, slide, deck card, stack card). The pixel data embeds **inline** in
  the host's event — the host stays self-contained, exactly like an
  embedded slide or a disc-in-slot.

### Product goals

1. A **`pixelart` layer type** — a palette-indexed pixel grid, usable in
   any design, rendered crisp (nearest-neighbour) at any scale.
2. A **Pixel Editor** — its own canvas-area view with a contextual pixel
   tool set: paint, fill, pick, palette, grid, zoom.
3. A standalone **Pixel Art** Designer-tab layout, publishing as
   `casewrap-pixelart`; importable into any design as a layer.
4. **PNG export** at 1× / 2× / 4× / 8×, transparency preserved.
5. (Later) **animation frames** and **GIF / sprite-sheet** export.

### Non-goals (v1 = Phase A)

- **GIF / animation in v1** — frames are designed into the data model
  from day one, but the timeline UI and the (vendored) GIF encoder are
  Phase C.
- **Whole-design → PNG export.** Rasterising an arbitrary layered Artstr
  artboard is a separate, harder problem (the DOM-to-raster question).
  This spec only rasterises *pixel content*. General design→PNG is out of
  scope here.
- **Image import / quantization, selection/move, dither, onion skin,
  symmetry, tile mode** — Phase C/D.
- **Embedding binary images** — pixel data is always the indexed grid,
  never an embedded PNG blob.
- **External media offload** (Blossom) — inline only for v1; a manifest
  escape hatch is sketched for later.

### Decisions (proposed — confirm before building)

1. **Layer-type-first.** The `pixelart` *layer* is the core. The
   standalone "Pixel Art" mode is a thin wrapper — a project that is one
   pixel grid.
2. **The Pixel Editor is its own canvas-area view** (`#pixelEditorView`),
   not a toolbar tool — joining `#discDesignerView` and `#deckSorterView`.
   The left tool palette is reused as a *contextual* host showing pixel
   tools while it's active.
3. **Frames from day one** — `pixelArt.frames[]` always exists; a v1
   static sprite is simply a one-frame stack with no timeline UI.
4. **Indexed palette + RLE**, never raw RGBA. Raster is export-only.
5. Additive schema — a `pixelart` layer type and a `pixelArt` payload
   object. No `SCHEMA_VERSION` bump.
6. **Publishing is gated on a measured event-size budget** (derived from
   the relays' NIP-11 limits), not on grid dimensions alone — see
   **Size limits**.

---

## Why this fits the repo

### What's reused

- **The layer system** — a `pixelart` layer moves / resizes / rotates /
  z-orders / locks / clips / sets opacity like any other layer; it shows
  in the Layers panel; it rides in every payload and preview.
- **The "separate canvas-area view" pattern** — `#previewShell` already
  swaps between `#sheetWrap`, `#discDesignerView`, and `#deckSorterView`.
  `#pixelEditorView` is one more.
- **The edit round-trip** — entering the pixel editor for an embedded
  layer and writing back on exit is the deck's "edit a slide → Back to
  deck" pattern (`persistEditingDeckSlide` / `editingIndex`).
- **The Designer-tab layout system** — a `pixelart` `templateMode` slots
  into `applyLayout`, `WORKFLOW_ORDER`, `updateBodyClasses`,
  `normalizeTemplateMode`, `MODE_LABELS`, exactly as `slide` did.
- **Undo/redo** — the 50-deep snapshot history already covers `state`;
  a pixel layer's data is in `state`, so a paint stroke is an ordinary
  history entry.
- **Publish / fork / feed / encryption** — a pixel-art design is a normal
  `kind:30078` design; the private-publishing envelope wraps it free.
- **Import-as-component** — pulling a published `casewrap-pixelart` in as
  a layer mirrors the disc-design → disc-slot import flow.

### Genuinely new work

1. The **`pixelart` layer type** + the indexed-grid + RLE data model.
2. A shared **`renderPixelGridToCanvas()`** — the app's first real
   raster/`<canvas>` layer (everything is DOM/SVG today).
3. The **Pixel Editor view** + the contextual pixel tool set + palette.
4. A **PNG export pipeline** — `<canvas>.toBlob()`; the app has no direct
   canvas raster export today (JPEG goes via PDF→PDF.js).
5. (Later) the **frame timeline** and a **vendored GIF encoder**.

### Current-state facts the plan is built on

- Layer types today: `image`, `text`, `color`, `shape`, `qr`; layers
  render as absolutely-positioned DOM nodes from inch coordinates.
- The canvas region swaps views by mode (`#sheetWrap` /
  `#discDesignerView` / `#deckSorterView`); the tool palette is already
  rendered contextually (only ▶ Present shows in the deck sorter).
- `casewrap-*` typed `kind:30078` events; `/share/<naddr>`; the community
  feed; categories include `slide`, `slide-deck`.
- "Export JPEG" round-trips through PDF + PDF.js — there is **no** direct
  `canvas.toBlob()` raster path yet.

---

## Data model

### The `pixelart` layer

```js
{
  id: 'l_x1',
  type: 'pixelart',
  name: 'Pixel sprite',
  // standard layer box — inches, on the host canvas:
  x, y, w, h, rotate, opacity, z, visible, locked, clip,
  pixelArt: {
    width: 64, height: 64,            // grid size, in cells
    palette: [                        // up to 256 entries, #rrggbbaa
      '#00000000',                    // index 0 — transparent by convention
      '#1a1a2eff',
      '#e94560ff'
    ],
    frames: [
      { id: 'f1', name: 'Frame 1', durationMs: 120, pixels: <RLE> }
    ],
    loop: true, fps: 8                // animation playback (Phase C)
  }
}
```

- **`frames` always exists.** A v1 static sprite has exactly one frame
  and no timeline UI — but the format never needs migrating when
  animation lands.
- **`pixels` is run-length-encoded**, row-major: an array of
  `[paletteIndex, runLength]` pairs.

  ```js
  pixels: [ [0,128], [1,24], [2,8], [1,24] ]
  // 128 transparent, 24 colour-1, 8 colour-2, 24 colour-1
  ```

  RLE suits pixel art's long flat runs and stays human-portable JSON, but
  is *worse* than raw for noisy art — so each frame stores **whichever is
  smaller**: `pixels` (RLE `[[index,count],…]`) **or** `pixelsB64`
  (base64 of a raw `Uint8Array` of indices, ~1.34 B/cell). Exactly one is
  present per frame. This bounds the worst case — see **Size limits**.
- **Palette** holds `#rrggbbaa` strings (alpha lets index 0 be fully
  transparent); capped at 256 so an index is one byte.
- The layer **box defaults to the grid's aspect ratio**, and its W/H
  aspect-lock (already a layer feature) defaults *on* — pixels stay
  square; the host never stretches them.

### Standalone Pixel Art design (`templateMode: 'pixelart'`)

```js
{
  version: SCHEMA_VERSION,
  templateMode: 'pixelart',
  templateType: 'pixelart',
  meta: { … },                        // title / category / language
  pixelArt: { width, height, palette, frames, loop, fps }
}
```

The standalone project *is* one pixel grid — `pixelArt` sits at the top
level (mirroring how a slide carries `slide`, a disc design carries
`discDesign`). **Importing** it into another design lifts that `pixelArt`
into a fresh `pixelart` layer; **publishing** a layer standalone does the
reverse. After import the two are independent (a fork).

### Nostr

- Tag `casewrap-pixelart`; `d`-tag `pixelart:<title|id>` (random when
  published privately, per `PRIVATE_PUBLISHING_FEATURE.md`).
- New `pixel-art` category (joining `slide`, `slide-deck`).
- Forkable, editable-in-place (NIP-33), `naddr`-shareable, encryptable.

---

## Size limits & the event budget

A pixel layer must never *silently* break publishing. Relays cap event
size individually (commonly 64 KB; some 128 / 256 KB), and an oversized
event is **rejected by some relays and accepted by others** — so the
design seems to publish but is unreliable. The budget covers the **whole
signed event**: every other layer, `meta`, tags, and ~270 B of
id / pubkey / sig.

### Why the indexed grid is small

Coordinates are **never stored** — cells are row-major, so position is
free. Hex is stored **once** in `palette`; each cell is just a small
index. RLE then collapses flat runs. A filled 64×64 sprite stored naively
as `[x, y, hex]` triples is **~90 KB**; the same sprite as an indexed RLE
grid is **~1–5 KB** — a 20–90× difference. Dropping coordinates and
de-duplicating the hex is the whole efficiency win.

### Rough sizes — encoded pixel data, one frame

RLE size is content-dependent (great for flat art, worse than raw for
noise); the encoder picks the smaller of RLE / base64, bounding the worst
case at ~1.34 B/cell.

| Grid | Cells | Typical (RLE) | Worst case |
|---|---|---|---|
| 16×16 | 256 | ~0.2 KB | ~0.35 KB |
| 32×32 | 1,024 | ~0.5–1.5 KB | ~1.4 KB |
| 64×64 | 4,096 | ~1–5 KB | ~5.5 KB |
| 128×128 | 16,384 | ~3–20 KB | ~22 KB |
| 256×256 | 65,536 | ~10–60 KB | ~88 KB |

Palette is minor (~12 B per colour). **Animation multiplies by frame
count** — that is where the budget is actually spent.

### The limits

- **Dimensions** — 256×256 hard max; 128×128 recommended ceiling; **32×32
  default** for a new grid. Palette ≤ 256 entries (1-byte indices).
- **Event byte gate — the real guard** (dimensions alone can't predict
  size). Before publishing, the app measures the would-be event size
  against a budget:
  - The budget is the **minimum `limitation.max_event_size`** advertised
    via NIP-11 across the user's relay set, falling back to **64 KB** when
    unknown.
  - **Soft warning at ~50%** of budget — suggests a smaller grid, fewer
    colours, or fewer frames.
  - **Hard block at ~90%** — publishing is refused with a clear message,
    instead of letting the event be silently dropped.
  - So a clean 256×256 publishes fine; a pathologically noisy one is
    caught before it half-publishes.
- **Live readout** — the Pixel Editor always shows current data size
  against the budget (e.g. *"Sprite data: 6.2 KB / 48 KB"*).
- **Oversized animations** route to the external-`manifest` / Blossom
  escape hatch (Phase C); inline storage covers everything that fits.

In short: single static sprites up to ~128×128 are always safe inline;
256×256 works unless the art is pathological; multi-frame animation is
the real pressure point and gets the offload path.

---

## Rendering

One shared helper, used by the editor, every preview renderer, the feed
cards, and export:

```
renderPixelGridToCanvas(pixelArt, frameIndex = 0) -> HTMLCanvasElement
```

- Decodes the frame's RLE into the `palette`, draws each cell as a 1×1
  fill onto an offscreen `<canvas>` sized exactly `width × height`.
- A `pixelart` layer renders as that `<canvas>` placed in the layer's
  div, `width:100%; height:100%; image-rendering: pixelated` — the CSS
  equivalent of `imageSmoothingEnabled = false`, so any up-scaling stays
  crisp.
- The decoded canvas is **memoised** keyed by the frame's pixel data, so
  the per-render layer rebuild stays cheap.
- `renderCustomArtPreviewDOM` (feed cards / publish preview) uses the
  same helper — pixel layers preview correctly everywhere.

---

## The Pixel Editor

`#pixelEditorView` — a new canvas-area view, shown when:

- a standalone Pixel Art design is open, **or**
- the user picks **"Edit pixels"** on a selected `pixelart` layer (or
  double-clicks it) inside any other design.

It contains a zoomed, paintable pixel-grid `<canvas>` with its own
zoom/pan, a **palette panel**, and the **contextual tool palette** (the
left palette slot, populated with pixel tools instead of the vector
tools — exactly as the deck sorter shows only ▶ Present).

**Entering / leaving** follows the deck round-trip: for an embedded
layer, "Edit pixels" enters; **"Done"** writes the grid back to the layer
and returns to the host artboard. For a standalone design the editor
*is* the project.

### v1 tools (Phase A core)

```
Pencil      paint cells with the current palette index
Eraser      paint index 0 (transparent)
Fill        flood-fill contiguous same-index region
Eyedropper  set current index from a cell
```

Plus: a **palette panel** (swatches; add / edit / remove a colour; pick
the current colour), a **grid overlay** toggle, **mirror X / Y** drawing,
and the editor's own **zoom** (fit / 1× / + / −). Drawing supports
click-and-drag; a whole drag-stroke is **one** undo entry (history is
pushed at stroke start, not per cell).

### Phase B tools

`Line`, `Rectangle`, `Ellipse`; whole-grid `Flip H / V` and `Rotate 90°`;
**resize the grid** (change `width`/`height`, anchored).

### Phase C / D tools

Selection + move; dither brush; onion-skin (needs frames); symmetry; tile
preview; image-import → pixelate/quantize.

---

## Raster export

PNG first — a clean, self-contained `<canvas>` pipeline, independent of
the app's PDF/JPEG route:

```
exportPixelArtPng(pixelArt, { scale, transparentBg, includeGrid }):
  native = renderPixelGridToCanvas(pixelArt, frame)      // width × height
  out    = canvas(width*scale, height*scale)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(native, 0, 0, out.width, out.height)
  return out.toBlob('image/png')
```

- **Scale:** 1× / 2× / 4× / 8× (nearest-neighbour always).
- **Transparent background** on/off; **include grid lines** on/off.
- `image/png` is the one format `toBlob()` is guaranteed to support;
  WebP is an easy later add.

Animation export (Phase C): **GIF** — Canvas can't `toBlob('image/gif')`,
so this needs a vendored JS/WASM encoder (e.g. `gif.js`), fed each
frame's rendered `ImageData` + `durationMs`. Also **sprite-sheet PNG**
(all frames tiled) + a `metadata.json`, which needs no new dependency.

---

## Phased delivery

### Phase A — Pixel layer, editor core, Nostr
- The `pixelart` layer type + `pixelArt` data model (RLE, frames-of-one).
- `renderPixelGridToCanvas` + crisp layer rendering everywhere
  (editor artboard, preview-DOM renderer, feed cards).
- The `#pixelEditorView` with the core tools (pencil / eraser / fill /
  eyedropper), palette panel, grid toggle, mirror, editor zoom.
- "Add Layer → Pixel Art"; the per-layer "Edit pixels" round-trip.
- The standalone "Pixel Art" Designer-tab layout (`templateMode:
  'pixelart'`).
- Save / load / publish / fork as `casewrap-pixelart`; feed card;
  `pixel-art` category; `pixelart` in `MODE_LABELS` / mode filters.

**Ship gate:** paint a 32×32 sprite, see it render crisp as a layer in a
Custom Art design and as a standalone design; save, reload, publish — it
round-trips and shows in the feed.

### Phase B — Raster export + editor extras
- PNG export at 1×/2×/4×/8×, transparency + optional grid.
- Line / rectangle / ellipse tools; flip H/V; rotate 90°; grid resize.
- Import a published `casewrap-pixelart` design as a layer (the
  disc-design-style remix flow).

**Ship gate:** export a sprite as a transparent 8× PNG; import a
published pixel design into another design as a layer.

### Phase C — Animation
- `frames[]` timeline UI: add / duplicate / delete / reorder frames,
  per-frame duration, loop/fps; onion-skin; playback preview.
- GIF export (vendored encoder); sprite-sheet PNG + metadata export.

**Ship gate:** build a 4-frame loop, preview it, export a working GIF and
a sprite sheet.

### Phase D — Conversion & advanced tools
- Image import → nearest-neighbour downscale / palette quantization →
  editable grid.
- Selection + move; dither brush; symmetry mode; tile preview.

### Later / backlog
- WebP / APNG / animated-WebP export.
- Blossom offload + an external `manifest` form for very large art.
- Animated pixel layers driving Stack actions (a sprite that plays on
  `onClick`).

---

## Risks & tradeoffs

| Risk | Mitigation |
|---|---|
| First real raster/`<canvas>` layer in a DOM-vector app | One shared `renderPixelGridToCanvas`; `image-rendering: pixelated`; the layer is still a normal DOM node hosting a `<canvas>`. |
| No direct canvas raster export exists today | PNG export of *pixel content* is self-contained (`toBlob`), independent of the PDF/JPEG route; whole-design PNG is explicitly out of scope. |
| GIF needs a new vendored dependency | Deferred to Phase C; isolated to export; sprite-sheet export (no dependency) ships alongside as the lighter option. |
| Per-pixel undo would swamp the 50-deep history | A whole drag-stroke / fill / transform is one `pushHistory` entry, taken at gesture start. |
| Large grids / many frames inflate the event → silent relay drops | Encoded size is gated against a NIP-11-derived budget (min `max_event_size` across the user's relays, 64 KB fallback): soft warning ~50%, hard block ~90%; the encoder stores the smaller of RLE / base64; oversized animations offload via Blossom (Phase C). See **Size limits**. |
| Pixels stretched / blurred by a non-matching layer box | Layer box defaults to the grid aspect; W/H aspect-lock defaults on; `image-rendering: pixelated` everywhere including print. |
| A pixel layer inside a host's PDF/print export | Verify the print path rasterises the `<canvas>` crisply; fall back to a high-scale PNG draw if needed. |
| Palette index overflow | Palette capped at 256 entries (one byte per index). |

---

## Open questions

1. **`templateMode: 'pixelart'`** on the Designer tab — confirmed?
2. **v1 core tool set** — pencil / eraser / fill / eyedropper + palette /
   grid / mirror / zoom — right cut?
3. **New-grid size options** — 32×32 default is set; which other presets
   to offer (16 / 32 / 64 / 128 / custom)?
4. **Editor zoom** — reuse the bottom `#canvasToolbar` slot, or a
   dedicated pixel-editor zoom control?
5. **GIF encoder** — OK to vendor one (`gif.js` or similar) in Phase C?
6. **Budget thresholds** — soft 50% / hard 90% — the right percentages,
   and is 64 KB the right NIP-11 fallback?

---

## Acceptance summary

### Phase A
- [ ] A `pixelart` layer renders crisp (nearest-neighbour) at any scale,
      in the editor, previews, and feed cards.
- [ ] The Pixel Editor view paints with pencil / eraser / fill /
      eyedropper; palette add/edit/remove; grid + mirror; editor zoom.
- [ ] "Add Layer → Pixel Art" works in any design; "Edit pixels" enters
      the editor and "Done" writes back.
- [ ] A standalone Pixel Art design saves / loads / publishes / forks as
      `casewrap-pixelart` and shows in the feed under `pixel-art`.
- [ ] A drag-stroke is a single undo step.
- [ ] Publishing is gated on the event-size budget — a live size readout
      in the editor, a soft warning, then a hard block — so a pixel
      design can never be silently dropped by relays.

### Phase B
- [ ] PNG export at 1×/2×/4×/8× with transparency and optional grid.
- [ ] Line / rect / ellipse, flip, rotate, grid resize.
- [ ] A published pixel design imports into any design as a layer.

### Phase C
- [ ] A multi-frame sprite plays back; onion-skin works.
- [ ] GIF export and sprite-sheet export both produce correct files.

### Phase D
- [ ] An imported PNG/JPEG converts to an editable pixel grid.
- [ ] Selection/move and the advanced brushes work.
