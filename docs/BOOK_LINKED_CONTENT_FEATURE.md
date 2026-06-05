# Book Designer — Linked Content + Threaded Text Frames

Status: **Drafted, not yet implemented.** This document describes the
next architectural arc for the Book Designer (the "Phase J" follow-on
to `BOOK_DESIGNER_FEATURE.md`). The current implementation works but
mixes content and layout in ways that don't scale to design-driven
typesetting; this spec lays out the upgrade.

## TL;DR

1. **Events are linked files.** A book references Nostr events by
   coordinate the same way an InDesign project references images,
   text files, and master spreads — by link, not by embedded copy.
   This generalizes the pin-vs-live toggle already shipped for
   chapters to every external asset the book references.
2. **Linked Content library** replaces the current "chapters mixed
   into the Pages overview" model. A dedicated tab lists every
   external event the book links: chapter articles, shared masters,
   designed pages from other books, illustration sets.
3. **Threaded text frames** (InDesign-style) replace today's
   "one master-text-frame paginates into N copies." Designed pages
   carry first-class `text-frame` layers with stable ids; the author
   threads frames port-to-port across pages; a thread declares its
   content source (a linked chapter event) and the pagination engine
   pours text through the chain.
4. The Pages overview filters to designed pages only — no more 250
   thumbnails for a 5-chapter book.

## Vision

The Book Designer should feel like InDesign with a Nostr-native
distribution model. Authors design pages bespoke (cover, frontmatter,
chapter-start spreads, full-bleed illustrations) and *link* content
(chapter text, shared masters, designed pages, illustration sets) by
referencing Nostr events. Text flows through user-arranged frames the
same way it flows through linked frames in InDesign. The book manifest
stays small — references, not payloads — and updates to any linked
event propagate to every book that links it.

## Mental model — events as linked files

| Nostr event kind | InDesign equivalent | Already shipped |
|---|---|---|
| `kind:30023` NIP-23 article (chapter markdown) | `.txt` / `.md` placed file | ✅ chapter import + pin/live toggle |
| `kind:30078` casewrap-page, `role:'cover-spread'` | Cover-spread master library | ✅ |
| `kind:30078` casewrap-page, `role:'master'` | Master page | ✅ |
| `kind:30078` casewrap-page, `role:'interior'` | Designed page from another book | ✅ Phase F3 import |
| Linked design layer (any flavor) | Placed `.psd` / `.ai` | ✅ Linked Designs spec |
| `kind:30078` casewrap-book manifest | The `.indd` project file | ✅ |

The pattern is consistent. What's missing is treating all of these as
first-class entries in a **Links panel** the way pro tools do — with
status (live / pinned / encrypted / broken), update notifications, and
relink / embed actions.

## Current vs proposed data model

### Today

```
book {
  spec:    { trim, bleed, spineFromPages, ... }
  cover:   { ref }
  masters: [{ ref, label }, ...]
  pages:   [
    { type: 'design',  id, ref, masterId, anchor, gating, ... },
    { type: 'reflow',  id, chapterMarkdown, chapterTitle, ref, pinnedEventId, masterId, ... },
    ...
  ]
}
```

Reflow entries carry inline `chapterMarkdown` (when locally edited) or
a `ref` to a NIP-23 article event. Mixed into the same ordered list as
designed pages. The pagination engine clones the entry's `masterId`
into N physical pages and pours markdown into the master's first
`text-frame` layer.

### Proposed

```
book {
  spec:    { ... }
  cover:   { ref }
  masters: [{ ref, label }, ...]
  pages:   [                            // designed pages only
    { id, ref, masterId, anchor, gating, ... },
    ...
  ]
  links:   [                            // the "Links panel" — every external reference
    {
      id,                               // local link id (stable across renames)
      kind: 'chapter' | 'master' | 'page' | 'design' | 'image',
      ref: { kind, pubkey, dTag, relays, encrypted },
      mode: 'live' | 'pinned',          // generalizes the chapter pin/live toggle
      pinnedEventId: string | null,
      label: string,                    // user-friendly display name
      lastResolvedAt: number,           // for "X minutes ago" hints
      lastEventId: string,              // for "update available" detection
    },
    ...
  ]
  threads: [                            // text flows
    {
      id,
      sourceLinkId,                     // points to a links[] entry of kind 'chapter'
      frames: [                         // ordered chain of frame refs
        { pageId, frameId },
        ...
      ],
      overflow: 'truncate' | 'autoflow', // policy when text exceeds frames
    },
    ...
  ]
}
```

Reflow entries disappear from `book.pages`. The chapter content lives
in a `links[]` entry; the flow path lives in a `threads[]` entry; each
designed page can host any number of `text-frame` layers.

### Migration

Existing books need a one-time migration on load:

1. For each `pages[]` entry where `type === 'reflow'`:
   - Create a `links[]` entry of kind `'chapter'` (carrying the entry's
     `ref` / `pinnedEventId` / `chapterTitle`).
   - Auto-generate N designed pages (one per paginated physical page)
     using the entry's `masterId`. Each new page gets one `text-frame`
     layer matching the master's text-frame geometry.
   - Create a `threads[]` entry that chains those N frames and points
     at the new `links[]` entry.
2. For each remaining `pages[]` entry (`type === 'design'`), drop the
   `type` discriminator — every entry is now a designed page.

Migration runs once at load when an old-schema book is detected (by
the presence of any `type: 'reflow'` entry). The original
`chapterMarkdown` field is preserved on the link entry so locally-
edited (not-yet-published) chapters survive.

## Threaded text frames

### Frame layer

A new layer type (or an upgrade of the existing `text-frame` master
layer) with this shape:

```
{
  id,
  type: 'text-frame',
  target: 'book-page:<pageId>',
  x, y, w, h, rotate, opacity, z,
  frameId,                              // stable id, unique within the page
  threadId: string | null,              // which thread this frame belongs to
  // No content of its own — content flows in from the thread.
}
```

Stable `frameId` survives layer reorders so threads don't break when
the user fiddles with z-order. The wrapper `id` is the layer's
identity in `state.layers`; `frameId` is the thread-addressable id.

### Threading UI

In InDesign every frame has two ports:

- **In port** — small square top-left. Visible state:
  - Empty: nothing flowing in (head of a thread or unlinked frame).
  - Arrow ▶: text is flowing in from a previous frame.
- **Out port** — small square bottom-right. Visible state:
  - Empty: end of thread, no overflow.
  - ▶: linked to another frame; mouse over to see which.
  - Red ⊞: overset — text wants more frames but the chain ends.

Linking:

1. User clicks the out port of frame A → cursor changes to a "loaded
   text cursor" carrying that link.
2. User clicks the in port of frame B → A's `nextFrame` becomes B; B
   joins the same thread.
3. Esc cancels the load.

Hover over either port to see the thread (highlight every frame in
the chain). Right-click for "Break thread" (split the chain at this
frame) or "Remove from thread" (yank this frame out, re-link its
predecessor to its successor).

### Pagination engine changes

Today: clone master N times, fill each master's first text-frame.

New: for each thread, walk `frames[]` in order:
1. Resolve the source link's markdown (live event or pinned snapshot).
2. Run the existing pagination engine, but instead of producing pages,
   produce **frame fills** — each frame in the chain gets one
   page-worth of blocks (with layout for that frame's geometry).
3. When text runs out, leave remaining frames empty.
4. When frames run out with text remaining, mark the last frame as
   overset (red ⊞ + warning hint).

The existing pagination engine (greedy line breaking, block model,
widow/orphan rules) doesn't change — only the "what's the frame
geometry" and "what's the page boundary" inputs do.

### Multiple threads per book

A book may have many threads:

- Main prose thread (Chapter 1 → 2 → 3, flowing through Chapters 1-50
  of designed pages).
- Sidebar thread (recurring callout text in a sidebar frame).
- Front-matter thread (the colophon + acknowledgements).

Each thread is independent. A frame belongs to at most one thread.

### Auto-flow

When the loaded text cursor (carrying a chapter waiting to be placed)
is Shift-clicked on an empty area, generate enough new designed pages
to fit the remaining text, using the active master as the page
template. This is InDesign's autoflow. UX:

- Place chapter on frame A: text fills A, overflow indicator appears.
- User Shift-clicks the out port: engine generates new pages with the
  master template's text frames, threads them all to A, fills.

Without autoflow you can still drag-create new frames manually and
thread them — autoflow is the convenience layer.

## Linked Content library tab

A new top-level tab in book mode (alongside Pages and Cover). UI:

```
┌─ Linked Content ─────────────────────────────────┐
│ [+ Add chapter from Nostr]  [+ From JSON]  [↻]  │
├──────────────────────────────────────────────────┤
│ 📄 Chapter — "Introduction"          live  · ✏  │
│    naddr1...  · author: Adam · 1.2 KB · 12m ago │
│                                                  │
│ 📄 Chapter — "Body" [encrypted]     pinned · ✏  │
│    naddr1...  · author: Adam · 8.4 KB · 1h ago  │
│                                                  │
│ 🎨 Master — "Standard interior"      live  · ✏  │
│    naddr1...  · author: Adam · 0.4 KB · just now│
│                                                  │
│ ⚠ Chapter — "Footnotes" [unresolved] live  · ↻ │
│    Couldn't fetch from your relays.              │
└──────────────────────────────────────────────────┘
```

Per-entry actions:

- **Edit** — for chapters: open the markdown editor pane. For masters
  / pages: open the surface in the canvas (existing flows).
- **Toggle pin / live** — same widget as today's chapter pin toggle.
- **Relink** — replace this entry's `ref` with a different event
  coordinate (paste a new naddr).
- **Embed** — copy the resolved payload inline into the manifest so
  the book is offline-safe. Loses the auto-update behavior. Reversible
  by adding back as a link.
- **Show usages** — highlight every thread / layer that references
  this link.
- **Remove** — only allowed when no thread or layer uses this link.

Status badges:

- 🟢 `live` — resolves to the latest event on each load.
- 🟡 `pinned` — locked to a specific `eventId`, ignores republishes.
- 🔒 `encrypted` — private (NIP-44 / NIP-04 encrypted to the author's
  pubkey).
- ⚠ `unresolved` — last fetch failed.
- ⬆ `update available` — pinned, but the live version has changed.

## Phasing

### Phase J1 — Linked Content tab + Pages filter (the foundation)

**Scope.** Pure UI / data refactor; no new rendering capability.

- Add a new tab in book mode: "Linked Content" or "📎 Links."
- Move the "Add chapter" affordances out of the Pages overview.
- Filter the Pages overview to designed pages only.
- Migration: convert legacy `book.pages` entries with `type: 'reflow'`
  into `book.links[]` + `book.threads[]` entries with auto-generated
  designed pages (one per paginated page, each holding a single
  text-frame matching the master's frame geometry).
- The pagination engine, PDF export, and Reader Mode continue to work
  by reading from `threads[]` instead of `pages[].type === 'reflow'`.

**What survives unchanged.** PDF export pipeline, NIP-23 chapter
event format, the Linked Designs resolver, the disk cache, the
manifest publish flow (apart from the new collections).

**What changes.** `book.pages` becomes homogeneous. `book.links` and
`book.threads` collections appear in the manifest payload (schema
version bumps). The Pages overview drops its reflow-tile rendering
branch.

### Phase J2 — First-class `text-frame` layer on designed pages

- Promote the existing master-only `text-frame` layer to work on any
  `book-page:<id>` target.
- Stable `frameId` field independent of layer id.
- Sidebar tool: "+ Text frame" alongside the existing Pen / Shape /
  Text tools, only enabled in book-page edit mode.
- For now: a placed frame is unlinked (no thread).
- Render unlinked frames as a thin dashed outline + the placeholder
  text "Empty frame — link to a thread to fill."

### Phase J3 — Threading UI

- Render in / out ports on every `text-frame` layer.
- Implement the load-cursor flow: click out port → cursor loads →
  click in port to link.
- Visual indicators: arrows on linked ports, red ⊞ on overset.
- Right-click menu: Break thread / Remove from thread / Show thread.
- Show-thread overlay: dim everything except the thread's frames.

### Phase J4 — Thread-aware pagination

- Refactor the engine: walk `thread.frames[]` instead of cloning the
  master N times.
- The thread's `sourceLinkId` supplies the markdown (resolved from
  `book.links[id]` per its mode/pinnedEventId).
- Frame-by-frame pagination — each frame gets one chunk of the layout
  based on its own width / height (frames in a thread can have
  different sizes; the engine recalculates line breaks per frame).
- Update the per-tile thumbnail painter and the PDF export to follow
  the same thread walk.
- Backwards compat: a master that has one text-frame is still useful
  as a template — autoflow uses it.

### Phase J5 — Thread ↔ chapter assignment + Linked Content library

- Wire the Linked Content tab to the new data model.
- Per-link actions: edit / pin-live toggle / relink / embed / remove.
- Loaded-cursor source: "Place chapter into frame…" creates a new
  thread or joins an existing one.

### Phase J6 — Polish

- Autoflow (Shift-click loaded cursor → generate pages from master).
- Overset warnings + a small "X frames overflow" badge on the Pages
  overview.
- "Show overflow text" inspector for an overset thread.
- Bulk relink / embed all / update-available chips.
- Cycle detection (frame A → B → A is rejected at link time).

### Implementation status (working branch — `phase-j-linked-content`)

| Phase | Commit | What it ships |
|---|---|---|
| J1.a | `1e6f2e9` | Chapters tab + Pages/Cover split; Pages overview hides reflow tiles via CSS |
| J1.b | `961b24d` | Distinct Pages empty-state when only chapters exist |
| J2   | `2110e72` | First-class `text-frame` on designed pages with stable `frameId` |
| J3.a | `3cab948` | In/out ports + `⌗ <frameId>` badge on every text frame |
| J3.b | `4afe726` | Click-to-link UX, break on linked out-port click, Esc cancel, cycle guard |
| J3.c | `a419160` | Hover any port → thread chain highlights (head blue, rest green) |
| J5   | `83d451d` | "📥 Place in selected frame" on each chapter row + chapter chip on each frame |
| J4   | `2d7e757` | `paginateChapter.opts.frameOverride`; threaded text actually flows through the chain (canvas editor) |
| J4.b | `282f5df` | Per-frame variable-geometry pagination via token cursor (`startTokenIndex` + `maxPages` + `endTokenIndex`) |
| J4.c.1 | `9d8be7e` | Pages overview tile thumbnails show threaded text |
| J4.c.2 | `10d9e51` | PDF export renders threaded text on designed pages via `_drawFrameBlocksToCanvas` |
| J4.c.3 | (implicit) | Reader Mode auto-covered — it reuses `renderBookDesignedPageToCanvas`, which J4.c.2 updated |

Still pending in J4: real-PDF text emission for threaded frames (so PDF
text is selectable, not just rasterised), table blocks in threaded
frames, perf cache for the per-frame paginate calls.

Still pending in the broader arc: J6 polish; the full migration of
legacy `type: 'reflow'` entries into `book.links[]` + `book.threads[]`
(today the threading lives inline on text-frame layers and chapters
still live in `book.pages` as reflow entries — the data model from
J1's spec hasn't moved yet); the Linked Content library tab (today
it's labelled "Chapters" and shows only chapter entries).

## What's deferred / out of scope

- **Multi-column text frames.** Single-column only in v1. Phase K.
- **Wrap-around-image text wrapping.** Phase K.
- **First-line drop caps as a thread-level style.** Phase K.
- **Floating frames anchored to text positions.** Phase L.
- **Master frames** (frames that exist on a master and replicate to
  every page using that master, each with its own thread membership)
  — needs a separate spec.
- **Variable-data publishing** (mail-merge from a Nostr list event)
  — interesting but separate arc.

## Open questions

1. **Frame ownership inside masters.** If a master defines a frame and
   a page using that master places a different frame at the same
   geometry, who wins? Proposal: master-frames are visible-only on
   the page (not editable); the page can ignore the master entirely
   by adding its own text-frame layer.
2. **Thread persistence on master swap.** If a thread runs through 10
   pages and the user changes one page's master, does the thread
   break? Proposal: no — threads track frames, not masters. Changing
   a master may move the frame visually but the thread holds.
3. **Encrypted chapter resolution latency.** Decryption happens on
   resolve, which is async. The Linked Content tab should show a
   spinner state ("decrypting…") and gracefully degrade if the
   extension lacks NIP-44.
4. **Embed-all size cap.** Embedding every linked event into the
   manifest can push it past relay size limits. Need a guardrail and
   a clear "manifest too large — keep some links?" prompt.
5. **Update notifications.** Live links should pull periodically (or
   on demand via the existing ↻ Refresh button). Per-tab polling
   feels wrong; better to check on book open + an explicit refresh.

## How this interacts with shipped features

- **Linked Designs** (`docs/LINKED_DESIGNS_FEATURE.md`) — designed
  page layers that already use the same pin-vs-live pattern. The
  new `links[]` panel surfaces them alongside chapters; nothing in
  Linked Designs has to change.
- **Premium pages** (Phase H1) — gating moves to the page event
  itself (already addressable), not the thread. A thread can span
  free + premium pages; the locked panes show the premium-unlock UI.
- **Embed mode** (`docs/EXTERNAL_EMBED_FEATURE.md`) and **Reader
  Mode** (Phase G) — both consume the resolved physical-page
  sequence the manifest produces. They don't care whether content
  came from a thread or a reflow entry; pre-migration they walk
  `pages[]` reflow expansions, post-migration they walk
  `threads[]`-driven layouts. The resolver handles the seam.
- **PDF export** — same.
- **Casewrap-book manifest schema** — bumps. Old manifests parse
  cleanly (reflow entries pass through the migrator); new ones
  require a reader that understands `links[]` and `threads[]`.
  Forward compat: a v1 reader seeing a v2 manifest should warn
  ("This book uses a newer schema") rather than crash.

## Acceptance criteria for Phase J1 (the first ship)

1. A book opened with legacy reflow entries auto-migrates to the new
   shape without data loss; the rendered output (PDF, Reader Mode,
   thumbnails) is pixel-identical before and after migration.
2. The Pages overview shows only designed pages; reflow entries no
   longer appear there.
3. The Linked Content tab exists, lists every chapter the book
   references, supports the existing pin-vs-live toggle, lets the
   user open the chapter editor.
4. The Cover view, Document settings, Masters modal, PDF export,
   Reader Mode, and the existing publish flows all still work
   unchanged.
5. Existing tests still pass; one new test verifies the migration is
   round-trip-stable (save → reload → identical render).
