# Book

Multi-page reflowable book with cover, designed pages, reflow
chapters, masters, PDF export, and full-screen Reader Mode.

> Hands-on walkthrough: see [`BOOK_DESIGNER_TUTORIAL.md`](https://github.com/PR0M3TH3AN/Artstr-Studio/blob/main/docs/BOOK_DESIGNER_TUTORIAL.md).
> Spec: see [`BOOK_DESIGNER_FEATURE.md`](https://github.com/PR0M3TH3AN/Artstr-Studio/blob/main/docs/BOOK_DESIGNER_FEATURE.md).

## Starting

When you enter Book mode with no pages, four starter cards appear
(US Trade / A5 / A4 / Square). Clicking one seeds a default master
with a text-frame, a starter chapter, and a Title page.

A 5th card appears when you have a slide deck loaded — **Convert
deck to book** turns each slide into a designed page (letterbox-fit
into the trim).

## The two main views

- **Pages overview** — every manifest entry as a tile (designed
  pages + reflow chapters). Drag to reorder. Hover for per-tile
  actions (proof PDF, duplicate, delete, master picker).
- **Cover** — wraparound spread editor. Front / spine / back panels
  selected via the layer-target dropdown.

Plus two **per-entry** views:

- **Designed page editor** — same flat-canvas tools as Custom Art,
  scoped to one `book-page:<id>` target. Master layers render
  underneath at 55% opacity.
- **Chapter editor** — markdown-on-left, paginated preview on right.
  CodeMirror with markdown syntax + smart Enter for list
  continuation.

## Masters

Reusable underlays. A master with a **text-frame** layer becomes a
valid reflow target — the chapter's prose flows into that frame.
Header / footer text on the master can use **tokens** that resolve
per page:

- `{page-number}`, `{page-count}`, `{physical-page-count}`
- `{book-title}`, `{book-author}`
- `{chapter-title}`, `{chapter-number}`

## Markdown features in chapters

- GFM headings / lists / blockquotes / code / tables / task lists.
- Nested lists (up to depth 6).
- `[^N]` footnote refs + `[^N]: definition` for footnote bodies
  (renders as Unicode superscript + chapter-end Footnotes section).
- `^[term]` invisible index markers.
- `[link text](#chapter-3)` cross-references — auto-appended with
  ` (p. N)` at render time.
- Magic tokens on their own line:
  - `{toc}` — auto-generated table of contents with page numbers.
  - `{index}` — alphabetical index of every `^[term]` marker.

## Publishing

Sidecar-architecture: each surface publishes as its own Nostr event.

| Surface | Event | d-tag |
|---------|-------|-------|
| Designed page | kind-30078 `casewrap-page` (role: 'interior') | `book-page:<entry-id>` |
| Master | kind-30078 `casewrap-page` (role: 'master') | `book-master:<master-id>` |
| Cover | kind-30078 `casewrap-page` (role: 'cover-spread') | `book-cover:<title-slug>` |
| Chapter (public) | kind-30023 NIP-23 article | `chapter:<title-slug>` |
| Chapter (private) | kind-30078 encrypted envelope | `book-chapter:<entry-id>` |
| Manifest | kind-30078 `casewrap-book` | `book:<title-slug>` |

The manifest references its sidecars via `{kind, pubkey, dTag}`
coords + emits matching `link` tags so external clients can
resolve them.

Publish each surface first (via the per-editor Publish buttons),
then the manifest (top-bar Publish).

## Private path

Toggle the sidebar **🔒 Private** chip. Every subsequent publish
(manifest + sidecars) goes through the encrypted envelope path
(AES-256-GCM, key wrapped to your own pubkey via NIP-44 / NIP-04).
Re-opens decrypt automatically.

## Reader Mode + embed

- **▶ Read** opens a full-screen page-flip viewer with TOC sidebar,
  keyboard nav, click-to-flip, and prefetch.
- The published manifest's `naddr` works in the embed iframe via
  `?book=<naddr>` (cut-down Reader Mode without TOC).

## PDF export

The **Export PDF…** modal exposes:

- Page range (All / from–to).
- Include cover spread.
- Include bleed margin.
- Crop marks (L-marks at trim corners).
- Single vs split output (interior + cover separate).
- Filename pattern.

Reflowed prose using Times / Helvetica / Courier-family fonts emits
as real PDF text (vector, selectable, searchable). Other fonts fall
back to vector raster + warning.

**📄 Proof PDF** in any editor toolbar exports just that single
page / chapter — useful for a printer paper-and-colour proof
before committing to the full book.
