# Streaming Relay Sync & Soft Cooldown Plan

## Goals
Make the Community template browser feel **fast and reliable** by rendering Nostr template events progressively as they arrive from each relay, instead of waiting for every relay (or a 4.5s timeout) before showing anything.

### Product goals
1. First template visible within ~300ms of opening Community (assuming any fast relay is reachable).
2. Slow or flaky relays no longer block the feed — their results trickle in late instead of being lost.
3. A single transient relay timeout does not silently shrink the relay pool for the next hour.
4. No regression in publish reliability or social action (react/follow/repost) flows.

### Non-goals (v1)
- Persistent local cache of fetched template events across sessions.
- Relay scoring / per-relay weighting beyond simple cooldown.
- Per-event retry on a different relay if its origin relay drops mid-stream.
- Switching to a Nostr library (e.g. NDK, nostr-tools pool). Stay with the in-file WebSocket implementation.

---

## Problem statement

**Symptoms reported:** Nostr designs (kind `30078` notes) often never appear in the template browser, or take very long to appear.

**Observed in `src/index.html`:**

1. `queryRelays()` (line 2980) opens a WebSocket per relay, sends a single `REQ`, and collects events into a `Map`. It uses `Promise.all` over every relay and only returns the merged result after **every relay either finishes (EOSE) or hits the timeout**. The default timeout is 3500ms; the template fetch uses 4500ms.
2. `fetchFeedAndReactions()` (line 5735) awaits that full result before populating `_feedCache.events`. `loadFeedTab()` (line 6217) waits for the entire cache to fill before building any rows.
3. `markRelayFailure()` (line 2685) is called on any timeout, error, or unexpected close, and pushes the relay into a cooldown that starts at **10 minutes** and escalates up to **1 hour**. State is persisted to `localStorage` under `casewrap-relay-health`, so failures bleed across sessions.

**Net effect:** if one or two relays are slow, the user stares at "Loading…" for the full timeout window, and any transient hiccup quietly removes that relay from the rotation for the rest of the hour — which compounds over time and explains the "sometimes never loads" report.

---

## Current architecture

```
loadFeedTab(tab)
  └── await fetchFeedAndReactions()
        ├── await Promise.all([
        │     queryRelays({ kinds:[30078], limit:200 }, 4500ms),   ← blocks until all relays settle
        │     queryRelays({ kinds:[5],     limit:100 }, 3500ms)
        │   ])
        ├── batch queryRelays({ kinds:[7], '#e':[...] })           ← reactions
        └── batch queryRelays({ kinds:[0], authors:[...] })        ← profiles
  └── buildRowsFromEvents(_feedCache.events, …)
  └── render
```

Single render at the end. No partial UI.

---

## Proposed architecture

```
loadFeedTab(tab)
  └── show skeleton
  └── start fetchFeedAndReactions({ onProgress: rerender })
        ├── queryRelays({ kinds:[30078] }, { onEvent }) ────────────┐
        │     onEvent → push into _feedCache.events Map            │
        │                trigger debounced onProgress              │
        │                                                          ├── render fires repeatedly as
        ├── queryRelays({ kinds:[5] },     { onEvent }) ────────────┘    new templates arrive
        ├── (await both relay sets to settle)
        ├── batch reactions  → onProgress
        └── batch profiles   → onProgress
```

Key shape changes:
- `queryRelays(relays, filters, { timeoutMs, onEvent, onRelayDone })` — new optional callbacks. Promise still resolves with the full event array when all relays settle, so non-streaming call sites are unchanged.
- `_feedCache.events` populated incrementally via a Map keyed by `event.id` (was: written once at the end).
- `fetchFeedAndReactions(opts)` accepts `{ onProgress }`. Calls it (debounced 150ms) whenever the cache changes.
- `loadFeedTab(tab)` passes an `onProgress` that re-runs `buildRowsFromEvents` and re-renders the current tab.

### Cooldown change (read vs publish)

`markRelayFailure(relay, error, { context })` gets a `context` param:
- `'publish'` (default, preserves current behavior): base **10 min**, max **1 hr**.
- `'read'`: base **30s**, max **5 min**.

`queryRelays` passes `{ context: 'read' }`. `publishToRelays` is unchanged (still defaults to `'publish'`).

Rationale: a single dropped read should not lock a relay out of the next 10 minutes of browsing. A repeated 30s skip is enough to deprioritize a genuinely-broken relay while keeping the pool wide for transient blips.

---

## Phased delivery plan

### Phase 1 — Soft cooldown for reads
Smallest, isolated change. High impact on its own because it stops the relay pool from silently shrinking.

**Changes**
- `src/index.html` constants block: add `RELAY_READ_FAILURE_COOLDOWN_MS = 30 * 1000` and `RELAY_READ_FAILURE_MAX_COOLDOWN_MS = 5 * 60 * 1000`.
- `markRelayFailure(relay, error, opts = {})`: accept `context`, pick cooldown base/max accordingly.
- `queryRelays`: pass `{ context: 'read' }` to every `markRelayFailure` call inside it.
- `publishToRelays`: no change (default `'publish'` context).

**Acceptance**
- Triggering a read-side timeout (e.g. by adding a known-dead relay URL) puts the relay in cooldown for ~30s, verifiable via `localStorage['casewrap-relay-health']`.
- Triggering a publish-side failure still produces a 10+ min cooldown.

### Phase 2 — Streaming `queryRelays`
Non-breaking extension of the existing function.

**Changes**
- Add `onEvent(event, relay)` and `onRelayDone({ relay, ok, error })` options to `queryRelays`.
- In the `message` handler, when a NEW `EVENT` arrives (not already in the dedupe Map), fire `onEvent` after inserting. Do not re-fire for duplicates.
- In `finish()`, fire `onRelayDone` once before resolving.
- Wrap callback calls in try/catch so a buggy listener can't kill the relay reader.
- Existing return value (sorted event array, resolves after all relays settle) is preserved.

**Acceptance**
- Existing call sites (publish verification, profile fetch, reaction batches, mute list, etc.) compile and behave identically.
- A new test invocation that passes `onEvent` receives events in arrival order across relays, with each `event.id` fired at most once.

### Phase 3 — Progressive feed render
Wire streaming into the template browser.

**Changes**
- Replace the array shape of `_feedCache.events` with a Map-backed accumulator. Add a getter helper `getFeedEvents()` that returns the merged array (cache + persisted templates) for use by `buildRowsFromEvents`.
- `fetchFeedAndReactions({ onProgress })`:
  - Reset the accumulator at start.
  - Run the template and deletion queries with `onEvent` callbacks that push into the accumulator and schedule a debounced `onProgress` (≈150ms).
  - After both queries settle, fire `onProgress` once more, then run reaction and profile batches (each followed by a final `onProgress`).
  - Continue to gate concurrent calls with `_feedCache.loading`.
- `loadFeedTab(tab)`:
  - Render a one-time skeleton.
  - Define `rerender()` that re-runs `buildRowsFromEvents`, sorts, paginates, and replaces the wall contents. Bail out if the user has switched to a different tab.
  - Call `await fetchFeedAndReactions({ onProgress: rerender })`.
  - One last `rerender()` after the await.
- Search and "Mine" tabs reuse the same pattern via a shared helper.

**Acceptance**
- With all six default relays in the list, first template appears in the wall before the slowest relay has responded.
- Switching tabs mid-stream cancels stale renders (no flicker into the wrong tab).
- Reaction counts and author avatars appear after the initial render without wiping the cards.
- "No templates found…" message only appears after both template-side relays have all settled with zero rows.

---

## Engineering notes

- **Debounce window:** 150ms is a balance between visible progressiveness and avoiding layout thrash when a fast relay dumps 50 events in one tick.
- **Dedupe:** must happen on `event.id`, not address — multiple relays will return the same event. Existing `events.set(id, …)` pattern already does this for the return value; the streaming callback must also gate on "not previously seen" to avoid double-rendering.
- **Cancellation:** if the user switches tabs, the in-flight queries keep running (they're cheap and we want the cache warm), but the `rerender` callback should check `state.community.currentTab` and no-op when stale.
- **Persisted templates:** `loadPersistedPublishedTemplateEvents()` should be merged once at the start (so the user's own published designs show even with zero relay results) and again each `onProgress`.
- **Backwards compat:** call sites that don't pass `onEvent` see no behavior change. `_feedCache.events` exposed as an array via the getter keeps `buildRowsFromEvents` callers unchanged.

---

## Risks and tradeoffs

| Risk | Mitigation |
|---|---|
| Re-render flicker as events stream in | Debounce + key cards by `event.id` so the diff is additive, not a full wipe |
| User clicks a card that gets re-sorted under their cursor | Sort key is stable (`created_at` desc, then `id` desc); new cards append to the end of the current sort, not above |
| Faster cooldown means a genuinely dead relay gets retried more often | Worst case is a 30s WebSocket open attempt every ~30s per dead relay, which is cheap. Failure count still escalates the cooldown up to 5 min |
| Streaming exposes payload-parse errors more loudly | Parse errors stay quietly skipped inside `buildRowsFromEvents`; no UI change |
| Long-running WebSockets leak if relay never sends EOSE | Existing per-relay `timeoutMs` still applies and calls `finish()` even with streaming |

---

## Out of scope / future enhancements

- Single-shot retry on a different relay when the original relay drops mid-stream.
- Background "warm" subscription that stays open while the modal is closed, so opening Community is instant.
- Per-relay latency surface in the relay settings UI (so users can see which relays are slowing them down).
- Caching template events across reloads with a TTL (would need careful invalidation against kind-5 deletions).
