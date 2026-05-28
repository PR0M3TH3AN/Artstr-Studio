# Zap-Gated Premium Templates (with NWC + Platform Split) — Feature Plan

> **Status:** planned, no code yet. This document supersedes the original
> `ZAP_GATED_TEMPLATES_FEATURE.md` and `ZAPS_NWC_FEATURE.md` — both of
> those described pieces of this feature in isolation. The two have
> been merged here because, in this product, they're a single arc:
> the platform-fee split is the whole reason for shipping zap-gated
> templates, and NWC is what makes the split tolerable as a UX.

---

## Goals

### Product goal
A creator can mark a template as "premium" with a minimum sat amount.
Other users see a ⚡ lock on the feed card instead of Import. Tapping
the lock pays the creator and the platform in a single user gesture,
and unlocks the import button (cached locally so they don't pay again).

### Why the split is mandatory
The platform fee is the entire revenue model for this feature. Every
unlock MUST split: creator gets `(100% − fee)`, platform gets `fee%`.
There is no creator-only fallback path.

### Non-goals (v1)
- **Non-Artstr clients.** Gating is client-side; another client could
  in principle implement the `zap-gate` tag without the platform
  split. The revenue model relies on Artstr being the primary client
  for the audience that publishes premium templates.
- **Refunds.** If the platform invoice fails after the creator
  invoice settles, we surface the error and ask the user to retry
  the platform leg — no auto-refund.
- **Tipping splits.** The existing LNURL tip flow still goes 100% to
  the creator. Splits are scoped to zap-gated unlocks only.
- **Non-NWC payment paths.** v1 requires NWC to be configured. No
  bolt11 QR fallback (would re-introduce the two-invoice clunky UX
  this whole arc is meant to avoid).

---

## Phased delivery

The phases build on each other. Each has an explicit ship gate so
work can be paused between phases for review.

### Phase 0 — Crypto bundle  *(~2–3h)*

The existing codebase signs/encrypts only via `window.nostr.*` (the
user's NIP-07 extension). NWC requires signing kind-23194 events with
the **NWC secret** (a different key, embedded in the wallet URI),
which the extension can't do. So we need a bundled cryptography
implementation.

**Deliverables**
- Inline a minimal `@noble/secp256k1` + `@noble/hashes` subset
  (schnorr sign/verify, ECDH for NIP-04 shared-secret).
- Inline a NIP-04 helper using `crypto.subtle` AES-CBC + the noble
  ECDH output.
- Verify against the canonical NIP-04 test vectors in code comments.

**Ship gate**
Round-trip encrypt/decrypt a known plaintext using the test-vector
keys → produces the test-vector ciphertext.

---

### Phase 1 — NWC connection  *(~5–7h)*

**Protocol summary (NIP-47)**
The wallet exposes a connection URI:
```
nostr+walletconnect://<wallet-service-pubkey>?relay=<wss-url>&secret=<hex>
```
- `wallet-service-pubkey` — the wallet's NIP-47 service pubkey.
- `relay` — a dedicated relay both ends listen on.
- `secret` — a 32-byte hex privkey that the client uses to sign
  requests (this is NOT the user's identity key).

**Request lifecycle**
1. Build a kind-23194 event:
   `content` = NIP-04(`{"method":"pay_invoice","params":{"invoice":"..."}}`)
   encrypted to the wallet service pubkey, with the NWC secret as
   sender; tag `["p", walletServicePubkey]`.
2. Sign with the NWC secret (schnorr).
3. Publish to the NWC relay.
4. Subscribe `{ kinds: [23195], '#p': [<client pubkey>], '#e': [<request id>] }`.
5. Decrypt the response with the NWC secret; parse JSON. Possible
   results: `{ "result_type": "pay_invoice", "result": { "preimage": "..." } }`
   or `{ "error": { "code": "...", "message": "..." } }`.

**Deliverables**
- `parseNwcUri(uri)` → `{ servicePubkey, relay, secret }` or null.
- `nwcConnect(uri)` — store creds, open WS, send a `get_info` ping to
  verify the wallet responds.
- `nwcPayInvoice(bolt11, { timeoutMs, hintMsats })` → resolves to
  `{ preimage }` or rejects with `{ code, message }`.
- Credentials live in `localStorage` under
  `casewrap-nwc-connection` (single-record; new paste replaces old).
  Trade-off acknowledged in the threat-model section.

**UX (the Settings panel)**
A new "Wallet" section in the Community settings, two-state:

*Not connected:*
```
┌────────────────────────────────────────────┐
│  Lightning wallet — not connected           │
│                                              │
│  To unlock premium templates, connect a      │
│  NIP-47 wallet. Recommended: CoinOS         │
│  (free, web-based, no install).             │
│                                              │
│  [Set up with CoinOS →]                     │
│  [ Paste connection string ▾ ]              │
└────────────────────────────────────────────┘
```

The CoinOS button opens a short modal:
> **1.** Visit [coinos.io](https://coinos.io) and sign up.
> **2.** Open *Settings → Wallet Connect*.
> **3.** Copy the connection string (`nostr+walletconnect://…`).
> **4.** Paste below.
> *[input]* *[Connect]*

The "Paste connection string" disclosure expands to the same input
with no per-wallet instructions — works for Alby Hub, Mutiny,
Phoenix, Cashu.me, Boltz, etc.

*Connected:*
```
┌────────────────────────────────────────────┐
│  ⚡ Connected to <walletDomain or short>    │
│  Last test: <time>  [Test] [Disconnect]    │
└────────────────────────────────────────────┘
```

**Ship gate**
With CoinOS-issued URI: `get_info` returns the wallet's alias.
`pay_invoice` against a 10-sat bolt11 from a different lud16 succeeds
and returns a preimage.

---

### Phase 2 — Platform-fee plumbing  *(~2–3h)*

**Constants** (single place to tune later)
```js
const PLATFORM_NPUB = 'npub15jnttpymeytm80hatjqcvhhqhzrhx6gxp8pq0wn93rhnu8s9h9dsha32lx';
const PLATFORM_FEE_BPS = 3000;  // 30%. Adjust to lower the cut.
```

**Deliverables**
- `PLATFORM_PUBKEY_HEX` derived once via the existing bech32 helper.
- On first need (lazy, then cached for the session): query relays for
  the platform npub's kind-0 → extract `lud16` → cache.
- `splitZapAmount(totalSats, bps)` →
  `{ creatorSats, platformSats }`. Round so the sum equals total;
  on rounding ambiguity, platform takes the floor and creator the
  remainder (creator gets the extra millisat-equivalent — slightly
  creator-favouring, which feels right).
- `payZapSplit({ creatorPubkey, creatorMetadata, eventId, totalSats })`
  → orchestrates two zap requests in sequence:
  1. Build + sign kind-9734 to creator for `creatorSats`.
  2. Fetch creator's bolt11 via existing `fetchLnurlInvoice`.
  3. Pay creator via `nwcPayInvoice`.
  4. Build + sign kind-9734 to platform for `platformSats`.
  5. Fetch platform's bolt11.
  6. Pay platform via `nwcPayInvoice`.
  7. Await both kind-9735 receipts on relays
     (reuse existing `startTipPaymentWatch` pattern).
  Returns `{ creatorReceipt, platformReceipt }` or throws with the
  failure stage so the UI can show a precise error.

**Why creator first, platform second:** if the creator leg succeeds
and the platform leg fails, the creator at least got paid; we surface
"Retry platform share" to the user. The reverse ordering would mean
a half-failed unlock paid the platform but not the creator, which is
the worst possible state.

**Ship gate**
Unit-test the split math on edge cases (1 sat → 0/1; 100 sats @ 3000
bps → 70/30; 101 @ 3000 → 71/30). Then a live dual-zap end to end
to two different lud16s and observe both receipts on relays.

---

### Phase 3 — Zap-gated templates  *(~4–6h)*

**Data model**
Add two tags to kind-30078 publish events:
- `["zap-gate", "true"]`
- `["zap-min", "<sats>"]` — minimum (and total) unlock amount.

Existing publish code reads `state.visibility`, `state.meta.*`, etc.
We add `state.publish.zapGate` (boolean) and `state.publish.zapMin`
(sats) alongside.

**Publish UI** — additions to the existing publish-confirm modal:
- Checkbox "Premium template — viewers must zap to unlock"
- Number input for minimum sats (default 100; enforce ≥ 10).
- Inline note: "Of every unlock, the creator receives 70 sats and the
  Artstr platform receives 30 sats (30% fee)." Numbers re-render
  from the user's input + the fee constant.
- Pre-publish check: creator must have a `lud16` in their kind-0; if
  not, block with "Set a Lightning address in your Nostr profile
  before publishing a premium template."

**Feed card** — when `isZapGated(event)`:
- Replace the Import button with a ⚡ "Unlock for N sats" card.
- The card preview still renders (already does in feed); only the
  CTA changes.
- If `isUnlockedLocally(event.id)` → show normal Import.

**Unlock flow** (when the lock card is clicked):
1. If NWC not connected → open the wallet setup modal first.
2. Otherwise open a confirm modal:
   ```
   Unlock "<title>" for N sats?
   • Creator (<short pubkey>):  70 sats
   • Artstr platform fee:        30 sats
   [Cancel] [Unlock]
   ```
3. On confirm: `payZapSplit(...)` with a streaming status line
   ("Paying creator…", "Paying platform fee…", "Waiting for
   receipts…").
4. On both receipts received: `markUnlocked(eventId)`, close modal,
   re-render the feed card with Import enabled.
5. On any failure: show error + targeted retry button (e.g. "Retry
   platform share" if creator leg succeeded).

**Local cache**
```js
const UNLOCK_CACHE_KEY = 'casewrap-unlocked-templates';
// shape: { [eventId]: { unlockedAt, creatorReceiptId, platformReceiptId } }
```
Receipt ids are kept so a future "Show my zap history" view can
reconstruct the unlock log.

**Ship gate**
Publish a premium template from account A. From account B, open the
feed, click the lock, complete the unlock, see the Import button,
import the template. Reload the page → import is still unlocked
(cache survives). Manually clear the cache key in DevTools → lock
returns; second unlock works without re-paying (uses the cached
zap receipts to fast-path verification before paying — see "Idempotency").

---

### Phase 4 — End-to-end + edge cases  *(~3–4h)*

**Test matrix**
- CoinOS source wallet + creator with Strike lud16 + platform with
  Wallet of Satoshi lud16.
- Wallet disconnects mid-pay (kill the WebSocket between calls):
  surfaced as a retry-able error.
- Platform invoice fails (e.g. node offline): "Creator was paid;
  retry the platform share." Retry-only button reuses the existing
  creator receipt.
- Creator has no `lud16`: blocked at publish time (already in Phase
  3), and on the consumer side blocked at unlock time with a clear
  "Creator can't receive payments yet" message.
- NWC not configured on consumer side: redirect to wallet setup.
- Two consumers unlocking the same template simultaneously: each
  unlock is independent; both succeed.

**Idempotency / re-attempt**
Track which legs paid via `localStorage`:
```js
const PARTIAL_UNLOCK_KEY = 'casewrap-partial-unlocks';
// shape: { [eventId]: { creatorReceiptId?, platformReceiptId? } }
```
On retry after partial failure, skip already-paid legs.

**Ship gate**
Every test-matrix row passes by hand on the deployed staging build,
with screenshots attached to the PR.

---

## Reused infrastructure (no new code)

Already in the codebase from the existing LNURL tip flow:
- `bech32Decode` (npub → hex).
- `lud16ToLnurlpUrl`, `resolveLnurlPayUrl`.
- `fetchLnurlInvoice(callback, msats)`.
- `buildZapRequestEvent({...})` (kind-9734).
- `parseBolt11Msats`, `parseZapReceiptAmount`.
- `ingestZapReceipt`, `startTipPaymentWatch`.
- `zapTotalForEvent`, `zapTotalForAuthor`.
- The existing tip-modal styling (we extend, not duplicate).

---

## Threat model

| Threat | Mitigation |
|---|---|
| Non-Artstr client implements `zap-gate` without the split | Accepted. Revenue model assumes Artstr is the primary publishing client. |
| User edits `localStorage` to fake an unlock | Cosmetic — they can already pirate the rendered design from the feed preview. The gate exists to align incentives, not to enforce DRM. |
| MITM on the NWC relay | The NIP-04 encryption uses ECDH between client + wallet service pubkeys, so the relay sees ciphertext only. Standard NIP-47 security. |
| Platform npub kind-0 lookup fails | Retry on next attempt; cache the resolved `lud16` for the session. If still failing after retries, the unlock errors out — no creator-only fallback (matches the "split is mandatory" goal). |
| Replay an old zap receipt to fake an unlock | Receipts must reference the specific template's event id (`#e`) AND the sender pubkey matches the local user. Old receipts for other events are rejected. |
| NWC secret exfiltration via XSS | Same risk surface as the NIP-07 extension key. Acknowledged. The secret lives in `localStorage` (not session-only) so reconnect doesn't require re-pasting. |

---

## Open questions to revisit later

- **Lower the fee.** 30% is the launch number. We may want a tiered
  model (e.g. 10% above 10k-sat unlocks) once usage data shows
  whether high-value unlocks are common. Single-constant design today
  makes this a one-line edit.
- **Receiving-side NWC.** Out of scope here. If we ever want creators
  to *receive* via NWC instead of LNURL, that's a separate spec.
- **General zaps via NWC.** Existing tip flow still shows bolt11/QR.
  Migrating that to NWC once it's wired here is a small follow-up
  (4–5h, reuses everything Phases 0–2 build).
