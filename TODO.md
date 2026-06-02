# Artstr Studio — TODO

Running list of deferred work. Detailed specs for the larger items live in
`docs/`. Each entry notes scope and where the spec is (if any).

## Adam's working list

_(Empty — see "Shipped (recent)" below for the items that just
landed. Drop new items in here as they come up.)_

## Design-tool follow-ups (Illustrator parity arc)

The pen / select / pathfinder bundle (`docs/PEN_TOOL_FEATURE.md`)
landed with these intentional gaps:

- **Smart Guides.** Snap-to-anchor and snap-to-edge alignment with
  on-canvas distance hints while dragging. Biggest "feels professional"
  upgrade still on the table; deserves its own arc.
- **Gradients + drop shadows.** Linear / radial gradient fills and a
  basic drop-shadow / glow effect on the appearance panel. Mostly an
  SVG `<defs>` + `filter` addition.
- **Scissors (C) + Outline text + Command palette (Cmd+K).** Three
  small wins: split a path at a click, convert text to editable pen
  paths (font-independent for Nostr export), searchable action list.
- **Flip H / V.** Prototyped during the Align panel arc but pulled
  out — needs the renderer to honor per-layer scaleX / scaleY.
- **Pathfinder limitations to lift.** Today: refuses rotated shapes,
  flattens curves, only the first polygon's outer ring stays
  pen-editable post-op. Rotation support is the most user-facing of
  these; curve fidelity would need a Bézier-aware clipper.
- **Pixel-art frame timeline.** Onion skin + frame list + FPS control.
  Largest open arc; transformative if pixel art is a focus.

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

- **Linked Designs** — `docs/LINKED_DESIGNS_FEATURE.md`. A new
  `kind: 'linked'` flavor of the existing design layer that stores
  only a NIP-01 addressable-event coordinate (no payload) and
  resolves to the latest source on render. Auto-update across
  collaborators, smaller host events, and first-class attribution
  via `'p'` tags. Phased: public-only → premium + private → polish
  (disk cache, attribution-tag emission, Credits panel, "Publish
  + link" workflow).
- **Artstr Stacks** — `docs/STACKS_FEATURE.md`. Interactive fullscreen
  page/card stacks (HyperCard for Nostr) — the Slide Deck extended with
  layer actions and an interactive viewer.
- **Badges (NIP-58)** — `docs/BADGES_FEATURE.md`. Award / display Nostr
  badges on profile pages.
- **Collections (NIP-51 sets)** — `docs/COLLECTIONS_FEATURE.md`. Let users
  organize favorite community templates into named sets.

## Premium-templates polish

The premium-encrypted-designs arc shipped in 2026-05; see
`docs/PREMIUM_DESIGNS_FEATURE.md` for the canonical spec. Open
follow-ups worth their own work:

- **Phase 4 E2E test matrix** — real-money round-trip through CoinOS:
  publish premium → unlock from another browser → vault sync. Plus
  the edge-case matrix from §19 item 4 of the spec (wallet budget
  exhausted, platform fail after creator paid, partial-pay resume,
  missing lud16, cache wipe → relay fast-path).
- **Confirm()-style modals** — the unlock confirm and a few other
  premium-related prompts still use native `confirm()`. Replace with
  the styled in-app modal pattern.
- **Future-proofing** — when an epoch's soft-gate pepper gets reverse-
  engineered we'll ship a new epoch. The infra is in place; the
  rotation playbook should land as a SECURITY.md when we do it.

## PPTX import polish

Phases 0–7 of `docs/PPTX_IMPORT_FEATURE.md` are shipped on `main`
(deck shell, slide backgrounds, text + speaker notes with per-run
rich-text spans, image / table / SmartArt placeholders, basic preset
shapes with fills + strokes + line flips + bent / curved connector
approximations, group flattening, theme color resolution +
master / layout bg inheritance). Native chart import (the former
"placeholders" item) is also shipped as its own arc — see
`docs/CHART_IMPORT_FEATURE.md`. Open follow-ups:

- **Richer report modal.** Per-slide warning summary, group counts,
  theme-resolution stats. The data already lands in
  `report.warnings` and `report.imported`; just needs UI.
- **Phase 6+ inheritance gaps.** Gradient slide backgrounds
  (`a:gradFill`), picture / blipFill backgrounds, font scheme
  resolution (`+mj-lt` / `+mn-lt` → the theme's actual font),
  placeholder geometry inheritance (text shapes that inherit xfrm
  from a layout placeholder currently warn + skip).
- **Unsupported preset shapes.** Anything outside the rect /
  roundRect / ellipse / triangle / line / star5 / hexagon / pentagon
  / straightConnector1 set falls back to a rectangle with a warning.
  Phase 6 in the spec includes `a:custGeom` → custom SVG-path
  conversion for arbitrary geometry.
- **Test deck library.** Build the 10 test decks from spec §19.1
  under `test/pptx/` so future-phase regressions are caught
  automatically.

## Chart import polish

Phases 1–4 of `docs/CHART_IMPORT_FEATURE.md` shipped (bar / column,
pie / doughnut with arc-d slices, line charts with markers, plus
the title / legend / data labels / nice-number axis ticks /
gridlines polish layer). Open follow-ups:

- **Stacked + percent-stacked bar / column / line.** PowerPoint's
  `c:grouping val="stacked"` and `"percentStacked"` variants
  currently return null and fall back to placeholder. Phase 5 of the
  chart spec covers the running-sum math + per-series rect deltas.
- **Combo charts.** Multiple chart types in one `c:plotArea` (e.g.
  bar + line). Today only the first child type renders; the others
  are silently dropped. Phase 6.
- **3D variants.** `c:bar3DChart`, `c:line3DChart`, `c:pie3DChart` —
  these still placeholder. Faithful 3D rendering isn't realistic in
  a single-canvas editor; an approximation as flat charts with a
  warning would be honest.

## Phase-3+ work on shipped features

- **Private (encrypted) publishing — Phases 3 & 4.**
  `docs/PRIVATE_PUBLISHING_FEATURE.md`. Phases 1 (private-to-me) and
  2 (toggle public ⇄ private) shipped in commit `3e6e89e`. Still
  unbuilt: Phase 3 (share with selected pubkeys) and Phase 4 (NIP-59
  gift-wrap metadata privacy + Blossom/NIP-96 offload for oversized
  encrypted blobs).

## Shipped (recent)

- **PPTX import** — `docs/PPTX_IMPORT_FEATURE.md`. Phases 0–7
  shipped on main: deck shell parser, slide backgrounds, text +
  speaker notes (with Phase-7 per-run rich-text spans for
  mid-paragraph styling), image / table / SmartArt placeholders,
  preset shapes (rect / ellipse / triangle / star / hexagon /
  pentagon / line / connectors with bent + curved approximations)
  with fills + strokes + line flips, group flattening with
  composed transforms, and theme-color + master / layout
  background inheritance. fflate-vendored zip lib + lazy-loaded
  `src/pptx-importer.js` module keep the main bundle lean.
- **Native chart import** — `docs/CHART_IMPORT_FEATURE.md`. Phases
  1–4 shipped: bar / column (clustered), pie + doughnut (path-arc
  wedges), line with optional markers, plus the Phase-4 polish
  layer — title text, series legend with color swatches, data
  labels (showVal / showCatName / showPercent / showSerName),
  nice-number value-axis ticks (1/2/5 × 10ⁿ), and optional
  gridlines when c:majorGridlines is present. Stacked variants
  and combo / 3D charts still placeholder via the existing
  CHART_TYPE_UNSUPPORTED fallback.
- **Premium decks — publishing + multi-slide preview viewer.**
  `_renderModeToExportCanvas` now handles `deck` mode (renders the
  first slide or currently-edited slide). Up to 6 watermarked
  per-slide previews land in the envelope (~40 KB each, ~240 KB
  total) so buyers can flip through with a Prev / Next pager
  before purchase. The same paginated viewer also renders on
  unlocked decks so the flip-through UX stays continuous.
- **Self-author auto-unlock.** Premium events authored by the
  current user decrypt locally on feed load and surface as
  unlocked — no zap-yourself required. Runs alongside the
  existing receipt fast-path; the soft-gate KDF is deterministic
  so no receipt is needed for the author.
- **Pixel-art layer animation when embedded.** Multi-frame
  pixel-art designs imported as layers into another canvas now
  animate at their stored fps + loop settings. RAF self-stops when
  the layer's display canvas leaves the DOM.
- **One-click PNG / GIF download on pixel-art preview pages.**
  Community-browser preview pane for pixel-art designs exposes a
  Download button that auto-picks PNG (single-frame) or animated
  GIF (multi-frame) at 4× scale. Reuses the editor's full export
  pipeline.
- **Auto-pick category metadata.** `defaultCategoryForMode` maps
  canvas modes (slide / deck / customart / pixelart) to their
  canonical mediaCategories values; runs at the top of `syncInputs`
  so both create-new and import paths land with a sensible
  category. Idempotent — leaves a user-picked value alone.
- **Locked-premium UI gating.** Print / Save PDF, Start
  Presentation (deck), and Import-into-Disc-1/2 (disc-design)
  hidden when the preview row is locked premium. The buttons all
  depend on the design payload, which the envelope only exposes
  after unlock.
- **Vault durability fixes.** Receipt fast-path now re-derives +
  decrypts the payload (was setting unlocked:true without payload,
  breaking Use/Fork after cache wipe). Vault upsert is now
  synchronous-to-success with visible failure toasts. Vault reads
  + writes use a wider relay union (current + DEFAULT_NOSTR_RELAYS)
  so purchases stay visible across browsers / domains even when
  the user narrows their relay list.
- **Premium encrypted designs — static soft-gate + NWC split-zap +
  purchase vault.** Spec lives in `docs/PREMIUM_DESIGNS_FEATURE.md`.
  Creators tick "Premium encrypted" + a soft-gate ack in the publish
  modal, set a minimum sat amount; we AES-256-GCM encrypt the
  payload (HKDF over an obfuscated per-epoch pepper + per-design
  salt + the event coordinate as AAD), render a watermarked low-res
  JPEG preview embedded in the envelope, and emit the §5.1 tag set
  with two zap-split tags (creator 70 % / platform 30 %).
  Consumers see a gradient-stroked card + ⚡ PREMIUM ribbon with an
  "Unlock for N sats" CTA on all three import paths (feed card,
  preview pane Use/Fork, preview pane Save JSON). Unlock fires both
  pay_invoice legs in parallel over NWC, derives the soft-gate key
  locally on receipt confirmation, decrypts in place with a reveal
  animation. Cross-device sync via a NIP-44 self-encrypted purchase
  vault (kind-30078 `d=artstr:purchase-vault:v1`) that auto-splits
  into per-item events when over 40 KB. Address-tolerant unlock
  lookup so edit-in-place doesn't invalidate prior purchases.
  Hydrates on Nostr login with a "Restored N unlocks ✓" toast.
  Soft-gate framing is honest in every UI surface: it raises
  friction against drive-by scraping, NOT strong DRM. Foundation
  layers (noble bundle, NWC client + wallet settings UI with
  CoinOS-first onboarding, platform-fee dual-zap orchestrator, NWC-
  default Lightning tips, login-method picker, profile dropdown
  menu with View Profile / Settings / Logout, the Settings modal
  itself, the new Premium tab + mobile-friendly browser layout)
  all shipped as part of the same arc. ~30 commits on the
  `zap-gated` branch, merged into main 2026-05.
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
