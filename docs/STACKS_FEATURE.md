# Artstr Stacks — interactive fullscreen pages

## Goals

Turn Artstr into a Nostr-native **HyperCard**: a user builds a **stack**
of fullscreen **cards**, each one an Artstr canvas (layers, drawings,
text, images, shapes, QR), and any object can be made to **do
something** — a click runs an ordered **action chain** that navigates,
reveals, hides, or links. The whole stack publishes as one self-contained
Nostr event and plays in a fullscreen **interactive runtime**.

Think interactive zines, micro-sites, portfolios, comics, choose-your-
path pages, simple games — decentralized, forkable, no hosting.

### The core realisation

**A Stack is a Slide Deck whose cards have interactive logic.** The Deck
Builder already gives us the card container, sorter, edit round-trip,
embed-inline storage, publish/fork path, and a fullscreen renderer. Stacks
are a focused extension of that — not a greenfield feature. What's
genuinely new is the **behaviour system**: triggers, action chains, and a
runtime that executes them.

> A stack is a collection of visual cards where any object can do
> something — and "something" is an ordered list of actions, not a single
> link.

### Product goals

1. **Stack format** — a Template-tab layout: an ordered set of fullscreen
   cards, each an Artstr canvas, at a stack-wide aspect ratio (16:9, 9:16,
   1:1, 4:3, or custom — not locked to 16:9 like slide decks).
2. **Interactivity** — a card has `onEnter` / `onExit` action chains; any
   layer has an `onClick` action chain. Actions navigate between cards,
   open links, and show / hide / toggle layers on the current card.
3. **Action builder** — a no-code panel: *"When this is clicked: 1. Hide
   layer X  2. Show layer Y  3. Go to card Z."* It should feel like Apple
   Shortcuts, not like writing code.
4. **Interactive runtime** — a fullscreen player that renders a card,
   routes clicks through `onClick` chains, runs `onEnter`/`onExit`, and
   tracks per-card layer visibility.
5. **Nostr-native** — publish / fork / edit-in-place as a `kind:30078`
   addressable event, shareable by `naddr`, encryptable via the
   private-publishing envelope.

### Non-goals (v1)

- **Arbitrary HTML / CSS / JavaScript.** A stack is a *safe declarative
  schema* Artstr interprets — never executable web content. No iframes,
  no script, no custom CSS, no `eval`. An action chain is data. This is
  the single most important constraint.
- **A scripting language.** v1 has triggers + action chains, *not*
  variables, counters, or conditionals. Those are a defined later tier
  (Phase E) — the action model is built to accept them without a rewrite.
- **New layer *types*** for interactivity — `onClick` is an *attribute*
  of the existing layers. (Audio / video layers are a real future
  addition, but later.)
- **Asset library, modals, Nostr embeds, Blossom upload, static-HTML
  export, stack templates** — all later.
- **Extra triggers** (`hover`, `timer`, `keypress`, `double-click`) —
  later; v1 triggers are `click`, `card-enter`, `card-exit`.
- **Forms, inputs, server logic** — a stack is a presentation artifact,
  not an app.

### Decisions (proposed — confirm before building)

1. **New `templateMode: 'stack'`**, reusing the Deck Builder's card-
   container engine via an `isDeckLike(mode)` helper — not a flag on
   `deck`. A Stack and a Slide Deck are distinct products.
2. **Interactivity is an attribute, not a layer type** — cards carry
   `onEnter`/`onExit`, layers carry `onClick`; each is an action chain.
3. **v1 action set:** `goto-card`, `go-back`, `open-url`, `show-layer`,
   `hide-layer`, `toggle-layer`. Everything else is reserved namespace.
4. **`open-url` shows a confirm** with the destination before navigating.
5. **One event = one stack** (all cards embedded inline), like a deck.
6. Additive schema — `onClick` on layers, `onEnter`/`onExit` + `id` on
   cards, a `stack` payload object. No `SCHEMA_VERSION` bump required.

---

## Why this fits the repo — what's reused

A Stack reuses the Deck Builder's **card-container engine** almost
wholesale. An `isDeckLike(mode)` helper covers both `'deck'` and
`'stack'`, so this plumbing is shared, not duplicated:

- **The card sorter** — the thumbnail grid, add / import / duplicate /
  delete / drag-reorder / inline-rename (`renderDeckSorter` and friends).
- **Edit round-trip** — open a card in the canvas editor, write back on
  switch (`persistEditingDeckSlide` pattern, `editingIndex`).
- **Inline-embedded storage** — one self-contained payload; the publish /
  load / fork path; `naddr` sharing; the community feed card with a
  count badge.
- **The whole canvas editor** — layers, text, shapes, the pen/pencil
  tools, clipping, undo/redo all apply to a card unchanged. Every layer
  already has a stable `id` (`makeLayerId()`) and a `visible` flag — the
  exact hooks `show`/`hide`/`toggle` actions need.
- **Theme composition** — `composeSlideForDeck` is reused
  (`ignoreStackTheme` mirrors `ignoreDeckTheme`).
- **Encryption** — a stack payload is deck-shaped, so the
  `PRIVATE_PUBLISHING_FEATURE.md` envelope wraps it with zero extra work.
- **The fullscreen renderer** — Presenter Mode already renders a card
  full-screen, letterboxed, via `renderCustomArtPreviewDOM`. The
  interactive runtime is that renderer plus an action layer.

### Genuinely new work

1. A per-stack **aspect ratio** (decks are locked 16:9).
2. The **behaviour model** — `onClick` on layers, `onEnter`/`onExit` on
   cards, each an ordered **action chain**.
3. The **action-builder UI** in the editor.
4. The **interactive runtime** — executes chains, tracks per-card layer
   visibility, hit-tests clickable layers.
5. A public **viewer route** (`/p/<naddr>`).

### Current-state facts the plan is built on

- `templateMode: 'deck'` — embedded ordered cards, the sorter view,
  edit-a-card-with-write-back, publish/fork as `casewrap-deck`, feed card
  with a count badge. (See `SLIDE_DECK_FEATURE.md`.)
- Presenter Mode (`#presenterMode`) — fullscreen, renders a card with
  `renderCustomArtPreviewDOM`, keyboard nav, capture-phase keyboard
  ownership, an Audience (slide-only) view.
- Every layer has a stable `id` and a `visible` boolean; the layer
  renderer positions each layer as an absolutely-placed div from inch
  coordinates.
- `casewrap-*` typed `kind:30078` events; `/share/<naddr>` cold-resolves;
  `vercel.json` rewrites `/share/:id` and `/u/:npub` to the SPA.

---

## Data model

### Stack payload (`templateMode: 'stack'`)

```js
{
  version: SCHEMA_VERSION,
  templateMode: 'stack',
  templateType: 'stack',
  meta: { … },                       // title / category / language
  stack: {
    aspect: '16:9',                  // 16:9 | 9:16 | 1:1 | 4:3 | custom
    width: 1920, height: 1080,       // canvas size every card shares
    theme: { fontFamily: '', background: '' },
    startCard: '<cardId>',           // entry card (default: first)
    cards: [
      {
        id: 'c_a1b2c3',              // stable; goto-card targets this
        name: 'Cover',
        background: '#111111',
        layers: [ … ],               // standard layers; may carry onClick
        onEnter: [ <action>, … ],    // runs when the card is shown
        onExit:  [ <action>, … ],    // runs when leaving the card
        ignoreStackTheme: false
      },
      …
    ]
  }
}
```

- A `card` is the deck's slide entry generalised: a stable `id`, no
  `notes`, plus `onEnter` / `onExit` action chains.
- **Feeding the shared renderer:** the deck renderer reads a per-entry
  `{ slide:{width,height,background}, layers }` shape. For a stack the
  engine synthesises that — `width`/`height` from `stack`, `background`
  from the card — so `renderCustomArtPreviewDOM` / `composeSlideForDeck`
  are reused untouched.
- **`startCard`** holds a card `id`; if that card is deleted it falls
  back to the first card.

### Layer interactivity

Any layer gains one optional field — an `onClick` action chain:

```js
{
  id: 'l_x1', type: 'shape', /* …normal layer fields… */
  visible: true,
  onClick: [ <action>, <action>, … ]   // empty / absent = not interactive
}
```

A **hotspot** is just a transparent shape layer (no fill, no stroke) with
an `onClick`. No new layer type — the editor offers an "Add hotspot"
convenience that drops a transparent, click-ready rect; otherwise any
text / image / shape layer can be given an `onClick`.

### Triggers (v1)

| Trigger | Lives on | Fires when |
|---|---|---|
| `onClick` | a layer | the layer is clicked / tapped / Enter-activated |
| `onEnter` | a card | the card becomes visible |
| `onExit`  | a card | the runtime leaves the card |

Named slots, not a generic trigger list — `onHover`, `onDoubleClick`,
etc. slot in later as additional named slots.

### Actions

An **action chain** is an ordered array of actions. v1 action types:

```js
{ "type": "goto-card", "target": "c_a1b2c3" }      // or next|prev|first|last
{ "type": "go-back" }                               // pop the visit back-stack
{ "type": "open-url", "url": "https://example.com" }
{ "type": "show-layer",   "target": "l_x1" }        // layer id on this card
{ "type": "hide-layer",   "target": "l_x1" }
{ "type": "toggle-layer", "target": "l_x1" }
```

**Execution rules:**

- A chain runs top to bottom.
- `goto-card` / `go-back` **end the chain** — actions after them are
  ignored (you're on a different card now). The editor flags trailing
  actions.
- `show` / `hide` / `toggle` `target` a layer **on the current card**;
  cross-card layer manipulation is not v1.
- **`onEnter` / `onExit` chains may not contain `goto-card` or `go-back`**
  — only `onClick` can navigate. This makes card-enter→navigate→card-enter
  loops structurally impossible.
- Chains are capped at **20 actions**; the runtime ignores the excess.
- Unknown `action.type` values are silently ignored — forward-safe for
  the Phase E logic actions (`set-variable`, `if`, …) and reserved ones
  (`open-nostr`, `zap`, `play-audio`, …).

### Runtime layer visibility

Show/hide/toggle never mutate the stored design. The runtime keeps a
**per-card visibility map** (`layerId → bool`), initialised from each
layer's authored `visible`. Re-entering a card **resets** that card's map
to the authored state, then runs `onEnter` — so behaviour is predictable
and re-playable. (Persisting runtime state across visits is the Phase E
variables tier.)

A `composeCardForRuntime(card, visibilityMap)` helper — analogous to
`composeSlideForDeck` — yields the `{layers}` the renderer draws.

### Nostr

- Tag `casewrap-stack`; `d`-tag `stack:<title|id>` (random when published
  privately, per `PRIVATE_PUBLISHING_FEATURE.md`).
- Forkable, editable-in-place (NIP-33), `naddr`-shareable, encryptable.

---

## The surfaces

### 1. Stack Builder — the card sorter

The Deck Builder sorter, reused. A new **Stack** option in the Template-
tab Layout panel (beside Case cover / Disc labels / Slide deck). The
sidebar adds a **Stack** panel:

- **Aspect ratio** — 16:9 / 9:16 / 1:1 / 4:3 / custom. Chosen up front;
  changing it later **re-fits every card** via the deck's import-letterbox
  remap (scale-to-fit + centre), behind a confirm — layers are never
  stranded off-canvas.
- **Add card** (blank / import a design / import from Nostr), duplicate,
  delete, drag-reorder, inline-rename — all from the deck sorter. Imports
  letterbox onto the **stack's** aspect, not a hardcoded 16:9.
- **Start card** — which card the runtime opens on (default: first).
- A **Stack theme** panel (font + background), reused from the deck.
- A per-card **onEnter / onExit** editor (an action-chain editor; see
  surface 3) reachable from the card's context menu.

### 2. Card editor — drawing

Clicking a card opens it in the canvas editor (the deck edit round-trip,
unchanged). All existing tools apply. New affordances:

- **Add hotspot** — drops a transparent, click-ready rect.
- A layer with a non-empty `onClick` shows an **action badge** in the
  layer list and a subtle dashed outline on canvas, so interactive
  regions are visible while authoring.

### 3. The action builder

The heart of the feature. A panel — opened for the selected layer
(`onClick`) or for a card (`onEnter` / `onExit`) — that edits one action
chain with **no JSON**:

```
When this layer is clicked:                       [+ Add action ▾]
  ⠿ 1. Hide layer   → [ Intro Text      ▾ ]              ✕
  ⠿ 2. Show layer   → [ Secret Panel    ▾ ]              ✕
  ⠿ 3. Go to card   → [ Chapter 2       ▾ ]              ✕
```

- **+ Add action** menu: Go to card · Go back · Open URL · Show layer ·
  Hide layer · Toggle layer.
- Each action row has a type-appropriate target picker — a **card
  dropdown** (the keywords *first / previous / next / last* plus every
  named card) for `goto-card`; a **layer dropdown** (layers on this card)
  for show/hide/toggle; a URL field for `open-url`.
- Rows are **drag-reorderable** (⠿) and removable.
- The editor **warns** on: actions after a `goto-card`/`go-back`
  (unreachable); a `goto-card` whose target card was deleted (dangling);
  navigation actions placed in a card's `onEnter`/`onExit` (not allowed).
- `target`s are stored as **ids** (card id, layer id) — reordering or
  renaming never breaks a chain.

### 4. The interactive runtime

The fullscreen player, built on the Presenter Mode engine:

- Renders the current card full-screen, letterboxed to the stack aspect,
  themed, with the runtime visibility map applied
  (`composeCardForRuntime`).
- On entering a card: reset its visibility map → run `onEnter`.
- An **action overlay** sits above the card: for each layer with a
  non-empty `onClick`, a positioned hit region matching the layer's
  (transformed) box, rendered as a real **`<button>`** — Tab-focusable,
  Enter/Space-activatable, screen-reader-announced. Overlapping
  interactive layers resolve by **z-order** (topmost wins); a
  hovered/focused region shows a pointer cursor.
- **Activating a layer** runs its `onClick` chain. `goto-card` runs the
  current card's `onExit`, then navigates, then the new card's `onEnter`.
  `open-url` shows a confirm with the destination, then opens a new tab
  with `rel="noopener noreferrer"`. `show/hide/toggle` mutate the
  visibility map and re-render the card. Clicking empty (non-action)
  space is a **no-op**.
- **Navigation safety net** — arrows / space still do prev/next, a
  visited-card **back-stack** powers `go-back` and Backspace, `Esc`
  exits. So a stack with broken or missing on-card navigation is never a
  dead end. `goto-card` keywords clamp at the ends (no wrap).
- The runtime **owns the keyboard** (capture-phase handler), like
  Presenter Mode. Launching from the editor persists the in-progress card
  edit first.
- **Touch** — taps act as clicks; fullscreen is best-effort.
- Two modes: **preview** (inside the editor — the ▶ View button in the
  Stack Builder tool palette) and **published** (`/p/<naddr>`).
- Entry points: ▶ **View** in the Stack Builder palette; **Open Stack**
  on a stack's community-browser preview page.

### 5. Public viewer route

`/p/<naddr>` — a cold-loadable URL that resolves the addressable event
and boots straight into the runtime (no editor chrome). Needs a
`vercel.json` rewrite (`/p/:id` → SPA), mirroring `/share/:id`.
`/share/<naddr>` of a stack still opens the editor. A `/p/` link to an
**encrypted** stack the viewer can't decrypt shows a "This stack is
private" locked state, per `PRIVATE_PUBLISHING_FEATURE.md`.

### 6. Community feed

A published stack is a normal `kind:30078` event:

- **Feed-card thumbnail** — the start card's mini-render with a card-count
  badge (e.g. `8 cards`), reusing the deck preview renderer.
- **Publish-confirm preview** — likewise the start card.
- **Preview page** — carries the **Open Stack** button (surface 4).
- `stack` joins `MODE_LABELS`, the dedup fingerprint, the mode filters,
  and gets a `stack` ("Interactive page") category.

---

## Security

- **No executable content.** The schema is declarative; the runtime only
  ever interprets the known action types and ignores the rest. No HTML
  injection, no script, no iframes, no remote CSS, no `eval`.
- **`open-url` is the one outward vector** — always behind a confirm
  dialog showing the real destination; new tab; `rel="noopener
  noreferrer"`; only `http(s):` / `mailto:` schemes — never `javascript:`
  or `data:`.
- **Action chains are bounded** — capped length, no recursion (a chain
  cannot call another chain), and `onEnter`/`onExit` cannot navigate, so
  there is no loop or runaway-execution surface.
- **Image layers stay remote URLs**, as everywhere in Artstr — payload
  bounded to layer/action JSON.
- A forked/imported stack is untrusted; `sanitizeStackJson()` drops
  unknown action types and clamps chain lengths on load.

---

## Phased delivery

> **A + B + C together are the minimum genuinely-useful unit** — a stack
> with no behaviour is just a free-aspect deck; behaviour with no runtime
> can't be played. Ship them as one arc, gated individually.

### Phase A — Stack format
- `templateMode: 'stack'` reusing the deck engine via `isDeckLike()`.
- The `stack` data model; per-stack aspect ratio (presets + custom).
- Stack option in the Template-tab Layout panel; the Stack + theme
  sidebar panels; the card sorter (add / import / duplicate / delete /
  reorder / rename); stable card `id`s.
- Save / load / publish / fork as `casewrap-stack`; feed card + count
  badge; `stack` in `MODE_LABELS` / categories / mode filters.

**Ship gate:** build a 5-card 9:16 stack, reorder, edit a card, save,
reload, publish — round-trips; shows in the feed with its count.

### Phase B — Behaviour authoring
- Layer `onClick` + card `onEnter` / `onExit` action chains in the data
  model; `sanitizeStackJson()` validation on load.
- The action set: `goto-card`, `go-back`, `open-url`, `show-layer`,
  `hide-layer`, `toggle-layer`.
- The **action-builder panel** (surface 3): add / reorder / remove
  actions, id-based target pickers, the warnings.
- "Add hotspot"; action badges on interactive layers.

**Ship gate:** give a hotspot an `onClick` of *hide A → show B → go to
card 2*; give a card an `onEnter` that shows a layer; both round-trip
through save / reload / publish; dangling targets are flagged.

### Phase C — Interactive runtime
- The fullscreen runtime: `composeCardForRuntime`, the action overlay,
  chain execution, per-card visibility, `onEnter`/`onExit`, the
  navigation safety net, `open-url` confirm.
- ▶ View entry point in the Stack Builder palette; Open Stack on the
  community preview.

**Ship gate:** play a stack end to end — clicking hotspots reveals/hides
layers and jumps cards; `onEnter` fires; Back + keyboard + `Esc` always
work; `open-url` confirms then opens.

### Phase D — Public viewer route + polish
- `/p/<naddr>` route + `vercel.json` rewrite; cold-boot into the runtime.
- Profile-page "feature this stack" pinning.

### Phase E — Stack logic *(the scripting tier)*
- `state` variables on the stack; actions `set-variable`,
  `increment-variable`; a conditional action `{ type:'if', condition,
  then:[…], else:[…] }`. Local-only state (`localStorage`), reset on
  runtime start.
- A condition builder in the action panel.

The v1 action model already tolerates these (unknown types are ignored),
so Phase E is additive — no schema rewrite.

### Later / backlog
- Audio / video layer types and `play`/`pause` actions; `onMediaEnd`.
- More triggers: `onHover`, `onDoubleClick`, `onTimer`, `onKeyPress`.
- `open-nostr` (npub / note / naddr) and `zap` actions; Nostr embeds.
- Card transitions; stack templates (zine / portfolio / comic / landing).
- Blossom / NIP-B7 media upload; an asset library.
- Modal overlays; static-HTML export; multi-event stacks.

---

## Risks & tradeoffs

| Risk | Mitigation |
|---|---|
| Action chains become a back-door scripting language | v1 is a fixed, finite action set; no variables/branching until Phase E; chains can't call chains; the runtime interprets, never `eval`s. |
| `onEnter` → `goto-card` → `onEnter` infinite loop | `onEnter`/`onExit` chains structurally cannot contain navigation actions; only `onClick` navigates. |
| `open-url` is a phishing / malware vector | Confirm dialog showing the destination; new tab + `noopener`; scheme allowlist; never `javascript:`/`data:`. |
| Targets break on reorder / delete / rename | Actions reference stable card / layer **ids**, never indices or names; dangling targets are editor-flagged and runtime no-ops. |
| A stack traps the viewer (bad on-card nav) | Keyboard prev/next, a back-stack, and `Esc` always work regardless of the stack's own buttons. |
| Aspect-ratio change strands layers | Changing aspect re-fits every card via the import-letterbox remap, behind a confirm. |
| Runtime visibility drifts / becomes unpredictable | Per-card map reset to authored `visible` on every (re-)entry; show/hide/toggle never mutate stored data. |
| Stack vs Deck code duplication | One shared card-container engine via `isDeckLike()`; only aspect, behaviour, and the runtime branch. |
| Layer click hit-testing | The overlay reuses the renderer's box math; a CSS `transform:rotate` hit region catches clicks in its true rotated shape (rotation is exact); a clip-masked layer hit-tests on its bounding box — documented limitation. |
| Viewer is mouse-centric | Action regions are focusable `<button>`s — Tab / Enter / Space and screen readers work. |
| Big stacks → large events (relay size caps) | Images are URLs; warn past ~100 KB / ~25 cards; Blossom + multi-event stacks deferred. |

---

## Open questions

1. **Mode** — confirm `templateMode: 'stack'` reusing the deck engine.
2. **v1 action set** — the six above — confirmed? (`open-nostr` deferred.)
3. **Aspect presets** — 16:9 / 9:16 / 1:1 / 4:3 / custom — right set?
4. **Runtime** — extend the Presenter Mode engine, or a separate module?
   (Lean: extend it.)
5. **Route** — `/p/<naddr>` as proposed?
6. **Category** — one `stack` category, or split (`page`, `zine`)?
7. **Re-entry semantics** — confirm a card resets its layer visibility on
   every entry (vs. remembering it). v1 plan: reset.

---

## Acceptance summary

### Phase A
- [ ] Stack is a Template-tab layout; per-stack aspect works, and
      changing it re-fits existing cards.
- [ ] Card sorter: add / import / duplicate / delete / reorder / rename;
      cards have stable ids; imports letterbox onto the stack's aspect.
- [ ] Save / load / publish / fork as `casewrap-stack`; feed card shows a
      card-count badge.

### Phase B
- [ ] A layer can be given an `onClick` chain and a card an
      `onEnter`/`onExit` chain via the no-JSON action builder.
- [ ] Action chains support goto-card / go-back / open-url /
      show / hide / toggle-layer; rows reorder; targets are id-based.
- [ ] Chains round-trip through save / reload / publish; dangling
      targets, trailing-after-navigation, and navigation-in-onEnter are
      all flagged.

### Phase C
- [ ] The runtime renders cards full-screen and executes `onClick`,
      `onEnter`, `onExit` chains.
- [ ] show / hide / toggle change layer visibility live; visibility
      resets on card re-entry.
- [ ] `goto-card` (ids + clamped keywords) and `go-back` navigate; a
      back-stack + keyboard + `Esc` always work; `open-url` confirms.
- [ ] Action regions are focusable buttons; empty-space clicks are
      no-ops; the runtime owns the keyboard; theme is composed in.

### Phase D
- [ ] `/p/<naddr>` cold-boots a published stack into the runtime.
