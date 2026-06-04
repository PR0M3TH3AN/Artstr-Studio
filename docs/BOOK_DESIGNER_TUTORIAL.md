# Book Designer — End-to-End Tutorial

This is the hands-on walkthrough for authoring, publishing, sharing,
and exporting a book in Artstr Studio. For the full spec see
`BOOK_DESIGNER_FEATURE.md`.

---

## 0. Setup (one-time)

- Sign in with a Nostr extension (top-right). For private-publish testing the
  extension needs NIP-44 or NIP-04 (most modern extensions do).
- In **Project Metadata** (left sidebar, any mode) set a **Title** and
  **Category**. The book uses these for the manifest's d-tag and tag set.

---

## 1. Start a new book

In the **Template** tab on the left, pick the **Book** entry. The canvas
switches to the Pages overview.

Three ways to start:

- **Starter template** — when Pages overview is empty, four cards appear
  (US Trade 6×9 / A5 / A4 / Square 8×8). Click one. The book is seeded with
  a default master + text-frame, a starter chapter, and a "Title page"
  designed entry.
- **Convert from deck** — if you have an existing deck (Deck mode →
  slides), click **→ Convert to book** in the deck-sorter toolbar. *Or* a
  "Convert deck to book" card appears on the empty Pages overview if a
  deck exists. Each slide becomes one designed page (letterbox-fit into the
  trim).
- **From scratch** — skip the starter cards. Use `+ Add page`,
  `+ Add chapter`, or open `Document settings…`.

---

## 2. Document settings

Open via the book sidebar → **Document settings…**.

- **Book size**: preset (US Trade / US Letter / A5 / A4 / Square) or
  **Custom** to enter arbitrary trim/bleed/paper-thickness.
- **Spine width**: derived from page count × paper thickness by default,
  or toggle off to enter manually.
- **Cover layout**: include spine? include back?
- **Page numbering**: enabled / startAt / firstNumberedPage / format
  (use `{n}` or `Page {n}` etc).
- **Typography** (expand the `<details>` block): override fonts / sizes /
  weights / colours per element — body, h1–h6, blockquote, codeBlock,
  inlineCode, link, list, hr. **Reset to defaults** restores the v1
  stylesheet.

---

## 3. Masters

Open via the book sidebar → **Manage masters…**.

A master is a reusable underlay applied beneath every page that uses it.
The starter template gives you one ("Body pages") with a text-frame
already added.

- Click a master row's **Edit** → master-edit mode. The canvas now binds
  to `book-master:<id>`. Add headers, page-numbers, etc.
- Use the **+ Text frame** button (visible only in master-edit) to add
  the reflow target if missing.
- Header / page-number text layers can use **tokens** — literal in the
  master, resolved at render time per page:
  - `{page-number}`, `{page-count}`, `{physical-page-count}`
  - `{book-title}`, `{book-author}`
  - `{chapter-title}`, `{chapter-number}`
- Click **← Back to masters** to leave the master.

---

## 4. Pages overview

Each tile is one manifest entry — a designed page or a reflow chapter
segment.

Tile hover reveals actions (top-right):
- 📄 proof PDF (just this entry)
- ⎘ duplicate
- × delete
- master-picker dropdown (per-tile override)

Toolbar buttons:
- `+ Add page` — blank designed page.
- `+ Add 10 pages` — bulk.
- `+ Add chapter` — reflow entry; opens the chapter editor immediately.
- `+ Import page` — paste an `naddr` / `nevent` to another author's
  `casewrap-page` event. Imports as a `ref:`-only entry; layers paint
  via the resolver.
- `▶ Read` — Reader Mode.
- `Export PDF…` — export modal.

Drag tiles to reorder.

---

## 5. Designed page editor

Click a designed-page tile → opens the canvas. Top bar shows
**← Back to Pages**, **← / →** prev/next, **Publish**, **📄 Proof PDF**,
**⚡ Free / N sats**.

- Add layers like any other Artstr canvas — text, shape, image, QR,
  pixel-art, linked design.
- Master layers render underneath at 55 % opacity (non-interactive while
  page-editing).
- Tokens in *master* layers resolve to this page's context; the same
  tokens in this page's own text layers stay literal.

---

## 6. Chapter editor (reflow)

Click a chapter tile → markdown-on-left, preview-on-right.

The textarea upgrades to **CodeMirror** with markdown syntax
highlighting + smart Enter (auto-continues list bullets, breaks out of
the list on an empty item).

### Try every feature in one chapter

```markdown
# Chapter Title

A paragraph. **Bold**, *italic*, `inline code`.

## Sub-heading

Cross-ref: see [the intro](#chapter-1) and [the index](#index).

A ^[GFM table] example:

| Col 1 | Col 2 |
|-------|-------|
| a     | b     |

A task list:

- [ ] todo
- [x] done
  - nested item

A footnote ref[^1] in the middle of a sentence.

[^1]: This is a footnote definition.

{toc}

{index}
```

What this exercises:
- `{toc}` → renders as a heading list with page numbers.
- `{index}` → sorted list of every `^[term]` marker in the book.
- `^[term]` → invisible in body; registers in the index.
- `[^N]` + `[^N]: def` → superscripted ref + "Footnotes" section
  appended to the chapter.
- `[text](#chapter-3)` / `[text](#some-heading)` → gets `(p. 12)`
  appended.
- GFM tables, task lists, nested lists all paginate.

### Chapter source-bar buttons

- **Import from Nostr** — paste an `naddr` / `nevent` / `note` / hex
  pointing at a NIP-23 (or encrypted) article; pulls into
  `chapterMarkdown`.
- **Publish chapter** — mints a `kind-30023` (public) or `kind-30078`
  encrypted (private) article event under `chapter:<slug>` or
  `book-chapter:<entry-id>`. Re-publishes replace in place.
- **↻ Refresh** — re-fetches a linked chapter (live or pinned).
- **Pin to current** / **Set to live** — freezes a specific event id
  vs follows the d-tag.
- **Unlink** — disconnects the textRef.
- **📄 Proof PDF** — exports just this chapter's paginated pages.

### Readouts

Top right of the chapter editor shows word count + paginated page count
+ first warning ("Block too tall for the text-frame", "Long word
doesn't fit", etc). If you see a warning, your text-frame is too narrow
or your prose has a word longer than a column.

---

## 7. Cover view

Pages overview → **Cover** tab.

- Spec summary + spread preview (back / spine / front panels).
- **Edit cover** → canvas widens to the full spread. Layers land on
  `book-cover-front` by default; the layer-target dropdown switches
  between **Front cover / Spine / Back cover**.
- **Publish cover** (top-bar) → `kind-30078` with `role:'cover-spread'`.

---

## 8. Visibility chip

Bottom of the book sidebar. Two states:

- **Public** (default) — every event publishes plain-text.
- **🔒 Private** — manifest + every sidecar publish goes through the
  encrypted envelope (AES-256-GCM, with the AES key NIP-44/NIP-04-wrapped
  to *your own* pubkey only). The chip is disabled if your extension
  lacks encryption capability. Publish-buttons show 🔒 to make this
  visible from inside any editor.

---

## 9. Publishing flow

Per-surface publishes are **independent** — you can publish a single
page without touching the manifest. To make the whole book discoverable
as one event, also publish the manifest.

**Recommended order:**

1. Open each chapter → **Publish chapter**.
2. Open each designed page → **Publish page**.
3. Open the cover → **Publish cover**.
4. Manage masters → publish each master via **Edit** → top-bar
   **Publish master**.
5. **Publish** in the top app bar → publishes the `casewrap-book`
   manifest with `link` tags pointing at every sidecar.

The book sidebar shows **⚠ Manifest has unsaved changes** when any
spec / order / list change diverges from the last published manifest.

---

## 10. Resolver (on re-open)

When you reload the page or open the book on another device:

- Autosave restores `state.book` from local storage.
- The resolver fetches every referenced page / master / cover / chapter
  from your relays.
- Cached events come from `localStorage` first (warm re-opens paint
  instantly; cap 2 MB total content, LRU evicted).
- A background probe checks each ref for a newer upstream version →
  tiles get a yellow **↑ Update** chip; click to apply.
- Force-refresh: book sidebar → **↻ Refresh from Nostr**.

---

## 11. Reader Mode

Pages overview → **▶ Read**.

- Click left half of the page = back, right half = forward.
- Keyboard:
  - **← / →** flip
  - **Space / PageDown** advance
  - **PageUp** back
  - **Home / End** first / last
  - **Esc** exits
- **☰ TOC** toggles the chapter-heading sidebar.
- Page counter + progress bar in the footer.
- Pages cache as you flip; forward flips prefetch the next two.

---

## 12. Embed (share publicly)

Once the manifest is publicly published, the resulting `naddr` works in
the embed iframe:

```html
<iframe
  src="https://your-host/#/embed/<naddr-here>"
  width="600" height="900"></iframe>
```

URL params:
- `?page=N` — deep-link to a starting page (1-based)
- `?controls=0` — hide prev/next/fullscreen
- `?attr=0` — hide the author chip
- `?open=0` — hide the "Open in Artstr ↗" link

The embed renders a cut-down Reader Mode (no TOC).

---

## 13. PDF export

Pages overview → **Export PDF…** opens the modal:

- **Pages**: All, custom range (from–to), or current.
- **Include cover spread**: yes/no.
- **Include bleed**: extends each PDF page to trim + 2×bleed (centered).
- **Crop marks**: L-shaped marks at each trim corner (printer guidance).
- **Output**: single file vs `<name>-interior.pdf` + `<name>-cover.pdf`
  split.
- **Filename pattern**.

Reflowed prose using **Georgia / Times / Helvetica / Arial / Courier /
monospace** families emits as real PDF text (vector, selectable,
searchable). Other fonts fall back to vector raster, and the warning
summary lists which families fell back.

**Proof one page** (📄 button on any tile or in any editor toolbar) →
one-click PDF of just that entry. No modal.

---

## 14. Tokens reference

Resolve at render time using the manifest's context.

| Token                   | Where it resolves                                         |
|-------------------------|-----------------------------------------------------------|
| `{page-number}`         | This page's number under `spec.pageNumbering` rules.      |
| `{page-count}`          | Total numbered pages in the book.                         |
| `{physical-page-count}` | Total physical pages (including skipped-number entries).  |
| `{book-title}`          | `state.meta.title`.                                       |
| `{book-author}`         | Cached profile display name, falling back to short npub.  |
| `{chapter-title}`       | The chapter this page belongs to.                         |
| `{chapter-number}`      | The chapter's ordinal.                                    |
| `{toc}` *(standalone)*  | Auto-generated TOC with page numbers.                     |
| `{index}` *(standalone)*| Auto-generated alphabetical index with page numbers.      |

Inline markers (in chapter markdown):
- `[^N]` … `[^N]: definition` → footnote ref + chapter-end definition.
- `^[term]` → invisible index marker; appears in `{index}`.
- `[text](#anchor)` → cross-reference; rewritten to `[text (p. N)]`.

---

## 15. Edge cases worth probing

- **Private round-trip** — switch to 🔒 Private, publish a chapter,
  reload the page. The resolver should decrypt + repaint.
- **Cross-device** — publish the manifest publicly, paste the `naddr`
  into the embed route on a different browser → it should resolve and
  render.
- **Spec change → spine shift** — open Document settings, change paper
  thickness or page count, look at the cover panel — spine width
  should re-derive immediately.
- **TOC accuracy** — TOC page numbers are computed pre-expansion
  (chapter-start granularity). Expect a 1–2 page offset for the TOC
  chapter itself once expanded.
- **Reflow overflow** — drop a `# Heading` near the end of a chapter
  that doesn't have room. The `keepWithNext` rule should push it to
  the next page.
- **Imported chapter from someone else** — import an existing NIP-23
  article, then click **Publish chapter** — should confirm before
  clobbering and mint your own d-tag.
- **Token resolution** — put `{page-number} of {page-count}` in a
  master text layer; verify the rendered numbers update as you add /
  remove pages.

---

## 16. Where to find things in the codebase

Single file: `src/index.html`.

- Pagination engine: `function paginateChapter`
- Reader Mode: `function openBookReader`
- PDF export: `async function exportBookToPdf`
- Resolver: `async function resolveBookSidecars`
- Disk cache: `BOOK_SIDECAR_CACHE_KEY`
- Manifest payload: `function bookManifestPayload`
- Token substitution: `function substituteBookTokens`
- TOC builder: `function _computeBookTocEntries`
- Index builder: `function _computeBookIndexEntries`
- Cross-refs: `function _computeBookSlugToPageMap`
- Footnotes: `function _processBookFootnotes`

Spec: `docs/BOOK_DESIGNER_FEATURE.md`.
