# Slide Decks & Presenter Mode

## Goals

Add a presentation system to Artstr Studio: design individual **slides**,
assemble them into an ordered **deck**, and run a **presenter mode** to show
the deck — all Nostr-native, forkable, and driven entirely off JSON data.

### Product goals

1. A **Slide Designer** — a 16:9 design surface (a flat canvas, like Custom
   Art) with an added **speaker-notes** field. A slide is a first-class
   Nostr design: publishable, forkable, loadable.
2. A **Deck Builder** — a container that holds an ordered, variable-length
   list of slides. The deck embeds its slides' full data inline, so it is a
   single self-contained file. Slides can be imported from published
   designs and extracted back out as standalone designs.
3. A **deck-level theme** that overrides per-slide styling (fonts,
   background) across the whole deck — with a per-slide opt-out so an
   individual slide can keep its own look.
4. A **Presenter Mode** that plays the deck full-screen with speaker notes
   and slide navigation.

### Non-goals (v1)

- **Dual-window presenter view** (audience window + a separate presenter
  window with notes on a second screen). This is the real presenting
  experience and is the explicit Phase E follow-up — v1 is single-window.
- Slide **transitions / animations / builds** (step-by-step reveals).
- A presenter **timer / rehearsal stats / laser pointer**. Phase E+.
- **Rich-text** speaker notes — plain text for v1.
- Importing PowerPoint / Keynote / PDF decks.
- **Exporting** a deck to PDF or slideshow video. A natural future ask, but
  not v1 — Presenter Mode is the v1 way to show a deck. (Individual slides
  still export as images like any Custom Art design.)
- A per-property theme matrix — v1 theme overrides a small fixed set
  (font family, background); per-property locking is future polish.

### Implementation status

- **Phase A — Slide format: done.** `templateMode: 'slide'` (a thin alias
  of the Custom Art canvas engine via `isCanvasMode()`), Slide Designer
  layout on the Designer tab, 16:9-locked Canvas panel + Speaker notes
  textarea (`state.customArt.notes`), and `slide` save / load / publish /
  fork as `casewrap-slide`. Slides appear in the community browser.
- **Phase B — Deck Builder: done.** `templateMode: 'deck'` with the
  embedded-slide `deck` data model; Deck Builder layout on the Template
  tab; the slide-sorter view (thumbnail grid with add-blank / import from
  Nostr / import from file / duplicate / delete / drag-reorder); open a
  slide in the canvas editor
  and write back via `persistEditingDeckSlide()`; deck save / load /
  publish / fork as `casewrap-deck`, self-contained; deck feed-card and
  publish-confirm previews show the first slide with a slide-count badge.
  Import letterboxes non-16:9 sources onto the slide.
- **Phase C — Deck theme: done.** `deck.theme` (font family + optional
  background-color override) with controls in the Deck Builder sidebar;
  per-slide `ignoreDeckTheme` opt-out in the slide editor; render-time
  theme composition (`composeSlideForDeck`) applied non-destructively to
  deck thumbnails and the community-browser preview.
- **Phase D — Presenter Mode (single-window): done.** Full-screen runtime
  (`#presenterMode`): the themed current slide, speaker notes, a next-slide
  thumbnail, and a `n / total` counter. On-screen prev/next, click-to-
  advance, and keyboard nav (arrows / space / PageUp-Down / Home / End /
  Esc); a Presenter-view ⇄ Audience-view toggle (Audience view shows the
  slide alone, full-screen, with auto-hiding chrome — for single-screen
  use). Presenter owns the keyboard via a
  capture-phase handler, so editor shortcuts are suppressed while it runs.
  Launches from a ▶ button in the Deck Builder tool palette and a
  "▶ Start Presentation" button on a deck's community-browser preview.
- **Phase E (dual-window presenter):** not started — explicit future work.

**The v1 plan (Phases A–D) is complete and shipping.** Two new categories —
`slide` ("Slide design") and `slide-deck` ("Slide deck") — were added so
slides and decks classify on their own terms, and both use the free-form
"Custom tag" field rather than the media-identifier panel.

### Remaining work

- **Phase E — dual-window presenter** (audience window + a separate
  presenter window with notes/timer on a second screen).
- v1 non-goals still deferred: slide transitions/animations, a presenter
  timer / rehearsal stats / laser pointer, rich-text speaker notes,
  PowerPoint/Keynote/PDF import, deck → PDF/video export, per-property
  theme locking, and a Keynote-style always-on filmstrip.
- Minor polish: the "Back to deck" bar is absolutely positioned (scrolls
  away if the slide-edit canvas overflows); deck theme background is
  color-only (an image-URL background was floated as future).

---

## Why this fits the repo

This is the **disc pattern generalized**. A disc-label *sheet*
(`templateMode: 'disc'`) embeds the disc designs assigned to its slots and
is self-contained for printing; disc *designs* (`appMode: 'designer'`) are
also independently publishable and importable. A deck/slide pair works the
same way:

- **Slide** ⇄ disc design — a standalone, publishable design.
- **Deck** ⇄ disc-label sheet — a Template-tab container that embeds the
  designs it holds.

Everything a deck needs already exists in some form:

- The **canvas editor** edits a slide unchanged — a slide is mechanically a
  Custom Art canvas locked to 16:9. Layers, text, shapes, the pen tool,
  undo/redo, fit-to-view all apply for free.
- The **persist/load-on-switch** pattern (`persistCurrentDiscDesign` /
  `loadCurrentDiscDesignLayers`) is exactly how editing one slide inside a
  deck will work — swap the editor's `state.layers` for the active slide,
  write back on switch.
- The **import-a-design-into-a-slot** flow (disc design → disc slot) is the
  model for "add a published design as a slide."
- **Publish / fork / community browser / Lightning** all reuse as-is.

The genuinely new surfaces are the **slide sorter** (the Deck Builder view)
and the **presenter runtime**.

### Current-state facts the plan is built on

- `appMode`: `'template' | 'designer'`. `templateMode`:
  `'cover' | 'disc' | 'jewel' | 'customart'`.
- The **Designer tab** is shown when `appMode === 'designer'` *or*
  `templateMode === 'customart'`. The **Template tab** otherwise.
- Each tab has a Layout panel: `layoutFieldset` (Template — Case cover /
  Disc labels) and `designerLayoutFieldset` (Designer — Custom Art / Disc
  Design). `applyLayout()` maps a layout choice to the right
  `appMode`/`templateMode` and crosses app modes when needed.
- Custom Art canvas state: `state.customArt = { width, height, background,
  preset }`, rendered on `#sheet`; payload via `customArtPayload()`.
- Designs publish as kind-30078 parameterized replaceable events tagged
  `casewrap-<mode>`, with the `d`-tag mode-prefixed.
- Save discriminator (`templateMode` in payloads): `cover`, `disc`,
  `jewel`, `customart`, `disc-design`.
- All image references are remote URLs — never embedded binary. A deck is
  therefore N slides of *layer JSON*, not megabytes of image data.

---

## Framing within Template / Designer

Per the decision to keep the existing tab framing (even though a deck is a
*sequence*, not a print artboard — the distinction stays intentionally
muddy for now):

- **Slide Designer** — a new layout option in the **Designer tab** Layout
  panel, beside Custom Art and Disc Design. Runs as
  `appMode: 'template', templateMode: 'slide'`. The Designer-tab visibility
  test extends to `… || templateMode === 'slide'`.
- **Deck Builder** — a new layout option in the **Template tab** Layout
  panel, beside Case cover and Disc labels. Runs as
  `appMode: 'template', templateMode: 'deck'`.

This mirrors disc design (Designer) vs disc-label sheet (Template): the
standalone authored thing lives on the Designer side, the container that
holds many of them lives on the Template side.

Two new `templateMode` values — `slide` and `deck` — are added to
`applyLayout()`, `WORKFLOW_ORDER`, the layout panels, the body-class /
visibility logic, and the save discriminator set.

---

## Data model

### Slide design (standalone — `templateMode: 'slide'`)

```js
{
  version: SCHEMA_VERSION,
  templateMode: 'slide',
  templateType: 'slide',
  meta: { … },                       // title / category / language, as usual
  slide: {
    width: 1920, height: 1080,       // 16:9, fixed aspect
    background: '#ffffff',
    notes: ''                        // plain-text speaker notes
  },
  layers: [ … ]                      // standard layer array
}
```

A slide is a Custom Art canvas with a `slide` object instead of `customArt`,
the addition being `notes`. Rendered on `#sheet`. The aspect is locked 16:9
(width/height adjustable for resolution, but the ratio holds).

### Deck (`templateMode: 'deck'`)

```js
{
  version: SCHEMA_VERSION,
  templateMode: 'deck',
  templateType: 'deck',
  meta: { … },                       // deck title / category / language
  deck: {
    theme: {
      fontFamily: '',                // '' = no override
      background: '',                // '' = no override (color or image URL)
      // small fixed set for v1; extensible
    },
    slides: [
      {
        name: 'Intro',                // optional label shown in the sorter
        slide: { width, height, background, notes },
        layers: [ … ],
        ignoreDeckTheme: false        // true = this slide keeps its own look
      },
      …                              // ordered, variable length
    ]
  }
}
```

- The deck **embeds each slide's full data inline** — it is one
  self-contained file. Presenter mode and previews never depend on N
  external events resolving.
- A slide object inside `deck.slides[]` is the same shape as a standalone
  slide design's `{ slide, layers }`, plus an optional `name` and
  `ignoreDeckTheme`. Embedded slides carry **no `meta`** of their own — the
  deck's `meta` covers the whole deck.
- **Import** copies a published design's `{ slide?/customArt, layers }` into
  a new `deck.slides[]` entry (see surface #2 for cross-aspect handling).
  **Extract** lifts one entry back out into a standalone slide design for
  separate publishing.

### Nostr

- Slide: kind-30078, tag `casewrap-slide`, `d`-tag `slide:<title|id>`.
- Deck: kind-30078, tag `casewrap-deck`, `d`-tag `deck:<title|id>`.
- Both are forkable and editable-in-place via the existing NIP-33 flow.
- Schema version bumps; `slide` / `deck` / `notes` / `ignoreDeckTheme` are
  additive — old clients ignore unknown payloads.

---

## The surfaces

### 1. Slide editor

The existing canvas editor, opened on a 16:9 slide. The Designer-tab Layout
panel's "Slide Designer" option gives a Canvas-style panel (resolution
presets — 1920×1080, 1280×720 — background) **plus a "Speaker notes"
textarea**. Notes save into `slide.notes`. Nothing else changes — it is the
Custom Art editor with a locked aspect and one extra field.

When a slide is opened **from within a deck**, the panel shows a small
notice that the deck theme will restyle fonts/background in the deck and
presenter views — so the un-themed editor view isn't a surprise.

### 2. Deck Builder (the slide sorter)

A new view for `templateMode === 'deck'`. The canvas area shows a
**reorderable grid of slide thumbnails**; the sidebar holds deck title and
theme controls.

- **Add slide** — new blank slide · import from a published design · import
  from the community browser. Imports land on a 16:9 slide: a 16:9 source
  (slide / Custom Art) fills it; any other aspect (cover, square, …) is
  scaled to fit and centered, letterboxed.
- **Reorder** — drag thumbnails.
- **Duplicate / Delete** a slide.
- **Edit a slide** — clicking a thumbnail opens it in the canvas editor
  (surface #1). The deck tracks `state.deck.editingIndex`; entering edit
  loads that slide into editor state, and a "Back to deck" control persists
  it back — the `persistCurrentDiscDesign`/`loadCurrentDiscDesignLayers`
  pattern. The active slide is persisted before *any* save, publish,
  reorder, or present.
- **Thumbnails** are mini-renders via the existing slide preview-DOM
  renderer + `fitMiniPreview`. Only the edited slide's thumbnail re-renders
  on write-back — not the whole grid.
- **Canvas chrome** — in the sorter view the bottom zoom bar and the right
  tool-options panel are hidden (nothing to zoom or configure); the left
  tool palette shows just the **Present** (▶) action button (see surface
  #3). Full chrome returns when a slide is opened in the canvas editor.
- **Undo** uses the app's single history stack: sorter operations
  (add / delete / reorder) and slide edits are ordinary entries; undoing an
  entry made in the other view switches to that view first.
- The sorter is its own view; a Keynote-style always-visible filmstrip
  alongside the canvas is deferred polish.

### 3. Presenter Mode (v1 — single window)

**Entry points.** Presenter Mode launches from a **Present** button — a play
glyph (`▶`) — used consistently in two places:

- **In the editor** — a button in the left **tool palette**, in the slot
  where the drawing tools normally sit. It is shown whenever a deck is
  active (the Deck Builder sorter, and while editing one of the deck's
  slides), so you can jump straight to presenting. It is an *action*, not a
  tool mode.
- **In the template browser** — a **Start Presentation** button on a deck's
  full preview page (`openDesignPreview`), beside Use/Fork · Share · Save
  JSON, using the same `▶` icon. This lets anyone present a published deck
  straight from the browser without forking it first.

Both entry points run the same full-screen runtime (Fullscreen API):

- The current slide is drawn with the **existing slide / Custom-Art
  preview-DOM renderer**, scaled to fill the viewport (letterboxed to 16:9)
  — no new slide renderer is needed.
- **Speaker notes** for the current slide in a side/bottom panel, with a
  toggle to hide them (e.g. when projecting this same window).
- A **next-slide thumbnail** and a **slide counter** (`3 / 12`).
- Navigation: on-screen prev/next, arrow keys / space, `Esc` to exit.
  Presenter mode **owns the keyboard** while active — the editor's tool and
  layer shortcuts (V/P/B, arrows, Delete, …) are suppressed until it exits.
- The deck theme is composed in (see below) — presenter mode shows the
  fully themed slide.

v1 is single-window: good for rehearsal, review, and casual presenting.
The true projector experience (audience window + separate presenter window
with notes) is **Phase E**.

### 4. Deck in the community browser

A published deck is a normal kind-30078 event, so it appears in the feed
like any design — which means it needs preview support:

- **Feed-card thumbnail** — the first slide's mini-render, with a
  slide-count badge (e.g. `12 slides`) so a deck reads as a deck at a
  glance.
- **Publish-confirm preview** — likewise the first slide.
- **Full preview page** (`openDesignPreview`) — carries the **Start
  Presentation** button (surface #3) alongside Use/Fork · Share · Save JSON.

These hook into the existing per-mode preview renderers and feed-card
builder; `deck` joins `MODE_LABELS` and the community mode filters.

---

## Theme composition

The deck theme is applied at **render time**, non-destructively — the slide
JSON is never mutated.

- `deck.theme` carries a small fixed set for v1: `fontFamily`, `background`.
- When a slide is rendered **in a deck context** (deck thumbnails, presenter
  mode), each themed property resolves as:

  ```
  effective = slide.ignoreDeckTheme ? slideValue
            : (deck.theme.<prop> || slideValue)
  ```

  e.g. a text layer's font = the deck theme font unless the slide opts out
  or the theme leaves it blank.
- The **slide editor shows the raw slide** (no theme) — the theme only
  exists in the deck. This keeps the editor simple and the slide reusable
  across decks with different themes. When the slide is opened from a deck,
  the editor shows a notice that the theme will restyle it elsewhere
  (surface #1) so the editor/presenter mismatch isn't surprising.
- `ignoreDeckTheme` is a per-slide boolean for v1 (whole-slide opt-out).
  Per-property locking is a future refinement.

Because it is pure JSON composition, the same logic serves deck thumbnails,
presenter mode, and any future export.

---

## Phased delivery

### Phase A — Slide format
- `templateMode: 'slide'`; 16:9 canvas; `slide` object with `notes`.
- Slide Designer option in the Designer-tab Layout panel.
- Canvas panel with resolution presets + the Speaker notes textarea.
- Save / load / publish / fork a standalone slide design (`casewrap-slide`).

**Ship gate:** create a 16:9 slide with notes, publish it, load it back —
notes round-trip; it shows in the community browser.

> Note: a standalone slide is thin value on its own — a 16:9 graphic whose
> notes don't pay off until Presenter Mode (Phase D). Phase A is
> groundwork; **A + B together** are the minimum genuinely-useful unit.

### Phase B — Deck Builder
- `templateMode: 'deck'`; the `deck` data model (embedded ordered slides).
- Deck Builder option in the Template-tab Layout panel.
- The slide-sorter view: add (blank / import, with cross-aspect
  letterboxing) · reorder · duplicate · delete; open a slide in the canvas
  editor and write back on switch; per-slide thumbnails.
- Sorter-view canvas chrome (hidden zoom bar / options panel).
- Save / load / publish / fork a deck (`casewrap-deck`), self-contained.
- Deck feed-card thumbnail (first slide + slide-count badge) and
  publish-confirm preview; `deck` added to `MODE_LABELS` / mode filters.

**Ship gate:** build a 5-slide deck, reorder it, edit slide 3, save the
deck, reload it — order and edits persist; the deck shows in the feed with
its slide count.

### Phase C — Deck theme
- `deck.theme` (font family, background) + theme controls in the sidebar.
- Per-slide `ignoreDeckTheme` toggle.
- Render-time theme composition for deck thumbnails.

**Ship gate:** set a deck font; all slides restyle in the thumbnails;
toggle one slide's opt-out and it reverts to its own font.

### Phase D — Presenter Mode (single-window)
- Full-screen runtime: current slide + notes + next thumbnail + counter.
- Keyboard / on-screen navigation; notes toggle; `Esc` to exit.
- Theme composed in.
- Two `▶` Present entry points: a tool-palette button in the Deck Builder
  editor, and a "Start Presentation" button on a deck's template-browser
  preview page.

**Ship gate:** present a deck start to finish with the keyboard from both
entry points; notes track the current slide.

### Phase E — Dual-window presenter (future)
- Popped-out audience window (slide only) synced to a presenter window
  (current + next slide, notes, timer). Not built in this pass.

---

## Risks & tradeoffs

| Risk | Mitigation |
|---|---|
| A deck embeds N slides → large JSON / large Nostr event; relays may cap event size | Images are URLs, not binary, so size is bounded to layer JSON. Warn when the deck payload exceeds ~100 KB or ~25 slides. Escape hatch if this proves limiting: a future mode where the deck references slide `naddr`s instead of embedding them (Phase E). |
| Slide-edit ⇄ deck round-trip can drop edits if write-back is missed | Reuse the proven `persist…/load…` pattern; persist on every view switch and before publish/save/reorder/present. |
| Undo crossing the sorter ⇄ slide-editor boundary (one shared history stack) | Sorter ops and slide edits are ordinary stack entries; undoing an entry made in the other view switches to that view first, so undo always lands somewhere coherent. |
| Template/Designer framing is conceptually muddy (a deck is a sequence, not a print artboard) | Accepted explicitly; documented. Deck = Template-tab by analogy to the disc sheet; revisit if the IA is ever reworked. |
| Theme composition must not corrupt the slide's own data | Theme is applied purely at render time; slide JSON is never mutated; opt-out is a slide flag. |
| Presenter fullscreen behaviour varies across browsers | Use the standard Fullscreen API with a graceful non-fullscreen fallback. |
| The slide sorter is a brand-new editor surface | Isolated as Phase B with its own ship gate; the slide *editor* itself is the existing canvas, unchanged. |
| Old clients loading a `deck`/`slide` payload | Additive schema; unknown `templateMode` falls back gracefully (the community browser already filters by mode). |

---

## Open questions

1. **Slide default resolution** — DECIDED: 1920×1080 default (matches the
   existing Custom Art 16:9 preset), 1280×720 offered as an alternate
   preset. Aspect locked 16:9.
2. **Presenter scope** — DECIDED: start single-window (Phase D); dual-window
   presenter view is Phase E.
2a. **Presenter entry points** — DECIDED: a `▶` Present button in the Deck
   Builder's tool palette, and a matching "Start Presentation" button (same
   icon) on a deck's preview page in the template browser.
3. **Slide editing** — DECIDED: the existing canvas editor, unchanged — a
   slide is just a 16:9 canvas.
4. **Deck theme** — DECIDED: a deck-level theme overrides per-slide styling
   (fonts, background); each slide has an opt-out (`ignoreDeckTheme`) so it
   can keep its own look. Render-time composition, JSON-driven.
5. **Speaker notes** — plain text for v1; rich text is future.
6. **Deck Builder canvas UI** — sorter-grid view that opens slides in the
   canvas editor for v1; an always-on filmstrip is deferred polish.
7. **Schema bump** — increment `schemaVersion` when Phase A lands; `slide`,
   `deck`, `notes`, `ignoreDeckTheme`, slide `name` are additive.
8. **Importing a non-16:9 design as a slide** — DECIDED: scale-to-fit,
   centered and letterboxed on the 16:9 slide; no cropping.
9. **Deck in the community feed** — DECIDED: feed-card and publish-confirm
   previews show the first slide, with a slide-count badge on the card.
10. **Deck → PDF / video export** — DECIDED: non-goal for v1; Presenter
   Mode is how you show a deck. A natural future phase.
11. **Deck size limit** — soft warning past ~100 KB / ~25 slides; hard
   architectural fallback (reference slides by `naddr`) deferred to Phase E
   if it proves necessary.

---

## Acceptance summary

### Phase A
- [ ] Slide Designer is a Designer-tab layout; canvas is 16:9.
- [ ] Speaker-notes field saves into `slide.notes` and round-trips.
- [ ] A slide publishes/loads/forks as a `casewrap-slide` design.

### Phase B
- [ ] Deck Builder is a Template-tab layout with a working slide sorter.
- [ ] Add / reorder / duplicate / delete slides; import a published design
      (a non-16:9 import lands letterboxed on the slide).
- [ ] Editing a slide writes back into the deck; deck saves self-contained.
- [ ] A published deck shows in the community feed with a slide-count badge.

### Phase C
- [ ] A deck theme restyles every slide in the deck.
- [ ] A slide's `ignoreDeckTheme` toggle reverts it to its own styling.

### Phase D
- [ ] Presenter mode plays a deck full-screen with notes + navigation.
- [ ] Notes follow the current slide; the theme is applied.
- [ ] Presenter mode owns the keyboard — editor shortcuts don't fire.
- [ ] A `▶` Present button launches it from the Deck Builder tool palette.
- [ ] A "Start Presentation" button launches it from a deck's template-
      browser preview page.
