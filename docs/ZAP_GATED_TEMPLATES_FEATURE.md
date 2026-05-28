# Zap-Gated Premium Templates Feature Plan

> **⚠️ SUPERSEDED.** This draft is kept for historical context only.
> The current plan lives in `ZAP_GATED_PREMIUM_FEATURE.md`, which
> merges this spec with `ZAPS_NWC_FEATURE.md` and adds the mandatory
> creator/platform fee split that's the actual reason for shipping
> the feature. Read the merged doc; everything below is the earlier
> draft before that scope was set.

## Overview
Creators can mark a template as "premium" and set a minimum zap amount. Other users
must send a Lightning zap (via NWC) before the import button unlocks. This creates a
voluntary monetization layer for high-effort designs, with no payment processor, no
platform fee, and no backend — just Nostr zap receipts (kind 9735) checked on the client.

## Complexity
**Moderate** — Estimated 4–6 hours
Depends on ZAPS_NWC_FEATURE.md being implemented first. The zap payment flow reuses
that infrastructure; this feature adds the gating logic on top.

## Prerequisite
**ZAPS_NWC_FEATURE.md must be implemented first.** Zap-gated templates require the
full NWC + NIP-57 zap flow to already work.

---

## How It Works

1. Creator publishes a template tagged as premium with a minimum zap amount
2. In the community feed, premium templates show a ⚡ lock icon instead of Import
3. User clicks the lock → zap modal opens pre-filled with the minimum amount
4. After payment, app listens for a kind 9735 zap receipt on relays
5. Receipt is verified (correct amount, correct template event, correct sender)
6. Import button unlocks for this session; receipt cached in `localStorage`

---

## Nostr Event Tags for Premium Templates

Creator adds two extra tags when publishing a kind 30078 template event:

```json
{
  "tags": [
    ["zap-gate", "true"],
    ["zap-min", "100"]
  ]
}
```

| Tag | Value | Meaning |
|-----|-------|---------|
| `zap-gate` | `"true"` | This template requires a zap to unlock |
| `zap-min` | `"100"` | Minimum amount in sats |

These are custom tags — no NIP defines them, but Nostr's open tagging allows this.
Any client that doesn't understand them will simply ignore them.

---

## Key Components

### 1. Premium Tag Detection

```javascript
function isZapGated(event) {
  return event.tags?.some(t => t[0] === 'zap-gate' && t[1] === 'true');
}

function getZapMin(event) {
  const tag = event.tags?.find(t => t[0] === 'zap-min');
  return tag ? parseInt(tag[1], 10) : 21;
}
```

### 2. Local Unlock Cache

After a successful zap, cache the unlock so the user doesn't need to re-pay on every
page load:

```javascript
const UNLOCK_CACHE_KEY = 'casewrap-unlocked-templates';

function markUnlocked(eventId) {
  const cache = JSON.parse(localStorage.getItem(UNLOCK_CACHE_KEY) || '{}');
  cache[eventId] = { unlockedAt: Date.now() };
  localStorage.setItem(UNLOCK_CACHE_KEY, JSON.stringify(cache));
}

function isUnlockedLocally(eventId) {
  const cache = JSON.parse(localStorage.getItem(UNLOCK_CACHE_KEY) || '{}');
  return !!cache[eventId];
}
```

### 3. Zap Receipt Verification (kind 9735)

After payment, subscribe to kind 9735 events on relays and verify the receipt:

```javascript
async function waitForZapReceipt(templateEventId, senderPubkey, minAmountSats, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Zap receipt timeout')), timeoutMs);

    const sub = subscribeRelays(relays, {
      kinds: [9735],
      '#e': [templateEventId],
    }, (receiptEvent) => {
      const bolt11Tag = receiptEvent.tags.find(t => t[0] === 'bolt11');
      const pTag      = receiptEvent.tags.find(t => t[0] === 'P');   // sender pubkey

      // Verify sender matches (P tag in 9735 is the zapper's pubkey)
      if (pTag?.[1] !== senderPubkey) return;

      // Decode amount from bolt11 (or from 'amount' tag if present)
      const amountSats = decodeBolt11Amount(bolt11Tag?.[1]) / 1000;
      if (amountSats < minAmountSats) return;

      clearTimeout(timer);
      sub.close();
      resolve(receiptEvent);
    });
  });
}
```

Note: `decodeBolt11Amount` needs to parse the bolt11 invoice to extract the amount.
A minimal bolt11 parser (~2 KB) is available from the `light-bolt11-decoder` package
or can be inlined for just the amount field.

### 4. Full Unlock Flow

```javascript
async function unlockPremiumTemplate(event) {
  const minSats = getZapMin(event);

  // Show zap modal pre-filled with min amount, locked to minimum
  const zapResult = await showZapModal({
    recipientPubkey: event.pubkey,
    eventId:         event.id,
    minAmount:       minSats,
    message:         `Unlocking: ${templateTitle(event)}`,
  });

  if (!zapResult) return;  // user cancelled

  showStatus('Waiting for zap receipt…');

  try {
    await waitForZapReceipt(event.id, state.community.myPubkey, minSats);
    markUnlocked(event.id);
    showStatus('Template unlocked! ✅');
    renderCommunityDetail(event);  // re-render to show Import button
  } catch (err) {
    showStatus('Receipt not received — try again or contact the creator.');
  }
}
```

### 5. Creator UI — Marking a Template as Premium

Add a "Premium template" toggle to the Publish panel:

```
┌──────────────────────────────────────┐
│  Publish Template                     │
│                                       │
│  ☐ Premium template (zap to unlock)  │
│     Minimum: [100] sats               │
│                                       │
│  [Publish]                            │
└──────────────────────────────────────┘
```

When checked, the `zap-gate` and `zap-min` tags are added to the published event.

---

## UI Changes

### Feed Card — Premium Lock Icon
Replace "Import" button with a locked state for gated templates:

```
[⚡ Unlock (100 sats)]     ← not yet paid
[Import]                   ← after unlock
```

Show a small ⭐ or ⚡ badge on the card thumbnail to signal premium status.

### Template Detail Panel
- Show "Premium template — zap to unlock" banner for gated templates
- Show minimum amount prominently: "⚡ 100 sats to unlock"
- After unlock: green "Unlocked ✅" badge replaces the banner

### Own Templates
Creator sees their own premium templates as unlocked by default (no self-payment needed):
```javascript
function isUnlocked(event) {
  return !isZapGated(event)
    || isUnlockedLocally(event.id)
    || event.pubkey === state.community.myPubkey;
}
```

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Creator's wallet doesn't publish kind 9735 receipt | Timeout after 30s; show "receipt not detected" message; user can retry |
| User zaps less than minimum | Amount check in receipt verification rejects it |
| User clears localStorage | Must re-pay; no cross-device unlock sync |
| Creator updates (replaces) the template event | Old unlock cache entry becomes stale; detect via changed event ID |

---

## Performance Considerations
- `isUnlockedLocally()` is a synchronous localStorage read — runs on every card render
- Kind 9735 subscription is opened only after payment — no background polling
- Receipt subscription times out and closes after 30s regardless of outcome

---

## Limitations
- Unlock is per-device / per-browser (localStorage). No cross-device sync in Phase 1.
- Receipt verification is client-side trust: a determined user could fake a cache entry
  in localStorage. This is appropriate for a community platform — not for high-value goods.
- Creators must have a functional Lightning address (lud16) for zaps to work
- If the creator's wallet doesn't publish kind 9735 receipts, the unlock flow times out
  (some wallets are inconsistent about this)

---

## Future Enhancements
- Cross-device unlock sync: store verified receipt event ID in user's NIP-51 kind 10001
  (pin list) so it syncs across clients
- Time-limited access: `zap-expires` tag unlocks template for N days only
- Subscription model: zap a creator's profile once to unlock all their premium templates
- Revenue stats for creators: count kind 9735 receipts referencing their templates
- Escrow / refund: out of scope (no smart contracts on Lightning without additional infrastructure)

---

## Testing Checklist
- [ ] `isZapGated()` correctly identifies events with `zap-gate: true` tag
- [ ] `getZapMin()` returns correct sat amount from `zap-min` tag
- [ ] Premium feed cards show "⚡ Unlock" button instead of "Import"
- [ ] Zap modal opens pre-filled with minimum amount
- [ ] Amount field rejects values below the minimum
- [ ] After successful zap, app subscribes to kind 9735 on relays
- [ ] Valid receipt with correct sender and amount triggers unlock
- [ ] Receipt with wrong sender is ignored
- [ ] Receipt with insufficient amount is ignored
- [ ] `markUnlocked()` persists to localStorage and survives page reload
- [ ] Unlocked template shows Import button on reload (from cache)
- [ ] Creator's own premium templates are pre-unlocked (no self-payment)
- [ ] 30-second timeout shows helpful error message
- [ ] Publish panel "Premium template" toggle adds correct tags to event
- [ ] Non-premium templates are unaffected by this feature
