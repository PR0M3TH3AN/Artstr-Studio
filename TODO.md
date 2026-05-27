# Artstr Studio — TODO

Running list of deferred work. Detailed specs for the larger items live in
`docs/`. Each entry notes scope and where the spec is (if any).

## Adam's working list

- **Click-canvas-background-to-deselect.** In the vector canvas editor,
  clicking on empty canvas (outside any layer) should clear the layer
  selection. Today the selection persists, which makes it hard to "exit"
  a selected layer without picking another one.
- **Toggle crop marks for export previews.** A new toggle in the
  vector designer to hide crop marks from the PDF Print/Save and
  JPEG Export flows. Today crop marks bleed into clean exports.
- **Custom-art canvas size from imported background URL.** When a
  user pastes a background image URL on a Custom Art canvas, offer
  a one-click "Match canvas to image size" button (or apply
  automatically on first import) so the canvas dims = image dims.
  Edge cases: huge images (clamp to CUSTOM_ART_MAX), aspect-locked
  layouts (Slide is locked 16:9 — should be skipped or warn).
- **Hide layer-selection outlines in PDF Print + JPEG-PDF-fallback.**
  The direct JPEG rasterizer (P1) draws to canvas via the canvas API
  without ever touching the DOM, so selection chrome never appears in
  the JPEG. The PDF Print / Save path AND the JPEG-fallback-via-PDF
  path still render the live DOM though, so a dashed selected-layer
  outline can sneak into those outputs. Add `body.exporting` (or
  similar) class that strips `.freeLayer.selected` outlines and the
  resize handles before either flow snapshots.
- **JPEG export — rich-text rendering (P2).** Plain-text only today
  in the direct JPEG flow (drawTextLayerToCanvas uses
  layerHtmlToPlainText). Add an SVG-foreignObject renderer that
  fires when `layer.html` contains inline marks (`<b>`/`<i>`/`<u>`/
  `<a>`/`<ul>`/`<ol>`/`<li>`), with the existing fillText path as
  fallback for plain text. ~150 LoC.
- **JPEG export — DPI / quality selector (P4 polish).** Currently
  hard-coded to dpi=150 / quality=0.92. Add a small dropdown in the
  Export panel: Low (96 dpi, 0.8) / Standard (150, 0.92) / Print
  (300, 0.95). ~40 LoC.
- **Independent-axis corner-node resize.** Corner resize handles
  currently lock the aspect ratio (or scale both axes together).
  Behaviour should follow the actual drag vector: dragging mostly
  horizontally with a small vertical move resizes width a lot,
  height a little — both axes scale proportional to their own
  movement, not to each other. Applies to every layer type's
  resize handles, not just text.

## QR code layer — remaining phases

Phases A and B shipped (the `qr` layer type: data, error-correction level,
quiet zone, module / background colors, transparent background, renders
on every surface + canvas export, JSON round-trip; plus "Insert npub" and
"Insert share link" buttons under the QR data field).

- **Phase C — visual polish.** Optional center logo overlay and rounded
  modules. Riskier: a logo eats into the error-correction budget, so it
  should nudge the ECC level up. Skippable.

## Editor / tool UX

Small editor-usability improvements — no spec doc; scoped here.

Shipped: on-canvas drag-resize handles for every layer type, text-box
resize that never rescales the point size, the expanded Text tool panel
(font / size / color / alignment / bold / italic), a collapsible sidebar
toggle that fits the early-web aesthetic. Add new editor-UX items below.

## Profile pages — deferred polish

(Core profile pages at `/u/<npub>` already shipped.)

- Make author chips clickable in the **community thread view** (comments and
  reposts) — currently only feed-card and preview-meta author chips route to
  `openProfilePage`.
- **About-text clamp** — long bios overflow the profile header; clamp to ~4
  lines with a "Show more" toggle.
- **Profile-grid pagination** — an author with 100+ designs renders them all
  at once; cap the initial render and add a "Show more" pager.

## Edit-published-designs — deferred polish

(Core edit-in-place via NIP-33 replaceable semantics already shipped.)

- Replace the remaining `confirm()` calls in the edit / publish flow with the
  styled in-app modal pattern, for consistency with the close-project and
  publish-confirm modals.
- "Editing a previously-deleted design" warning — if the user opens Edit on a
  design they had tombstoned with a kind-5, warn that publishing will
  republish it.

## Pixel art — future polish

- **`pixelsB64` size-fallback encoder.** The spec calls for each frame
  to store whichever is smaller: `pixels` (RLE pairs) or `pixelsB64`
  (base64 of the raw `Uint8Array` of indices). Only RLE is implemented
  today. For noisy / photo-pixelized content with many palette colours,
  base64 is ~5× smaller — a 24-frame 64×64 sprite tested at 785 KB
  RLE would drop to ~150 KB. Worth shipping alongside a live event-size
  readout in the editor (soft warn at 50% of relay budget, hard block
  at 90%) so users see the budget before publish.

## Drafted-but-unbuilt features

Each has a full spec in `docs/`.

- **Private (encrypted) publishing** — `docs/PRIVATE_PUBLISHING_FEATURE.md`.
  Publish any design encrypted, readable only by the author (Phase 1
  "private to me"). The agreed next build; Phase 0 is a validation spike.
- **Artstr Stacks** — `docs/STACKS_FEATURE.md`. Interactive fullscreen
  page/card stacks (HyperCard for Nostr) — the Slide Deck extended with
  layer actions and an interactive viewer. Queued after private publishing.
- **Badges (NIP-58)** — `docs/BADGES_FEATURE.md`. Award / display Nostr
  badges on profile pages.
- **Collections (NIP-51 sets)** — `docs/COLLECTIONS_FEATURE.md`. Let users
  organize favorite community templates into named sets.
- **Zap-gated premium templates** — `docs/ZAP_GATED_TEMPLATES_FEATURE.md`.
  Creators mark a template premium with a minimum-zap threshold.
- **Zaps via Nostr Wallet Connect** — `docs/ZAPS_NWC_FEATURE.md`. In-app
  zapping without the wallet handoff. (Tracked LNURL-pay tips already ship;
  this would be the NWC path.)

## Shipped (recent)

- **JPEG export — one-click direct rasterizer (P1).** Replaces the
  print-to-PDF-then-re-pick flow for Cover, Disc sheet, Jewel,
  Disc design, Custom Art, and Slide canvases. The infrastructure
  was already 90% built (drawLayerToCanvas + four canvas-type
  rasterizers existed but were never wired to any entry point);
  P1 added the missing Custom-Art rasterizer + the orchestrator
  that picks the right rasterizer per templateMode, pre-flights
  CORS via the existing _exportFailedImages set, and falls back to
  the print modal when any image can't be embedded directly.

- **Slide deck PDF export** — multi-page PDF, one page per slide. The
  existing Print / Save PDF button is context-aware: in the Deck Builder
  it builds a hidden print-only container with one page per slide (themed
  via `composeSlideForDeck`, each page sized to the preview's native
  dimensions so the slide fills the page exactly) and emits one PDF via
  `window.print()`. Inside a single-slide editor, the button still prints
  just that slide.
- **Copy / paste transform consistency** — paste now computes a single
  group bounding box across all clipboard items, applies one shared scale
  (only shrinks, never enlarges) and one shared translation, so cross-
  target paste keeps every layer's relative position and size to the
  others intact.
- **Pixel-editor colour picker** — ported the OS native `<input type="color">`
  over from the vector tools (same swatch styling; opens the OS picker with
  its built-in eyedropper on click). Removed the Screen-Capture-API screen-
  eyedropper workaround (~170 lines of dead code). Palette swatches and
  the in-canvas eyedropper tool now sync the picker too, so grabbing a
  palette colour as the starting point for a tweaked variant just works.

- **Pixel Art** — `docs/PIXEL_ART_FEATURE.md`. Phases A–D all shipped:
  embedded `pixelart` layer + standalone `casewrap-pixelart` design,
  PNG / sprite-sheet / GIF export, drawing tools (line / rect / ellipse,
  flip / rotate, grid resize), animation (multi-frame timeline, playback,
  onion-skin), image → pixelize, and animated previews in every preview
  surface. Undo / redo integrated with the top-level toolbar.
- **Pixel editor layout expansion** — addressed by the collapsible
  sidebar (gives both the pixel and vector editors a lot more breathing
  room when needed).
- **Print / Save event ID wrapping** — the event-id `<dd>` already uses
  `overflow-wrap: anywhere; word-break: break-word`, so no horizontal
  scroll.
- **TMDB auto-fill cleanup** — `docs/TMDB_AUTOFILL_FEATURE.md` removed.
