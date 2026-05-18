# Profile Pages (`/u/:npub`)

## Goals
Turn every Nostr author who appears in CaseWrap Studio into a **first-class, linkable profile page**:

- Pulls kind-0 metadata: avatar, banner, display name, NIP-05, about, website, lightning address (`lud16` / `lud06`).
- Shows their published designs (templates + disc designs + custom art) using the existing feed-card renderer.
- Sharable via a real URL: `https://casewrap.studio/u/<npub>` resolves on cold load, on reload, and on link share.
- Surface `lud16` / `lud06` metadata so a future zap feature has a hook to bind to.

### Product goals
1. Make discovery feel like browsing channels — clicking an author goes somewhere instead of a dead-end menu.
2. Use only Nostr-native metadata that's already flowing through the app.
3. Don't break the existing `/share/:id` route or any current entry points.
4. Stay snappy: never block first paint waiting for a profile fetch.

### Non-goals (v1)
- Editing your own profile from inside the app (still done in Alby / Damus / nostrudel etc.).
- Following counts / following-back UI (we have `state.community.myFollows` already, but rendering follow graphs visually is its own feature).
- Reply / DM affordances on the profile page.
- Lightning zaps / tips — fully out of scope here. See `docs/LIGHTNING_ZAPS_FEATURE.md` for the separate plan.
- Open Graph / Twitter card meta for `/u/:npub` (SPA + static host = no per-route OG without a build step; ship later).
- "Pinned design" / profile-level featured artwork.

---

## URL design

### Canonical form
```
/u/<npub>
```

- `<npub>` is the NIP-19 bech32 encoding of the pubkey (`npub1…`). Lowercase, ~63 chars.
- Optional trailing slash tolerated.
- Optional query string preserved (`?tab=designs`, future).

### Why `/u/` (and not `/profile/` or `/p/`)
- Short, conventional (mastodon, Twitter, etc.). `/p/` already implies "post" on some platforms; avoid the ambiguity.
- Easy to type, easy to share verbally.

### Hash fallback
For environments that can't honor the Vercel rewrite (local file open, some static hosts), also accept:
```
/#/u/<npub>
```
The existing `/share/:id` route already does this — same pattern.

### Accepted identifiers in the route
- `npub1…` (canonical, what we emit)
- 64-char hex pubkey (fallback for hand-typed links)
- `nprofile1…` (NIP-19 profile with relay hints — decoded the same way as in `loadSharedDesign`)

If the identifier is unparseable, render an error state in-modal: "Not a recognized Nostr identifier. Double-check the link or paste an `npub1…`."

### Vercel routing
Add to `vercel.json`:
```json
{
  "rewrites": [
    { "source": "/share/:id", "destination": "/" },
    { "source": "/share/:id/", "destination": "/" },
    { "source": "/u/:npub", "destination": "/" },
    { "source": "/u/:npub/", "destination": "/" }
  ]
}
```

Vercel returns `index.html` for any `/u/<...>` URL; the SPA reads `location.pathname` and dispatches to `openProfilePage`.

### URL ↔ UI sync (history API)
| Trigger | URL action |
|---|---|
| Click an author chip in the feed | `history.pushState({ profile: pubkey }, '', '/u/<npub>')` |
| Close the profile modal via "Back" or × | `history.back()` (lets the browser back stack handle it) |
| Open the modal directly via deep link | URL is already correct; just open the modal |
| `popstate` away from `/u/...` | Close the profile modal |
| `popstate` to a different `/u/...` | Swap the modal contents to the new pubkey |

This matches the existing `/share/:id` behavior — same `popstate` listener (line ~10327) gets extended.

---

## Data model

### What's already in state
- `state.community.profiles[pubkey]` — kind-0 content cache (used by feed cards).
- `_feedCache.profiles[pubkey]` — same shape, populated by feed loads.
- `state.community.myFollows[]` — viewer's hop-1 graph.
- `state.community.myMuted` — viewer's mute list.
- `_blockedAuthors` — local block set.

### New cache: `_profilePages`
A small in-memory map for profile-page-specific data so we don't re-fetch on every open:

```js
const _profilePages = new Map(); // pubkey -> { profile, designs, fetchedAt, status }
```

- `profile`: latest kind-0 content (merged from existing caches if present).
- `designs`: array of events authored by this pubkey, filtered to template/disc/customart kinds.
- `fetchedAt`: timestamp; TTL ~5 minutes — same scale as feed.
- `status`: `'loading' | 'ok' | 'empty' | 'error'` for the render layer.

### Lightning fields
From the kind-0 content JSON:
- `lud16`: `"alice@walletofsatoshi.com"` — display verbatim.
- `lud06`: `"LNURL1…"` — decode for display in v1 (just show "⚡ Lightning address available"); full LNURL-pay flow lands with zaps.
- Both can be present; prefer `lud16` if so.

### NIP-05 verification
Already partially handled in the codebase (`profile?.nip05` is read at line 3342). For the profile page:
- Display the raw `nip05` string under the display name.
- v1: trust-but-display — no on-demand verification fetch (NIP-05 spec says clients should verify via well-known, but it's optional and slow). Tag with a small "unverified" hint.
- v2 (deferrable): fire-and-forget GET to `/.well-known/nostr.json?name=…`; cache result in `_profilePages` entry.

---

## UX

### Layout (modal)
```
┌─────────────────────────────────────────────────────────────┐
│   ╔═══════════════════════════════════════════════════════╗  │  ← banner image
│   ║          (full-bleed kind-0 `banner` URL)             ║  │     16:5 aspect cap
│   ╚═══════════════════════════════════════════════════════╝  │
│                                                                │
│      ┌──────┐                                                 │
│      │      │   Display name                Follow  Block  …  │  ← actions row
│      │ AVA  │   alice@example.com (nip05)                     │
│      │      │   npub1abc…xyz  📋                              │
│      └──────┘                                                 │
│                                                                │
│   About text wraps here for several lines if present.         │
│   Website link, lightning address chip, etc.                  │
│                                                                │
│   ⚡ alice@walletofsatoshi.com  📋   [ Zap (coming soon) ]    │
│                                                                │
│   ─────────────────────────────────────────────────────────   │
│                                                                │
│   Designs (24)                              [filter ▾]        │
│                                                                │
│   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                 │
│   │ card   │ │ card   │ │ card   │ │ card   │   …             │
│   └────────┘ └────────┘ └────────┘ └────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

### Header components
- **Banner**: kind-0 `banner` URL, `object-fit: cover`. If missing, fall back to a gradient using the viewer's accent color so cards aren't ragged.
- **Avatar**: 96×96 circle, overlapping the banner bottom by ~30%. Fall back to `picture` → identicon (existing `shortPubkey`-based placeholder) → default.
- **Display name**: `display_name` || `name` || `shortPubkey(...)`.
- **NIP-05**: small line under name; muted color.
- **npub**: `npub1abc…xyz` (truncated middle), with a 📋 copy button.
- **About**: rendered as plain text (no HTML parsing in v1; mentions and links don't auto-link). Truncate to 4 lines with "Show more".
- **Website**: if `profile.website` is a valid http(s) URL, show as a chip-link.
- **Lightning chip**: if `lud16` present, shows the address with a ⚡ icon; click to copy. If only `lud06`, generic "⚡ Lightning enabled" chip. No payment action in v1 — that lives in a separate feature.

### Action row (chip buttons)
- **Follow / Unfollow** — only visible when signed in. Wires into existing `state.community.myFollows` + kind-3 publish. Optimistic update.
- **Block** — same `blockAuthor` + confirm dialog as feed cards.
- **Report** — opens existing `openReportModal(null, pubkey)` (we'll widen the existing report flow to accept a pubkey-only target; today it requires an event id).
- **Copy npub** — clipboard.
- **Open in nostr client** — opens `nostr:<npub>` URL scheme; lets the OS hand off to whatever client is registered.

(No zap button in v1 — handled in a separate feature.)

If the profile is **the viewer themselves** (`pubkey === state.community.myPubkey`), the action row collapses to just "Copy npub" + a note: "This is you."

### Designs grid
Reuses `buildFeedCard` and the existing card CSS. Sort: newest first.

Filters:
- All (default)
- Cover wrap
- Disc sheet
- Jewel insert
- Disc design
- Custom art

Filter dropdown reuses the existing category filter shape. Empty state: "No public designs yet."

### Loading sequence
1. Modal opens immediately; banner + avatar + "Loading…" appear.
2. If `_profilePages` has a fresh entry → render full state in one paint.
3. Else fire two parallel queries to current relay list (`state.community.relays`):
   - `{ kinds: [0], authors: [pubkey], limit: 1 }`
   - `{ kinds: [30078], authors: [pubkey], limit: 200 }` (the design kind)
4. Progressive paint: profile metadata fills as soon as kind-0 arrives; designs stream in as kind-30078 events arrive, deduped by `d`-tag (replaceable kind — keep latest).
5. Cache the result; expires after `PROFILE_TTL_MS = 5 * 60 * 1000`.

### Empty / error states
| Case | Render |
|---|---|
| pubkey valid, no kind-0 event found | Avatar = default; name = `shortPubkey(pk)`; about = blank. Designs query still runs. |
| pubkey valid, no designs published | Designs section shows "No public designs yet." |
| Identifier unparseable | Modal shows error message + Close button. |
| Relay query times out | Show what we have (cached or partial) + "Retry" affordance. |
| User is in `_blockedAuthors` | Show a banner: "You blocked this author. Unblock to see their designs." with an Unblock button. |

### Close behavior
- × button in top-right (matches welcome modal).
- ESC key closes (new — also fixes report/close-project modals while we're here, optional).
- Click on backdrop closes (matches existing modal pattern).
- Closing always calls `history.back()` if we pushed state; otherwise just hides the modal.

---

## Engineering plan

### New module-ish functions (all in the existing inline script)

```js
const PROFILE_TTL_MS = 5 * 60 * 1000;
const _profilePages = new Map();

function parseProfileIdFromLocation()         // mirrors parseShareIdFromLocation
function decodeProfileIdentifier(raw)         // npub / nprofile / hex → { pubkey, relays? }
async function openProfilePage(pubkeyOrId, opts = { pushState: true })
async function ensureProfilePageData(pubkey)  // fetch profile + designs, cache
function renderProfilePage(pubkey)            // DOM render against cache
function closeProfilePage()                   // hide modal, optionally history.back()
```

### Wiring points (existing code that needs to call these)
| Today | New behavior |
|---|---|
| Author chip click in `buildFeedCard` (currently no-op or opens profile in nostrudel) | `openProfilePage(row.e.pubkey)` |
| Author name in comment list | same |
| Author name in repost row | same |
| Author name on shared-design preview header | same |
| `init()` (line ~10321) — currently dispatches `parseShareIdFromLocation` only | also dispatch `parseProfileIdFromLocation` |
| `popstate` listener (line ~10327) | branch on which route the new URL matches |

### Markup (new modal)
```html
<div class="modal" id="profileModal" aria-hidden="true" style="display:none">
  <div class="modalInner" style="max-width:880px;padding:0;overflow:hidden">
    <button class="modalClose" id="profileCloseBtn" aria-label="Close">×</button>
    <div id="profileBanner" class="profileBanner"></div>
    <div class="profileHeader">
      <img id="profileAvatar" class="profileAvatar" alt="" />
      <div class="profileHeaderText">
        <h2 id="profileName"></h2>
        <p id="profileNip05" class="hint"></p>
        <p id="profileNpub" class="hint"></p>
      </div>
      <div id="profileActions" class="profileActions"></div>
    </div>
    <p id="profileAbout" class="profileAbout"></p>
    <div id="profileLnRow" class="profileLnRow" style="display:none"></div>
    <hr />
    <div class="profileDesignsHeader">
      <h3>Designs (<span id="profileDesignCount">0</span>)</h3>
      <select id="profileDesignFilter">…</select>
    </div>
    <div id="profileDesignsGrid" class="feedWall"></div>
    <p id="profileStatus" class="hint"></p>
  </div>
</div>
```

CSS additions are small — banner, avatar overlap, action chip row. Designs grid reuses `.feedWall`.

### Performance notes
- Profile fetch and designs fetch are parallel — first paint doesn't wait for either.
- `diffWallCards` (already used by the template browser) keeps the designs grid stable as events stream in.
- `_profilePages` is in-memory only — survives within a single page session, not across reloads. Good enough for v1; localStorage cache is a follow-up if we see usage justify it.

---

## Lightning surface (v1)

The profile page is **purely a metadata surface** for Lightning in v1 — no payment flow, no button, just display:

```js
const ln = profile.lud16 || decodeLud06(profile.lud06) || '';
if (ln) {
  // render "⚡ <ln>  📋" chip — clicking copies to clipboard
}
```

When zaps land separately (`docs/LIGHTNING_ZAPS_FEATURE.md`), the chip becomes an entry point. The profile project does not block on zaps and does not preview them.

The action row in v1 contains **only** Follow, Block, Report, Copy npub, Open in nostr client. No zap button.

---

## Phased delivery

### Phase A — Route + skeleton modal (no live data)
1. Add `vercel.json` rewrites for `/u/:npub`.
2. New `profileModal` markup + CSS.
3. `parseProfileIdFromLocation`, `decodeProfileIdentifier`, `openProfilePage` (no fetch yet — just opens modal with placeholder).
4. Wire `popstate` and `init()`.

**Acceptance**: visiting `/u/npub1…` cold-loads with the modal open showing "Loading…"; closing returns to `/`.

### Phase B — Profile metadata
1. `ensureProfilePageData` fetches kind-0; merges into existing caches.
2. `renderProfilePage` paints header, about, lightning chip, action row.
3. Author chips across the app (feed cards, comments, reposts, preview header) wired to `openProfilePage`.
4. Block / Report / Follow chips reuse existing handlers; widen `openReportModal` to accept pubkey-only.

**Acceptance**: clicking any author opens their profile; reload preserves it; back returns to where you came from.

### Phase C — Designs grid
1. Query kind-30078 by author; dedupe by `d`-tag.
2. Reuse `buildFeedCard` + `diffWallCards`.
3. Filter dropdown.
4. Empty state copy.

**Acceptance**: profile page shows the author's designs, latest first, with a working filter. Streams in without flashing.

### Phase D — Polish
1. ESC closes modal.
2. NIP-05 verification (async, fire-and-forget).
3. "Open in nostr client" chip.
4. Better banner fallback gradient.

---

## Risks and tradeoffs

| Risk | Mitigation |
|---|---|
| Long npubs make the URL ugly | Acceptable — `npub` is the conventional form; we could optionally also accept `nprofile` later for relay hints |
| Cold-loading `/u/:npub` flashes empty modal before kind-0 arrives | Render skeleton (gradient banner + initials avatar) immediately; swap in real data on arrival |
| Author has a banner URL that 404s or is huge | `loading="lazy"` + error fallback to gradient; we already do similar for design thumbnails |
| Designs query returns 100s of events for prolific authors | Cap initial render to first 60; "Show more" button paginates from cache |
| User-typed `/u/<garbage>` 404-like state | In-modal error message + close button (no native alert) |
| NIP-05 lookups would slow first paint if synchronous | Always async, never blocking; show unverified state first |
| Lightning address in metadata is malformed | Skip the chip entirely; don't crash; don't show a broken UI |
| Profile modal opens over a design preview — back-stack confusion | `pushState` per opening; `popstate` closes the topmost modal that matches the URL |
| Author has muted us / we've blocked them | Block check happens **before** modal opens, redirecting to unblock prompt |

---

## Open questions to resolve before build

1. **Should the profile modal replace or stack over the design preview?**
   Recommendation: **stack**. Closing the profile returns to the preview. Use `history.pushState` so back works naturally.
2. **Should we render LN address as a payment intent (`lightning:` URL) in v1?**
   Recommendation: **no**. v1 is copy-only; v2 introduces the proper zap flow. Avoid teaching users a half-flow.
3. **What about non-CaseWrap kind-0 fields like `bot: true` or `pronouns`?**
   Recommendation: ignore for v1. They're not standard. Pronouns could be added later under display name.
4. **Should we surface follower count / following count?**
   Recommendation: **no for v1**. Requires fetching the author's kind-3 (cheap) but rendering "followed by N" is its own UX puzzle (whose N?). Defer.
5. **Should we cache profile pages to localStorage so reloads are instant?**
   Recommendation: **no for v1**, yes for v2. In-memory is fine to validate the feature.

---

## Acceptance summary

- [ ] `/u/<npub>` resolves on cold load, reload, and back/forward.
- [ ] Clicking any author surface in the app routes to their profile.
- [ ] Profile shows banner, avatar, name, NIP-05, about, npub (copyable), lightning chip (when present).
- [ ] Profile shows the author's published designs in a filterable grid.
- [ ] Follow / Block / Report chips work and reflect current state.
- [ ] Back button leaves the profile and restores the previous view.
- [ ] No browser-native alerts on any error path.
- [ ] Existing `/share/:id` route is unaffected.
