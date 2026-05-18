# Tracked Zaps (NIP-57)

## Goals
Turn today's untracked LNURL-pay tips into **on-relay-recorded zaps** so we can sum them per design, per author, and per author's profile, and rank by them.

- A zap that fires today should generate a kind-9735 receipt on Nostr that *anyone* can later read.
- A design card should be able to display `⚡ N sats` and a count of zappers.
- The feed should be sortable by zap totals.
- Profile pages should show the total zaps that author has received (and, later, sent).

### Product goals
1. Make tipping discoverable. If a design has gotten 10k sats, that's a signal future viewers should see.
2. Preserve the existing plain-LNURL-pay flow as a fallback so tips never silently fail.
3. Stay Nostr-native: use NIP-57 directly, no analytics service, no central scoreboard.

### Non-goals (v1)
- Backfilling tips from the pre-tracking era. Those LN payments are gone from a Nostr perspective.
- Punishing or hiding designs with **few** zaps. We surface signal, not anti-signal.
- Showing **who** zapped (privacy + UI clutter); v1 only sums amounts. A "Zappers" list can come later.
- Anonymous zaps (`anon` tag in NIP-57). Adds branch complexity. Defer.
- WebLN auto-pay (would also need a NIP-57 path; deferrable).
- Zap leaderboards across all designs / authors. Once aggregation works, leaderboards are a small UI; not v1.

---

## Current state
- The existing tip flow (`openTipModal` → `fetchLnurlPayMetadata` → `fetchLnurlInvoice`) does **plain LNURL-pay**: fetches an amount-locked bolt11 and renders QR + copy. Nothing about that payment lands on Nostr.
- LN providers that support zaps publish a kind-9735 **iff** the LNURL-pay request carries a `nostr=<encoded-zap-request>` param. The plain flow omits it, so receipts are never created for our tips.

---

## NIP-57 in our terms

### What a zap request looks like (kind 9734)
```json
{
  "kind": 9734,
  "pubkey": "<tipper hex>",
  "created_at": 1700000000,
  "tags": [
    ["relays", "wss://relay.damus.io", "wss://nos.lol"],
    ["amount", "21000"],                       // millisats
    ["p", "<author hex>"],                     // recipient
    ["e", "<design event id>"],                // OPTIONAL — present for design zaps; omitted for pure profile zaps
    ["a", "30078:<author>:<d-tag>"]            // OPTIONAL — naddr coords for replaceable kinds
  ],
  "content": "Optional comment"
}
```

Sent to the LNURL-pay endpoint as:
```
GET <callback>?amount=<msats>&nostr=<URL-encoded JSON of signed event>
```

### What a zap receipt looks like (kind 9735)
Published by the LN service (or by Alby's zap.land etc.) after the invoice settles:
```json
{
  "kind": 9735,
  "pubkey": "<LN-service zap pubkey>",         // matches metadata.nostrPubkey
  "created_at": 1700000000,
  "tags": [
    ["bolt11", "lnbc..."],
    ["description", "<JSON string of original 9734>"],
    ["p", "<recipient>"],
    ["e", "<event id>"],
    ["a", "30078:..."]
  ],
  "content": ""
}
```

Amount is parsed from the `bolt11` tag (HRP `lnbc<amount><multiplier>` encoding) or from the `amount` tag in the embedded zap request.

### Metadata flag
The LNURL-pay metadata endpoint advertises support via:
```json
{
  "allowsNostr": true,
  "nostrPubkey": "<hex pubkey of the zap-publisher>"
}
```

Both must be present and non-empty to use the zap path. `nostrPubkey` is also what we use to **verify** that incoming kind-9735 receipts are legitimate (the receipt's `pubkey` must match).

---

## Phase 1 — Sign zap requests when supported

### Decision tree at "Get invoice" click time

```
LNURL metadata advertises allowsNostr + nostrPubkey?
├── No  → plain LNURL-pay (today's flow)
└── Yes
    Tipper has NIP-07 signer available?
    ├── No  → plain LNURL-pay (today's flow)
    └── Yes
        Sign kind-9734 with the right tags →
          ?nostr=<encoded> appended to callback →
          bolt11 returned + QR rendered as before
```

The user-visible UX is identical for the picker / invoice view. The only difference is a tiny `⚡ Tracked zap` badge next to the amount once we know the zap path is engaged (so a user paying via QR/copy knows their tip will count).

### Tag rules per entry point

| Entry point | Tags on the 9734 |
|---|---|
| **Profile page Tip chip** | `p`=author, `relays`, `amount`. No `e`, no `a`. Pure profile zap. |
| **Feed card Tip button** | `p`=author, `e`=design event id, `a`=`<kind>:<author>:<d-tag>` if d-tag exists, `relays`, `amount`. |
| **Design preview Tip button** | Same as feed card. |

This lets us aggregate by author OR by design just from filters.

### Plumbing changes
- `openTipModal` accepts an optional `targetEvent: { id, kind, dTag, authorPubkey }`. Profile-page openings omit it; feed-card / preview openings pass it.
- New helper `buildZapRequestEvent({ recipient, amount, eventId, kind, dTag, relays, comment })` returns the unsigned 9734.
- New helper `tryZapPath(metadata, target, amount)` returns `{ encodedZapRequest, zapPubkey }` or `null` if any precondition fails.
- `fetchLnurlInvoice` gains an optional `nostr` param; when present, appends `&nostr=<urlencoded>` to the callback.
- `getTipInvoiceFlow` calls `tryZapPath` first; on success, signs and includes; on failure, falls through to plain.

### What never changes
- The bolt11 we hand the user is identical in structure either way.
- Fallback paths for malformed addresses, CORS errors, min/max range remain exactly as today.
- No new modal states. Just a tiny optional badge.

### Out of scope (still) in Phase 1
- Reading 9735s. That's Phase 2.
- Showing the tipper's pubkey to the recipient. NIP-57 receipts already do this naturally if the recipient queries — we don't add UI here.
- Encrypted zaps / private zaps.

### Acceptance
- A signed-in user tipping a zap-supporting author (e.g., Wallet of Satoshi) sees the same invoice/QR flow as before — but minutes later a kind-9735 receipt with our zap request inside appears on the relays.
- A signed-out user tipping the same author still gets a working bolt11 — the LN provider returns one even without `nostr=`, just no receipt.
- A signed-in user tipping a non-zap LN endpoint (`allowsNostr` absent or false) silently falls back — no error, no extra UI noise.

---

## Phase 2 — Aggregate & display

### Fetch strategy
- When the community feed renders, batch-query receipts for visible designs:
  `{ kinds: [9735], '#e': [eventId1, eventId2, …], limit: 500 }`
- For author totals (profile page), query:
  `{ kinds: [9735], '#p': [authorPubkey], limit: 500 }`
- Stream results into a `_zapCache` Map keyed by event id (and a separate one keyed by author for profile totals).
- Validate each receipt:
  - Parse the embedded `description` JSON → must be a kind-9734.
  - Receipt's `pubkey` must equal the recipient's metadata `nostrPubkey` if we know it (we may not, so this check is opportunistic, not required for v1).
  - Sum `amount` from the zap request tag (or parse from `bolt11` as a fallback).

### Display
- **Feed card**: small chip `⚡ 5.2k` in the actions row when total > 0.
- **Profile page**: under the avatar, optional line `⚡ 84k sats received`.
- **Design preview**: same chip in the preview meta line.

Counts use abbreviated formatting (`1.2k`, `21k`, `1.4M`).

### Sort
- Feed sort dropdown gets a new option: **Most zapped**. Sums received within a sliding window (default: forever; could later add 7-day / 30-day).
- Ranking is purely client-side from the visible window of receipts. No global leaderboard.

### Caching
- Same TTL as feed reactions (~2 min). Cheap to refetch.
- Soft-mod cache and zap cache live independently. Both keyed by event id.

### Acceptance
- A design that has received zaps shows the total on its card and in its preview.
- Sorting the feed by "Most zapped" reorders cards correctly within the loaded set.
- Profile pages show the author's lifetime zap-received total.

---

## Risks and tradeoffs

| Risk | Mitigation |
|---|---|
| Tipper not signed in → zap untracked | Show a one-line hint in the tip modal: "Sign in with Nostr to make this tip count toward this design's totals." Optional. |
| LN provider doesn't support zaps | Silent fallback. Don't surface failure as user-facing error — the tip still works. |
| Wallet publishes the 9735 to relays we don't query | Fetch from a broad relay set (use `relays` tag from the receipt's embedded zap request, plus the viewer's relays). |
| Forged zap receipts (someone publishes a fake 9735) | v1 trusts what we see. v2 adds the `pubkey === metadata.nostrPubkey` check by caching service pubkeys per recipient. |
| Sum inflated by duplicate receipts | Dedupe receipts by `id` (event id), not by zap request. |
| bolt11 amount mismatch with zap request amount | Trust the bolt11 amount (it's what actually got paid); zap-request amount is the *intent*. |
| Querying receipts for 50 designs at once → big subscription | Use existing `queryRelays` streaming with `onEvent`; batch in groups of 20 if relays balk. |
| Race between Phase 1 sign + endpoint response | Standard try/catch; on signing failure, fall back to plain flow. |

---

## Phased delivery (concrete)

### Phase 1 — Sign zap requests (this PR)
1. Add `buildZapRequestEvent`, `tryZapPath`, `signNostrEvent` reuse.
2. Extend `openTipModal` to accept `{ targetEvent }`.
3. Thread `targetEvent` through feed-card and preview Tip buttons.
4. Update `getTipInvoiceFlow` to attempt zap path; fall back on any failure.
5. Tiny `⚡ Tracked zap` badge on the invoice view when zap path engaged.

**Ship gate**: a tip from a signed-in user to a zap-enabled provider produces a kind-9735 receipt on the recipient's relays within a minute.

### Phase 2 — Aggregate and display
1. `_zapCache` keyed by event id and by author.
2. Fetch receipts during community feed loads and on profile page open.
3. Parse + validate + sum.
4. Render zap totals on feed cards / preview / profile.
5. Add "Most zapped" sort option.

**Ship gate**: zap totals appear on cards within a session; sort order changes when the new sort is selected.

---

## Open questions

1. **Should we publish the kind-9734 ourselves before sending to LNURL-pay?**
   NIP-57 says clients MAY publish it themselves; not required. Recommendation: **no** — the receipt's `description` tag already proves it existed, and double-publishing pollutes relays.
2. **Use a fixed default-zap amount (e.g., 21 sats)?**
   Not v1. Picker already handles this. Default zap amounts can land later as a profile preference.
3. **Should we surface "you zapped this" on cards (visible only to the zapper)?**
   Nice but requires querying receipts whose embedded request has `pubkey === me`. Cheap; could be a small v2 add.
4. **Verify receipt service pubkey strictly?**
   Recommend v1 = loose verification (any kind-9735 with a parseable embedded request counts). v2 = strict (cache `metadata.nostrPubkey` per recipient and require receipt.pubkey to match).
5. **Should the picker grow a "comment" box for zap-supporting endpoints?**
   Many endpoints accept comments via `commentAllowed`. v1 = no, to keep UI quiet. v2 = optional.

---

## Acceptance summary

### Phase 1
- [ ] Profile-page tip flow signs and sends a zap request when supported; plain LNURL-pay otherwise.
- [ ] Feed-card tip flow does the same with `e` and `a` tags pointing at the design.
- [ ] Design-preview tip flow same.
- [ ] All three entry points fall back silently for non-zap endpoints and signed-out users.
- [ ] A `⚡ Tracked zap` badge appears in the invoice view when the zap path engaged.

### Phase 2
- [ ] Feed cards show `⚡ <total>` when receipts exist.
- [ ] Profile pages show author totals.
- [ ] Design preview shows the same chip.
- [ ] "Most zapped" sort option works.
