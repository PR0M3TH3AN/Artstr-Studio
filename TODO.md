# Artstr Studio — TODO

Running list of deferred work. Detailed specs for the larger items live in
`docs/`. Each entry notes scope and where the spec is (if any).

## QR code layer — remaining phases

Phase A shipped (the `qr` layer type: data, error-correction level, quiet
zone, module / background colors, transparent background, renders on every
surface + canvas export, JSON round-trip).

- **Phase B — convenience inserts.** "Insert npub" and "Insert share link"
  buttons next to the QR data field. Insert npub fills the signed-in user's
  `npub`; Insert share link fills the design's `naddr`/`nevent` once it's
  been published. ~80 LoC.
- **Phase C — visual polish.** Optional center logo overlay and rounded
  modules. Riskier: a logo eats into the error-correction budget, so it
  should nudge the ECC level up. Skippable.

## Editor / tool UX

Small editor-usability improvements — no spec doc; scoped here.

- **On-canvas resize handles.** Add draggable nodes on a selected layer's
  edges and corners (text / shape / image / all layer types) so the user
  can resize by dragging instead of typing into the W/H inputs. Corner
  handles resize both axes (respecting the existing aspect-ratio lock
  toggle); edge handles resize one axis. The handles live on the
  `.freeLayer.selected` element and write back to the layer's `w` / `h`
  (and `x` / `y` for top/left drags).
- **Text box resize must not rescale the text.** Resizing a `text`
  layer's box changes only the area the text flows within — `fontSize`
  (points) stays fixed. (Distinct from image/shape, where the content
  scales with the box.)
- **Expand the Text tool panel.** `#textToolOptions` already exists but
  is minimal (color + size). Build it out like `#penToolOptions` —
  point size, font family, paragraph alignment, bold/italic — so text
  styling is editable from the tool-options panel, not just the layer
  panel.

## Cleanup

- **Delete `docs/TMDB_AUTOFILL_FEATURE.md`.** TMDB auto-fill was declined —
  the metadata fields work fine filled by hand, and the IMDb-style import
  has been removed.

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

## Drafted-but-unbuilt features

Each has a full spec in `docs/`.

- **Private (encrypted) publishing** — `docs/PRIVATE_PUBLISHING_FEATURE.md`.
  Publish any design encrypted, readable only by the author (Phase 1
  "private to me"). The agreed next build; Phase 0 is a validation spike.
- **Artstr Stacks** — `docs/STACKS_FEATURE.md`. Interactive fullscreen
  page/card stacks (HyperCard for Nostr) — the Slide Deck extended with
  layer actions and an interactive viewer. Queued after private publishing.
- **Pixel Art** — `docs/PIXEL_ART_FEATURE.md`. An editable `pixelart`
  layer type (palette-indexed grid in JSON), a dedicated Pixel Editor
  view, PNG/GIF export, and a standalone `casewrap-pixelart` design.
- **Badges (NIP-58)** — `docs/BADGES_FEATURE.md`. Award / display Nostr
  badges on profile pages.
- **Collections (NIP-51 sets)** — `docs/COLLECTIONS_FEATURE.md`. Let users
  organize favorite community templates into named sets.
- **Zap-gated premium templates** — `docs/ZAP_GATED_TEMPLATES_FEATURE.md`.
  Creators mark a template premium with a minimum-zap threshold.
- **Zaps via Nostr Wallet Connect** — `docs/ZAPS_NWC_FEATURE.md`. In-app
  zapping without the wallet handoff. (Tracked LNURL-pay tips already ship;
  this would be the NWC path.)
