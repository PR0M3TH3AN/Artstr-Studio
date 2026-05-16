# Zaps via Nostr Wallet Connect (NWC) Feature Plan

## Overview
Allow users to zap template creators (and specific templates) directly from the community
feed using Nostr Wallet Connect (NIP-47). The user connects their Lightning wallet once via
a connection string, then taps ⚡ on any template card to send sats to the creator. No
backend required — NWC runs entirely over WebSockets through the user's own wallet relay.

## Complexity
**Moderate–High** — Estimated 6–10 hours
- NWC connection + pay_invoice: ~3 hours
- NIP-57 zap request + LNURL flow: ~3 hours
- UI (zap button, amount modal, settings): ~2 hours
- Crypto dependency setup: ~1 hour

---

## Protocol Overview

Two NIPs work together here:

| NIP | Purpose |
|-----|---------|
| NIP-47 (NWC) | App requests a payment from the user's wallet over an encrypted relay channel |
| NIP-57 | Defines what a "zap" is — a Lightning payment linked to a Nostr event or profile |

**The payment chain:**
```
User clicks ⚡
  → app fetches creator's Lightning address from their cached kind 0 profile (lud16)
  → app queries the creator's LNURL-pay endpoint for a callback URL
  → app builds a NIP-57 zap request (kind 9734) and signs it via NIP-07
  → app POSTs to the LNURL callback → gets back a bolt11 invoice
  → app sends pay_invoice to user's wallet via NWC (NIP-47)
  → wallet pays, publishes kind 9735 zap receipt to relays
```

---

## Key Components

### 1. NWC Wallet Connection (NIP-47)

#### Connection String Format
Wallets (Alby, Mutiny, Zeus, Cashu) generate a URI the user pastes in once:
```
nostr+walletconnect://<walletPubkey>?relay=wss%3A%2F%2Frelay.example.com&secret=<appSecret>
```

| Part | Meaning |
|------|---------|
| `walletPubkey` | Hex pubkey of the wallet service |
| `relay` | WebSocket URL of the relay the wallet listens on |
| `secret` | App-side private key (hex) — used to sign requests and decrypt responses |

#### Storage
- Store connection string in `localStorage` key `casewrap-nwc-uri`
- **Never log or expose the secret** — treat it like a password
- Derive the app pubkey from the secret at runtime for signing

#### Core parse function
```javascript
function parseNWCUri(uri) {
  // Returns { walletPubkey, relay, secret } or null if invalid
  const url = new URL(uri.replace('nostr+walletconnect://', 'https://'));
  return {
    walletPubkey: url.hostname,
    relay: url.searchParams.get('relay'),
    secret: url.searchParams.get('secret'),
  };
}
```

---

### 2. NWC pay_invoice Request (NIP-47)

NWC uses encrypted Nostr events to pass commands to the wallet. The app encrypts a JSON
command as kind 23194, publishes it to the wallet relay, and waits for a kind 23195
response from the wallet.

#### Encryption
NWC uses **NIP-04 encryption** (ECDH shared secret → AES-128-CBC).
- Shared secret = ECDH(appSecret, walletPubkey).x
- This is the same cipher used elsewhere in Nostr but keyed with the NWC secret, NOT the
  user's NIP-07 key — so `window.nostr.nip04` cannot be used here.
- Requires a small crypto library (see Crypto Dependencies section).

#### Request event (kind 23194)
```json
{
  "kind": 23194,
  "pubkey": "<appPubkey>",
  "tags": [["p", "<walletPubkey>"]],
  "content": "<nip04-encrypted JSON>",
  "created_at": <unix>,
  "id": "<sha256 of canonical form>",
  "sig": "<schnorr sig with appSecret>"
}
```

Decrypted content:
```json
{
  "method": "pay_invoice",
  "params": { "invoice": "lnbc..." }
}
```

#### Response event (kind 23195)
Wallet sends this back, encrypted to appPubkey:
```json
{
  "result_type": "pay_invoice",
  "result": { "preimage": "<hex>" }
}
// OR on failure:
{
  "result_type": "pay_invoice",
  "error": { "code": "INSUFFICIENT_BALANCE", "message": "..." }
}
```

#### Core send function
```javascript
async function sendNWCPayment(bolt11) {
  // 1. Parse stored NWC URI
  // 2. Encrypt pay_invoice request with NIP-04 using appSecret
  // 3. Build, sign, and publish kind 23194 to wallet relay
  // 4. Open subscription for kind 23195 from walletPubkey, tagged with request event ID
  // 5. Wait up to 30s for response, decrypt, return result or throw error
}
```

Note: The app signs kind 23194 events with the NWC `secret` key — NOT the user's NIP-07 key.
All NWC signing is done with the noble-secp256k1 library directly.

---

### 3. NIP-57 Zap Request + LNURL Flow

Before paying, the app must obtain a bolt11 invoice from the creator's Lightning address.
This follows the LNURL-pay + NIP-57 protocol:

#### Step A — Resolve the creator's Lightning address (lud16)
The creator's `lud16` field in their kind 0 profile (e.g. `alice@getalby.com`) maps to a URL:
```javascript
function lud16ToUrl(lud16) {
  const [name, domain] = lud16.split('@');
  return `https://${domain}/.well-known/lnurlp/${name}`;
}
```
If the creator only has `lud06` (bech32 LNURL), decode it:
```javascript
function decodeLNURL(lud06) {
  // bech32-decode lud06 → UTF-8 URL string
}
```

#### Step B — Fetch LNURL-pay metadata
GET the resolved URL. Check `allowsNostr: true` to confirm zap support:
```json
{
  "callback": "https://getalby.com/lnurlp/alice/callback",
  "minSendable": 1000,
  "maxSendable": 100000000000,
  "allowsNostr": true,
  "nostrPubkey": "<alby-service-pubkey>"
}
```

#### Step C — Build and sign the zap request (kind 9734)
This event is attached to the payment so the recipient sees who zapped them and what for:
```json
{
  "kind": 9734,
  "pubkey": "<senderPubkey>",
  "tags": [
    ["relays", "wss://relay.damus.io", "wss://nos.lol"],
    ["amount", "21000"],
    ["lnurl", "<lnurl>"],
    ["p", "<recipientPubkey>"],
    ["e", "<templateEventId>"]
  ],
  "content": "Love this design! ⚡"
}
```
Sign via `window.nostr.signEvent()` (NIP-07) — this DOES use the user's NIP-07 key.

#### Step D — Fetch the invoice
```
GET {callback}?amount=21000&nostr={encodeURIComponent(JSON.stringify(signedZapRequest))}&lnurl={lnurl}
```
Response: `{ "pr": "lnbc21n1p..." }`

#### Step E — Pay via NWC
Pass the `pr` bolt11 string to `sendNWCPayment()`.

```javascript
async function zapCreator(recipientPubkey, eventId, amountSats, message) {
  const profile = state.community.profiles[recipientPubkey];
  if (!profile?.lud16 && !profile?.lud06) throw new Error('Creator has no Lightning address');
  const lnurlInfo = await fetchLNURLPayInfo(profile.lud16 ?? profile.lud06);
  if (!lnurlInfo.allowsNostr) throw new Error('Creator wallet does not support zaps');
  const zapRequest = await buildAndSignZapRequest(recipientPubkey, eventId, amountSats * 1000, message);
  const invoice = await fetchZapInvoice(lnurlInfo, zapRequest, amountSats * 1000);
  return await sendNWCPayment(invoice);
}
```

---

### 4. Crypto Dependencies

NWC requires:
- **Schnorr signing** (sign kind 23194 events with appSecret)
- **NIP-04 encryption** (ECDH + AES-128-CBC)
- **Event ID hashing** (SHA-256 of canonical serialization)

The app has no build tools, so load from CDN via ES module imports or `<script>` tags:

```html
<!-- noble-secp256k1: Schnorr signing + ECDH -->
<script type="module">
  import * as secp from 'https://esm.sh/@noble/secp256k1@2';
  import { sha256 } from 'https://esm.sh/@noble/hashes/sha256';
  window._secp = secp;
  window._sha256 = sha256;
</script>
```

These two packages together are ~20 KB minified and have no further dependencies.
They are widely used across the Nostr ecosystem.

For bech32 decoding of `lud06` LNURL values, use:
```html
<script src="https://esm.sh/@scure/base@1"></script>
```

---

### 5. UI

#### Settings Panel — Wallet Connection
Add a "Lightning Wallet" section to the existing settings/profile panel:

```
┌─────────────────────────────────────────┐
│ ⚡ Lightning Wallet                      │
│                                          │
│ [Paste NWC connection string…      ] [Connect] │
│                                          │
│ Connected: Alby (alice@getalby.com)      │
│ Balance: 12,450 sats        [Disconnect] │
└─────────────────────────────────────────┘
```

- "Connect" parses and stores the NWC URI; optionally fires a `get_balance` request
- Balance display is optional — costs one extra NWC round-trip; hide if user prefers
- "Disconnect" clears localStorage key and hides zap buttons site-wide

#### Zap Button on Template Cards
Add to the `reactionRow` in both `renderCommunity()` feed cards and `renderCommunityDetail()`:

```
[👍 12]  [💬 3]  [🔁 5]  [⚡ Zap]
```

- Show ⚡ button only when the creator's profile has `lud16` or `lud06`
- If NWC is not connected, clicking ⚡ opens the settings panel to prompt setup
- Show "Zap creator" tooltip on hover

#### Zap Amount Modal
Opens on ⚡ click:

```
┌──────────────────────────────┐
│  ⚡ Zap  alice@getalby.com   │
│                               │
│  [  21 ]  [ 100 ]  [ 500 ]   │
│  [1000 ]  [ Custom…      ]   │
│                               │
│  Message (optional):          │
│  [________________________]  │
│                               │
│       [Cancel]  [Send Zap]   │
└──────────────────────────────┘
```

- Preset amounts in sats (21 is the canonical "nice" zap amount in Nostr culture)
- Custom amount field with min/max validation against LNURL `minSendable`/`maxSendable`
- Message populates the `content` field of the kind 9734 zap request
- "Send Zap" button shows spinner while in flight, then ✅ success or ❌ error message

---

## State Additions

```javascript
// Add to state object:
nwc: {
  uri: '',           // raw connection string (from localStorage on load)
  connected: false,  // true after successful parse + optional balance check
  balance: null,     // sats, or null if not fetched / not supported
}
```

---

## Performance Considerations
- LNURL fetch and NWC round-trip each take ~1–3 seconds — always show a loading state
- NWC WebSocket opens on-demand per payment and closes immediately after — no persistent connection
- Creator profile `lud16` is already in `state.community.profiles` — no extra relay query needed
- `get_balance` is optional; skip it to save a round-trip on wallet connect
- bech32/secp256k1 libs load once on page init; zap operations after that are <5ms local work

---

## Limitations
- Requires creator to have a Lightning address (`lud16` or `lud06`) in their Nostr profile
- Requires creator's wallet/service to support NIP-57 (`allowsNostr: true`)
- NWC secret gives partial spend authority — user should use a budget-limited NWC URI (Alby and Mutiny both support spending limits on NWC connections)
- `get_balance` and multi-pay are optional NWC methods — not all wallets implement them
- Zap receipts (kind 9735) are published by the recipient's wallet, not the sender — the app can listen for them but cannot guarantee delivery
- No offline support — both LNURL fetch and NWC require live network

---

## Security Notes
- Store the NWC URI in `localStorage` only — never send it to any server
- Never log `uri` or `secret` to console
- The NWC `secret` grants payment authority up to the wallet's configured spending limit — document this clearly in the UI so users understand what they're connecting
- LNURL fetches go to third-party servers (the creator's wallet provider) — no PII is sent beyond the zap request event (which is a public Nostr event anyway)

---

## Future Enhancements
- Zap splits: send a percentage to both template creator and original asset uploader (NIP-57 supports multiple `p` tags)
- Zap leaderboard on template detail: show top zappers (parse kind 9735 receipts)
- Recurring/scheduled zaps for favorite creators
- Show total sats zapped on each template card (sum kind 9735 receipts)
- Cashu/eCash zaps for sub-sat amounts (separate NIP, future consideration)
- WebLN fallback: if user has a WebLN browser extension instead of NWC, use `window.webln.sendPayment()` as a simpler alternative

---

## Testing Checklist
- [ ] NWC URI parses correctly (walletPubkey, relay, secret extracted)
- [ ] Invalid / malformed NWC URI shows clear error in settings
- [ ] `get_balance` request succeeds and displays balance (if wallet supports it)
- [ ] Disconnect clears stored URI and hides zap buttons
- [ ] ⚡ button only shows on cards where creator has lud16/lud06
- [ ] ⚡ click on card without NWC connected opens wallet setup flow
- [ ] LNURL fetch resolves correctly for standard lud16 addresses
- [ ] LNURL fetch resolves correctly for bech32 lud06 addresses
- [ ] `allowsNostr: false` shows friendly "creator wallet doesn't support zaps" message
- [ ] Zap request (kind 9734) is signed via NIP-07 and includes correct tags
- [ ] Invoice is fetched from LNURL callback with correct query params
- [ ] NWC pay_invoice request is encrypted and published to wallet relay
- [ ] Successful payment shows ✅ confirmation in modal
- [ ] NWC error codes (INSUFFICIENT_BALANCE, etc.) show readable messages
- [ ] Amount presets respect LNURL minSendable/maxSendable limits
- [ ] Custom amount validates against min/max before sending
- [ ] NWC connection secret is never logged to console
- [ ] Page reload restores NWC connected state from localStorage
