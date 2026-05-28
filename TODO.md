# Artstr Studio — TODO

Running list of deferred work. Detailed specs for the larger items live in
`docs/`. Each entry notes scope and where the spec is (if any).

## Adam's working list

_(Empty — see "Shipped (recent)" below for the items that just
landed. Drop new items in here as they come up.)_

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

- **Premium encrypted designs (static soft-gate + purchase vault)** —
  `docs/PREMIUM_DESIGNS_FEATURE.md`. **In-progress / current focus.**
  Creators publish encrypted designs gated by a Lightning split zap
  (creator 70% / platform 30%). Buyers unlock via NWC; the static
  client derives the AES key locally after valid split-zap receipts
  arrive on relays, decrypts the payload, and stores the key in a
  NIP-44 self-encrypted purchase vault for cross-device re-open.
  Honest "soft gate, not strong DRM" framing — determined reverse-
  engineers can still extract the client pepper; the protection is
  against casual copying / relay scraping.
  Foundation already shipped: noble crypto bundle, NWC client +
  wallet settings, platform-fee dual-zap orchestrator, NWC-default
  Lightning tips, and a tag-only gate UI (still in place but now
  superseded by the encrypted content envelope). See
  `docs/ZAP_GATED_PREMIUM_FEATURE.md` for the Phases 0–3 history.
- **Artstr Stacks** — `docs/STACKS_FEATURE.md`. Interactive fullscreen
  page/card stacks (HyperCard for Nostr) — the Slide Deck extended with
  layer actions and an interactive viewer. Queued after zap-gated lands.
- **Badges (NIP-58)** — `docs/BADGES_FEATURE.md`. Award / display Nostr
  badges on profile pages.
- **Collections (NIP-51 sets)** — `docs/COLLECTIONS_FEATURE.md`. Let users
  organize favorite community templates into named sets.

## Phase-3+ work on shipped features

- **Private (encrypted) publishing — Phases 3 & 4.**
  `docs/PRIVATE_PUBLISHING_FEATURE.md`. Phases 1 (private-to-me) and
  2 (toggle public ⇄ private) shipped in commit `3e6e89e`. Still
  unbuilt: Phase 3 (share with selected pubkeys) and Phase 4 (NIP-59
  gift-wrap metadata privacy + Blossom/NIP-96 offload for oversized
  encrypted blobs).

## Shipped (recent)

- **Pixel-art dropdowns — no more sidebar clipping.** The pixel-editor
  resize-grid and PNG-export menus were `position: absolute; right: 0`
  inside their toolbar wrap. When the toolbar wrapped and the trigger
  button landed at the left of its row, the menu slid leftward under
  the main sidebar. Switched both menus to `position: fixed` with a
  JS-placed coord that anchors to the button's right edge by default,
  flips to its left edge if anchoring right would clip past the
  sidebar (sidebar's actual right edge, not just the viewport),
  and clamps inside the viewport on both sides. Also auto-closes any
  open menu on window resize to avoid stranded fixed-position remnants.
- **Top-right action strip — permanent, never wraps.** Pulled the
  canvas-size readouts and the undo / redo pair out of the topbar's
  flex flow and pinned them in a fixed strip directly under the Nostr
  widget, right-anchored, with `flex-wrap: nowrap`. Order: canvas-size
  pills on the left, undo / redo on the right (so undo / redo hug the
  viewport edge). The topbar's right padding now tracks the wider of
  the Nostr widget or the strip via the existing
  `--nostr-widget-space` var, so the project title never slides under
  it.
- **Click canvas background → deselect.** The existing #sheet click
  handler missed clicks in the gutter between sheet edge and
  previewShell edge; added a #previewShell handler.
- **Crop marks for Custom Art / Slide canvases.** New `.canvasCrops`
  corner marks inside .sheet, scoped to those template modes. The
  existing showCrops / printCrops toggles drive screen + print
  visibility (relaxed from cover-only to a new `.crops-toggle`
  class).
- **Strip selection chrome from PDF Print / JPEG-fallback output.**
  Dead `body.exporting` CSS rules were renamed to actually match the
  class JS sets. Wired both the regular printBtn flow and the
  JPEG-PDF flow to set the class. Two-class split (`body.exporting`
  for chrome-stripping in either flow, `body.export-print` for the
  heavier container-isolation only the JPEG-PDF flow does) avoids the
  blank-print regression that a single class caused.
- **Custom Art: match canvas to image's natural dimensions.** New
  "Match canvas to image size" button on the image-layer panel (Custom
  Art mode only; Slide is 16:9 locked). Loads the image via
  loadImageWithCors, clamps to CUSTOM_ART_MAX, pushes one undo entry.
- **JPEG export — rich text rendering (P2).** Canvas-based engine
  that walks the layer's HTML into styled runs (bold/italic/underline,
  bullets, numbered lists, line breaks), lays them out with
  ctx.measureText + word wrap, and draws each item with its own font
  + underline. Dispatches to plain `fillText` when no inline marks
  are present. SVG-foreignObject was tried first; it taints the
  canvas in Chromium so we built the run-layout engine instead.
- **Independent-axis corner-node resize.** Corner handles default to
  independent axes (each axis follows its own drag delta); Shift+drag
  locks aspect (Figma / Photoshop / Keynote convention). The sidebar
  🔒 toggle still governs typed W/H input cascades.
- **JPEG export — DPI / quality selector (P4 polish).** 96/150/300 dpi
  presets in a dropdown next to the Export JPEG button.
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
