# Book Designer

## Goals

A unified document type for designing **books** — a cross between InDesign
and Illustrator inside Artstr Studio. One document combines a cover spread
(front + spine + back), an ordered list of interior pages, and per-page
design surfaces, all driven by a shared **document spec** (trim size,
bleed, page count, paper thickness) so that changes propagate
automatically (e.g. adding pages re-computes spine width).

The three existing workflows are the building blocks:

- **Cover designer** → renders the book's front / back / spine spread.
- **Slide-deck overview** → reorganises pages and gives a thumbnail-grid
  table of contents.
- **Custom-art canvas** → the per-page design surface.

A **Book** document type orchestrates all three around the shared spec and
exports the whole thing as a multi-page PDF.

### Product goals

1. **A single Book document** that holds a cover spread, an ordered list
   of interior pages, and a document spec. The document is one
   self-contained Nostr-publishable artefact (`casewrap-book`).
2. **Auto-computed spine width** from `pageCount × paperThicknessIn`. The
   cover designer's spine column is derived, not user-typed; the cover
   re-renders whenever pages are added or removed.
3. **Uniform page artboards**. Every interior page inherits trim width /
   height / bleed from the spec, so resizing the trim updates every page
   in one shot.
4. **Pages overview** that reuses the deck-sorter UI: drag-reorder,
   add-blank, duplicate, delete, label, jump-to-edit. Page numbers render
   on each thumbnail.
5. **Per-page editor** that reuses the Custom Art canvas — same tools,
   same layer model, same renderer — but knows it's inside a book so
   prev / next page navigation, page-number context, and a small
   "page X / N" header are present.
6. **Master pages** (Indesign-style inheritance): a master is a special
   page whose layers render *underneath* every page that inherits from
   it. Used for running headers / footers, page numbers, baseline grids,
   margin guides.
7. **Multi-page PDF export** that stamps each page in order then the
   cover spread on its own page, with optional bleed marks and crop
   marks for print.

### Non-goals (v1)

- **Reflowable text / paragraph styles / threaded text frames.** A book
  in Artstr is fixed-layout; you design each page as a canvas, not as
  a continuous text flow with master typography. (A natural follow-up
  arc, but huge.)
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
- **Linked design pulls inside pages.** The existing Linked Designs
  feature still works inside book pages, but pages aren't published
  individually — only the whole book.
- **Spreads-as-design-units** (facing-page editing). v1 is single-page
  layout per page. Facing-page guide overlays can come later.

### Implementation status

Not started. This document is the v1 spec.

---

## Why this fits the repo

Most of the primitives are already in place; Book mode is **glue + spec**,
not a new engine.

- **Layer model + targets.** Each layer already keys to a `target`
  (`page` / `cover-trim` / `back` / `spine` / `designer-disc` / `canvas`).
  Adding `book-page:<id>` / `book-cover-front` / `book-cover-back` /
  `book-spine` / `book-master:<id>` targets is additive.
- **Per-target rendering.** `renderLayers` already filters by target and
  delegates to the right host; the cover designer, deck, and custom-art
  all coexist in one document with no special-casing in the renderer.
- **Deck overview grid.** The deck sorter already does thumbnail-grid
  reordering with drag-and-drop. Reusing it for pages is a relabel +
  one data-shape rename away.
- **Custom-art canvas as page editor.** The page editor *is* the Custom
  Art canvas. The book wraps it in prev/next nav and a page-context bar.
- **Cover designer.** The cover view *is* the existing cover designer,
  except the spine width is computed from the spec instead of typed.
- **Nostr publish + fork + embed.** Books reuse the existing publish
  pipeline as kind-30078 with a new `casewrap-book` tag.

What's actually new:

- **`state.book`** document spec + page list shape.
- **Spine derivation** when page count or paper thickness changes.
- **Master pages** (a new render pass: master layers render below page
  layers, scoped by `inheritsMasterId`).
- **Page-aware navigation** (prev / next, page numbers).
- **Multi-page PDF export.** Currently there is no PDF export at all;
  Custom-art exports PNG/JPG and the cover designer exports per-panel
  PNG. Books need one PDF stamped with every page in order.
- **Document settings modal** that owns the spec and propagates changes.

---

## Framing within Template / Designer

The existing top-level modes:

| Mode             | Selector                | Surfaces                                            |
|------------------|-------------------------|-----------------------------------------------------|
| Cover            | `templateMode: 'cover'` | `cover-trim` / `front` / `back` / `spine`           |
| Disc             | `templateMode: 'disc'`  | `designer-disc`                                     |
| Custom Art       | `templateMode: 'customart'` | `canvas`                                        |
| Slide            | `templateMode: 'slide'`   | `canvas` (16:9 alias)                             |
| Deck             | `templateMode: 'deck'`    | embedded slides via `deck.slides[]`               |
| Pixel-art        | `templateMode: 'pixelart'`| `canvas` (palette-indexed)                        |
| **Book** (new)   | `templateMode: 'book'`  | `book-cover-front` / `book-cover-back` / `book-spine` / `book-page:<id>` / `book-master:<id>` |

Book mode adds a third sidebar tab ("Pages") alongside Designer (per-page
canvas) and Template (cover view). All three views read and write the same
`state.book` document.

---

## Data model

### Book (`templateMode: 'book'`)

```js
{
  version: SCHEMA_VERSION,
  templateMode: 'book',
  templateType: 'book',
  meta: { … },                              // title / category / language / tags
  book: {
    spec: {
      trimW: 6.0,                            // inches; common preset: US Trade
      trimH: 9.0,
      bleed: 0.125,                          // outside each trim edge
      paperThickness: 0.0042,                // inches per page; default = uncoated 60# text
      spineFromPages: true,                  // false → spineW is user-typed instead
      spineWManual: 0.5,                     // used only when spineFromPages = false
      coverHasSpine: true,                   // softcover yes, single-spread chapbook no
      coverHasBack: true,                    // wraparound vs front-only
      pageNumbering: {
        enabled: true,
        startAt: 1,
        firstNumberedPage: 1,                 // skip cover, title, etc.
        format: '{n}',                       // '{n}' / 'Page {n}' / '— {n} —'
      },
      bookSize: 'US Trade 6×9',              // label only; matches a preset
    },
    cover: {
      front: { background: '#ffffff', layers: [ … ] },
      back:  { background: '#ffffff', layers: [ … ] },     // omitted if !coverHasBack
      spine: { background: '#ffffff', layers: [ … ] },     // omitted if !coverHasSpine
    },
    masters: [
      {
        id: 'master:body',                    // referenced by page.inheritsMasterId
        name: 'Body pages',
        background: '#ffffff',
        layers: [ … ],                        // page-number text, header rule, etc.
        renderBelow: true,                    // master layers below page layers (always true v1)
      },
      …
    ],
    pages: [
      {
        id: 'page:abc123',
        name: 'Cover page',                   // optional label for the sorter
        inheritsMasterId: 'master:body' | '', // '' = no master
        background: '',                       // '' = inherit master / spec; '#hex' overrides
        skipNumber: false,                    // true = numbered as blank (e.g. title page)
        layers: [ … ],
      },
      …                                        // ordered list, variable length
    ],
  },
}
```

#### Shape notes

- A book is **self-contained**: every page and master embeds its full
  layer array. Same model as `deck.slides[]`. The whole book publishes as
  one Nostr event.
- Each **embedded surface** (cover panel, master, page) carries only its
  per-surface fields — no `meta`, no `templateMode`. Document-level
  metadata covers the book.
- Layer `target` for a page layer is `book-page:<id>`. For a master:
  `book-master:<id>`. Cover panels: `book-cover-front` / `…-back` /
  `…-spine`. The renderer filters by target as it already does — no
  cross-talk between pages, no leak from one master into another.
- The `pages` array order **is** the print order. The sorter mutates
  this array directly.

#### Derived values

- `spec.spineW` = `spineFromPages ? pageCount × spec.paperThickness : spec.spineWManual`.
- `pageCount` = `book.pages.length`.
- Cover-spread total W = `(2 × trimW) + spineW + (2 × bleed)`.
- A page's drawable area = `trimW × trimH` (bleed renders outside but is
  trimmed in the printed product; gutter / margins are master-page
  responsibilities, not spec-driven).

### Nostr

- Book: kind-30078, tag `casewrap-book`, `d`-tag `book:<title|id>`.
- Single event carries cover + every page + every master inline. A large
  book may exceed the relay's max event size; if so, splitting masters /
  pages into per-event sidecars (à la Linked Designs) is a v2 concern.
- Schema-version bump; new `book` block is additive — old clients render
  nothing for a book event but don't break.

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

Editing **trim** prompts confirmation if any page already has layers —
"Layers may need reflowing." Apply re-runs page-bounds calc and refits
the cover surfaces. Bleed change does not warn (it only affects guides).

### 2. Cover view

Reuses the existing cover designer host. Differences:

- The spine column width is **read-only** when `spineFromPages = true`;
  shows the computed value with a hint ("derived from N pages × paper
  thickness"). When manual, the existing typed-in field is editable.
- Front / back / spine targets renamed under the hood to
  `book-cover-front` / `book-cover-back` / `book-spine` so layers don't
  collide with a stand-alone cover document opened in the same session.
- A "Replace with template" picker scoped to the **`book-cover` template
  category** (a new kind alongside `casewrap-template`).

### 3. Pages overview

Reuses the deck-sorter component. Differences:

- Title says "Pages" with a `Total: N` counter.
- Each tile shows the page number (from `pageNumbering`) below the
  thumbnail. Skipped or unnumbered pages show no number.
- Drag-reorder writes back to `book.pages`. Numbering re-renders live.
- Per-tile menu: **Edit** (jumps to the per-page editor), **Duplicate**,
  **Delete**, **Apply master…** (pick from `book.masters`), **Skip
  numbering**, **Rename**.
- A toolbar above the grid: **+ Add page**, **+ Add 10 pages** (common
  bulk action), **Import page from Nostr** (paste a slide / custom-art
  event id and convert), **Manage masters…** (modal listing
  `book.masters`).

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

The tool palette, layer panel, alignment / pathfinder / pen tools —
all unchanged. The canvas binds to `book-page:<id>` (or
`book-master:<id>` in master-edit mode), so new layers land on the
right page.

### 5. Masters modal

Lists `book.masters` with per-row Edit / Duplicate / Delete /
Rename / Set-as-default. "+ New master" creates a blank entry.
"Edit" opens the per-page editor in master-edit mode.

---

## Cross-surface reactivity rules

1. **Page count changes** (add / delete / paste) → `spec.spineW`
   recomputed if `spineFromPages` → cover view re-renders with the new
   spine column width → cover layers re-clamped if any straddled the
   old spine boundary (probably warn but don't auto-move).
2. **Trim size changes** → every `book.pages[].layers[]` and the cover
   panel sizes recompute. Layers are NOT auto-scaled — they keep their
   absolute inch coordinates. Users get a one-time toast prompting
   "Layers may now sit outside the trim — review pages."
3. **Bleed changes** → guide overlays update; layer coordinates
   untouched.
4. **Master edit** → every page that inherits that master re-renders.
5. **Page-numbering format change** → all numbered page thumbnails
   re-render their badges. The numbering doesn't get *baked* into page
   layers; it lives on the master via a special `{page-number}` token
   in a text layer.

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

For each page (and each cover panel):

1. Build a **virtual canvas** at the page's pixel resolution
   (e.g. `trimW × 300dpi`).
2. Run the existing `renderLayers` pipeline against that virtual
   canvas. This already handles every layer type (shape, image, text,
   QR, pixelart, linked design, deck slide, pathfinder result).
3. Take the rendered output and stamp it into a new PDF page via
   `pdf-lib`. Text layers ideally get re-emitted as PDF text objects
   (vector + searchable / selectable); v1 may flatten text to vector
   paths to dodge font-subset complexity, with a follow-up to switch
   to true PDF text.
4. Cover page is single-PDF-page with the full spread; print shops
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

---

## Master pages

A master is a page-shaped surface whose layers paint *under* every
page that inherits it. Used for:

- Running headers / footers
- Page numbers (via the `{page-number}` text token — the renderer
  substitutes it per page at render time)
- Margin guides drawn as faint shape layers (optional)
- Background art / chapter dividers

### Inheritance rule

- A page declares `inheritsMasterId: 'master:body'`. Render: master
  layers first (filtered by their `book-master:body` target), then page
  layers on top. Master layers are non-interactive in the page editor.
- Multi-master: a master can itself inherit another master via
  `inheritsMasterId` on the master record. (v1 supports a single level
  of inheritance to keep the render simple — chained inheritance is
  follow-up.)
- Default master: `book.spec.defaultMasterId` — applied to any page that
  doesn't specify its own. New pages adopt it on creation.

### `{page-number}` token

A text layer whose HTML contains `{page-number}` gets per-page
substitution at render time. The same token works inside any text layer
but is primarily useful on master pages. Substitution:

- `{page-number}` → current page number (per `pageNumbering` format).
- `{page-count}` → total numbered pages.
- `{book-title}` → `meta.title`.

Tokens render at the live value in the page editor preview too.

---

## Phased delivery

### Phase A — Spec + Book mode skeleton
- New `templateMode: 'book'` with `state.book = { spec, cover, masters,
  pages }`. Default spec: US Trade 6×9, 0.125 bleed, 0 pages.
- Sidebar Template tab gets a "Book" entry alongside Cover / Disc /
  Custom Art / Slide / Deck.
- Empty Pages overview view (deck sorter clone, no pages yet) and
  Cover view (cover designer in spec-aware mode, spine derived).
- Document settings modal with all spec fields wired.
- Save / load / autosave: the `book` block round-trips alongside
  existing modes; no Nostr publish yet.

### Phase B — Pages overview + per-page editor
- Add / duplicate / delete / drag-reorder pages.
- Per-page editor (Custom Art canvas bound to `book-page:<id>`).
- Page-context bar (prev / next / Back to Pages).
- Page numbering live in thumbnails + the editor header.

### Phase C — Master pages
- Masters modal, master-edit mode in the canvas, master-layer underlay
  in the page editor.
- `{page-number}`, `{page-count}`, `{book-title}` token substitution.
- Default master applied to new pages.

### Phase D — Nostr publish + fork
- `casewrap-book` Nostr publish path. `d`-tag `book:<title|id>`.
- Fork in the community browser (clone the whole book under a new
  identity).
- Feed-card preview shows the cover spread thumbnail + page count.

### Phase E — PDF export
- Vendor `pdf-lib`. Build the render-to-PDF pipeline (Canvas2D first,
  text-flatten for v1).
- Export modal in Pages + Cover toolbars.
- Bleed + crop marks options. Single-file and split (cover + interior)
  output modes.

### Phase F — Templates + import polish
- New `book` template category for the community browser; templates
  ship at common sizes (US Trade, A5, A4).
- Import a deck → convert to a book of N pages, each page seeded with
  one slide's layers (cross-aspect letterbox-fit). Letting users
  bootstrap a book from a deck is the cleanest reuse story.
- Import a single page from another book.

---

## Risks & tradeoffs

- **Event size.** A book with 200 pages of layered art could easily
  exceed a 256 KB Nostr event. v1 caps publish size and warns; v2
  candidate: per-page sidecar events (à la Linked Designs).
- **Master-layer perf.** Rendering master + page on every page-view
  switch is 2× the layer work. Acceptable in v1 with the existing
  renderer; if it bites, cache rasterised master snapshots.
- **PDF correctness.** This is the biggest correctness risk — print
  output that's slightly off can cost the user money at the printer.
  Mitigate with: clear preview before download, bleed / crop options
  explicit, and a "test page" download for proofing a single page
  before exporting the whole book.
- **Trim-resize collateral.** Resizing trim mid-design leaves layers
  out of bounds. v1 warns but doesn't auto-scale. A "Refit selection
  to trim" tool can come later.
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
  Currently the spec puts `background` on both `book.pages[]` and
  masters. Resolve precedence: page beats master beats spec default.
- **TOC generation.** Out of scope for v1, but a manual TOC page can
  use the `{page-count}` token and a list of layer-text entries. A
  `{toc}` magic token that auto-builds from page names would be a
  natural Phase G addition.
- **Multi-book event size strategy.** When (not if) we hit relay
  limits, do we prefer per-page sidecars (lots of small events,
  parallel fetch) or a chunked-blob event (one big event split into
  CBOR chunks)?

---

## Acceptance summary

### Phase A — Book mode skeleton
- [ ] `templateMode: 'book'` saves + restores via autosave.
- [ ] Document settings modal applies every spec field and the cover
  view's spine width updates live when `paperThickness` or page count
  changes.
- [ ] Cover view renders empty front / back / spine surfaces sized to
  the spec.
- [ ] Pages overview view renders an empty grid with an Add Page button.

### Phase B — Pages overview + per-page editor
- [ ] Add / duplicate / delete / drag-reorder writes back to
  `book.pages` and the numbering reflects the new order.
- [ ] Clicking a tile opens the per-page editor; prev / next walk the
  page list.
- [ ] Layers added in the editor are bound to `book-page:<id>` and
  persist across reloads.

### Phase C — Master pages
- [ ] At least one master exists; pages inheriting it render the
  master layers below their own.
- [ ] `{page-number}` substitution renders the right number on each
  page (matching `pageNumbering` config) in both the editor preview
  and the overview thumbnails.

### Phase D — Publish
- [ ] A book publishes as `casewrap-book` and reopens losslessly.
- [ ] Community-browser feed-card shows the cover thumbnail + page
  count.

### Phase E — PDF export
- [ ] Export modal produces a PDF with the expected page count + cover
  spread on a separate page.
- [ ] Bleed + crop-marks toggle work; output passes a visual diff
  against a hand-laid InDesign export of the same book at a single
  reference size.
