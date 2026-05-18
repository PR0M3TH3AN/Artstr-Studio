# Lightning Tips / Zaps (LNURL-pay v1)

## Goals
Ship the **smallest possible "send sats" surface** that works for any author with a Lightning address in their kind-0 profile.

- Pick an amount.
- Get a bolt11 invoice rendered as a QR code + copyable string.
- User pays from whatever wallet they want.
- Done.

No Nostr Wallet Connect. No WebLN auto-pay. No NIP-57 zap requests (kind-9734) or zap receipts (kind-9735) in v1. Just **LNURL-pay → bolt11 → QR**.

### Product goals
1. Get sats flowing to creators in the fewest possible steps.
2. Zero dependency on any extension, wallet integration, or signed-event flow.
3. Works for both **profile pages** (tip the author) and **design cards** (tip a specific piece of artwork) using the same modal.
4. Privacy-respectful: requests hit only the recipient's LNURL endpoint and (optionally) one QR-generator library — no analytics, no payment-relay middleman.

### Non-goals (v1)
- NIP-57 zap requests. Without a signed zap request, the payment is technically a **plain LNURL-pay tip**, not a zap-in-the-spec-sense. We use "Zap" as the user-facing label because it's the term users expect.
- Zap receipts / "Zapped ⚡" badges on designs.
- WebLN (`window.webln.sendPayment`) auto-pay. Could ship in a v1.1 polish if cheap.
- Nostr Wallet Connect (NWC) wallet binding.
- Payment confirmation tracking. We hand off the invoice and trust the user.
- Comment / message attached to the tip.
- Custom amounts beyond the LNURL-advertised min/max range.

---

## What we already have to work with

- `profile.lud16` (e.g. `alice@walletofsatoshi.com`) and/or `profile.lud06` (LNURL bech32 string) — pulled in via the existing `populateCommunityProfiles` (kind-0 fetch).
- A working modal pattern (`reportModal`, `closeProjectModal`, `pdfJpegModal`).
- An author surface in feed cards (we'll wire a "Tip" button onto every card).
- An author surface in the upcoming profile page.

---

## LNURL-pay primer (just the parts we need)

### Step 1 — Resolve the LNURL-pay endpoint
- `lud16` (Lightning address) `name@host` → `https://<host>/.well-known/lnurlp/<name>`.
- `lud06` (bech32 LNURL) decodes to the same kind of URL via the bech32 → URL trick.

### Step 2 — Fetch endpoint metadata
GET that URL. Response shape (the fields we care about):
```json
{
  "callback": "https://host/lnurl/pay/callback?id=…",
  "minSendable": 1000,
  "maxSendable": 100000000,
  "metadata": "[[\"text/plain\",\"Sats for alice\"]]",
  "tag": "payRequest",
  "commentAllowed": 0
}
```
- `minSendable` / `maxSendable` are in **millisats** (1 sat = 1000 msat).
- `commentAllowed`: max chars for an attached comment. Often 0. We skip comments in v1.

### Step 3 — Request the invoice
GET `<callback>?amount=<msats>` (URL-encode preserved). Response:
```json
{
  "pr": "lnbc100n1p...",
  "routes": []
}
```
- `pr` is the bolt11 invoice. That's all we need.

### Step 4 — Show it
Render `pr` as:
- A QR code (scan with a mobile wallet).
- A copyable string (paste into a desktop wallet).
- A `lightning:<pr>` link (OS hands off to a desktop wallet if registered).

We do not poll for payment confirmation. The modal stays open until the user closes it.

---

## UX

### Entry points
- Profile page action row: a `⚡ Tip` chip (only rendered if the profile has `lud16` or `lud06`).
- Feed card: a `⚡ Tip` button on each card whose author has a lightning address. Same modal, scoped to that author.
- Single-design preview: same chip in the actions row, when the author has a lightning address.

(Per-design tipping in v1 = tipping the **author** of that design. Splitting payments to multiple recipients or tagging the tip to a specific event id is out of scope.)

### The tip modal
```
┌─────────────────────────────────────┐
│  Tip alice@walletofsatoshi.com   ×  │
│                                     │
│  Amount                             │
│  [ 21  ] [ 100 ] [ 500 ] [ 1000 ]   │  ← quick-pick chips, sats
│  [ 5000 ] [ 21000 ] [ Custom ]      │
│                                     │
│  Custom: [______] sats              │  ← visible only when Custom selected
│                                     │
│  [ Get invoice ]                    │
└─────────────────────────────────────┘
```

After "Get invoice":
```
┌─────────────────────────────────────┐
│  Tip alice@walletofsatoshi.com   ×  │
│                                     │
│   ┌───────────────────┐             │
│   │                   │             │
│   │   ▓▓▓ QR CODE ▓▓▓ │             │  ← clickable → lightning:pr URL
│   │                   │             │
│   └───────────────────┘             │
│                                     │
│   lnbc100n1p...3qx2  📋             │  ← truncated, full on copy
│                                     │
│   Scan with a Lightning wallet,     │
│   or copy the invoice to paste.     │
│                                     │
│   [ New amount ]   [ Close ]        │
└─────────────────────────────────────┘
```

- Default amounts (sats): 21, 100, 500, 1000, 5000, 21000. Plus "Custom".
- Custom respects `minSendable` / `maxSendable` from the endpoint (converted to sats). Out-of-range values render an inline hint, not a native alert.
- "Get invoice" is disabled while fetching; shows "Fetching invoice…".
- QR is clickable; click opens `lightning:<bolt11>` so desktop wallets registered on the scheme can pick it up. Mobile users scan.
- "New amount" returns to the picker without closing.
- ESC / × / backdrop click closes.

### Error states
| Case | Render |
|---|---|
| `lud16` / `lud06` missing or malformed | The Tip entry point isn't rendered at all. |
| LNURL-pay endpoint unreachable / 4xx / 5xx | "Couldn't reach the recipient's Lightning service. Try again later." Retry button. |
| Endpoint returns non-`payRequest` tag | "This isn't a Lightning tip endpoint." Close button. |
| Amount outside min/max | Inline hint: "Enter between X and Y sats." |
| Invoice fetch failed | "Couldn't generate an invoice. Try a different amount." |
| CORS blocks the lookup | Fallback: show the lightning address with a "Copy and pay manually" prompt. (See CORS section below.) |

No browser `alert()` ever fires.

---

## Engineering plan

### New code (all in the existing inline script)

```js
async function fetchLnurlPayEndpoint(lud16OrLud06) // returns { callback, minSendable, maxSendable, metadata } or throws
async function fetchLnurlInvoice(callback, msats)  // returns bolt11 or throws
function openTipModal(opts: { ln: string, label?: string })
function renderTipAmountPicker()
function renderTipInvoiceView(bolt11)
function closeTipModal()
```

### LNURL helpers

```js
function lud16ToLnurlpUrl(ln) {
  const [name, host] = ln.split('@');
  if (!name || !host) throw new Error('Bad lightning address');
  return `https://${host}/.well-known/lnurlp/${name}`;
}

function lud06ToUrl(bech32) {
  // reuse the bech32 decoder we already use for npub/note/nevent
  const decoded = decodeBech32(bech32);
  return new TextDecoder().decode(decoded.data);
}

function resolveLnurlPayUrl(profile) {
  if (profile.lud16) return lud16ToLnurlpUrl(profile.lud16.trim());
  if (profile.lud06) return lud06ToUrl(profile.lud06.trim());
  return '';
}
```

### Invoice fetch
```js
async function getLnurlPayMetadata(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`Lookup failed: ${r.status}`);
  const j = await r.json();
  if (j.tag !== 'payRequest') throw new Error('Not a pay endpoint');
  return j;
}

async function getInvoice(callback, msats) {
  const url = `${callback}${callback.includes('?') ? '&' : '?'}amount=${msats}`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`Invoice fetch failed: ${r.status}`);
  const j = await r.json();
  if (j.status === 'ERROR') throw new Error(j.reason || 'Service error');
  if (!j.pr) throw new Error('No invoice in response');
  return j.pr;
}
```

### QR rendering
We need an in-browser QR encoder. The repo currently has no build step.

**Recommendation**: vendor a tiny self-contained QR encoder as `src/vendor/qrcode.min.js` and load it with a `<script>` tag. Smallest options:
- `qrcode-generator` by Kazuhiko Arase — ~12 KB minified, MIT, no deps. Renders to canvas or SVG.
- `nayuki/QR-Code-generator` — slightly larger, also MIT.

Pick `qrcode-generator`. Wrap it:
```js
function renderQrInto(el, text, sizePx = 240) {
  const qr = qrcode(0, 'M');   // auto type, medium error correction
  qr.addData(text);
  qr.make();
  el.innerHTML = qr.createSvgTag({ scalable: true });
  el.querySelector('svg').style.width = sizePx + 'px';
  el.querySelector('svg').style.height = sizePx + 'px';
}
```

### Modal markup (sketch)
```html
<div class="modal" id="tipModal" aria-hidden="true" style="display:none">
  <div class="modalInner" style="max-width:420px">
    <button class="modalClose" id="tipCloseBtn" aria-label="Close">×</button>
    <h2 id="tipTitle"></h2>
    <p class="hint" id="tipSubtitle"></p>

    <!-- Picker view -->
    <div id="tipPickerView">
      <div class="tipAmounts">
        <button data-sats="21">21</button>
        <button data-sats="100">100</button>
        <button data-sats="500">500</button>
        <button data-sats="1000">1k</button>
        <button data-sats="5000">5k</button>
        <button data-sats="21000">21k</button>
        <button data-sats="custom">Custom</button>
      </div>
      <input type="number" id="tipCustomInput" placeholder="Sats" style="display:none" />
      <p class="hint" id="tipPickerError" style="min-height:1.2em"></p>
      <div class="buttonRow">
        <button type="button" id="tipGetInvoiceBtn" class="primary">Get invoice</button>
      </div>
    </div>

    <!-- Invoice view (display:none until ready) -->
    <div id="tipInvoiceView" style="display:none">
      <div id="tipQr" class="tipQr"></div>
      <div class="tipBolt11">
        <code id="tipBolt11"></code>
        <button type="button" id="tipCopyBtn">📋</button>
      </div>
      <p class="hint">Scan with a Lightning wallet, or copy and paste.</p>
      <div class="buttonRow">
        <button type="button" id="tipBackBtn">New amount</button>
        <button type="button" id="tipDoneBtn">Close</button>
      </div>
    </div>
  </div>
</div>
```

### Wiring
- Profile page action row: render `⚡ Tip` chip when `resolveLnurlPayUrl(profile)` returns a non-empty URL.
- Feed card: same — only render when the author profile (from `_feedCache.profiles`) has `lud16` or `lud06`.
- Click handler: `openTipModal({ ln: resolveLnurlPayUrl(profile), label: profile.lud16 || profile.name || shortPubkey(pk) })`.

---

## CORS

LNURL-pay endpoints **usually** set `Access-Control-Allow-Origin: *`. The big providers (Wallet of Satoshi, Strike, getalby.com, Phoenix, Alby Hub) all do. But some self-hosted nodes don't, and that's not something we can fix client-side.

Mitigation:
1. Try the direct fetch first.
2. On CORS failure, show a graceful fallback: render the lightning address with "We can't auto-generate the invoice for this address from the browser. Paste it into your wallet to send sats." plus a copy button.

No public CORS proxy by default — proxies are a privacy and reliability risk. A user-configurable "trusted CORS proxy" setting could land later as an opt-in.

---

## Performance

- The LNURL metadata fetch is on-demand (only when the modal opens), so it doesn't slow profile or feed first paint.
- The QR encoder is loaded eagerly on app start (it's tiny). Acceptable.
- No persistent caching — each tip session re-fetches. Tip flows are rare and the data may change (e.g., min/max amounts adjusted by the recipient).

---

## Phased delivery

### Phase A — LNURL helpers + tip modal (profile page only)
1. Vendor `qrcode-generator` as `src/vendor/qrcode.min.js`; add `<script>` tag.
2. Implement `lud16ToLnurlpUrl`, `lud06ToUrl`, `resolveLnurlPayUrl`, `getLnurlPayMetadata`, `getInvoice`, `renderQrInto`.
3. Add `tipModal` markup + CSS.
4. Implement `openTipModal` / picker / invoice view / close.
5. Wire the chip into the profile page action row.

**Acceptance**: opening a profile that has `lud16` shows the Tip chip; clicking it lets me pick an amount and renders a working QR + bolt11. Scanning it in a wallet shows the right amount.

### Phase B — Feed card surface
1. Add tip button to feed-card action row when author has LN address.
2. Same handler.

**Acceptance**: every feed card whose author has a lightning address shows a tip button.

### Phase C — Single-design preview surface
1. Same chip in the preview header.

**Acceptance**: previewing a design from a tip-enabled author shows the chip.

### Phase D — Polish (optional, ship later)
1. WebLN auto-pay path: if `window.webln` is available, `await window.webln.enable()` and `await window.webln.sendPayment(bolt11)` from the invoice view as a one-click pay option.
2. Comment box if `commentAllowed > 0`.
3. Remember last amount in `localStorage`.

---

## Risks and tradeoffs

| Risk | Mitigation |
|---|---|
| CORS blocks the LNURL fetch | Fallback to "copy the address and pay manually" UI |
| Recipient's LNURL endpoint is slow/down | Timeout + Retry button; never spinner-forever |
| QR library bloats the bundle | Use `qrcode-generator` (~12 KB); load once |
| User picks an amount outside min/max | Validate before invoice fetch; inline hint |
| Custom amount parsing | Coerce to integer sats; reject non-positive |
| User pays the wrong amount because the bolt11 is locked to a specific amount | bolt11s from LNURL-pay are **amount-locked**; wallets show the amount before paying — low risk |
| User generates an invoice, walks away, comes back later | Invoices have expiration (usually ~10 min); modal copy explains "If this expires, just regenerate" — acceptable |
| Recipient's lightning address changes between when profile is cached and when user tips | Always resolve LNURL at modal open time, never cache the LNURL itself |
| Looks like a zap but isn't (no kind-9735 receipt published) | UI says "Tip" not "Zap" until we ship the real zap-request flow. Or we accept the loose terminology — most users don't distinguish |
| Self-hosted LN nodes with strict TLS / outdated certs | Browser error surfaces; we show a friendly message and the manual-paste fallback |

---

## Open questions

1. **Use "Tip" or "Zap" as the label?**
   - Recommendation: **"Tip"** in v1, since no kind-9734 zap request is signed. Reserve "Zap" for when we ship the full NIP-57 flow.
2. **WebLN as a v1 nice-to-have or strictly later?**
   - Recommendation: **Phase D**. It's ~20 lines and a real UX boost for desktop users with Alby installed, but adds a code path to maintain.
3. **Should we add a tip button to the single-design preview from day one?**
   - Recommendation: **yes**. Same handler, trivial to wire, and people viewing a specific design are highly engaged.
4. **Comment / message field?**
   - Recommendation: **skip v1**. Most LNURL endpoints have `commentAllowed: 0` anyway. Adds modal complexity for little payoff.
5. **Where to vendor the QR library?**
   - Recommendation: `src/vendor/qrcode.min.js`, committed to the repo (no CDN dependency, works offline, no rugpull risk).

---

## Acceptance summary (v1 = Phase A + B + C)

- [ ] LNURL-pay endpoint resolves from `lud16` and `lud06`.
- [ ] Tip chip appears on profile / feed card / preview only when the author has a Lightning address.
- [ ] Amount picker offers 21 / 100 / 500 / 1k / 5k / 21k + Custom.
- [ ] Custom amount validates against endpoint min/max.
- [ ] Bolt11 invoice renders as both QR and copyable text.
- [ ] Clicking QR opens `lightning:<pr>` for desktop wallet handoff.
- [ ] Errors render inline; no `alert()`.
- [ ] CORS-blocked endpoints surface a manual-paste fallback.
- [ ] Profile page and feed first paint are not blocked by LNURL fetches.
