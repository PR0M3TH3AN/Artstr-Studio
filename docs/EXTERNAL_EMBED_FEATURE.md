# Artstr Studio External Embed Viewer

## Read-only iframe-able render of any public Artstr object

### Status

Draft v2 — supersedes the earlier draft. Updated 2026-05-31 to cover
every design mode and every cross-cutting feature shipped since the
original sketch: linked designs, premium / private gating, layer
groups, PPTX-imported decks, native charts, pixel-art animation,
the disk cache, batched relay prefetch, attribution + Credits.

Nothing in this spec is implemented yet — this is the plan.

---

## 1. Feature Summary

Add an embeddable, read-only Artstr viewer that lets external
websites display any public Artstr object — design, slide, deck,
pixel art, custom art, disc, disc-design, jewel insert — with a
single iframe snippet:

```html
<iframe
  src="https://artstr.org/embed/naddr1..."
  width="800" height="450"
  loading="lazy" allowfullscreen
  style="border:0; max-width:100%; aspect-ratio:16/9;"
></iframe>
```

The viewer renders by:

1. Resolving the Nostr identifier to the latest (or pinned) event.
2. Parsing the Artstr payload.
3. Resolving any linked sub-designs in the payload via the existing
   `linkedDesigns` resolver (disk cache + batched prefetch reused).
4. Painting through the existing share/preview renderer with the
   editor chrome hidden.

The embedding site only needs to swap the Nostr identifier to
display a different Artstr object.

---

## 2. Product Goal

Embedding public Artstr work on any site should feel as ordinary
as embedding a YouTube video. Pastable into:

- static HTML / Markdown / MDX,
- Astro / Hugo / Jekyll,
- GitHub Pages, Netlify, Vercel,
- WordPress custom-HTML blocks,
- Substack, Ghost, Notion (embed blocks),
- Nostr long-form clients that allow iframes (Habla, YakiHonne).

It also gives Artstr authors a distribution primitive that doesn't
require viewers to leave their host site.

---

## 3. Core User Stories

### 3.1 Site owner embeds a public Artstr design

Paste an iframe into a static blog post; visitors see the design
without leaving the page.

### 3.2 Artist embeds their latest version (`naddr`)

Use the addressable-event coord so updates to the source propagate
to every page that embeds it. No re-embedding needed.

### 3.3 Archivist embeds an exact version (`nevent` / `note` / hex)

Pin to a specific event id so the embed never changes.

### 3.4 Presenter embeds a deck

Embed a deck with minimal controls so visitors can advance slides
inline.

### 3.5 Collaborator embeds a host with linked sub-designs

Embed a host design that pulls multiple linked layers from other
authors. The embed renders the live state and surfaces the
contributor chain.

### 3.6 Buyer-curious viewer encounters a premium embed

Embed of a premium design shows the watermarked preview + "Open in
Artstr to unlock" CTA — never asks the embedding site's visitor to
authenticate or pay inside the iframe.

### 3.7 Reader follows back to Artstr

A small "Open in Artstr" link in the embed lets viewers jump to
the full app to fork, zap, comment, or inspect.

---

## 4. Non-Goals for MVP

- `<img src="…">`-style rendering (requires server-side image bytes).
- Server-rendered PNG / SVG endpoints.
- oEmbed JSON endpoint.
- Private (visibility-encrypted) event display.
- In-iframe premium unlock (zap flow stays in the main app).
- Edit / publish / fork from inside the embed.
- Login UI / NIP-07 prompts inside the embed.
- Comments, reactions, zaps inside the embed.
- Designer-mode chrome (sidebars, layer list, toolbars).
- Arbitrary scripts from event content (always sanitized).
- Perfect dynamic auto-resize across every CMS (we expose a
  postMessage handshake; consumers opt in).

Each is a viable Phase 2+ follow-up.

---

## 5. Identifier Strategy

### 5.1 Supported identifier types

| Identifier     | Meaning                                   | Embed behavior                     |
| -------------- | ----------------------------------------- | ---------------------------------- |
| `naddr1…`      | Parameterized replaceable event address   | Latest version (auto-updates)      |
| `nevent1…`     | Specific event pointer with relay hints   | Exact event                        |
| `note1…`       | Specific event id (no relay hints)        | Exact event                        |
| 64-char hex    | Specific event id                         | Exact event                        |

### 5.2 Product guidance copy

In the embed-code generator:

> Use the **latest-version embed** if you want updates to appear
> automatically (`naddr`). Use the **snapshot embed** if you want
> this exact version to stay unchanged (`nevent` / `note`).

### 5.3 Identifier parsing

Reuse the existing `parseNostrIdentifier` family (used by
`/share/<id>` routes and the linked-designs resolver). No new
parsing logic should be invented for embeds.

---

## 6. URL Design

### 6.1 Canonical route

```
/embed/<nostr-id>
```

Examples:

```
https://artstr.org/embed/naddr1...
https://artstr.org/embed/nevent1...
https://artstr.org/embed/note1...
https://artstr.org/embed/0123abcd...
```

### 6.2 Static-host fallback route

Since Artstr is a static SPA, also support a query-based form so
hosts without SPA rewrites still work:

```
/?embed=naddr1...
/embed.html?id=naddr1...
```

The embed-code generator picks the canonical route by default and
exposes the fallback under an "Advanced" disclosure.

### 6.3 Query parameters

**Core (all modes):**

| Param      | Values                       | Default      | Effect                                                       |
| ---------- | ---------------------------- | ------------ | ------------------------------------------------------------ |
| `controls` | `1` / `0`                    | `1`          | Show/hide minimal control bar                                |
| `theme`    | `light` / `dark` / `auto`    | `auto`       | Background + control color scheme                            |
| `bg`       | `transparent` / `solid`      | `transparent`| Iframe content background                                    |
| `fit`      | `contain` / `cover`          | `contain`    | Scaling policy                                               |
| `open`     | `1` / `0`                    | `1`          | Show "Open in Artstr ↗" link                                 |
| `credits`  | `1` / `0`                    | `0`          | Show Credits overlay (contributors via linked layers)        |
| `attr`     | `1` / `0`                    | `1`          | Show "by @author" footer                                     |
| `frame`    | `1` / `0`                    | `0`          | Show outer Artstr branding chrome                            |

**Deck-specific:**

| Param      | Values        | Default | Effect                                                  |
| ---------- | ------------- | ------- | ------------------------------------------------------- |
| `slide`    | `1`..`N`      | `1`     | Initial slide index (1-based)                           |
| `autoplay` | `1` / `0`     | `0`     | Auto-advance slides on load                             |
| `loop`     | `1` / `0`     | `0`     | Restart at end of deck                                  |
| `interval` | ms (>= 1000)  | `8000`  | Autoplay interval                                       |

**Pixel-art-specific:**

| Param      | Values        | Default | Effect                                                  |
| ---------- | ------------- | ------- | ------------------------------------------------------- |
| `play`     | `1` / `0`     | `1`     | Auto-play frame animation (no-op if single-frame)       |
| `fps`      | int >= 1      | from payload | Override frame rate                                |

**Debug:**

| Param      | Values        | Effect                                          |
| ---------- | ------------- | ----------------------------------------------- |
| `debug`    | `1`           | Console-log resolver + render diagnostics       |

---

## 7. Embed Code Snippets

### 7.1 Responsive 16:9 (default for slides + decks)

```html
<div style="position:relative;width:100%;max-width:960px;aspect-ratio:16/9;">
  <iframe
    src="https://artstr.org/embed/naddr1..."
    title="Artstr design"
    loading="lazy" allowfullscreen
    style="position:absolute;inset:0;width:100%;height:100%;border:0;"
  ></iframe>
</div>
```

### 7.2 Cover / square (1:1 + auto-aspect)

Cover, jewel, disc, and pixelart all have intrinsic aspect ratios.
The generator queries the payload's natural aspect and emits
`aspect-ratio` accordingly.

```html
<div style="position:relative;width:100%;max-width:480px;aspect-ratio:1/1.4;">
  <iframe
    src="https://artstr.org/embed/naddr1..."
    title="Artstr cover"
    loading="lazy"
    style="position:absolute;inset:0;width:100%;height:100%;border:0;"
  ></iframe>
</div>
```

### 7.3 Chrome-free

```html
<iframe
  src="https://artstr.org/embed/naddr1...?controls=0&open=0&attr=0"
  title="Artstr design"
  width="800" height="450"
  loading="lazy"
  style="border:0;max-width:100%;"
></iframe>
```

### 7.4 Deck embed, deep-linked to slide 3

```html
<iframe
  src="https://artstr.org/embed/naddr1...?slide=3&controls=1"
  title="Artstr slide deck"
  width="960" height="540"
  loading="lazy" allowfullscreen
  style="border:0;max-width:100%;aspect-ratio:16/9;"
></iframe>
```

### 7.5 Animated pixel art

```html
<iframe
  src="https://artstr.org/embed/naddr1...?play=1"
  title="Pixel art"
  width="320" height="320"
  loading="lazy"
  style="border:0;image-rendering:pixelated;"
></iframe>
```

---

## 8. Supported Artstr Object Types

The embed viewer must support every public payload type Artstr
publishes today. Each is rendered via the existing share/preview
renderer.

| Mode          | Embed treatment                                                         |
| ------------- | ----------------------------------------------------------------------- |
| `cover`       | Render case-cover artwork read-only at natural aspect                   |
| `disc`        | Render disc label sheet read-only                                       |
| `jewel`       | Render jewel-case insert read-only                                      |
| `customart`   | Render custom canvas read-only                                          |
| `slide`       | Render single slide read-only at 16:9 (or slide's native aspect)        |
| `deck`        | Render deck player read-only with slide controls                        |
| `pixelart`    | Render pixel art at chosen scale; auto-animate multi-frame designs      |
| `disc-design` | Render single disc design read-only                                     |

**MVP priority order** (matches user-impact):

1. `slide`
2. `deck`
3. `customart`
4. `cover`
5. `pixelart`
6. `disc` / `jewel` / `disc-design`

### 8.1 Layer types within any payload

Whatever the top-level mode is, the payload's `layers` array can
contain any combination of: text (with rich-text spans), shapes,
images, QR codes, pixel-art layers (with animation), design layers
(embedded or linked), grouped layers. The embed renderer inherits
all of this from the existing layer rendering path; no new
renderers per layer type.

Specifically reused from the editor:

- `renderShapeIntoElement`
- `renderQrIntoElement`
- `renderPixelArtIntoElement` (animation included)
- `renderDesignObjectIntoElement` (embedded + linked branches)
- text layers' `applyPreviewLayerTextStyle` + safe-href scrubbing
- `safeTextLinkHref` for inline anchors

---

## 9. Linked Sub-Design Resolution Inside Embeds

A host payload can contain linked layers (`layer.design.kind === 'linked'`)
pointing at other Nostr events. The embed renderer reuses the
existing `linkedDesigns` IIFE end-to-end:

- `linkedDesigns.prefetchBatch(specs)` warms the cache with one
  batched relay round-trip across all linked refs in the host.
- `linkedDesigns.resolveLinked(spec)` handles per-layer paints.
- Cycle detection + depth-3 cap + per-event + per-tree byte caps
  all apply.
- Disk cache (`artstr.linkedDesignCache.v1`) is shared with the
  main editor when an embed loads from the same origin.

### 9.1 Premium linked sub-designs

When the host viewer is anonymous (always the case in an embed),
the resolver's vault lookup misses for premium sub-designs. Those
layers render the watermarked preview + a 🔒 overlay; clicking the
overlay opens the linked source in artstr.org's main app for
unlocking (via `Open in Artstr ↗`).

### 9.2 Private linked sub-designs

The embed has no signing extension and isn't in any envelope's
recipients list. Private sub-designs render the existing 🔒
"Private design / Not shared with this account" placeholder.

### 9.3 Pinned linked layers

`design.pinnedEventId` is respected — the embed resolves and
paints whatever the host pinned to.

### 9.4 Deck-slide pickers

A linked layer with `design.slideIndex` projects the deck's
chosen slide as a stand-alone slide payload before painting
(reuses `_deckSlideToSlidePayload`).

---

## 10. Visibility Boundaries

| Source visibility | Embed behavior                                                                 |
| ----------------- | ------------------------------------------------------------------------------ |
| Public            | Full render.                                                                   |
| Premium (zap-gated) | Watermarked preview JPEG from envelope + "🔒 Open in Artstr to unlock" CTA.  |
| Private (encrypted) | Refused with a clear "Private design" placeholder. No decryption attempts.   |
| Linked-premium-locked sub-layer | Watermarked preview at .45 opacity + 🔒 (same as in-app locked).   |
| Linked-private-locked sub-layer | Dark gray "🔒 Private design / Not shared" tile.                   |

The embed never:

- Prompts for NIP-07 sign-in.
- Initiates a zap.
- Decrypts private content.
- Loads anything from `localStorage` it didn't write itself
  (vault keys live on the artstr.org origin, not on the embed
  consumer's origin — unless the embed is same-origin).

---

## 11. UX Spec

### 11.1 Layout

```
┌────────────────────────────────────────┐
│                                        │
│            artwork surface             │  ← scales to fit
│                                        │
│                                        │
├────────────────────────────────────────┤
│ ←  3 / 12  →    by @author      Open ↗ │  ← optional control bar
└────────────────────────────────────────┘
```

Surfaces hidden by default:

- editor sidebars, toolbars, layer list,
- publish UI,
- community browser,
- metadata panels,
- raw JSON,
- Designer mode.

### 11.2 Static-design embed (cover, slide, customart, pixelart, etc.)

```
[ artwork ]

(optional bottom-right or footer bar)
by @author              Open in Artstr ↗
```

If `controls=0` AND `attr=0` AND `open=0` → no chrome at all.

### 11.3 Deck embed

```
[ slide N ]

←  3 / 12  →    ⛶ fullscreen    by @author    Open ↗
```

Keyboard (when iframe is focused):

| Key                             | Action                |
| ------------------------------- | --------------------- |
| ArrowRight / Space / PageDown   | Next slide            |
| ArrowLeft / PageUp              | Previous slide        |
| Home                            | First slide           |
| End                             | Last slide            |
| F                               | Toggle fullscreen     |
| Esc                             | Exit fullscreen       |

Touch / pointer:

- swipe left / right on slide surface advances,
- tap on left third = previous, right third = next, center = controls toggle.

### 11.4 Pixel-art embed

Multi-frame designs auto-play. A tiny play/pause toggle appears
in the controls bar (or top-right corner overlay when `controls=0`).
The play/pause respects `play=0` initial state. Frame rate
honors `fps` param or payload's `fps`.

### 11.5 Credits overlay (opt-in via `credits=1`)

Mirrors the in-app Credits panel (LINKED_DESIGNS_FEATURE.md §10.1).
Renders as a thin bottom strip above the control bar:

```
🔗 Credits  @alice (3) · @bob (1) · @crrdlx (1)         …more
```

Each name links to artstr.org/u/<npub> in the parent window
(`target="_top"`, `rel="noopener"`) so embed visitors can follow
through.

If no linked layers exist, the credits row hides entirely.

### 11.6 Locked-premium overlay

```
┌────────────────────────────────────────┐
│        [watermarked preview]           │
│        ╳ ╳ ╳ ╳ ╳ ╳ ╳ ╳                 │  ← 45% opacity
│                                        │
│       ┌──────────────────────┐         │
│       │ 🔒 Premium design     │         │
│       │ Open in Artstr to    │         │
│       │ unlock                │         │
│       └──────────────────────┘         │
└────────────────────────────────────────┘
```

The "Open in Artstr" link is the entire CTA — no zap flow in
the iframe.

### 11.7 Loading state

Centered, compact, theme-aware:

```
⟳ Loading Artstr design…
```

Replaced as soon as the resolver returns (cache hit may make
this invisible).

### 11.8 Error states

| Failure                                | Message                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------ |
| Identifier malformed                   | "That's not a valid Artstr identifier."                                  |
| Event not found on any relay           | "Could not find this design. The source may have been deleted or relays are unreachable." |
| Event found but payload unparseable    | "This event isn't a valid Artstr design."                                |
| Event is private                       | "🔒 Private design — only sharers can view this."                        |
| Event size > cap                       | "Source is too large to embed (cap: 1 MB)."                              |
| Network timeout                        | "Couldn't reach Nostr relays. Open in Artstr ↗ to try again."            |

All errors include the `Open in Artstr ↗` link so the visitor has
a fallback. Specific internal errors go to `console.warn` and
appear in dev-tools when `?debug=1`.

---

## 12. Architecture

### 12.1 Route detection

Detect embed mode before any editor bootstrapping:

```js
function parseEmbedRoute() {
  const path = location.pathname || '';
  const params = new URLSearchParams(location.search || '');
  if (path.startsWith('/embed/')) {
    return { isEmbed: true, id: decodeURIComponent(path.slice('/embed/'.length)), params };
  }
  if (path === '/embed.html' && params.get('id')) {
    return { isEmbed: true, id: params.get('id'), params };
  }
  if (params.get('embed')) {
    return { isEmbed: true, id: params.get('embed'), params };
  }
  return { isEmbed: false };
}
```

### 12.2 Boot split

```js
const route = parseEmbedRoute();
if (route.isEmbed) {
  document.body.classList.add('embed-mode');
  bootEmbedViewer(route);
} else {
  bootFullStudio();
}
```

If splitting bootstraps cleanly is too invasive for MVP, the
embed path can short-circuit the editor init early via the
`embed-mode` body class + CSS hiding all editor chrome. A
follow-up phase splits the bundle for size.

### 12.3 Embed state

```js
const embedState = {
  id: '',
  params: {},
  status: 'idle',          // idle | loading | ready | error
  error: '',
  event: null,
  payload: null,
  mode: '',
  pubkey: '',
  premium: null,           // { state: 'locked', envelope, addressCoord } or null
  deckIndex: 0,
  warnings: [],
};
```

### 12.4 Event resolution

```js
async function resolveArtstrEmbed(id, opts = {}) {
  const pointer = parseNostrIdentifier(id);
  if (!pointer) throw new Error('Unsupported Artstr embed identifier.');
  const hints = readRelayHints(pointer, opts.params);
  const relays = uniqueRelays([...hints, ...DEFAULT_NOSTR_RELAYS]);
  if (pointer.type === 'naddr') {
    return await queryLatestReplaceable(relays, pointer);
  }
  return await queryExactEvent(relays, pointer);
}
```

Reuse the existing share-route resolvers when possible. The
embed should NOT reinvent identifier parsing.

### 12.5 Linked sub-design prefetch

After the host payload is parsed, but before render:

```js
const linkedSpecs = collectLinkedSpecs(payload);
if (linkedSpecs.length) {
  await linkedDesigns.prefetchBatch(linkedSpecs);
}
renderEmbedPayload(payload, container, opts);
```

`collectLinkedSpecs` walks `payload.layers` + every
`payload.deck.slides[*].layers` for `kind === 'linked'` entries.
The renderer then paints from a warm cache with no per-layer
relay latency.

### 12.6 Rendering reuse

```js
function renderEmbedPayload(payload, container, opts) {
  const mode = normalizeTemplateMode(payload);
  if (mode === 'deck') return renderEmbedDeck(payload, container, opts);
  // Everything else reuses the existing mode renderers.
  return renderDesignPayloadPreview(container, payload, {
    compact: true,
    transparentPixelArt: opts.bg !== 'solid',
  });
}
```

`renderEmbedDeck` adds the slide-player state machine but the
slide content itself goes through `renderCustomArtPreviewDOM`
(slides share the customart preview path).

### 12.7 Deck player

```js
const deckRuntime = {
  payload: null,
  slides: [],
  index: 0,
  totalSlides: 0,
  autoplay: false,
  loop: false,
  intervalMs: 8000,
  timer: 0,
};
function renderEmbedDeck(payload, container, opts) { /* ... */ }
function goToEmbedSlide(i) { /* ... */ }
function startDeckAutoplay() { /* ... */ }
function stopDeckAutoplay() { /* ... */ }
```

Render strategy:

- Render only the current slide (and pre-render the next at the
  edges of `requestIdleCallback` for snappy transitions).
- Heavy decks (many large images) defer non-current slides.

### 12.8 PostMessage handshake (optional)

When the host iframe loads, post `{ type: 'artstr.ready', mode, naturalAspect }`
to `parent` so the embedding page can auto-resize. Accept:

| Message in                              | Effect                |
| --------------------------------------- | --------------------- |
| `{ type: 'artstr.nextSlide' }`          | Deck: next slide      |
| `{ type: 'artstr.prevSlide' }`          | Deck: prev slide      |
| `{ type: 'artstr.goToSlide', index }`   | Deck: jump            |
| `{ type: 'artstr.play' }`               | Pixel: play           |
| `{ type: 'artstr.pause' }`              | Pixel / deck: pause   |
| `{ type: 'artstr.fullscreen' }`         | Request fullscreen    |
| `{ type: 'artstr.refresh' }`            | Re-resolve from relay |

Out per state change:

| Message out                                | When                          |
| ------------------------------------------ | ----------------------------- |
| `{ type: 'artstr.ready', ... }`            | After first paint             |
| `{ type: 'artstr.slideChanged', index }`   | Deck slide changes            |
| `{ type: 'artstr.error', code, message }`  | Any error state               |
| `{ type: 'artstr.resize', w, h }`          | Natural size reported         |

Origin guard: by default ignore messages from origins other than
the parent's origin (sniff from `event.origin`). Embedding sites
that want bidirectional control opt in by always posting to the
iframe with the embed page's origin (`https://artstr.org`).

---

## 13. Embed Code Generator (in-app)

### 13.1 Entry points

Add **Embed** action in:

- the community preview pane (next to existing "Save JSON" / "Use/Fork"),
- the share page,
- post-publish toast actions,
- the "My Designs" row context menu.

### 13.2 Modal layout

```
[ live preview iframe at chosen size ]

Identifier:
  (•) Latest version  (naddr1…ab12)
  ( ) Exact version   (nevent1…xy93)

Size:
  (•) Responsive 16:9
  ( ) Cover / portrait
  ( ) Square
  ( ) Custom: [  w  ] × [  h  ]

Options:
  [x] Show controls
  [x] Show "by @author" footer
  [x] Show "Open in Artstr" link
  [ ] Show Credits row
  [ ] Autoplay (deck only)
  [ ] Loop (deck only)

  Start at slide: [ 1 ]   (deck only)

[ Copy iframe code ]   [ Copy embed URL ]   [ Copy share URL ]
```

### 13.3 Generator outputs

- iframe HTML (responsive or fixed),
- raw embed URL,
- share URL (the existing `/share/<id>` link),
- (future) Markdown link,
- (future) oEmbed-discovery URL.

### 13.4 Discoverability

Surfaced in the preview pane as a small "<>" Embed button next to
the existing share / save buttons. Adds an entry to the post-publish
toast: "Published — copy embed code ↗".

---

## 14. Security

### 14.1 Public-only by construction

The embed has no signing extension and no vault state. Every
attempt to render a private envelope refuses with a clear
placeholder; every premium event renders the public watermarked
preview only.

### 14.2 Sanitization

Linked sub-payloads come from arbitrary third parties — even when
the top-level host is from a trusted author. The embed renderer
reuses the existing sanitization paths:

- `safeTextLinkHref` for inline anchors.
- The shape allowlist (`migrateLegacyLayerTargets`).
- Image URL pass-through (no script execution; `<img>` only).
- SVG layers go through the same sanitizer the editor uses
  before being injected. If any path turns out NOT to sanitize
  (audit during Phase 1), the embed feature hardens it.

### 14.3 Per-event + per-tree byte caps

Reuses `LINKED_DESIGN_MAX_EVENT_BYTES` (1 MB) for the top-level
embed event, and `LINKED_DESIGN_MAX_TREE_BYTES` (1 MB) for the
total resolved sub-tree. Hitting the per-tree cap freezes
further linked-layer paints to fallback placeholders + a console
warning.

### 14.4 Frame-ancestors

The embed route must allow framing from any origin:

```
Content-Security-Policy: frame-ancestors *
```

Other routes can keep stricter framing. No `X-Frame-Options:
DENY|SAMEORIGIN` on `/embed/*`. Same applies to `/embed.html` and
the fallback query path.

### 14.5 Relay constraints

- Use `_vaultRelayUnion()` so the embed shares the linked-designs
  relay strategy.
- Cap the number of relays per embed query (e.g., 8) to limit a
  malformed identifier from fanning out indefinitely.
- Don't honor arbitrary `relay=` params unless the identifier
  itself carries hints (NIP-19).

### 14.6 No cross-origin localStorage leak

The embed runs on `artstr.org` so it shares `localStorage` with
the main app. That includes the disk cache, vault, NWC creds,
etc. Embed code must NEVER:

- Read or write the vault key.
- Read or write the NWC key.
- Interact with sign-in state.

Reading the linked-designs disk cache is fine (it's public Nostr
event content).

---

## 15. Performance

### 15.1 Cold load

MVP loads the full Artstr bundle inside the iframe. Acceptable
but unideal long-term.

Mitigations:

- Skip expensive editor init (community feed, theme processing,
  pixel editor, NWC connection) when `embed-mode` is set.
- Render loading state immediately after `embed-mode` body class
  is applied — before any relay queries.
- Lazy-load the deck player only when the resolved mode is `deck`.

### 15.2 Relay latency

- Resolve host event in parallel with prefetchBatch for linked
  sub-designs once the host content arrives.
- Disk cache reads zero-cost; hit rate is high on return visits.
- Race default relays; first valid event wins.
- For `naddr`: continue listening 500-800ms for newer
  replaceable events that arrive after the first valid one.

### 15.3 Heavy decks

- Render current slide only by default.
- Pre-render adjacent slides (index-1, index+1) at idle.
- Lazy-load image layers (`loading="lazy"`).
- Pixel-art frames pre-render once and cache the canvases (same
  as the in-app deck pixel-art animation path).

### 15.4 Bundle split (future)

Phase 7: extract a smaller `embed.html` entry that loads only:

- noble bundle (for signing-free relay reads — actually nothing
  needs signing in embeds, so noble can be dropped entirely from
  the embed bundle),
- relay-read code,
- `linkedDesigns` resolver,
- preview renderers,
- deck player,
- a tiny embed-only CSS bundle.

Expected size reduction: ~70% (skip editor + NWC + Premium
encrypt code + community feed + import paths).

---

## 16. Accessibility

- iframe `title` is always set (default: "Artstr design" /
  "Artstr slide deck" / "Artstr pixel art").
- Control bar buttons have accessible labels.
- Deck controls support keyboard navigation with visible focus.
- Loading / error states use readable text + don't rely on color
  alone.
- Animated pixel art respects `prefers-reduced-motion`: pauses
  by default and shows a play button (`play=1` can override).
- High-contrast outline on focus.

---

## 17. SEO & Social Preview

### 17.1 MVP

iframe content does not appreciably help the embedding site's
SEO. We accept this trade-off.

### 17.2 Open Graph for the embed URL itself

When someone shares an `/embed/<id>` URL on Nostr or Twitter,
the embed route emits Open Graph tags:

- `og:title` = event title tag or designObjectTitle(payload)
- `og:description` = author name + "Artstr design / deck / …"
- `og:image` = `/render/<id>.png` (Phase 7 — currently the
  watermarked preview from a premium envelope can stand in
  if present)
- `og:url` = canonical `/share/<id>`

### 17.3 Future: oEmbed endpoint

```
/oembed?url=https://artstr.org/share/naddr1...
```

Returns:

```json
{
  "version": "1.0",
  "type": "rich",
  "provider_name": "Artstr",
  "provider_url": "https://artstr.org",
  "title": "Design title",
  "author_name": "@alice",
  "html": "<iframe src=\"https://artstr.org/embed/naddr1...\" width=\"800\" height=\"450\" style=\"border:0\" allowfullscreen></iframe>",
  "width": 800,
  "height": 450
}
```

Requires a serverless function (oEmbed consumers fetch JSON
directly; an SPA-rendered HTML page won't satisfy them).

### 17.4 Future: image render endpoint

`/render/<id>.png`, `/render/<id>.svg`, `/render/<id>.jpg`.
Probably backed by headless Chromium or a same-bundle SVG
serializer. Lets `<img src="...">` users get a static fallback
without iframes.

---

## 18. Implementation Plan

### Phase 0 — Discovery + reuse audit

- Map existing `/share/<id>` route resolver.
- Map existing preview renderer entry points.
- Confirm sanitization coverage on every layer type.
- Identify the smallest possible skip-list for editor init.

Deliverable: a one-pager listing reused functions and any that
need extraction.

### Phase 1 — Static-design embed (vertical slice)

Acceptance:

- `/embed/<naddr>` route detection.
- `?embed=<id>` fallback.
- `embed-mode` body class hides editor chrome.
- Resolves a public `naddr` to the latest event.
- Renders `slide` and `customart` modes.
- Loading + error states.
- "Open in Artstr ↗" link works.

### Phase 2 — All static modes

Acceptance:

- `cover`, `disc`, `jewel`, `pixelart` (single-frame), `disc-design` all render.
- Layout scales correctly per mode's natural aspect.
- No scrollbars in 16:9 / square / portrait iframes.

### Phase 3 — Linked sub-designs

Acceptance:

- Host with linked layers paints them via `linkedDesigns.resolveLinked`.
- `prefetchBatch` warms cache in one batched round-trip.
- Cycle detection + depth-3 cap visible (test with crafted host).
- Locked-premium sub-layer shows watermarked preview + 🔒.
- Locked-private sub-layer shows the dark placeholder.

### Phase 4 — Deck player

Acceptance:

- Deck embed shows current slide + controls.
- `?slide=N` deep-links to slide N.
- Keyboard nav works when iframe focused.
- Fullscreen via control button + `F` key.
- `controls=0` hides controls; visitor can still keyboard-nav.
- Autoplay + loop work; respect `prefers-reduced-motion`.

### Phase 5 — Animated pixel art

Acceptance:

- Multi-frame pixel-art auto-plays.
- `play=0` starts paused; `fps` overrides payload FPS.
- `prefers-reduced-motion` defaults to paused with a play CTA.

### Phase 6 — Embed code generator

Acceptance:

- Modal opens from community preview, share page, post-publish toast.
- Identifier type selector (naddr / nevent) with explanation.
- Size presets + custom.
- Options checkboxes wired to query params.
- Copy buttons for iframe HTML, embed URL, share URL.
- Live preview of generated iframe inside the modal.

### Phase 7 — Hardening + headers

Acceptance:

- Frame-ancestors `*` on `/embed/*` and `/embed.html`.
- SPA rewrites configured for clean route on host (Vercel
  `vercel.json` rewrites or Netlify `_redirects`).
- Origin-allowlisted iframe smoke-tested from a third-party site.
- Malformed-event fuzzing produces friendly errors, not crashes.
- `?debug=1` surfaces useful resolver / renderer diagnostics.
- Cap relay count per embed query (limit ~8).

### Phase 8 — Polish

- Credits overlay (`credits=1`).
- PostMessage handshake (`artstr.ready` + slide / play /
  fullscreen messages).
- Light / dark / auto theme.

### Phase 9 — Future (separate roadmap)

- oEmbed endpoint (serverless).
- Image render endpoint (`/render/<id>.png`).
- Lightweight `embed.html` bundle.
- Pre-rendered Open Graph preview images.

---

## 19. Risks

- **Bundle size.** The embed loads the full SPA. Acceptable for
  MVP; bundle split planned for Phase 9.
- **Sanitization gaps.** Linked sub-payloads from arbitrary
  authors widen the attack surface. Mitigation: audit during
  Phase 1, harden during Phase 7.
- **Identifier confusion.** Authors paste an `nevent` expecting
  it to update; the in-app copy must clearly contrast latest vs.
  snapshot.
- **Relay reliability.** A single down relay can stall the embed
  if hints point at it. Mitigation: race + timeout + fall back to
  defaults.
- **Premium UX.** Locked-premium embed shows watermarked preview
  but no unlock path — viewers must follow the link out. Some
  authors may dislike this asymmetry; we explain in copy.

---

## 20. Acceptance Criteria for Embed v1 (MVP)

Embeds are MVP-complete when ALL of these hold:

- `/embed/<id>` and `?embed=<id>` both route correctly.
- `naddr`, `nevent`, `note`, raw hex all resolve.
- All eight Artstr modes render read-only.
- Linked sub-designs render via `linkedDesigns.prefetchBatch` + per-layer `resolveLinked`.
- Deck embeds support keyboard + on-screen prev/next + fullscreen.
- Pixel-art embeds auto-animate multi-frame designs.
- Locked premium sub-layers show the watermarked preview + "Open in Artstr to unlock" link.
- Private events refuse with a clear placeholder; no decryption attempts.
- Embed code generator can produce iframe HTML + URL + share URL.
- The generated iframe works from an external static HTML page on a different origin.
- Malformed / oversized / private payloads show friendly errors, not crashes.
- Sanitization rejects script tags, dangerous href schemes, SVG handlers, oversized payloads.
- `frame-ancestors *` is set on the embed route.

---

## 21. Out of Scope (explicitly)

- `<img>`-style PNG/SVG output.
- oEmbed JSON endpoint.
- Edit / publish / fork / zap / comment from the iframe.
- Login UI.
- Server-side rendering of any kind.
- Custom themes beyond light/dark/auto.
- Embed analytics (privacy-preserving counters can come later).

These all belong to Phase 9+.
