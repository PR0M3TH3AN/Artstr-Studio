# Book Designer

## Goals

A unified document type for designing **books** — a cross between InDesign
and Illustrator inside Artstr Studio. One book combines a cover spread
(front + spine + back), an ordered list of interior pages, and per-page
design surfaces, all driven by a shared **document spec** (trim size,
bleed, page count, paper thickness) so that changes propagate
automatically (e.g. adding pages re-computes spine width).

The three existing workflows are the building blocks:

- **Cover designer** → renders the book's front / back / spine spread.
- **Slide-deck overview** → reorganises pages and gives a thumbnail-grid
  table of contents.
- **Custom-art canvas** → the per-page design surface.

A **Book** document type orchestrates all three around the shared spec,
exports the whole thing as a multi-page PDF, and publishes to Nostr as a
**manifest event** that references each page / cover / master as its
own addressable kind-30078 event — the same sidecar pattern Linked
Designs already uses.

### Product goals

1. **A Nostr-native book**, not a monolithic blob. The manifest event
   carries the spec + an ordered list of `naddr` refs. Each page, each
   master, and the cover are separate addressable events. Edits to one
   page replace only that page's event; the manifest changes only on
   structural edits (order, list, spec).
2. **A single Book document UX**. End-users see one cohesive editor —
   the sidecar plumbing is invisible. Opening a book event fans out to
   resolve every referenced page (with progressive fetch and a
   localStorage disk cache, just like Linked Designs).
3. **Auto-computed spine width** from `pageCount × paperThicknessIn`.
   The cover designer's spine column is derived, not user-typed; the
   cover re-renders whenever pages are added or removed.
4. **Uniform page artboards**. Every interior page inherits trim
   width / height / bleed from the spec, so resizing the trim updates
   every page in one shot.
5. **Pages overview** that reuses the deck-sorter UI: drag-reorder,
   add-blank, duplicate, delete, label, jump-to-edit. Page numbers
   render on each thumbnail.
6. **Per-page editor** that reuses the Custom Art canvas — same tools,
   same layer model, same renderer — but knows it's inside a book so
   prev / next page navigation, page-number context, and a small
   "page X / N" header are present. Saving a page autosaves the
   per-page event; saving the book updates the manifest.
7. **Master pages** (Indesign-style inheritance) **as reusable Nostr
   objects**. A master is its own addressable event; one master can be
   referenced by many books (and forked by other authors). Masters
   render *underneath* every page that inherits from them — running
   headers / footers, page numbers, baseline grids, margin guides.
8. **Multi-page PDF export** that stamps each page in order then the
   cover spread on its own page, with optional bleed marks and crop
   marks for print.
9. **Per-page premium / tips** (free Phase D follow-on). A book's
   manifest can gate individual pages via the existing PREMIUM_DESIGNS
   pipeline, enabling "first chapter free, rest paid" flows. NIP-57
   zaps on the manifest tip the whole book; zaps on a page tip a
   chapter.
10. **Per-page reactions and comments** — because each page is its own
    addressable event, NIP-25 reactions and kind-1 comments work per
    page for free, no extra plumbing.

### Non-goals (v1)

- **Reflowable text / paragraph styles / threaded text frames.** A book
  in Artstr is fixed-layout; you design each page as a canvas, not as
  a continuous text flow with master typography. For reflowable prose,
  Nostr already has **NIP-23 long-form articles** (kind-30023, markdown
  body) — Book mode is explicitly the *design* counterpart, not a
  competing prose format.
- **Footnote / endnote engine, index, automatic TOC, cross-references.**
  These all depend on a text-flow model we don't have. Manual TOC
  pages are fine.
- **CMYK colour management or ICC profile attachment.** PDF export is
  sRGB. Pro-print colour fidelity is a phase E+ concern.
- **Imposition / signatures / booklet print layouts.** Pages export in
  reading order; if a printer needs imposition they'll handle it
  themselves.
- **Page-size variance within a single book.** Every interior page has
  the same trim / bleed (only the cover differs). Mixed-size books are
  out of scope.
- **Spreads-as-design-units** (facing-page editing). v1 is single-page
  layout per page. Facing-page guide overlays can come later.
- **Chained master inheritance.** A master can be inherited by a page
  but not by another master. Single level only in v1.

### Implementation status

Not started. This document is the v1 spec.

---

## Why this fits the repo

Most of the primitives are already in place; Book mode is **glue + spec +
manifest**, not a new engine.

- **Linked Designs gives us the sidecar architecture for free.** The
  resolver IIFE, schema discriminator, progressive fetch, localStorage
  disk cache, batched relay queries, upstream-update notifications,
  attribution chain (p-tags + link-tags) — every piece transfers
  verbatim. A book manifest is functionally a *deck of linked designs*
  with cover + masters metadata layered on. Phases 1a–3d of Linked
  Designs are direct dependencies.
- **Layer model + targets.** Each layer already keys to a `target`
  (`page` / `cover-trim` / `back` / `spine` / `designer-disc` / `canvas`).
  Adding `book-page` / `book-cover-front` / `book-cover-back` /
  `book-spine` / `book-master` targets is additive.
- **Per-target rendering.** `renderLayers` already filters by target and
  delegates to the right host; the cover designer, deck, and custom-art
  all coexist in one document with no special-casing in the renderer.
- **Deck overview grid.** The deck sorter already does thumbnail-grid
  reordering with drag-and-drop. Reusing it for pages is a relabel +
  ref-shape rename away.
- **Custom-art canvas as page editor.** The page editor *is* the Custom
  Art canvas. The book wraps it in prev/next nav and a page-context bar.
- **Cover designer.** The cover view *is* the existing cover designer,
  except the spine width is computed from the spec instead of typed.
- **PREMIUM_DESIGNS** already implements per-event gating (watermarked
  preview + zap-unlocked content). A book gates individual page events
  with the same machinery — no new crypto path.
- **Nostr publish + fork + embed.** Books reuse the existing publish
  pipeline; each constituent event reuses the same kind-30078 with new
  tag names.

What's actually new:

- **`state.book`** as a manifest plus a hydrated cache of referenced
  page / master / cover objects.
- **Manifest publish flow** that fans out per-page autosave events and
  separately versions the manifest.
- **Spine derivation** when page count or paper thickness changes.
- **Master pages** as a new event type with a single-level inheritance
  render pass.
- **Page-aware navigation** (prev / next, page numbers).
- **Multi-page PDF export.** Currently there is no PDF export at all;
  Custom-art exports PNG/JPG and the cover designer exports per-panel
  PNG. Books need one PDF stamped with every page in order.
- **Reader Mode** (analogous to the Slide Decks' Presenter Mode) — a
  full-screen page-flip viewer driven off the manifest.
- **Book embed** — a flip-book player in the EXTERNAL_EMBED iframe
  transport.
- **Document settings modal** that owns the spec and propagates changes.

---

## Framing within Template / Designer

The existing top-level modes:

| Mode             | Selector                  | Surfaces                                            |
|------------------|---------------------------|-----------------------------------------------------|
| Cover            | `templateMode: 'cover'`   | `cover-trim` / `front` / `back` / `spine`           |
| Disc             | `templateMode: 'disc'`    | `designer-disc`                                     |
| Custom Art       | `templateMode: 'customart'` | `canvas`                                          |
| Slide            | `templateMode: 'slide'`   | `canvas` (16:9 alias)                               |
| Deck             | `templateMode: 'deck'`    | embedded slides via `deck.slides[]`                 |
| Pixel-art        | `templateMode: 'pixelart'`| `canvas` (palette-indexed)                          |
| **Book** (new)   | `templateMode: 'book'`    | `book-cover-front` / `book-cover-back` / `book-spine` / `book-page` / `book-master` |

Book mode adds a third sidebar tab ("Pages") alongside Designer (per-page
canvas) and Template (cover view). All three views read and write the same
`state.book` document, which hydrates page / master / cover refs from
Nostr via the Linked Designs resolver.

---

## Data model

The book is a **manifest event** that references its constituent parts.
Page, master, and cover events live as their own kind-30078 events and
each carries a single design surface plus the metadata needed to render
it.

### Addressable refs

Every reference inside the manifest uses the existing addressable-event
shape Linked Designs already speaks:

```js
{ kind: 30078, pubkey: '<hex>', dTag: '<d-tag>' }
```

Convertible to / from `naddr` at the UI layer.

### Book manifest (`templateMode: 'book'`, tag `casewrap-book`)

```js
{
  version: SCHEMA_VERSION,
  templateMode: 'book',
  templateType: 'book',
  meta: { … },                                  // title / category / language / tags
  book: {
    spec: {
      trimW: 6.0,                                // inches; common preset: US Trade
      trimH: 9.0,
      bleed: 0.125,                              // outside each trim edge
      paperThickness: 0.0042,                    // inches per page; default = uncoated 60# text
      spineFromPages: true,                      // false → spineWManual is used
      spineWManual: 0.5,
      coverHasSpine: true,                       // softcover yes, single-spread chapbook no
      coverHasBack: true,                        // wraparound vs front-only
      pageNumbering: {
        enabled: true,
        startAt: 1,
        firstNumberedPage: 1,                    // index into `pages` — skip cover, title, etc.
        format: '{n}',                           // '{n}' / 'Page {n}' / '— {n} —'
      },
      bookSize: 'US Trade 6×9',                  // label matching a preset
      defaultMasterRef: { … } | null,            // applied to new pages on creation
    },
    cover: { ref: { kind, pubkey, dTag } },      // a `casewrap-page` with role:'cover-spread'
    pages: [
      {
        ref: { kind, pubkey, dTag },             // a `casewrap-page` with role:'interior'
        label: 'Intro',                          // optional sorter label override
        inheritsMasterRef: { kind, pubkey, dTag } | null,  // overrides defaultMasterRef
        skipNumber: false,                       // true = excluded from {page-number} sequence
        gating: null | {                         // optional, opt-in per page
          mode: 'free' | 'premium',
          previewWatermark: true,                // PREMIUM_DESIGNS pipeline
          // unlock details live on the gated page event itself
        },
      },
      …                                          // ordered list, variable length
    ],
    masters: [                                   // refs only; the book can use a master without listing here, but listing surfaces them in the Masters modal
      { ref: { kind, pubkey, dTag }, label: 'Body pages' },
      …
    ],
  },
}
```

### Page event (kind-30078, tag `casewrap-page`)

```js
{
  version: SCHEMA_VERSION,
  templateMode: 'book-page',
  templateType: 'book-page',
  meta: { … },                                  // page title / language / optional thumbnail hash
  page: {
    role: 'interior' | 'cover-spread' | 'master',
    // Sizing: a page snapshots the spec values that produced it so it
    // renders correctly even if opened standalone (e.g. via embed).
    trimW: 6.0,
    trimH: 9.0,
    bleed: 0.125,
    coverSpread: null | {                        // present only when role: 'cover-spread'
      spineW: 0.5,
      hasSpine: true,
      hasBack: true,
    },
    background: '',                              // '' = inherit master / spec; '#hex' overrides
    layers: [ … ],                               // standard layer array; targets are book-page, book-master, or book-cover-*
  },
}
```

#### Notes on the page event

- **One surface per event.** Whether interior, cover, or master, the
  event carries a single design surface so it can be opened
  standalone (Linked Designs viewer, embed iframe, etc.) without
  needing the parent book to interpret it.
- **No order or numbering inside the page itself.** Position in the
  book and `skipNumber` live on the manifest; the page is reusable.
- **`{page-number}` tokens** in text layers resolve at render time
  using context from whichever manifest is rendering the page (or
  show a placeholder when previewed standalone).
- **Independent publish life-cycle.** Page events have their own
  `d`-tag (e.g. `book-page:<title|id>` or a stable opaque id) so
  NIP-33 replaceability works per page. Edit one page → that page
  event replaces; the book manifest is unaffected unless the
  user changes the page list or order.

### Master event

Same shape as a page event with `role: 'master'`. Masters do not
typically declare `trimW` / `trimH` themselves (they inherit from the
book), but they snapshot the spec at publish time so a stand-alone
preview is sane.

### Cover event

Same shape as a page event with `role: 'cover-spread'`. The
`coverSpread` block records the spine width and whether the spread
includes spine / back. Layers carry `book-cover-front` /
`book-cover-back` / `book-spine` targets so the renderer can lay them
out side-by-side.

### Why a separate event for each surface

| Concern                          | Inline-blob book | Sidecar book |
|----------------------------------|------------------|--------------|
| 200-page book event size         | Tens of MB; relays reject | Manifest stays small (~10 KB); pages fetched on demand |
| Edit one page                    | Re-publishes whole book | Replaces only that page's event |
| Reuse a master across books      | Copy-paste each time | One master event, many manifests reference it |
| Forks of one chapter             | Must clone whole book | Fork just the page event |
| Per-page comments / reactions    | All collapse to the book | Each page receives its own |
| Per-page premium / tips          | Whole book or nothing | First-chapter-free is natural |
| Reader fetches as you scroll     | Must download everything up front | Progressive fetch via the resolver |

### Nostr

- **Book manifest**: kind-30078, tag `casewrap-book`, `d`-tag
  `book:<title|id>`.
- **Page / master / cover**: kind-30078, tag `casewrap-page`, `d`-tag
  `book-page:<title|id>` (or `book-master:`/`book-cover:` if we want
  three tags for easier filter UX). Decision: **one tag
  (`casewrap-page`) with `role` differentiating** — fewer filters for
  clients, the `role` field still discriminates.
- All four event types are forkable and editable-in-place via the
  existing NIP-33 flow.
- Schema-version bump; the new `book` block + new event types are
  additive. Old clients see an unknown templateMode and either skip or
  render a stub.
- **Attribution.** Manifest p-tags every author that contributed a
  referenced page / master / cover (already how Linked Designs Phase
  3a handles attribution).
- **NIP-89 / kind-31990** client recommendations: a future arc; for v1
  Artstr is the only client that opens these by URL.

---

## Token substitution + page-count semantics

A text layer's HTML can contain magic tokens that resolve at render
time using the manifest's context.

- `{page-number}` → the current page's number under the manifest's
  `pageNumbering` config. A skipped page renders no number (its
  `{page-number}` token resolves to empty).
- `{page-count}` → total **numbered** pages (counts excluding any
  `skipNumber: true` entries). This is what users mean when they say
  "page 3 of 240."
- `{physical-page-count}` → total pages in the manifest, including
  skipped ones. Rarely useful but exposed for completeness.
- `{book-title}` → manifest `meta.title`.
- `{book-author}` → manifest `pubkey` resolved to a profile name.

Tokens resolve in both the editor preview and rendered output. Standalone
preview (a page event opened without its manifest) shows tokens with a
greyed-out placeholder (`[page]`, `[N]`).

---

## The surfaces

### 1. Document settings modal

Owns the spec. Accessible from a "Document settings" button in every
book view. Fields:

- **Book size preset**: US Trade 6×9, US Letter 8.5×11, A5 5.83×8.27,
  A4 8.27×11.69, Square 8×8, Custom. Picking a preset fills trim
  width/height + sensible default bleed and paper-thickness; switching
  to Custom unlocks them.
- **Trim width** / **Trim height** (inches, numeric).
- **Bleed** (inches, numeric, default 0.125).
- **Paper thickness** (inches per page) + **Spine from pages?** checkbox.
  When checked, spine width is derived; when unchecked, a manual Spine
  width field appears.
- **Cover layout**: wraparound (front + spine + back) / front-only.
- **Page numbering**: enabled toggle + start-at, first-numbered-page,
  format string.
- **Default master**: dropdown of refs registered in `book.masters`.

Editing **trim** prompts confirmation — "Page events that snapshotted
the old trim won't auto-resize; you may need to re-publish each page."
Apply re-runs cover surface fit and pushes the new spec into newly
created pages.

### 2. Cover view

Reuses the existing cover designer host, bound to whatever event the
manifest's `cover.ref` resolves to. Differences from the standalone
cover designer:

- The spine column width is **read-only** when `spineFromPages = true`;
  shows the computed value with a hint ("derived from N pages × paper
  thickness"). When manual, the existing typed-in field is editable
  and writes back to the spec.
- Saving the cover publishes the cover event (via the page autosave
  flow); the manifest is updated only if the cover ref needs to change
  (e.g. forking a referenced cover into a local copy for edits).
- A "Replace cover with…" picker scoped to the **`casewrap-page` events
  with `role: 'cover-spread'`** category.

### 3. Pages overview

Reuses the deck-sorter component. Differences:

- Title says "Pages" with a `Total: N` counter (numbered / physical
  shown separately).
- Each tile shows the page number below the thumbnail, derived from
  the manifest's `pageNumbering`. Skipped pages show no number.
- Drag-reorder writes back to `book.pages[]`. Numbering re-renders
  live; the manifest event is marked dirty for republish.
- Per-tile menu: **Edit** (jumps to the per-page editor), **Duplicate**
  (creates a new page event seeded with the current one's layers,
  appends to manifest), **Delete** (removes from manifest; the page
  event itself is left untouched on relays — manifest reference just
  drops), **Apply master…** (pick from `book.masters`), **Skip
  numbering**, **Rename**, **Open standalone** (opens the page event
  in a fresh tab as if you imported it via Linked Designs).
- A toolbar above the grid: **+ Add page**, **+ Add 10 pages**,
  **Import page from Nostr** (paste a `casewrap-page` event id;
  manifest gets a ref to it without re-publishing the page),
  **Manage masters…**, **Document settings**.

### 4. Per-page editor

The existing Custom Art canvas with three wraps:

- A **page-context bar** at the top of the canvas: `Page 12 / 248`,
  prev / next arrows (← / →), a master-page badge ("Inheriting: Body
  pages"), and a "Back to Pages" button.
- A **master layer underlay**: master layers render under the page's
  own layers, with reduced opacity (~50 %) and a small "M" badge when
  a master layer is hovered, to make the inheritance obvious. Master
  layers are **not editable** from the page editor — they're click-
  through to the page layer below. To edit a master, the user opens it
  from the masters modal (which routes back to the same canvas in
  master-edit mode — the only difference is which target the editor
  binds new layers to).
- A **trim + bleed guides** overlay (already exists in cover designer
  conceptually). Trim is dashed red, bleed is dashed teal, optional
  margin / gutter from the spec is faint grey.

Editing a layer marks the **page event** as dirty for autosave. Saving
publishes that page event (NIP-33 replace). The manifest is only marked
dirty if the user changes the page's `inheritsMasterRef`, `skipNumber`,
or `label` (manifest-owned fields).

### 5. Masters modal

Lists `book.masters` refs. Per-row Edit / Duplicate / Delete from
list / Rename / Set-as-default. "+ New master" creates a new
`casewrap-page` event with `role: 'master'` under the user's pubkey
and appends its ref to the manifest. "Import master from Nostr" pastes
in an existing master ref so the book can reuse another author's
master.

### 6. Reader Mode

Analogous to the Slide Decks' Presenter Mode. A full-screen page-flip
viewer driven off the manifest. Pulls page events progressively as the
user moves forward (with prefetch of next 2 pages); previously-viewed
pages cached in localStorage via the existing Linked Designs disk
cache.

- Keyboard nav: → / Space / PageDown advance; ← / PageUp back; Home /
  End jump to first / last; Esc exits.
- Mouse / touch: click right half advances, left half retreats; swipe
  on touch.
- Sidebar TOC: scrollable list of page labels with current-page
  highlight; click to jump.
- Page count footer: `12 / 248` plus a thin progress bar.
- Premium-gated pages render the watermarked preview by default; an
  inline "Unlock with zap" CTA opens the existing PREMIUM_DESIGNS
  modal.

Launches from a ▶ Read button on the manifest's preview pane and a
keyboard shortcut from the Pages overview.

### 7. Embed integration

The EXTERNAL_EMBED viewer learns a `?book=<naddr>` mode that renders
the manifest in a flip-book player (cut-down Reader Mode without the
TOC sidebar; arrows + swipe only). Re-uses the same iframe transport
and CSP rules; no new origin work needed.

---

## Cross-surface reactivity rules

1. **Page count changes** (add / delete / reorder) → `spec.spineW`
   recomputed if `spineFromPages` → cover view re-renders with the new
   spine column width → cover layers re-clamped if any straddled the
   old spine boundary (warn but don't auto-move) → manifest marked
   dirty.
2. **Trim size changes** → cover surface sizes recompute. Existing
   page events keep their snapshotted trim (since their content was
   designed for that size); a "Re-publish snapshot" action regenerates
   the page event's `trimW` / `trimH`. Users get a one-time toast.
3. **Bleed changes** → guide overlays update; layer coordinates and
   page events untouched.
4. **Master edit** → master event republishes. Every page referencing
   that master re-renders on next view (the Linked Designs auto-update
   notification surfaces the new version).
5. **Upstream page / master / cover updated externally** → Linked
   Designs already does this: a "New version available" badge in the
   sorter tile / cover-view header; user clicks to accept and refetch.
6. **Page-numbering format change** → all numbered page thumbnails
   re-render their badges. Numbering is never *baked* into page layers;
   it lives only as `{page-number}` token text on a master (or wherever
   the author chose to place it). Manifest marked dirty.
7. **Duplicate page** → creates a new page event under the user's
   pubkey (not a manifest-internal copy); both the original and the
   duplicate are independent events going forward.

---

## Premium, tipping, gating

PREMIUM_DESIGNS already implements per-event premium gating. Books
layer on top with **per-page gating** as a v1 capability and
manifest-level gating for whole-book paywalls.

- **Free book.** Default. Manifest and every page event publish without
  premium fields.
- **Whole-book paywall.** Gate the **manifest event** itself with
  PREMIUM_DESIGNS' encrypted-publish path. Readers see metadata + a
  cover thumbnail; unlocking the manifest gives them refs to (already
  free) page events. Cleanest model when the author wants to gate
  everything.
- **First-chapter-free / rest paid.** Gate **individual page events**.
  The manifest stays free (so previews / discovery work). When the
  reader hits a gated page, Reader Mode shows the watermarked preview
  and an unlock CTA. Each page can have its own price.
- **Tips.** NIP-57 zaps work on whatever event the user is zapping —
  manifest, individual page, or master. The author's lightning address
  on their profile is the destination as usual.

The manifest's per-page `gating` object is a hint to clients; it does
not duplicate the crypto state, which lives on the page event itself.
Clients should always verify gating by inspecting the page event when
loading it.

---

## PDF export

### What v1 produces

- One PDF with N + (1 or 2) pages: every interior page in order, then
  the cover spread on its own landscape page. (Back / spine / front
  flow follows the cover designer's existing left-to-right layout.)
- Page size: `trimW × trimH` plus bleed margin if "include bleed" is
  on. Cover page size: full cover-spread width × trim height plus
  bleed.
- sRGB. No ICC embedding. Fonts subset-embedded when supported by the
  PDF library; otherwise rasterised text fallback.
- Crop marks toggle: thin black L-marks at each trim corner, offset
  outside the trim by the bleed amount.

### Library

`pdf-lib` (~80 KB minified, MIT). Pure-JS, runs in the browser, supports
images, SVG paths (via converting our `d` strings into PDF path ops),
text, fonts, page management. Vendored as
`src/vendor/pdf-lib.min.js` the same way `polygon-clipping` is.

### Pipeline

For each page (resolved via the manifest):

1. Build a **virtual canvas** at the page's pixel resolution
   (e.g. `trimW × 300dpi`).
2. Run the existing `renderLayers` pipeline against that virtual
   canvas. This already handles every layer type (shape, image, text,
   QR, pixelart, linked design, deck slide, pathfinder result).
3. Token-substitute `{page-number}` etc. at render time using the
   manifest's `pageNumbering` config.
4. Take the rendered output and stamp it into a new PDF page via
   `pdf-lib`. Text layers ideally get re-emitted as PDF text objects
   (vector + searchable / selectable); v1 may flatten text to vector
   paths to dodge font-subset complexity, with a follow-up to switch
   to true PDF text.
5. Cover page is single-PDF-page with the full spread; print shops
   typically want it as one wide spread, so a separate "Cover-only
   PDF" download is also offered.

### Export UI

A new "Export PDF…" button in the Pages overview toolbar and the
Cover view toolbar opens an export modal:

- Interior pages: All / range / current
- Include cover spread: yes / no
- Include crop marks: yes / no
- Include bleed: yes / no
- Output: `Interior + Cover (single file)` / `Interior PDF + Cover PDF
  (two files)`. Print shops often want them separate.
- Filename pattern.

### Limitations baked in v1

- Vector text fidelity may regress where the renderer rasterises text
  for SVG output. We accept it and flag as a phase B PDF improvement.
- No bookmarks / outline / TOC links inside the PDF.
- No press-quality CMYK profile.
- Premium-gated pages: by default the export refuses to include them
  if the user is not the author or hasn't unlocked them. A user
  exporting their own book gets everything; a reader who has zapped to
  unlock can export the unlocked subset.

---

## Master pages

A master is a page-shaped Nostr event (kind-30078, `casewrap-page`,
`role: 'master'`) whose layers paint *under* every page that inherits
it. Used for:

- Running headers / footers
- Page numbers (via `{page-number}` tokens — substituted per page at
  render time)
- Margin guides drawn as faint shape layers (optional)
- Background art / chapter dividers

### Inheritance rule

- A page-list entry declares
  `inheritsMasterRef: { kind, pubkey, dTag }`. Render: master layers
  first (filtered by their `book-master` target), then page layers on
  top. Master layers are non-interactive in the page editor.
- **Single level of inheritance only in v1** — masters cannot inherit
  from other masters. Chained inheritance is a follow-up.
- Default master: `spec.defaultMasterRef` — applied to any page
  whose `inheritsMasterRef` is null. New pages adopt it on creation.
- A master ref can point to any author's master event, enabling
  reuse: ship one "Body pages" master and many books reference it.

---

## Phased delivery

### Phase A — Spec + Book mode skeleton
- New `templateMode: 'book'` with `state.book = { spec, cover: null,
  masters: [], pages: [] }`. Default spec: US Trade 6×9, 0.125 bleed,
  0 pages.
- Sidebar Template tab gets a "Book" entry alongside Cover / Disc /
  Custom Art / Slide / Deck.
- Empty Pages overview view (deck sorter clone, no pages yet) and
  Cover view (cover designer in spec-aware mode, spine derived).
- Document settings modal with all spec fields wired.
- Save / load / autosave: the `book` block round-trips alongside
  existing modes; refs are stored but no Nostr publish yet.

### Phase B — Pages overview + per-page editor
- Add / duplicate / delete / drag-reorder pages. Pages exist as
  in-memory objects with provisional ids; not yet published.
- Per-page editor (Custom Art canvas bound to `book-page` target).
- Page-context bar (prev / next / Back to Pages).
- Page numbering live in thumbnails + the editor header. Token
  substitution implemented for `{page-number}` / `{page-count}` /
  `{physical-page-count}` / `{book-title}` / `{book-author}`.

### Phase C — Master pages
- Masters modal, master-edit mode in the canvas, master-layer
  underlay in the page editor.
- Default master applied to new pages.
- Masters still in-memory, not yet published.

### Phase D1 — Publish individual page / cover / master events
- Per-page autosave publishes a `casewrap-page` event. Provisional
  ids are upgraded to real `naddr` refs on first publish.
- Cover save publishes its own `casewrap-page` event with
  `role: 'cover-spread'`.
- Master save publishes a `casewrap-page` event with `role: 'master'`.
- Linked Designs resolver wired so opening a book on a second client
  / device fetches the referenced events progressively.
- Disk cache: page / master / cover events cached in localStorage so
  re-opens are instant offline.
- Upstream-update notifications surface on the sorter tiles +
  cover-view header when a referenced event has a newer version
  upstream.

### Phase D2 — Publish the manifest
- Manifest publish path: `casewrap-book` event with the spec + list
  of `naddr` refs. Manifest is dirty whenever spec / page order /
  page list / per-page-manifest-fields change.
- Fork (community browser): clones the manifest under the user's
  pubkey; referenced pages stay as upstream refs unless the user
  explicitly "Make local copy" on a per-page basis.
- Attribution: manifest p-tags every author that contributed a
  referenced event (Linked Designs Phase 3a).
- Feed-card preview shows the cover spread thumbnail + page count.

### Phase E — PDF export
- Vendor `pdf-lib`. Build the render-to-PDF pipeline (Canvas2D first,
  text-flatten for v1).
- Export modal in Pages + Cover toolbars.
- Bleed + crop marks options. Single-file and split (cover + interior)
  output modes.
- Gated-page export rules enforced.

### Phase F — Templates + import polish
- New `book` template category for the community browser; templates
  ship at common sizes (US Trade, A5, A4).
- Import a deck → convert to a book of N pages, each page seeded with
  one slide's layers (cross-aspect letterbox-fit). Letting users
  bootstrap a book from a deck is the cleanest reuse story.
- Import a single page from another book (already works via Phase
  D1's Linked Designs plumbing — formalise the UI).

### Phase G — Reader Mode + embed
- Full-screen Reader Mode with TOC sidebar, page-flip nav, progressive
  fetch, premium-gate handling, NIP-57 zap inline.
- EXTERNAL_EMBED `?book=<naddr>` mode — flip-book in the iframe.
- Per-page NIP-25 reactions + kind-1 comments surfaced in the reader
  (already work natively because pages are addressable; this phase is
  just UX surfacing).

### Phase H — Premium / gating polish
- Per-page paywall toggle in the page editor. Manifest carries the
  `gating` hint; the page event carries the actual encrypted payload.
- Whole-book paywall via gating the manifest itself.
- "Unlock with zap" flow tested end-to-end in Reader Mode.

---

## Risks & tradeoffs

- **Many small events instead of one big event.** Fetching 200 page
  events is 200 relay round-trips' worth of overhead vs one fat
  download. Mitigation: the Linked Designs batched-query resolver
  (Phase 3d) already coalesces refs into bulk filters; localStorage
  disk cache keeps re-opens instant; Reader Mode prefetches the next
  two pages aggressively.
- **Manifest atomicity.** Manifest publish and per-page publish are
  not transactionally linked. If a user republishes a page and
  reorders pages in the same session, the manifest can land before
  the page event reaches all relays. Mitigate with: publish pages
  first, then manifest; show a "syncing" indicator until both land.
- **Master-layer perf.** Rendering master + page on every page-view
  switch is 2× the layer work. Acceptable in v1 with the existing
  renderer; if it bites, cache rasterised master snapshots.
- **PDF correctness.** This is the biggest correctness risk — print
  output that's slightly off can cost the user money at the printer.
  Mitigate with: clear preview before download, bleed / crop options
  explicit, and a "test page" download for proofing a single page
  before exporting the whole book.
- **Trim-resize collateral.** Resizing trim mid-design leaves layers
  out of bounds on pages that snapshotted the old trim. v1 warns and
  offers per-page re-snapshot; no auto-scale.
- **Reference rot.** A referenced master / page event's author can
  delete it (kind-5 tombstone) and the book breaks. Mitigation: the
  manifest's "Make local copy" action lifts a ref into a copy under
  the current user's pubkey. Encouraged at publish time for refs
  that aren't your own.
- **Two-level navigation.** Pages → Page editor → back to Pages — the
  user has to remember where they are. The page-context bar with
  prev / next / "Back to Pages" is essential and should never be
  hidden.

---

## Open questions

- **Facing pages.** Do we want a v1.5 facing-page preview (two pages
  side by side) even without facing-page editing? It's a small render
  addition.
- **Bleed in the per-page editor.** Show as a guide always, or
  toggleable? Cover designer shows it; we should match.
- **Per-page background image** vs masters owning the background.
  Currently the spec puts `background` on both the page event and
  masters. Resolve precedence: page beats master beats spec default.
- **TOC generation.** Out of scope for v1, but a manual TOC page can
  use the `{page-count}` token and a list of layer-text entries. A
  `{toc}` magic token that auto-builds from page labels would be a
  natural Phase G+ addition.
- **Manifest event size at the extreme.** A 1,000-page book's
  manifest is 1,000 refs × ~80 bytes each = ~80 KB. Approaching relay
  limits. If we ever hit them, the manifest itself can be sharded
  (chapter-manifests referenced from a top-level book event).
- **NIP-89 / client recommendations.** Worth publishing a kind-31990
  recommendation so other Nostr clients know to open
  `casewrap-book` / `casewrap-page` events with Artstr Studio. v2
  unless someone else builds a competing book viewer first.
- **Linked Designs interaction.** Pages can themselves use Linked
  Design layers (a page that pulls in another author's illustration).
  Confirm this works through the renderer's existing async resolver
  path — should "just work" but worth a smoke test in Phase B.

---

## Acceptance summary

### Phase A — Book mode skeleton
- [ ] `templateMode: 'book'` saves + restores via autosave.
- [ ] Document settings modal applies every spec field and the cover
  view's spine width updates live when `paperThickness` or page count
  changes.
- [ ] Cover view renders an empty front / back / spine surfaces sized
  to the spec.
- [ ] Pages overview view renders an empty grid with an Add Page button.

### Phase B — Pages overview + per-page editor
- [ ] Add / duplicate / delete / drag-reorder writes back to
  `book.pages` and the numbering reflects the new order.
- [ ] Clicking a tile opens the per-page editor; prev / next walk the
  page list.
- [ ] Layers added in the editor are bound to `book-page` and persist
  across reloads.
- [ ] `{page-number}` / `{page-count}` / `{physical-page-count}` /
  `{book-title}` / `{book-author}` tokens substitute correctly in
  text layers (live in the editor + in thumbnails).

### Phase C — Master pages
- [ ] At least one master exists; pages inheriting it render the
  master layers below their own.
- [ ] Master-layer underlay is non-interactive in the page editor
  (hover shows an "M" badge, click passes through).

### Phase D1 — Per-event publish
- [ ] Saving a page publishes a `casewrap-page` kind-30078 event
  under the user's pubkey.
- [ ] Reopening a book on a second device resolves every page /
  master / cover ref via the Linked Designs resolver.
- [ ] An upstream master update surfaces a "new version available"
  notice in the masters modal and (when accepted) propagates to every
  page that inherits it.

### Phase D2 — Manifest publish
- [ ] A book publishes as `casewrap-book` and reopens losslessly
  across devices.
- [ ] Manifest p-tags every author of every referenced event
  (attribution chain).
- [ ] Community-browser feed-card shows the cover thumbnail + page
  count.

### Phase E — PDF export
- [ ] Export modal produces a PDF with the expected page count + cover
  spread on a separate page.
- [ ] Bleed + crop-marks toggle work; output passes a visual diff
  against a hand-laid InDesign export of the same book at a single
  reference size.
- [ ] A premium-gated page included in the export is replaced by the
  watermarked preview when the user is not authorised to unlock it.

### Phase G — Reader Mode + embed
- [ ] Reader Mode walks the manifest's pages with progressive fetch;
  prev / next page navigation works keyboard + touch + click.
- [ ] EXTERNAL_EMBED `?book=<naddr>` opens the same book in an iframe
  flip-book.
- [ ] A gated page in Reader Mode shows the watermarked preview and a
  working "Unlock with zap" CTA.

### Phase H — Premium gating
- [ ] A book with one gated chapter publishes; an unauthorised reader
  sees the preview; a reader who zaps to unlock sees the real content
  in Reader Mode without re-opening the book.
