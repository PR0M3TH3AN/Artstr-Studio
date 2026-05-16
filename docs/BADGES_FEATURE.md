# NIP-58 Badges Feature Plan

## Overview
Award and display Nostr badges on creator profiles in the community feed. Badges like
"Top Creator", "100 Zaps Received", and "Verified Designer" appear on template cards and
profile views. Because badges are a Nostr standard (NIP-58), they automatically sync with
and appear in other Nostr clients (Damus, Primal, Snort) — no proprietary profile system needed.

## Complexity
**Low–Moderate** — Estimated 3–5 hours
- Badge display (reading + rendering): ~2 hours
- Badge awarding (publishing badge events): ~2 hours
- Admin/auto-award logic: ~1 hour

---

## NIP-58 Primer

Three event kinds make up the badge system:

| Kind | Name | Purpose |
|------|------|---------|
| 30009 | Badge Definition | Defines a badge: name, description, image (addressable, created by issuer) |
| 8 | Badge Award | Issues a badge to specific pubkeys |
| 30008 | Profile Badges | User's curated list of badges they want displayed on their profile |

### Badge Definition (kind 30009)
```json
{
  "kind": 30009,
  "pubkey": "<app-issuer-pubkey>",
  "tags": [
    ["d", "top-creator"],
    ["name", "Top Creator"],
    ["description", "Awarded to creators with 10+ published templates"],
    ["image", "https://casewrap.app/badges/top-creator.png", "512x512"],
    ["thumb", "https://casewrap.app/badges/top-creator-64.png", "64x64"]
  ]
}
```

### Badge Award (kind 8)
```json
{
  "kind": 8,
  "pubkey": "<app-issuer-pubkey>",
  "tags": [
    ["a", "30009:<issuer-pubkey>:top-creator"],
    ["p", "<recipient-pubkey>", "<relay-hint>"]
  ]
}
```

### Profile Badges (kind 30008)
Users opt-in to displaying specific badges. The app reads this to know which badges
to show on a profile:
```json
{
  "kind": 30008,
  "pubkey": "<user-pubkey>",
  "tags": [
    ["d", "profile_badges"],
    ["a", "30009:<issuer-pubkey>:top-creator"],
    ["e", "<award-event-id>"]
  ]
}
```

---

## Badge Catalog (Proposed)

| Badge ID | Name | Criteria | Auto-awarded? |
|----------|------|----------|---------------|
| `first-publish` | First Publish | Published first template | Yes |
| `top-creator` | Top Creator | 10+ published templates | Yes |
| `prolific` | Prolific | 50+ published templates | Yes |
| `zap-magnet` | Zap Magnet | Received 100+ zaps | Yes (via kind 9735 scan) |
| `early-adopter` | Early Adopter | Joined before a cutoff date | Manual |
| `verified-designer` | Verified Designer | Manually awarded by app admins | Manual |

App issues badges from a dedicated CaseWrap app keypair (not tied to any user's NIP-07 key).
The app keypair's pubkey and private key are stored in the app's admin config.

---

## Key Components

### 1. Badge Display on Template Cards and Profile Views

Fetch the creator's kind 30008 profile badges event, cross-reference with known badge
definitions, and render badge thumbnails:

```javascript
async function fetchProfileBadges(pubkey) {
  // Query relays for kind 30008 authored by pubkey
  // Returns array of badge definition a-tags the user has accepted
}

async function resolveDisplayBadges(pubkey) {
  const profileBadges = await fetchProfileBadges(pubkey);
  // Filter to only CaseWrap-issued badges (by app issuer pubkey)
  // Return array of { id, name, thumbUrl } for known badges
}
```

Render as small badge icons (32×32) in the author row of template cards:
```
alice@getalby.com  🏆 🎨 ⚡  · 2 days ago
```

Hovering a badge shows a tooltip with the badge name and description.

### 2. Badge Cache
Badge definitions rarely change — cache fetched definitions in `sessionStorage`:

```javascript
const BADGE_CACHE_KEY = 'casewrap-badge-cache';

function cacheBadgeDefinition(def) { /* store in sessionStorage */ }
function getCachedBadge(dTag)      { /* retrieve from sessionStorage */ }
```

### 3. Auto-Award Logic (client-side trigger)
When a user publishes a template, check if they've crossed a badge threshold and award
automatically. Award logic runs after publish:

```javascript
async function checkAndAwardBadges(pubkey) {
  const count = await fetchPublishedTemplateCount(pubkey);
  if (count === 1)  await awardBadge(pubkey, 'first-publish');
  if (count === 10) await awardBadge(pubkey, 'top-creator');
  if (count === 50) await awardBadge(pubkey, 'prolific');
}
```

Note: Auto-awarding requires the app's issuer private key to sign the kind 8 event.
For a fully static app this means either:
- Keeping the issuer key client-side (acceptable for low-stakes community badges), or
- Using a small serverless function as the award endpoint (one POST, no database)

### 4. Badge Award Function

```javascript
async function awardBadge(recipientPubkey, badgeId) {
  const aTag = `30009:${APP_ISSUER_PUBKEY}:${badgeId}`;
  const event = {
    kind: 8,
    pubkey: APP_ISSUER_PUBKEY,
    tags: [
      ['a', aTag],
      ['p', recipientPubkey],
    ],
    content: '',
    created_at: Math.floor(Date.now() / 1000),
  };
  // Sign with APP_ISSUER_PRIVKEY (noble-secp256k1), publish to relays
  await publishToRelays(signEvent(event, APP_ISSUER_PRIVKEY));
}
```

### 5. Badge Accept UI (Optional)
After receiving a badge, the user can add it to their kind 30008 profile badges so it
shows across all Nostr clients. Show a prompt: "You earned Top Creator! Add it to your profile?"
Clicking yes publishes/updates their kind 30008 event via NIP-07.

---

## UI Changes
- Author row on template feed cards: small badge icon row (max 3, +N overflow)
- Template detail panel: full badge list with names and descriptions on hover
- Profile section in settings: "Your Badges" list showing earned + pending badges
- Publish success toast: "🏆 You earned a new badge!" when a threshold is crossed

---

## Performance Considerations
- Fetch kind 30008 lazily — only when a card is hovered or detail panel opens
- Cache badge definitions in `sessionStorage` — definitions rarely change
- Batch profile badge fetches with other kind 0 / kind 3 queries at feed load time
- Show badges from cache immediately; refresh in background

---

## Limitations
- Badge display depends on the creator having accepted badges into their kind 30008 event
  (users who never do this won't show badges even if awarded)
- Auto-award requires the app's issuer key to be available; keep it budget-appropriate
  (not a treasury key) since it lives client-side
- No revocation mechanism in NIP-58 — badges cannot be taken back once awarded

---

## Future Enhancements
- User-to-user badge awards ("Community Pick" badge that any user can nominate for)
- Badge showcase page listing all CaseWrap badges and current recipients
- Integration with zap receipts to auto-award "Zap Magnet" by scanning kind 9735 events

---

## Testing Checklist
- [ ] Badge thumbnails render in author row on template cards
- [ ] Hovering badge shows tooltip with name and description
- [ ] Badge cache prevents redundant relay queries on repeated views
- [ ] `first-publish` badge is awarded on first successful template publish
- [ ] `top-creator` badge is awarded when published count reaches 10
- [ ] Kind 8 award event contains correct `a` and `p` tags
- [ ] "Add to profile" prompt publishes/updates kind 30008 via NIP-07
- [ ] Badge display respects user's kind 30008 accepted list (not all awarded badges shown)
- [ ] No badge icons appear for creators with no accepted badges
- [ ] Settings "Your Badges" panel shows earned badges correctly
