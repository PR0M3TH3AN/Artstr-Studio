# Trust & Block Feature Plan

## Overview
Add web-of-trust filtering and user block lists to the community template feed so users can
hide content from bad actors and prioritize templates from trusted sources. Because the app
already uses Nostr for identity and publishing, this feature can be built entirely on existing
Nostr protocol standards (NIPs) with no backend required.

## Complexity
**Moderate–High** — Estimated 4–8 hours to implement (phased; Phase 1 alone is ~2 hours)

---

## Background: Nostr Primitives Available

| NIP | Kind | Purpose |
|-----|------|---------|
| NIP-02 | 3 | Contact / follow list — the source of truth for the social graph |
| NIP-51 | 10000 | Mute list — pubkeys, event IDs, keywords to suppress |
| NIP-56 | 1984 | Content report — flag a pubkey or event as spam/NSFW/illegal |

These events are already signed with the user's key (via NIP-07 extension) and stored on
Nostr relays, so the block/mute list automatically syncs across any Nostr-compatible client
the user signs in to.

---

## Phased Plan

### Phase 1 — Local Block List (no login required)

The simplest layer: any visitor can block a pubkey locally without signing in.

#### Storage
- `localStorage` key: `casewrap-blocked-pubkeys` → JSON array of hex pubkeys
- Survives page refresh; cleared only if the user explicitly unblocks or clears browser data

#### UI
- Add a "Block this author" option to each template card menu (⋮ or right-click)
- Blocked templates are hidden from the feed immediately (no reload needed)
- Settings panel shows blocked pubkey list with per-entry "Unblock" buttons
- Blocked count shown as a subtle badge: "3 authors hidden"

#### Core Functions
```javascript
function blockPubkey(pubkey)
  // Add to localStorage block list, re-filter visible templates

function unblockPubkey(pubkey)
  // Remove from localStorage block list, re-filter

function isBlocked(pubkey)
  // Returns true if pubkey is in the local block list

function applyBlockFilter(templates)
  // Filter template array, removing any whose author is blocked
```

---

### Phase 2 — Nostr Mute List Sync (requires NIP-07 login)

Upgrade the local block list to a Nostr-native mute list (NIP-51 kind 10000) so it persists
across devices and syncs with other Nostr apps (Damus, Primal, Snort, etc.).

#### On Login
1. Fetch the user's existing kind 10000 mute list from relays
2. Merge with any locally blocked pubkeys (union, no duplicates)
3. Save merged list back to the relay (signed via `window.nostr.signEvent`)

#### On Block
1. Add pubkey to the in-memory mute list
2. Publish updated kind 10000 event to relays
3. Update `localStorage` as a local cache

#### Event Schema
```json
{
  "kind": 10000,
  "tags": [
    ["p", "<hex-pubkey>"],
    ["p", "<hex-pubkey>"]
  ],
  "content": ""
}
```

#### Core Functions
```javascript
async function fetchMuteList(pubkey)
  // Query relays for kind 10000 authored by pubkey, return p-tag array

async function publishMuteList(mutedPubkeys)
  // Sign and publish updated kind 10000 event

async function syncMuteListOnLogin()
  // Merge relay mute list with localStorage block list on sign-in
```

---

### Phase 3 — Web-of-Trust Feed Filter (requires NIP-07 login)

Only show templates from pubkeys within your social graph — the most effective spam defense.

#### How It Works
1. Fetch the signed-in user's follow list (NIP-02 kind 3) → set of followed pubkeys ("hop 1")
2. Optionally fetch follows-of-follows → "hop 2" (wider but noisier)
3. In the community feed, templates are ranked/filtered by trust tier:

| Tier | Source | Display |
|------|--------|---------|
| Trusted | Pubkey is in your follow list (hop 1) | Full display, shown first |
| Extended | Pubkey is in follows-of-follows (hop 2) | Shown normally |
| Unknown | No social graph overlap | Shown with a "low trust" badge |
| Blocked | In mute list | Hidden entirely |

#### Trust Score (optional enhancement)
For each template author, count how many of your follows also follow them.
This score (0–N) can be shown as a small indicator on the template card.

```javascript
async function fetchFollowList(pubkey)
  // Query relays for kind 3, return array of followed pubkeys

function buildTrustSet(myFollows, followsOfFollows)
  // Returns { hop1: Set<pubkey>, hop2: Set<pubkey> }

function getTrustTier(authorPubkey, trustSet)
  // Returns 'trusted' | 'extended' | 'unknown' | 'blocked'

function sortByTrust(templates, trustSet)
  // Put hop-1 templates first, then hop-2, then unknown
```

#### Caching
- Follow lists are large — cache in `sessionStorage` keyed by pubkey
- Re-fetch at most once per session to avoid relay hammering
- Show a loading indicator while the graph is being fetched

#### UI Controls
- Toggle in settings: "Show only trusted authors" (default: off — non-breaking)
- Toggle: "Show low-trust badge on unknown authors" (default: on when logged in)
- Trust tier shown as a subtle icon on template cards (★ trusted, ~ extended, ? unknown)

---

### Phase 4 — Content Reporting (NIP-56)

Allow users to flag templates as spam, NSFW, or abusive so relay operators can act.

#### Report Flow
1. User clicks "Report" in the template card menu
2. Modal asks for report type: `spam` | `nudity` | `illegal` | `impersonation`
3. App publishes a NIP-56 kind 1984 event referencing the template event ID and author pubkey

#### Event Schema
```json
{
  "kind": 1984,
  "tags": [
    ["e", "<template-event-id>", "spam"],
    ["p", "<author-pubkey>"]
  ],
  "content": "Optional description"
}
```

#### Notes
- Reports are published to relays but have no local effect by themselves
- Optionally: auto-hide locally after reporting (user already chose to flag it)
- Reports help relay operators and moderation tools (like Spam Scout) build block lists

```javascript
async function reportTemplate(eventId, authorPubkey, reason, description)
  // Sign and publish NIP-56 kind 1984 event
```

---

## Integration Points

All four phases hook into the community feed render loop. The minimal change is:

```javascript
// In the function that renders community template cards:
function renderCommunityFeed(templates) {
  const filtered = applyBlockFilter(templates);          // Phase 1
  const sorted   = sortByTrust(filtered, trustSet);      // Phase 3
  filtered.forEach(t => renderCard(t, getTrustTier(t.author, trustSet)));
}
```

Block/report actions live in the template card's action menu alongside existing
"Copy link" / "Import" options.

---

## Performance Considerations
- Follow list fetches are async and cached — they don't block the initial feed render
- Local block filter runs synchronously on the already-fetched template array (~1ms)
- Follows-of-follows (hop 2) can be 10,000+ pubkeys — use a `Set` for O(1) lookups
- Only fetch hop-2 if the user enables the extended trust option (off by default)
- Relay queries use `REQ` filters with `kinds: [3]` — single-use subscriptions, close after `EOSE`

---

## Limitations
- Web-of-trust only works when the user is signed in via NIP-07
- Users with small follow lists get little benefit from WoT filtering
- Relay queries for follows-of-follows can be slow on large social graphs (~5–15s)
- NIP-56 reports are advisory only — relay operators decide whether to act
- No cross-relay mute list deduplication (if user uses multiple relay sets)

---

## Future Enhancements
- Subscribe to community-maintained block lists (NIP-51 kind 30000 "follow sets" used as shared deny lists)
- Import block list from Nostr clients (Damus, Primal) via relay sync
- NSFW blur overlay instead of full hide (user can click to reveal)
- Relay-level WoT filtering: connect to WoT-curated relays (e.g. relay.nostr.band WoT endpoint) for pre-filtered feeds
- Keyword/hashtag muting (NIP-51 supports `["word", "badterm"]` tags in kind 10000)

---

## Implementation Order (recommended)

1. **Phase 1** — Local block list. Zero dependencies, works for logged-out users, shippable alone.
2. **Phase 3** — WoT feed sort/filter. High value for logged-in users; Phase 2 not required first.
3. **Phase 2** — Nostr mute list sync. Upgrades Phase 1 to be cross-device.
4. **Phase 4** — Reporting. Lowest urgency; depends on relay operator buy-in.

---

## Testing Checklist
- [ ] Blocking a pubkey hides all their templates immediately
- [ ] Unblocking restores their templates
- [ ] Block list persists across page refresh (localStorage)
- [ ] Blocked pubkeys are excluded from all feed views (not just main)
- [ ] Mute list sync fetches existing kind 10000 on login (Phase 2)
- [ ] Publishing updated mute list signs correctly via NIP-07 (Phase 2)
- [ ] Follow list fetch correctly identifies hop-1 pubkeys (Phase 3)
- [ ] Trust tier badges display correctly on template cards (Phase 3)
- [ ] "Show only trusted" toggle hides unknown-tier templates (Phase 3)
- [ ] Report publishes a valid kind 1984 event to relays (Phase 4)
- [ ] No performance regression on feed load (follow list fetched async)
- [ ] Logged-out users see Phase 1 block UI only (no WoT controls)
