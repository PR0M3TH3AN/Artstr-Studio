# Artstr Studio Linked Designs

## Cross-Reference Imports + Auto-Update + Attribution Chain

### Status

Spec draft. Not yet implemented. This document is the canonical plan;
when work begins it follows this doc, and updates land here first.

---

## 1. Feature Summary

Artstr currently supports **embedded** cross-template imports: any
design can be pulled into another as a `type: 'design'` layer (or as
a `type: 'pixelart'` layer, or as a deck slide, or into a disc-sheet
slot). Every existing import is a deep `JSON.parse(JSON.stringify(...))`
clone — once placed, the new layer has no relationship to its source
event. Source edits don't propagate; host-event size grows linearly
with embedded content.

This spec adds a parallel **linked** flavor of design imports.
A linked layer stores only the NIP-01 addressable-event coordinate
(`30078:<creatorPubkey>:<dTag>`) of its source. The renderer fetches
the latest event at that address on demand and renders it in place.

Two architectural wins this unlocks:

1. **Auto-update.** The source author edits their design — every host
   design that links to it picks up the change next render. Brand
   assets, logos, common components stay in sync without coordination.
2. **Smaller host events.** A host with N linked layers is the size
   of its own metadata + N coordinates, not N × source-payload. Side-
   steps the per-event relay size limit for large composite designs.

A third win, called out by the user during scoping: **attribution
chain**. Every linked layer's source pubkey is computable at render
time. The host's published event carries a `p` tag for every distinct
contributing creator, so Nostr-aware clients + relays can surface
"co-created by" without manual tagging.

Embedded imports stay as the default for everything that ships today.
Linked imports are an opt-in alternative offered alongside, with a
clear UI distinction.

---

## 2. Goals

- A new `design.kind: 'linked'` variant of the existing design layer.
- Address-coordinate-based resolution that returns "always latest" by
  default, with an opt-in "pin to this version" toggle exposed in the
  layer-options panel.
- Three levels of nesting allowed (linked design can itself contain
  linked layers, up to depth 3) with cycle detection.
- Attribution chain: published host events carry one `p` tag per
  distinct contributing creator, plus an in-app "Credits" panel that
  lists who contributed.
- Convert-direction commands: "Unlink to embed" (snapshot to current
  version) and "Publish + link" (extract an embedded layer into its
  own event and replace it with a link).
- Graceful degradation when relays don't return the source (loading
  state → placeholder + optional cached `fallbackPreview`).

## 3. Non-Goals

- Linked premium / private designs in Phase 1. Encrypted-design link
  resolution requires the viewer's unlock state for premium and the
  share-list for private; both ship in Phase 2.
- Real-time push when the source updates. The renderer polls on each
  render + offers a manual Refresh button; no relay subscription is
  held open for linked sources.
- Editing the linked source through the host. A linked layer is
  read-only at the host level; to modify the source, the original
  creator edits the source event.
- Cross-relay write replication. Source-author publishes as they do
  today; linked rendering reads from the host viewer's normal relay
  set.

---

## 4. Existing Artstr Fit

- The `type: 'design'` layer type and `renderDesignObjectIntoElement`
  renderer already accept any payload and render via the existing
  `renderDesignPayloadPreview` compact-mode path. Linked layers reuse
  the same renderer; only the source of the payload changes.
- The purchase-vault arc already established multi-relay union reads
  via `_vaultRelayUnion()` for kind-30078 events. Linked-design
  resolution borrows the same pattern (NIP-65 write relays + a
  default fallback set), keyed by address.
- Address-tolerant lookup helpers (`premiumAddressCoord`,
  `findUnlockedEntry`) already exist; the linked-design resolver
  follows the same shape.

---

## 5. Schema

Linked design layer:

```js
{
  id: 'layer-...',
  type: 'design',
  name: 'Linked: <source title>',
  target: 'canvas',
  x, y, w, h,
  rotate, opacity, z,
  design: {
    kind: 'linked',                                  // disambiguates from embedded
    ref: '30078:<creatorPubkey>:<dTag>',             // NIP-01 addressable coord
    mode: 'cover',                                   // hint: source-design template mode
    pinnedEventId: null,                             // optional, locks to a specific event id
    pinnedSnapshot: null,                            // optional, see §6
    fallbackPreview: null,                           // optional, see "persistence" below
    lastResolvedAt: null,                            // optional, in-memory ms timestamp
    lastResolvedSize: null,                          // optional, in-memory { w, h }
  },
}
```

### 5.1 Persisted vs in-memory fields

The host event's `content` is what gets published to relays, so every
field there counts toward the per-event size budget. To keep linked
layers small:

- **Persisted (serialized to host event):** `kind`, `ref`, `mode`,
  `pinnedEventId`, `pinnedSnapshot` (only when pinning, see §6).
- **In-memory only (stripped at publish time):** `lastResolvedAt`,
  `lastResolvedSize`, `fallbackPreview`. These are populated by the
  resolver after a successful fetch and used for runtime UI (timestamp
  display, layout hints, offline fallback) but never written into the
  serialized layer when the host publishes.

A pre-publish hook in `_publishPremiumDesign` and the regular publish
path strips the in-memory fields from `design` before signing. A linked
layer's serialized footprint is then roughly:
`{kind:'linked', ref:'30078:<pubkey>:<dTag>', mode:'cover', pinnedEventId:null}`
— ~110 bytes including overhead. 50 linked layers = ~5.5 KB, well under
any relay's content cap.

`fallbackPreview` is the one exception that's *optionally* persisted —
the user can tick "Cache a fallback preview" on the link-options panel
to embed a small JPEG (subject to the existing premium-preview 50 KB
cap) that survives source deletion. Off by default.

Embedded design layer (unchanged from today, made explicit for
contrast):

```js
{
  type: 'design',
  design: {
    kind: 'embedded',                  // implicit / absent on legacy layers
    mode: 'cover',
    payload: { /* full design JSON */ },
  },
  ...
}
```

Legacy layers without `design.kind` are treated as `embedded` for
backwards compatibility.

Top-level host-event tags (added at publish time for linked-design
attribution):

```
['p', '<contributor pubkey>', '<relay-hint>', 'design-contributor']
['p', '<contributor pubkey>', '<relay-hint>', 'design-contributor']
...
```

One `p` tag per *distinct* contributing pubkey discovered by walking
the host's linked layers (and their linked layers, up to depth 3).
The fourth element marks the tag as design-contributor specifically
so it doesn't collide with `p` tags emitted for replies / mentions
in other Nostr contexts.

---

## 6. Versioning Model

PPTX-style "always latest" is the default. Pinning is the advanced
opt-in.

- **Default (always latest):** `pinnedEventId === null`. Renderer
  queries relays for `kinds: [30078], '#d': [dTag], authors: [pubkey]`
  and uses the most recent event. NIP-01 addressable semantics
  guarantee relays only retain the latest event per address, so this
  is essentially free.
- **Pinned to version:** user toggles "Pin to this version" in the
  layer options. The current resolved `eventId` is written to
  `pinnedEventId`. Renderer queries by `ids: [<eventId>]` instead of
  by address — only that exact event is rendered. Source-author edits
  don't propagate until the host author manually un-pins or re-pins
  to a newer event.

### 6.1 Pinned + source deletion

A subtle but important case: if the source author tombstones the
pinned event (kind-5 delete), relays will discard it and the pinned
event id won't resolve anywhere. The pin no longer protects against
disappearance.

Two complementary mitigations:

1. The pin-mode toggle also offers a checkbox **"Embed snapshot for
   permanence"** that captures the resolved payload into
   `design.pinnedSnapshot` (full design JSON). The renderer prefers
   the live fetched event, falls back to `pinnedSnapshot` if the
   event is gone. This restores the old embed-style survivability at
   the cost of host-event size.
2. The `fallbackPreview` field (§5.1) is the lower-cost option for
   visual-fidelity-only fallback: a small JPEG that renders when the
   source disappears but isn't editable.

Default for new pinned layers: pin without snapshot. The user
explicitly opts in to snapshot for designs they want to outlive the
source.

The toggle is visible on every linked-design layer's right-panel.
Switching states is non-destructive; flipping back to "always latest"
just nulls `pinnedEventId`.

UI surfaces:

- Layer-options panel: "Source: <title> by <creator> · 🔗 latest"
  with a "Pin to this version" checkbox.
- A "Last resolved <timestamp>" line so the user knows how fresh.
- A "Refresh" button that re-queries even when the in-session cache
  is warm.

---

## 7. Caching Strategy

Per-session in-memory cache keyed by address (or by `eventId` when
pinned). Three layers:

1. **Session cache** — `Map<addressOrEventId, { payload, fetchedAt }>`.
   First render fetches; subsequent renders within the same session
   hit cache. TTL: 5 minutes. Closing the tab clears it.
2. **Disk cache** — None for Phase 1. If real-deck round-trips show
   render lag, Phase 3 polish adds a small localStorage-backed cache
   keyed by address + content-hash so a return visit doesn't re-fetch.
3. **Manual refresh** — A "Refresh" button on the layer options bypasses
   the cache and re-queries unconditionally. Useful for the
   collaborative case where Adam knows the source author just edited.

Cache invalidation strategy:

- TTL on session cache (5 min).
- "Refresh" button per-layer.
- Switching from latest → pinned (or vice versa) busts the entry.
- Editing the layer's `ref` busts the entry for the old ref.

Cache misses degrade gracefully:

- While fetching: render a loading placeholder ("⟳ Loading linked
  design...").
- On fetch failure (no relay returned the event): render the
  `fallbackPreview` data URL if present, else a "🔗 Linked design
  not found — refresh to retry" placeholder.

---

## 8. Render Flow

```
host design opened
  → render() walks layers
  → for each layer where layer.design.kind === 'linked':
      resolver.lookup(ref, pinnedEventId)
        → check session cache → hit: return payload
        → cache miss: queryRelays(union, filter)
        → success: cache + return
        → fail: return null + emit fallback
      renderDesignObjectIntoElement(el, { design: { payload } })
```

### 8.1 Sync vs async render

`render()` and `renderDesignObjectIntoElement` are synchronous today.
A linked layer can't return its content synchronously on first encounter
(relay query is async). Three patterns considered:

1. **Block render** on resolver — bad UX, stalls every layer behind the
   first network round-trip.
2. **Pre-fetch all linked layers** before any render — predictable
   state but visibly delays first paint.
3. **Sync render with placeholder, async upgrade** — initial render
   shows a "⟳ Loading…" or `fallbackPreview` placeholder, kicks off the
   resolver, then mutates the rendered DOM node when the resolver
   resolves. *This is the chosen pattern.*

Implementation shape:

- `renderDesignObjectIntoElement(el, layer)` synchronously renders the
  placeholder + tags the DOM element with `data-linked-pending`.
- The resolver's promise resolution finds that DOM element by layer id
  and calls `renderDesignPayloadPreview(el, payload, opts)` to replace
  the placeholder. Self-aborts if the element left the DOM mid-flight
  (covers the case where a re-render swaps it out).
- Cached resolutions (session cache hit) skip the placeholder phase:
  the renderer reads from cache synchronously and renders the payload
  immediately. So the placeholder only appears on the very first fetch
  (or after a manual refresh).

Trade-off accepted: per-layer loading flicker on cold open. Mitigated
by parallel resolver kick-off across all linked layers + the optional
`fallbackPreview` for visually-stable cold loads.

### 8.2 Autosave + cold start

Artstr autosaves `state` to localStorage on every change. A linked
layer's in-memory fields (`lastResolvedAt`, `lastResolvedSize`,
`fallbackPreview` when not opted-in to persist) are lost on tab
reload. On `restoreAutosave`, the resolver kicks off in the background
for every linked layer so the editor's first paint shows placeholders
that fill in within a few hundred ms (cache + relay round-trip).

Resolver lives in a `linkedDesigns` IIFE alongside the existing
`Premium` and purchase-vault helpers in `src/index.html`. Exposes:

- `resolveLinked({ ref, pinnedEventId })` → `Promise<payload | null>`
- `clearCache()` (used by the manual Refresh button)
- `walkContributors(payload, opts)` → `Set<pubkey>` (used by the
  attribution-tagging path at publish time)

Renderer changes are minimal — `renderDesignObjectIntoElement`
already handles "render a payload as a compact preview." The new
path just fetches the payload async before calling it.

---

## 9. Nesting + Cycle Detection

Up to **three levels of linking** allowed. A links B links C is fine;
C linking back to A is rejected at resolve time.

The resolver tracks `visited = Set<addressOrEventId>` through a single
top-level render pass:

```js
async function resolveLinkedTree(layer, depth, visited) {
  if (depth > MAX_LINK_DEPTH) return _depthLimitPlaceholder();
  const key = layer.design.pinnedEventId || layer.design.ref;
  if (visited.has(key)) return _cyclePlaceholder();
  visited.add(key);
  const payload = await resolveLinked(layer.design);
  // walk payload.layers for nested linked layers, recurse
  ...
}
```

`MAX_LINK_DEPTH = 3` (host counts as 0). Caps fetch storms + UX
predictability.

Cycle and depth-exceeded placeholders show a small inline label so
the user knows why nothing rendered.

---

## 10. Attribution Chain

The collaborative-project pitch is the main reason the user wants
this feature, so attribution is first-class.

### 10.1 At-render attribution

The "Credits" panel (new, surfaced from the design's metadata
sidebar) lists every distinct creator who contributed via a linked
layer in the current design. Pulled from the resolved-tree walk; lazy,
populated as resolves complete.

Displayed as: `@alice (3 designs)`, `@bob (1 design)`, etc., with
each entry linking to the contributor's `/u/<npub>` profile page.

### 10.2 At-publish attribution

When the user publishes a host design that contains linked layers,
the publish pipeline:

1. Walks the host's layers + their linked-tree resolutions (up to
   depth 3) to collect contributor pubkeys.
2. Adds one `['p', '<pubkey>', '<relay-hint>', 'design-contributor']`
   tag per distinct contributor.
3. Emits a `['link', '<address>', '<relay-hint>']` tag per linked
   reference so other indexers / readers can crawl the graph
   without re-fetching the design content.

NIP-aware clients picking up the host event can surface "co-created
by" without parsing the design payload. Relays can index by `p` to
let users find designs they've contributed to.

### 10.3 Embedded → linked conversions

When the user runs "Publish + link" on an embedded layer (see §11.4),
the embedded payload is published as a fresh kind-30078 under the
**current user's** pubkey (Artstr can't sign on behalf of the original
creator). The replacement linked layer therefore credits the current
user, not whoever first authored the embedded content. Today's
embedded layers don't carry source-author metadata, so we have no
provenance to preserve forward.

In practice the conversion is useful for layers the *current user*
authored manually but later wants to extract as reusable. For
content originating elsewhere, the conversion will credit the wrong
person — the action should warn explicitly in copy ("This publishes
the layer's contents under your Nostr identity. Don't use this for
designs you didn't make."). A future enhancement could capture the
original author at embed time so the chain survives, but that's out
of scope for this arc.

---

## 11. UX / UI

### 11.1 Import flow

Existing flow: layer's right-panel + Community modal already expose
"Browse community" and "Load from file." Add a third path:

- **"Link to community design"** — opens the community browser in
  link-mode. Selecting a row creates a `kind: 'linked'` layer with
  the source's address.
- Existing "Browse community" remains and continues creating
  embedded layers (default).

A "Link this design" action also appears in each community-result
card's row menu, so the user can pick link vs. embed at any entry
point.

### 11.2 Visual distinction in the layer list

Linked layers show a 🔗 prefix in the layer list (e.g.
`🔗 Brand logo (alice's design)`). Hover tooltip:
`Linked to alice's design · latest version · refreshed 12s ago`.

### 11.3 Layer-options panel for linked designs

When a linked layer is selected, the right-side options panel shows:

- Source title + creator pubkey (clickable to profile)
- `🔗 latest` vs `📌 pinned` toggle
- "Refresh" button (forces re-fetch)
- "Replace link…" button (opens community browser to swap target)
- "Unlink to embed" button (snapshots the currently-resolved payload
  into an embedded layer + drops the link)
- "Open source in new tab" link

Position / size / rotation / opacity stay editable like any layer.
Inner layers of the linked design are NOT editable — that's the
trade-off for source updates working.

### 11.4 "Publish + link"

A right-click action on any embedded design layer (or in the layer
menu): "Publish this layer as its own design and link to it."
Pipeline:

1. Extract the embedded payload into a fresh design.
2. Publish it as a normal kind-30078 from the current user.
3. Replace the host's embedded layer with a linked layer pointing at
   the new address.

Lets a user organically refactor a self-contained sub-design into
a reusable linked asset. Important attribution caveat in §10.3 —
the published copy goes under the current user's pubkey, so this
should not be used for layers that originated from a third party.

### 11.5 Picking initial layer dimensions

`addDesignLayerFromPayload` today reads the embedded payload's aspect
ratio to choose initial layer w/h. A linked layer has no payload yet
when it's created (resolve is async).

Solution: the layer-add path runs a synchronous resolver lookup first
(blocks UI ~< 1 s on cold relays). If resolution succeeds, the
initial layer uses the source aspect like an embed would. If
resolution fails or times out (1.5 s), the layer is added at a
default 1920×1080 (16:9) aspect, with a toast suggesting the user
"Refresh the layer when the source is available" — they can resize
manually afterward.

The link-creation modal also previews the source design at choose
time so the user knows what they're linking before commit.

---

## 12. Publishing Considerations

A host design with linked layers publishes as a normal kind-30078,
just with a smaller content payload (linked layers carry only the
ref, not the full sub-payload).

- Host content shape stays loadable by old viewers that don't know
  about linked layers. Legacy clients render the layer's
  `fallbackPreview` (when present) or a generic "Linked design" stub.
- Attribution tags (§10.2) are additive — clients that don't parse
  them ignore them. NIP-01 compliant.
- The host stays Nostr-publishable at standard relay size limits even
  when linking dozens of components.

### 12.1 Premium / private design boundary (Phase 2)

When a linked layer points at a premium design, the host viewer's
**purchase-vault entry** controls render — NOT the soft-gate
decryption itself, since the soft-gate KDF is deterministic from
public material and any browser could technically decrypt without
payment (§ PREMIUM_DESIGNS_FEATURE.md). The access check is
"does `findUnlockedEntry(eventId, address)` find an entry for the
linked source?":

- Vault entry present → render the decrypted payload (already in the
  cache from the vault).
- No vault entry → render a placeholder ("🔒 Linked premium design —
  unlock to render") with an inline unlock CTA that runs the normal
  premium-unlock flow against the linked source's address.

For private designs (`payload.visibility === 'private'`), Phase 2
checks the share-list at fetch time; rendering only happens for the
source author or an explicitly-shared pubkey.

Phase 1 detects an encrypted source and renders the
"Linked design — currently unsupported (premium / private)"
placeholder.

---

## 13. Security

- Sanitize text content from linked payloads the same way as forks
  today — `safeTextLinkHref` etc. — since linked content arrives
  from an arbitrary third party.
- Reject layer types that don't pass the existing
  `migrateLegacyLayerTargets` allowlist.
- **Per-event cap**: cap fetched payload size at 256 KB per linked
  event to avoid pulling in adversarially huge sub-designs.
- **Per-tree cap**: cap *total* resolved payload bytes for a single
  host render at 1 MB. Depth-3 fan-out can theoretically multiply
  fetches (one root linking to many designs each linking to many);
  the tree cap stops a coordinated DOS at the host level. When the
  cap is hit, subsequent linked layers in the same render render the
  fallback placeholder and emit a console warning.
- Depth cap (§9) prevents fetch-storm DOS.
- Cycle detection (§9) prevents stack-blowing infinite loops.
- No external URL fetching introduced — only relay queries.

---

## 14. Implementation Plan

### Phase 1 — Public-only linking

- Schema additions (`design.kind`, `design.ref`, `design.pinnedEventId`,
  `design.fallbackPreview`, `design.lastResolvedAt`).
- `linkedDesigns` resolver IIFE with session cache + multi-relay
  union queries (mirror of `_vaultRelayUnion`).
- Render-time wiring in `renderDesignObjectIntoElement` for the
  linked branch.
- Nesting + cycle detection.
- Layer-options panel: pin / refresh / unlink / replace.
- Community browser "Link this design" path.
- Loading + missing-source + cycle placeholders.
- Acceptance: a public cover design linked into a public slide deck
  renders correctly; editing the source updates the host's render
  next refresh.

### Phase 2 — Premium + private

- Premium link: check `findUnlockedEntry` for the source's address
  before rendering; show unlock CTA inline when locked.
- Private link: respect `payload.visibility === 'private'` + the
  shared-with list; render only for authorized viewers.
- Acceptance: a premium design linked into a host renders for buyers
  who've unlocked it and shows an unlock CTA for those who haven't.

### Phase 3 — Polish

- localStorage-backed disk cache for return-visit performance.
- Attribution `p`-tag emission at host publish time.
- Credits panel UI in the host design's sidebar.
- "Publish + link" workflow (convert embedded → linked).
- Optional batching of the resolver's relay queries to reduce
  round-trips when a host has many linked layers.

---

## 15. Risks

- **Source disappears.** If the source author tombstones their
  design (kind-5 deletion) or all relays drop the event, the host
  renders the fallback preview or a placeholder. Document this in
  the link-creation UI: "Linked designs depend on the source staying
  on relays."
- **Performance on large compositions.** A host with 50 linked
  layers triggers 50 fetches on first render. Mitigation: in-session
  cache + (Phase 3) disk cache + (Phase 3) batched queries.
- **Latency on first paint.** Each linked layer flashes a loading
  placeholder before the resolved payload arrives. Mitigation:
  parallel kick-off + per-layer fallback preview.
- **Embed / link confusion.** Two visually-similar import paths
  with very different semantics. Mitigation: 🔗 prefix in layer
  list, distinct icons in the import modal, clear copy in both
  buttons.
- **Attribution griefing.** A malicious user could embed a target
  pubkey via a linked layer to spuriously attribute work. Mitigation:
  attribution `p` tag includes the `'design-contributor'` marker so
  it's distinguishable from arbitrary mention tags, and the source
  author can issue a kind-5 deletion of any host event that
  falsely credits them.

---

## 16. Acceptance Criteria for Phase 1

- Linked layers render the latest version of their source on each
  open of the host design.
- Pinned linked layers freeze at a specific event id and don't pick
  up later edits.
- Up to 3 levels of nested linking works; depth-4 and cycles emit
  visible placeholders without breaking the host.
- Refresh button forces a re-fetch.
- Missing-source events render either the cached `fallbackPreview`
  or a clear "not found" placeholder.
- An embedded layer + its linked-twin layer render identically when
  pointing at the same source.
- Layer panel shows 🔗 prefix + creator name.
- A host event with 10 linked layers serializes to under 5 KB of
  layer overhead (link refs ~ 110 bytes each) and publishes without
  hitting any of the common relay caps (Damus / nos.lol / Primal /
  Snort / nostr.band — all accept ≥ 64 KB content).
- In-memory fields (`lastResolvedAt`, `lastResolvedSize`,
  non-opted-in `fallbackPreview`) are stripped from the serialized
  layer at publish time so they never inflate the host event.

---

## 17. Future Enhancements (not in initial release)

- **Real-time updates** — subscribe to kind-30078 with the linked
  address filter so source edits notify the host viewer instantly.
- **Relay subscription budgets** — coordinate fetches across hosts
  that share a tab to avoid duplicate work.
- **Designer comments / pull-requests** — let a viewer suggest an
  edit to a linked source via a kind-1 comment (out of scope, but
  the link graph makes this navigable).
- **Author allowlists** — a host design optionally restricts which
  authors' linked layers it'll render, for safety in adversarial
  contexts.
- **Diff-aware fallback** — store last-N source previews so the host
  can "fall back to last known good" when the new source is broken.
