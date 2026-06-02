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
   carries the spec + an ordered list of `naddr` refs. Each page,
   each master, the cover, and each prose chapter (as a NIP-23
   article) are separate addressable events. Edits to one event
   replace only that event; the manifest changes only on structural
   edits (order, list, spec).
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
11. **Reflowable text via Markdown + NIP-23.** Prose-heavy chapters are
    written as **markdown** and published as **NIP-23 long-form
    articles** (kind-30023). The book manifest references each
    chapter's article event and pours its markdown into per-page
    text frames at render time using a book-level **stylesheet**
    (H1 / H2 / H3 / body / blockquote / code / link typography).
    Designed pages and reflow segments interleave in the page
    sequence. The same NIP-23 article can be read standalone on
    Habla.news *and* presented as a designed chapter inside a book
    — one source, two presentations.

### Non-goals (v1)

- **Reflowable text beyond the v1 markdown subset.** v1 supports
  paragraphs, h1-h6, **bold** / *italic* / `inline code`, code
  blocks, lists (ordered + unordered), blockquotes, links, hr, and
  inline images (one per line). **Out of scope for v1:** tables,
  footnotes / endnotes, definition lists, GFM task lists, embedded
  HTML, multi-column text frames, float-around-image, ligatures
  beyond the renderer's defaults. Each deferred feature can land
  later as its own phase with its own typography rules.
- **Threaded text frames across non-adjacent pages.** Reflow always
  fills frames in master-page order; you can't manually link a
  frame on page 12 to one on page 47.
- **A WYSIWYG markdown editor.** v1 ships a textarea + live preview.
  Rich syntax-highlighted editing is a Phase I follow-up.
- **Auto-paginated tables of contents, indices, cross-references.**
  All of these depend on a richer flow model. Manual TOC pages are
  fine; a `{toc}` magic token that auto-builds from chapter titles
  is on the open-questions list.
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
- **NIP-23 long-form articles** are already first-class Nostr citizens
  with rich tooling (Habla.news, Yakihonne, others). A book chapter
  *is* a NIP-23 article event — we reuse the kind, the editor
  ecosystem, and the discovery surface for free. Authors can write
  on whatever NIP-23 client they prefer and assemble the book later.
- **Nostr publish + fork + embed.** Books reuse the existing publish
  pipeline; each constituent event reuses the same kind-30078 with new
  tag names.

What's actually new:

- **`state.book`** as a manifest plus a hydrated cache of referenced
  page / master / cover / chapter objects.
- **Manifest publish flow** that fans out per-page autosave events and
  separately versions the manifest.
- **Spine derivation** when page count or paper thickness changes.
- **Master pages** as a new event type with a single-level inheritance
  render pass.
- **`text-frame` layer type** on masters — a rectangular flow region
  the pagination engine fills with markdown content.
- **Pagination engine.** Markdown tokens → measured lines → page
  breaks, with widow / orphan rules to avoid bad page splits. Powers
  both on-screen render and PDF export.
- **Book-level text stylesheet** (`spec.textStyles`) that maps each
  markdown element to typography (font, size, weight, leading,
  alignment, top/bottom margin).
- **Markdown editor surface** in the page editor for `reflow`
  entries — a textarea with live preview of the rendered chapter,
  scrolled in sync with the source.
- **Page-aware navigation** (prev / next, page numbers).
- **Multi-page PDF export.** Currently there is no PDF export at all;
  Custom-art exports PNG/JPG and the cover designer exports per-panel
  PNG. Books need one PDF stamped with every page in order — with
  reflowed prose as real PDF text (searchable, copyable, not
  flattened-to-paths) where possible.
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
      textStyles: {                              // book-level markdown stylesheet (see "Reflowable text" below)
        body:       { fontFamily: 'Georgia', fontSize: 11, lineHeight: 1.5, color: '#111', marginAfter: 0.08, alignment: 'left' },
        h1:         { fontFamily: 'Helvetica', fontSize: 24, fontWeight: 700, marginBefore: 0.4, marginAfter: 0.2, alignment: 'center', keepWithNext: true },
        h2:         { fontFamily: 'Helvetica', fontSize: 18, fontWeight: 700, marginBefore: 0.3, marginAfter: 0.15, keepWithNext: true },
        h3:         { fontFamily: 'Helvetica', fontSize: 14, fontWeight: 700, marginBefore: 0.2, marginAfter: 0.1, keepWithNext: true },
        blockquote: { fontStyle: 'italic', marginLeft: 0.3, marginRight: 0.3 },
        codeBlock:  { fontFamily: 'monospace', fontSize: 10, background: '#f5f5f5', padding: 0.05 },
        inlineCode: { fontFamily: 'monospace', fontSize: 10, background: '#f5f5f5' },
        link:       { color: '#0066cc', underline: true },
        list:       { marginAfter: 0.08, indent: 0.2 },
        hr:         { color: '#cccccc', thickness: 0.5, marginBefore: 0.15, marginAfter: 0.15 },
      },
    },
    cover: { ref: { kind, pubkey, dTag } },      // a `casewrap-page` with role:'cover-spread'
    pages: [                                     // discriminated union; see GatingBlock + AnchorBlock below
      // 1) Designed page (fixed-layout):
      {
        id: 'entry:abc123',                      // stable opaque id, generated on insert — used by AnchorBlock and the editor's "which entry am I on"
        type: 'design',
        ref: { kind, pubkey, dTag },             // a `casewrap-page` with role:'interior'
        label: 'Title page',                     // optional sorter label override
        masterRef: { kind, pubkey, dTag } | null,// overrides spec.defaultMasterRef; null = use default
        skipNumber: false,                       // true = excluded from {page-number} sequence
        anchor: AnchorBlock | null,              // see below; null = "sits after the previous entry"
        gating: GatingBlock | null,
      },
      // 2) Reflow segment (markdown text poured into N pages):
      {
        id: 'entry:def456',
        type: 'reflow',
        textRef: { kind: 30023, pubkey, dTag },  // a NIP-23 article event carrying the chapter's markdown
        textPinnedEventId: '<hex>' | null,       // when set, lock to this exact revision (event id ref). null = always use latest addressable.
        masterRef: { kind, pubkey, dTag },       // master whose text-frame layer the markdown flows into; required, must reference a master with a text-frame layer
        chapterTitle: 'Chapter 3: The Threshold',// overrides article's title for {chapter-title} tokens
        chapterNumber: 3 | null,                 // explicit number for {chapter-number}; null = auto-numbered by reflow-segment ordinal
        startsOnPage: 'recto' | 'verso' | 'any', // bookbinding: chapter starts on right-hand page = 'recto'
        skipNumberOnFirstPage: false,            // common print convention: page number suppressed on a chapter's first page
        styleOverrides: TextStylesBlock | null,  // per-chapter overrides to spec.textStyles (rare)
        gating: GatingBlock | null,              // gates the textRef event in PREMIUM_DESIGNS pipeline
      },
      …                                          // ordered list, variable length
    ],
    masters: [                                   // refs the book wants surfaced in the Masters modal. A master ref used elsewhere (e.g. via masterRef on a page) doesn't have to appear here, but listing it makes it pickable from the UI.
      { ref: { kind, pubkey, dTag }, label: 'Body pages' },
      …
    ],
  },
}
```

Where:

```js
// AnchorBlock: keeps a designed page's semantic position stable as
// reflow segments expand or contract. Without an anchor, a designed
// page sits at its array position — which can be ambiguous when a
// chapter ahead of it changes length.
AnchorBlock =
  | { mode: 'before-chapter',  entryId: 'entry:def456' }   // landed just before the named reflow entry
  | { mode: 'after-chapter',   entryId: 'entry:def456' }   // landed just after the named reflow entry's last paginated page
  | { mode: 'at-position',     after: 'entry:abc123' };    // sits right after the named designed entry (chains designed pages explicitly)

// GatingBlock: hint that this entry is paid content. Authoritative
// crypto state lives on the gated event itself; clients verify by
// reading the event, not by trusting the manifest.
GatingBlock = {
  mode: 'free' | 'premium',
  previewWatermark: true,                        // PREMIUM_DESIGNS pipeline renders watermarked preview when locked
  priceSats: 1000 | null,                        // hint only; truth is on the event
};

// TextStylesBlock: a partial map of element-name → typography
// object. Used in three places: book.spec.textStyles (the
// stylesheet), reflow entry's styleOverrides, and the master's
// text-frame.styleOverrides. Merged low-to-high precedence at
// render time.
TextStylesBlock = {
  body: TypographyObject,
  h1: TypographyObject, h2: …, h3: …, h4: …, h5: …, h6: …,
  blockquote: TypographyObject,
  codeBlock: TypographyObject, inlineCode: TypographyObject,
  link: TypographyObject,
  list: TypographyObject,
  hr: TypographyObject,
};

// TypographyObject keys (all optional):
// { fontFamily, fontSize, fontWeight, fontStyle, lineHeight, color,
//   alignment, marginBefore, marginAfter, marginLeft, marginRight,
//   underline, background, padding, indent, thickness,
//   keepWithNext, keepTogether }
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
  `d`-tag — a stable opaque id (e.g. `book-page:abc123`) generated
  at insert time, NOT derived from the page's title (titles change,
  d-tags shouldn't). NIP-33 replaceability works per page. Edit
  one page → that page event replaces; the book manifest is
  unaffected unless the user changes the page list or order.

### Master event

Same shape as a page event with `role: 'master'`. Masters snapshot
the spec at publish time so a stand-alone preview is sane. A master
intended for reflow MUST carry exactly one `text-frame` layer (the
manifest UI refuses to pair a master without one). A master without
a text-frame is still valid for designed pages — it just doesn't
participate in reflow.

### Cover event

Same shape as a page event with `role: 'cover-spread'`. The
`coverSpread` block records the spine width and whether the spread
includes spine / back. Layers carry `book-cover-front` /
`book-cover-back` / `book-spine` targets so the renderer can lay them
out side-by-side.

### Chapter event (kind-30023 NIP-23 article)

Vanilla NIP-23. The book references it via the reflow entry's
`textRef`. The article has no book-specific schema; it's a normal
long-form article and opens cleanly on Habla, Yakihonne, or any
other NIP-23 client.

```js
{
  kind: 30023,
  pubkey: '<hex>',
  created_at: <unix>,
  tags: [
    ['d', 'chapter:<slug>'],                     // standard NIP-23 d-tag for replaceable addressing
    ['title', 'Chapter 3: The Threshold'],
    ['summary', '<optional short summary>'],
    ['published_at', '<unix>'],                  // when first published (NIP-23 convention)
    ['t', 'book-chapter'],                       // optional, for discoverability in book-aware clients
    // …any other normal NIP-23 tags (language, image, etc.)
  ],
  content: '<markdown body>',
}
```

A book can reference any author's existing NIP-23 article as a
chapter — no special encoding required. Conversely, a chapter
written for a book is a perfectly normal article that any NIP-23
reader can open.

### Uniqueness rules

- A given chapter event (by `textRef`) may appear in **at most one**
  reflow entry per book. The Pages overview refuses to add a
  duplicate; if a user wants two appearances they must duplicate the
  chapter event under a new `d`-tag first.
- A given designed-page event (by `ref`) may appear at most once per
  manifest. Same rule.
- Every manifest entry has a unique `id`. Generated at insert time;
  stays stable across reorders so anchors don't break.

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
  referenced page / master / cover / chapter (already how Linked
  Designs Phase 3a handles attribution).
- **NIP-89 / kind-31990** client recommendations: a future arc; for v1
  Artstr is the only client that opens these by URL.
- **Chapter events are vanilla NIP-23.** A book chapter is just a
  kind-30023 article — same kind Habla.news and Yakihonne publish.
  No book-specific tag is required, though we'll add an optional
  `t` tag `book-chapter` for discoverability. A book can reference
  any author's existing NIP-23 article as a chapter, and any NIP-23
  client can open a referenced chapter standalone.

### Schema + compatibility

- The book feature bumps `SCHEMA_VERSION` to **6** (current is 5).
- The new `book` block on the project payload is additive; older
  clients that load a v6 project either skip Book mode entirely or
  fall back to a "Unsupported template — open in latest Artstr"
  notice (same fallback PIXEL_ART used at its v5 bump).
- Page, master, and cover events use `templateMode: 'book-page'`
  inside their payload (one shape, three roles).
- Chapter events have no `templateMode` — they're raw NIP-23
  articles, opaque to the book code beyond their `content` and
  metadata tags.
- Old clients seeing a `casewrap-book` manifest can render the
  feed-card thumbnail (the cover ref resolves to a normal
  `casewrap-page` event they understand visually); only opening the
  full editor requires v6.

### Privacy

Books can be published privately via the existing
`PRIVATE_PUBLISHING` flow: every constituent event (manifest, pages,
masters, cover, chapters) can be encrypted to the author's own
pubkey or shared with a specific reader set. Per-event privacy is
already the model, so nothing new is needed beyond making sure the
publish UI offers the choice at the right granularity (default:
public; opt-in to private at publish time, applied uniformly across
all constituent events of that publish action).

---

## Token substitution + page-count semantics

Magic tokens that resolve at render time using the manifest's
context. **Tokens are honored in two places only:**

1. The HTML of a regular text layer on a designed page or a master.
2. Reflow entry fields that drive on-canvas display
   (`chapterTitle`, sorter labels).

Tokens are **not** substituted inside a chapter event's markdown
body — chapter events are vanilla NIP-23 articles that must remain
portable to other long-form clients. If you want a chapter title in
a running header, put a `{chapter-title}` token on a text layer on
the chapter's reflow master, not in the markdown.

- `{page-number}` → the current page's number under the manifest's
  `pageNumbering` config. A skipped page renders no number (its
  `{page-number}` token resolves to empty).
- `{page-count}` → total **numbered** pages (counts excluding any
  `skipNumber: true` entries). This is what users mean when they say
  "page 3 of 240."
- `{physical-page-count}` → total pages in the manifest after reflow
  pagination, including skipped ones. Rarely useful but exposed for
  completeness.
- `{book-title}` → manifest `meta.title`.
- `{book-author}` → manifest `pubkey` resolved to a profile name.
- `{chapter-title}` → the current reflow segment's `chapterTitle`,
  or the NIP-23 article's title when none is overridden. Useful for
  running headers on master pages — the value updates as the reader
  moves through chapters.
- `{chapter-number}` → the current reflow segment's `chapterNumber`,
  or its 1-based ordinal among reflow segments if not explicit.

Tokens resolve in both the editor preview and rendered output. Standalone
preview (a page event opened without its manifest) shows tokens with a
greyed-out placeholder (`[page]`, `[N]`).

---

## Reflowable text + Markdown

Prose chapters are stored as **NIP-23 long-form articles** (kind-30023,
markdown body). A reflow entry on the book manifest references the
chapter event and pairs it with a master that has a `text-frame`
layer; at render time the pagination engine pours the chapter's
markdown into copies of the master until the chapter is exhausted.
Designed pages and reflow entries interleave in the page sequence.

### Why markdown

- **Markdown encodes paragraph + character styles** without inventing a
  schema. `# H1`, `## H2`, `**bold**`, `> blockquote`, ``` ` `` `code` ``,
  lists, links, images. The book's `spec.textStyles` defines how each
  element renders — that's the entire "paragraph styles" feature.
- **One source, many presentations.** An author writes a chapter on
  Habla.news. It's published as a kind-30023 article. Readers on Habla
  see a clean reading view. The author later assembles a book on Artstr
  Studio that references the same article event; readers on Artstr see
  it laid out as designed book pages. Edit on Habla → the next book
  read picks up the change.
- **Event size fits.** A typical chapter is 3-5K words ≈ 20-30 KB of
  markdown. Well within relay event limits. A 100K-word novel splits
  cleanly into ~30 chapter events.

### `text-frame` layer type (new)

A new shape-like layer that masters can carry. Has:

- `x` / `y` / `w` / `h` / `rotate` (same as any layer)
- `padding` (inside the frame, inches)
- `verticalAlign`: `top` | `middle` | `bottom`
- `columns`: 1 in v1 (multi-column deferred)
- `styleOverrides`: optional partial `textStyles` block; merges over
  the manifest's `spec.textStyles` for prose rendered into *this*
  frame only

A master with no `text-frame` is invalid for use as a reflow master
(the manifest UI refuses the pairing). A master with `text-frame` can
still be used for designed pages — the frame just doesn't get filled.

### `spec.textStyles` (book-level stylesheet)

Maps each markdown element to typography. Inheritance order at render
time, low → high precedence:

1. Built-in defaults (sane fallbacks per element)
2. `book.spec.textStyles`
3. Reflow entry's `styleOverrides` (per chapter)
4. Master's `text-frame.styleOverrides` (per frame)

Each style block is a plain typography object — same fields the existing
text layer already speaks: `fontFamily`, `fontSize`, `fontWeight`,
`fontStyle`, `lineHeight`, `color`, `alignment`, `marginBefore`,
`marginAfter`, `marginLeft`, `marginRight`, plus boolean flow controls
(`keepWithNext`, `keepTogether`) for the pagination engine.

### Markdown subset (v1)

Supported:

- Paragraphs (blank-line separated)
- `# H1` through `###### H6`
- `**bold**`, `*italic*`, `***bold-italic***`, `~~strikethrough~~`
- `` `inline code` ``, fenced code blocks (```` ``` ````)
- `> blockquote` (single-level)
- Ordered (`1.`) and unordered (`-`, `*`) lists, **single level**
- `[link text](url)` — links render with the `link` style; URL is
  preserved as a layer attribute for PDF export
- `![alt](url)` inline images — one per line, full-width-of-frame,
  with optional alt-text caption underneath (per stylesheet config).
  URLs may be `nostr:` (resolves to a NIP-94 file event) or `https:`
- `---` horizontal rule
- Soft line break (two trailing spaces): renders as `<br>`
- Hard line break (blank line): paragraph break

Deferred (Phase I+):

- Tables (own typography rules + layout pass)
- Footnotes / endnotes (need a footnote-frame layer and per-page
  collection)
- Definition lists, GFM task lists
- Nested lists beyond one level
- HTML embedded in markdown (security + complexity)
- Multi-column text frames
- Float-around-image (text wraps around an inline figure)

### Pagination engine

Pure function: takes `(markdown, frame geometry, stylesheet, master,
page-context)` and returns `({ pageBreaks, lineLayout, overflow })`.

1. **Parse** markdown into a token stream using `marked` (~30 KB
   minified, MIT, vendored as `src/vendor/marked.min.js`). We use the
   lexer output directly, not the HTML renderer — we want token shapes
   for measurement, not HTML strings.
2. **Measure** each token against the current frame's available width.
   Text wrapping uses a Canvas2D measurement context with the right
   font / size loaded.
3. **Line-break** greedily within paragraphs (no Knuth–Plass in v1).
4. **Page-break** when a line doesn't fit, with these rules:
   - `keepWithNext: true` on a heading style → if the heading would
     be the last line on the page, push it to the next page too.
   - `keepTogether: true` on a small block (e.g. an image with its
     caption) → don't split it across pages.
   - Widow rule: a paragraph's last line should not stand alone at
     the top of the next page. If it would, push the previous line
     too.
   - Orphan rule: a paragraph's first line should not stand alone at
     the bottom of the previous page. If it would, push the heading
     too.
5. **Generate** virtual page entries (master + filled `text-frame`)
   that feed into `renderLayers` exactly like designed pages.

Token substitution (`{chapter-title}` etc.) happens at the
text-frame's containing-page level, not at the token-stream level —
the engine emits placeholder tokens and the page renderer substitutes
on draw.

Edge cases v1 documents (and does not fix):

- A word wider than the frame: render with horizontal overflow + a
  warning toast.
- A code block wider than the frame: same — no auto-hyphenation, no
  shrink-to-fit.
- An image wider than the frame: scale down to frame width.
- A page that has zero room (the master's text-frame has negative
  effective height due to padding overflow): refuse and surface an
  error.

### Anchoring designed pages around reflow segments

A reflow segment expands to N pages at render time, so designed pages
can't be addressed by absolute page index — N changes when prose
changes. Each designed page on the manifest carries an `anchor` field
that references **another manifest entry's stable `id`** so the
relationship survives reorders and reflow:

```js
{ type: 'design', id: 'entry:dedication',     ref: …, anchor: { mode: 'before-chapter', entryId: 'entry:chapter-1' } }
{ type: 'design', id: 'entry:epilogue',       ref: …, anchor: { mode: 'after-chapter',  entryId: 'entry:chapter-12' } }
{ type: 'design', id: 'entry:half-title',     ref: …, anchor: { mode: 'at-position',    after: 'entry:title-page' } }
{ type: 'design', id: 'entry:title-page',     ref: …, anchor: null }   // null = "sits at its array position"
```

The pagination pipeline interleaves anchored designed pages around
reflow segments so the *semantic* order is stable even as page counts
shift. A new designed page is given `anchor: null` by default
(sits at insertion order); the user can promote it to a chapter
anchor from the Pages overview's per-tile menu.

### Pinning chapter revisions

Text drift is the biggest reflow tradeoff: if an author edits the
NIP-23 article a book references, the book's pagination changes —
designed pages may shift, the printed page count may differ from
what was proofed. Two modes per reflow segment:

- **Pinned** (`textPinnedEventId` set): the manifest locks to a
  specific event id. `kind-5` deletes or addressable replacements
  upstream don't affect this book. Updates are explicit: an
  "Update pinned chapter" command pulls the latest revision and
  re-runs pagination.
- **Live** (`textPinnedEventId` null): the manifest tracks the
  addressable ref — always the latest. Linked Designs' upstream-
  update notification surfaces when the chapter changes, and the
  reader prompts to refresh.

Default: **pinned at publish time.** Safe by default for print
runs. Authors can opt a chapter into live mode if they want
"latest-always" behaviour (e.g. for a serialised work in progress).

### Markdown editor surface

For each reflow entry, the page editor switches to a two-pane layout:

- Left pane: markdown textarea (autosaves to the chapter's local
  draft; explicit "Save chapter" publishes a new revision of the
  NIP-23 event).
- Right pane: live preview rendered through the same pagination engine
  the book will use, showing the chapter as paginated pages with the
  selected master applied.

v1 ships a plain textarea + preview; a syntax-highlighted CodeMirror
upgrade is a Phase I follow-up.

The editor also exposes:

- A **"Import from Nostr"** field that paste-fetches an existing
  kind-30023 article event and seeds the textarea with its content.
- A **"Pin / Live"** toggle.
- A **"Re-paginate now"** button (shows page count + warns about
  changes since last paginate).

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

- Title says "Pages" with three counters: `Numbered: N`,
  `Physical: M` (after reflow pagination), `Reflow segments: K`.
- Two tile styles by entry type:
  - **Designed-page tile**: a thumbnail of the rendered page, just
    like the deck sorter shows slides today.
  - **Reflow tile**: a stack-of-pages icon with the chapter title,
    chapter number, a master-name pill, the latest paginated page
    count (e.g. "Chapter 3 — Body pages master — 14 pages"), and
    a tiny preview thumbnail of the chapter's first paginated page.
- Drag-reorder writes back to `book.pages[]`. Numbering and reflow
  re-paginate live; the manifest event is marked dirty for republish.
- Per-tile menu — designed:  **Edit**, **Duplicate**, **Delete**
  (removes from manifest; the page event itself is left untouched on
  relays), **Apply master…**, **Skip numbering**, **Rename**, **Open
  standalone**.
- Per-tile menu — reflow: **Edit chapter** (opens the markdown editor),
  **Change master…**, **Pin / Live toggle**, **Re-paginate**,
  **Open chapter on Habla** (link to the NIP-23 article on a public
  long-form client for cross-checking), **Delete from book**.
- A toolbar above the grid: **+ Add designed page**, **+ Add chapter**
  (creates a new draft NIP-23 article + a reflow entry referencing
  it), **Import chapter from Nostr** (paste an existing kind-30023
  article id; manifest gets a ref to it without republishing),
  **Import designed page from Nostr**, **Manage masters…**,
  **Document settings**.

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
- sRGB. No ICC embedding. Fonts on the **embeddable allowlist**
  (Georgia, Times, Helvetica, Arial, monospace family) are
  subset-embedded; layers using any other font fall back to vector
  paths and are listed in a per-export warning so authors can pick
  whether to swap fonts before re-exporting.
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
   `pdf-lib`. Text layers — both designed-page text layers and the
   pagination engine's reflowed prose — emit as real PDF text
   objects (vector, searchable, copyable) when the font is on the
   allowlist; otherwise fall back to vector paths with the per-export
   warning. This applies uniformly to both reflowed prose and
   designed-page text.
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

- Layers using fonts outside the embeddable allowlist fall back to
  vector-path text (still visually identical, just not selectable in
  the PDF). The per-export warning lists which layers were affected.
- No PDF bookmarks / outline / TOC links. Phase I+ adds bookmarks
  built from each reflow segment's `chapterTitle` and the
  `{toc}` token's targets.
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

### MVP launch path

Book mode is a large feature. The phase order is set up so each
phase ships independently and the project never sits in a half-done
state. Two reasonable launch targets:

- **MVP-A: Designed-only books.** Phases **A + B + D1 + D2**.
  A user can lay out a fixed-layout book with cover + designed
  interior pages and publish it as a manifest + sidecar events.
  No reflow, no PDF, no Reader Mode. Useful for art books,
  zines, photo books, comic chapbooks.
- **MVP-B: Books with prose.** MVP-A + Phase **C + C.5 + E**.
  Adds masters, reflowable chapters via NIP-23, and PDF export.
  This is the full "book designer" experience.

Phases **F (templates + deck-to-book import)**, **G (Reader Mode +
embed)**, **H (premium gating)**, and **I (markdown + extras)** are
strict enhancements — none of them block MVP-A or MVP-B.

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
- **`text-frame` layer type** added — masters can carry a text-frame
  on the canvas (a new layer kind that renders as a labelled
  rectangle in the editor and is the future drop-target for prose).
  No reflow yet; the frame is purely structural.
- Masters still in-memory, not yet published.

### Phase C.5 — Reflowable text (markdown + pagination)
- Vendor `marked` (~30 KB MIT) as `src/vendor/marked.min.js`.
- Implement the pagination engine (token stream → measured lines →
  page breaks, with widow / orphan + `keepWithNext` /
  `keepTogether`). Pure-function shape so it's testable in isolation.
- `spec.textStyles` editor in Document settings.
- `reflow`-type entries in `book.pages[]`; pages overview tiles
  render reflow segments with the "stack of pages" affordance and
  paginated page-count.
- Markdown editor pane in the per-page editor for reflow entries
  (textarea + live preview).
- Anchoring of designed pages around reflow segments
  (`anchor.mode = 'before-chapter' | 'after-chapter' | 'at-position'`).
- `{chapter-title}` / `{chapter-number}` tokens substitute correctly
  in master text layers.
- Pin / Live revision tracking for chapter refs.
- `text-frame` layer is now functional — masters with one become
  valid reflow-master targets; masters without one are rejected by
  the "Set master" picker for reflow entries.
- NIP-23 import: paste a kind-30023 article id, get a reflow entry
  that references it.

### Phase D1 — Publish individual page / cover / master / chapter events
- Per-page autosave publishes a `casewrap-page` event. Provisional
  ids are upgraded to real `naddr` refs on first publish.
- Cover save publishes its own `casewrap-page` event with
  `role: 'cover-spread'`.
- Master save publishes a `casewrap-page` event with `role: 'master'`.
- **Chapter save publishes a `kind-30023` (NIP-23) article event.**
  Title comes from the reflow entry's `chapterTitle`; body is the
  markdown source. The article event is independent — readable on
  any NIP-23 client.
- Linked Designs resolver wired so opening a book on a second client
  / device fetches the referenced events progressively.
- Disk cache: page / master / cover / chapter events cached in
  localStorage so re-opens are instant offline.
- Upstream-update notifications surface on the sorter tiles +
  cover-view header when a referenced event has a newer version
  upstream; for chapters, the notice also reports the new word count
  delta.

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
- Vendor `pdf-lib`. Build the render-to-PDF pipeline.
- **Reflowed prose exports as real PDF text** (not flattened paths)
  using `pdf-lib`'s font subsetting. Designed-page text layers
  whose font isn't embeddable fall back to vector-path text with a
  per-export warning listing which layers were flattened.
- Export modal in Pages + Cover toolbars.
- Bleed + crop marks options. Single-file and split (cover + interior)
  output modes.
- Gated-page export rules enforced.
- A **"Proof one page"** quick-export emits a single page or a
  single chapter as a PDF — useful for sending to a printer to
  test colour / paper before exporting the full book.

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

### Phase I — Markdown editor + extended subset
- Replace the plain textarea with a syntax-highlighted CodeMirror
  instance (~150 KB minified, vendored). Adds inline rendering hints,
  smart quotes, list-continuation, drag-and-drop image insert.
- Extended markdown features, each added with its own typography
  rules and pagination handling:
  - **Tables** with column-width balancing and per-cell alignment.
  - **Footnotes** — a footnote-frame layer on masters collects
    references per page; reference markers in the flow render as
    superscripts.
  - **Nested lists** beyond one level (typography per level).
  - **Definition lists**, GFM task lists.
- Auto-generated TOC via `{toc}` magic token that walks every
  reflow segment's H1 / H2 / H3 headings and emits a styled list
  with page numbers.
- Auto-generated index via `{index}` and inline `^[term]` markers
  in the markdown source.
- Cross-references: `[See chapter 3](#chapter-3)` resolves to a
  page number at render time.

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
- **Pagination is fiddly.** Pagination engines have a long tail of
  edge cases — long words on narrow columns, code blocks wider than
  the frame, images that should keep with their caption, mid-line
  font changes. **Mitigations:**
  - **Tight v1 subset.** Document the supported markdown subset
    explicitly. Each deferred feature lands as a separate phase
    with its own tests.
  - **Pure-function engine** so it's testable in isolation: feed it
    a markdown string + frame geometry + stylesheet, assert page
    breaks. Build a small canonical corpus of "should paginate
    these ways" fixtures.
  - **"Preview pagination"** command before publish so the author
    sees the page count + any overflow warnings without committing.
  - **Overflow warnings** in the editor: a long word, a too-wide
    code block, a margin that swallows the frame — each emits a
    toast pointing at the offending line, rather than silently
    rendering wrong.
- **Text drift breaking pagination.** A chapter event updates
  upstream → its word count changes → physical page count shifts →
  designed pages anchored after that chapter move. **Mitigations:**
  - **Pin chapters at publish time by default.** Authors who want
    "latest-always" opt-in to live mode per chapter.
  - **Re-paginate notice** when a live chapter changes, with a
    diff (`+12 pages` / `-3 pages`) shown in the sorter so the
    author knows what shifted before accepting the update.
  - **Anchor-based designed pages.** Designed pages on the manifest
    use `anchor.mode: 'before-chapter' | 'after-chapter'` rather
    than absolute index, so they stay semantically in place even
    when page counts shift.
- **PDF text fidelity for reflowed prose.** Reflowed paragraphs
  must export as real PDF text objects (searchable, copyable) — the
  Phase E PDF pipeline uses `pdf-lib` font subsetting for this.
  **Mitigations:**
  - **Font allowlist.** Document settings restricts text-frame
    fonts to ones we know `pdf-lib` can subset cleanly (start with
    a small set of bundled web-safe fonts: Georgia, Times, Helvetica,
    Arial, monospace).
  - **Fallback to vector paths** for fonts outside the allowlist,
    with a per-export warning listing which paragraphs were
    flattened.
- **Markdown editor scope.** Building a full WYSIWYG markdown
  editor would eat the v1 timeline. **Mitigation:** ship a plain
  textarea + live preview for v1 (Phase C.5). CodeMirror upgrade is
  Phase I. A WYSIWYG editor is explicitly never in scope — markdown
  is the source of truth, not a transient representation.

---

## Open questions

- **Facing pages.** Do we want a v1.5 facing-page preview (two pages
  side by side) even without facing-page editing? It's a small render
  addition; useful for previewing recto / verso bookbinding before
  print.
- **Bleed guide in the per-page editor.** Show as a guide always, or
  toggleable? Cover designer shows it always; recommend matching for
  consistency unless user research surfaces a reason not to.
- **`background` precedence.** Spec puts `background` on the page
  event, the master, and `spec` (implicitly). Proposed precedence:
  page event's `background` wins, then master's, then spec default
  (`#ffffff`). Lock this in code review of Phase B.
- **Manifest event size at the extreme.** A 1,000-page book's
  manifest is ~1,000 refs × ~80 bytes = ~80 KB. Approaching relay
  limits. If we ever hit them, the manifest itself can be sharded
  (chapter-manifests referenced from a top-level book event). Not
  worth solving until a real user runs into it.
- **NIP-89 / client recommendations.** Publishing a kind-31990
  recommendation so other Nostr clients know to open
  `casewrap-book` / `casewrap-page` events with Artstr Studio is
  worth doing eventually but only matters once a competing viewer
  exists.
- **Inline-image source resolution.** v1 markdown images accept
  `https://` URLs. Adding `nostr:` resolution (image events under
  NIP-94, profile pictures by npub) is a small Phase C.5 follow-up
  worth scoping once the engine is working.

## Compatibility notes

- **Linked Designs inside pages.** A page can include a Linked
  Design layer (e.g. an illustration pulled from another author).
  The existing async resolver path handles it; no special book
  code needed. Worth a smoke test in Phase B since this is the
  first place we render a Linked Design *inside* a page that is
  itself fetched via the resolver — a two-level lookup.
- **Layer types known to work on a book page.** All existing layer
  types (`shape`, `image`, `text`, `qr`, `pixelart`, `design`,
  `slide`) render unchanged on `book-page` / `book-master` /
  `book-cover-*` targets — the renderer keys off layer type, not
  target. The new `text-frame` layer is the only book-specific
  layer type.

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
- [ ] A master can carry a `text-frame` layer; the editor renders it
  as a labelled rectangle but the frame is empty (no reflow yet).

### Phase C.5 — Reflowable text
- [ ] A reflow entry on the manifest renders the chapter's markdown
  into the chosen master's `text-frame`, paginating across as many
  pages as the prose needs.
- [ ] Each markdown element type (H1 / H2 / H3 / body / blockquote /
  code / list / link / image / hr) renders with the typography
  defined by `spec.textStyles`.
- [ ] `keepWithNext` on headings prevents a heading-as-last-line on
  any page; widow / orphan rules prevent single-line splits.
- [ ] `{chapter-title}` / `{chapter-number}` tokens on master text
  layers resolve to the *containing* chapter's values.
- [ ] Designed pages with `anchor.mode: 'before-chapter' |
  'after-chapter'` interleave around reflow segments correctly, and
  stay in place semantically when prose changes.
- [ ] Pin / Live revision tracking: a pinned chapter ignores
  upstream updates; a live chapter surfaces an update notice with
  page-count delta.
- [ ] "Preview pagination" shows page count + overflow warnings
  before publish.

### Phase D1 — Per-event publish
- [ ] Saving a page publishes a `casewrap-page` kind-30078 event
  under the user's pubkey.
- [ ] Saving a chapter publishes a `kind-30023` NIP-23 article event;
  the same event opens cleanly on Habla.news as a long-form article.
- [ ] Reopening a book on a second device resolves every page /
  master / cover / chapter ref via the Linked Designs resolver.
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
- [ ] Reflowed prose exports as real PDF text (searchable + copyable)
  for fonts on the allowlist; a per-export warning lists any layers
  that fell back to vector paths.
- [ ] Bleed + crop-marks toggle work; output passes a visual diff
  against a hand-laid InDesign export of the same book at a single
  reference size.
- [ ] A premium-gated page included in the export is replaced by the
  watermarked preview when the user is not authorised to unlock it.
- [ ] "Proof one page" / "Proof one chapter" produces a single-page
  PDF in under 2 seconds end-to-end.

### Phase F — Templates + import polish
- [ ] At least three book templates ship at common sizes (US Trade
  6×9, A5, US Letter); each opens as a fresh book with master(s)
  configured.
- [ ] Import-from-deck produces a book of N designed pages whose
  layouts match the deck's slides (letterboxed when the deck aspect
  doesn't match the book trim).
- [ ] Import-single-page from another book lands a Linked-Designs
  ref in the manifest without re-publishing the page.

### Phase G — Reader Mode + embed
- [ ] Reader Mode walks the manifest's pages with progressive fetch;
  prev / next page navigation works keyboard + touch + click.
- [ ] Reader Mode works on a book with **no** reflow segments
  (designed-only) and on a book with **only** reflow segments
  (prose-only).
- [ ] EXTERNAL_EMBED `?book=<naddr>` opens the same book in an iframe
  flip-book.
- [ ] A gated page in Reader Mode shows the watermarked preview and a
  working "Unlock with zap" CTA.

### Phase H — Premium gating
- [ ] A book with one gated chapter publishes; an unauthorised reader
  sees the preview; a reader who zaps to unlock sees the real content
  in Reader Mode without re-opening the book.
- [ ] A book whose **manifest itself** is gated shows only its cover
  thumbnail + price to unauthorised readers; the page list resolves
  after unlock.

### Phase I — Markdown editor + extended subset
- [ ] CodeMirror editor replaces the plain textarea for reflow
  entries; syntax highlighting + smart list continuation + drag-
  and-drop image insert work.
- [ ] Each extended markdown feature (tables, footnotes, nested
  lists, definition lists) has typography rules in
  `spec.textStyles`, paginates correctly across page breaks, and
  is acceptance-tested with its own fixture set in the engine's
  canonical corpus.
- [ ] `{toc}` magic token expands into a styled list of chapter
  titles with page numbers; updates live as reflow re-paginates.
- [ ] Cross-references (`[See chapter 3](#chapter-3)`) resolve to
  the right page number in both Reader Mode and PDF output.
- [ ] PDF export includes a bookmarks outline built from
  `chapterTitle` per reflow segment.
