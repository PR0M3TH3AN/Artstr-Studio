# Artstr Studio Premium Encrypted Designs

## Static Soft-Gate, Split-Zap Platform Fee, and Private Purchase Vault

### Status

**Shipped on `zap-gated`, merged into `main` 2026-05-29.** This is the
canonical spec for the encryption + key-delivery layer of premium
templates. It supersedes the Phase 5/6 sketch in
`ZAP_GATED_PREMIUM_FEATURE.md`, which described a creator-online
NIP-04 DM key-delivery scheme. That approach was abandoned in favour
of the **static soft-gate + buyer purchase vault** model below, which
removes the creator-online requirement entirely.

Implementation maps to §10 of this doc:

- **Step 0 — Crypto bundle.** `src/noble-bundle.min.js` exposes
  `@noble/secp256k1` v3.1.0 + `@noble/hashes` v2.2.0 as
  `window.ArtstrNoble`.
- **Step 1 — Soft-gate primitive.** The `Premium` IIFE in
  `src/index.html` (`pepperBytesForEpoch`, `deriveKey`,
  `encryptPayload`, `decryptPayload`).
- **Step 2 — Watermarked preview pipeline.** Canvas-based JPEG
  renderer that snapshots a low-res preview of the design pre-encrypt
  and embeds it in the envelope's `preview.dataUrl`.
- **Step 3 — Encrypted publish + premium consume.** Publish modal
  premium controls + soft-gate ack, encrypted event emission with the
  §5.1 tag set, and a feed/preview consume path that shows the
  gradient-stroked card, ⚡ PREMIUM ribbon, and "Unlock for N sats" CTA
  on the three import paths (feed card, preview Use/Fork, preview
  Save JSON).
- **Step 4 — Purchase vault + My Purchases tab.** NIP-44 self-
  encrypted kind-30078 vault (`d=artstr:purchase-vault:v1`), auto-
  splitting into per-item events (`d=artstr:purchase:<sha256(addr)>`)
  when the manifest crosses 40 KB. Hydrates on login with a
  "Restored N unlocks ✓" toast. The Premium tab in My Designs lists
  purchased items address-tolerantly so an edit-in-place doesn't
  invalidate a prior unlock.

Phases 0–3 of `ZAP_GATED_PREMIUM_FEATURE.md` (the noble bundle, NWC
client, platform-fee plumbing, and the original tag-only UI) shipped
earlier on the same branch and were reused for the encrypted version.

Phase 4 (the real-money E2E test matrix from §19 item 4) is the only
open work and now lives under "Premium-templates polish" in
`TODO.md`.

### Goal

Add a premium design system to Artstr Studio that lets creators publish encrypted paid designs, lets buyers unlock them with a Lightning/Nostr zap flow, and lets the buyer persist purchased design keys in a private Nostr-synced purchase vault.

This first version is intentionally a **static-client soft gate**. It raises friction and protects premium payloads from casual browsing, relay scraping, and obvious JSON copying, but it is not strong DRM. A determined reverse engineer can still recover client-derived secrets because Artstr remains a fully static browser app.

The architecture should be designed so the later stronger version can swap in a creator unlock bot without changing the buyer-facing purchase vault model.

This spec also includes **rotating soft-gate epochs** and **buyer-private vault salts**. These provide damage control, compartmentalization, and cleaner future migrations. They should not be described as true cryptographic forward secrecy, because a static client cannot hide the epoch material from a determined user.

---

## 1. Product Summary

Premium designs are published as encrypted Nostr events. A buyer sees a preview card and an unlock button. When the buyer pays, Artstr performs a split zap: most sats go to the designer, and a platform fee goes to Artstr/the developer. Once all required split payments are confirmed by zap receipts, Artstr derives the soft-gate decryption key, decrypts the design locally, and stores the design key in the buyer's private purchase vault.

From the buyer's perspective:

1. Open a premium design.
2. Click **Unlock for X sats**.
3. Review split: designer share + Artstr platform fee.
4. Approve payment.
5. Artstr pays the required split invoices.
6. Artstr waits for valid zap receipts.
7. Design unlocks.
8. Purchased design appears in **My Purchases** across browsers/devices when signed in with the same Nostr identity.

From the creator's perspective:

1. Create a design as usual.
2. Choose **Premium encrypted** in the publish modal.
3. Set minimum unlock price.
4. Artstr publishes an encrypted premium event with zap split tags.
5. Buyers zap to unlock.

---

## 2. Non-Negotiable Security Truth

A fully static client cannot keep a secret from its own users.

If a decryption key can be computed using only public JavaScript, public Nostr events, public pubkeys, public zap receipts, and public constants, then a determined user can compute it without paying.

Therefore v1 must be presented as:

> Premium soft-gated designs are encrypted on Nostr and unlocked in Artstr after a valid zap purchase. This protects against casual copying and relay scraping, but it is not strong DRM.

This is acceptable for a community template marketplace. It is not acceptable for high-value intellectual property where real cryptographic access control is required.

### 2.1 Salts, Epochs, and the Correct Security Claim

Salts and rotating epochs are useful, but they do not create true forward secrecy in a static app.

They can provide:

* per-design key uniqueness;
* reduced blast radius when one design key leaks;
* epoch-based damage control when an old soft-gate derivation gets reverse-engineered;
* a cleaner migration path from soft-gate keys to future bot-delivered keys;
* buyer-side purchase vault hardening and recovery metadata.

They cannot provide:

* a secret unknown to the buyer's browser;
* retroactive protection for old events once their epoch derivation is discovered;
* true forward secrecy in the cryptographic sense.

Use the term **rotating soft-gate epochs**, not **forward secrecy**, in user-facing copy and developer comments.

The spec should make the upgrade path obvious:

* **v1:** static soft gate; key is client-derived after valid payment.
* **v1.1:** static soft gate with rotating epochs and buyer-private vault salts.
* **v2:** secure gate; creator bot or unlock service publishes a buyer-specific encrypted key envelope after valid payment.

---

## 3. Feature Modes

Artstr should have four visibility/commercial states:

### 3.1 Public Free

Existing behavior.

* Plaintext project JSON.
* Appears in feed.
* Anyone can open, fork, import, and export.

### 3.2 Private to Me

Existing/near-existing private publishing behavior.

* Encrypted project JSON.
* Only author can decrypt.
* Does not appear in public feed.
* Uses private self-encryption/envelope model.

### 3.3 Premium Soft-Encrypted

New v1 feature.

* Encrypted project JSON.
* Appears in public feed as a premium card.
* Includes preview/metadata needed for browsing.
* Full design decrypts only after Artstr validates the buyer's split zap purchase.
* Decryption key is derived by the static client using obfuscated soft-gate KDF.
* Buyer stores derived key in private purchase vault.

### 3.4 Premium Secure, Future

Future v2 feature.

* Same premium event format, but key is not derivable from static client code.
* Creator bot watches for valid split-zap purchases.
* Bot publishes a buyer-specific NIP-44 encrypted unlock key envelope.
* Buyer stores received key in the same purchase vault.

---

## 4. High-Level Architecture

```text
Premium Design Event
  kind: 30078
  public tags: discovery + price + split policy
  content: encrypted Artstr payload envelope

Split Zap Purchase
  buyer signs zap requests
  Artstr requests one LNURL invoice per split recipient
  Artstr pays invoices via NWC/WebLN/manual handoff
  Artstr validates zap receipts from relays

Decryption
  after all required split receipts are valid
  derive soft-gate AES key
  decrypt premium payload locally

Purchase Vault
  buyer publishes self-encrypted app-data event
  stores purchased design references + design keys
  enables cross-device re-open without re-paying
```

---

## 5. Premium Design Event Format

Use a kind `30078` parameterized replaceable event. This aligns with the existing Artstr app-data model and lets the creator edit/replace the design with the same `d` tag.

### 5.1 Tags

Example tags for a 1,000 sat premium design with a 70/30 split:

```json
[
  ["d", "premium:customart:poster-title-or-random-id"],
  ["t", "casewrap"],
  ["t", "casewrap-customart"],
  ["title", "Premium Poster Template"],
  ["summary", "Premium encrypted Artstr design"],
  ["client", "Artstr Studio"],

  ["premium", "true"],
  ["premium-mode", "softgate-v1"],
  ["softgate-epoch", "2026-05"],
  ["zap-gate", "true"],
  ["zap-min", "1000"],
  ["encrypted", "artstr-softgate-v1"],

  ["zap-split", "required"],
  ["zap", "<designer-pubkey>", "wss://designer-profile-relay.example", "70"],
  ["zap", "<platform-pubkey>", "wss://platform-profile-relay.example", "30"]
]
```

Notes:

* `d` should be persistent for edit-in-place.
* `t` tags keep the card discoverable in the existing feed.
* `title` and `summary` are intentionally public so buyers can browse. Do not put sensitive design details in these tags.
* `premium-mode` identifies the unlock logic.
* `softgate-epoch` identifies which rotating static KDF epoch this design uses.
* `zap-min` is total purchase price in sats.
* `zap` tags follow the Nostr zap split convention: recipient pubkey, relay for profile lookup, and optional weight.
* `zap-split: required` tells Artstr that all weighted split payments must complete before unlock.

### 5.2 Event Content Envelope

The event `content` is not the raw Artstr design JSON. It is an encrypted envelope.

```json
{
  "v": 1,
  "visibility": "premium",
  "premiumMode": "softgate-v1",
  "payloadSchemaVersion": 5,
  "enc": {
    "alg": "aes-256-gcm",
    "kdf": "artstr-softgate-v1",
    "compression": "gzip"
  },
  "aad": "30078:<creator-pubkey>:premium:customart:poster-title-or-random-id",
  "salt": "<base64-random-32-bytes>",
  "iv": "<base64-random-12-bytes>",
  "ciphertext": "<base64>",
  "preview": {
    "kind": "watermarked-image",
    "url": "https://...",
    "width": 1200,
    "height": 675
  },
  "softgate": {
    "version": 1,
    "epoch": "2026-05",
    "publicDesignSalt": "<base64-random-32-bytes>",
    "purchaseScope": "address",
    "puzzle": {
      "enabled": false,
      "difficultyBits": 0
    }
  }
}
```

The decrypted plaintext is the ordinary Artstr project payload that `loadProjectFromText()` already understands.

### 5.3 Associated Data

Use AES-GCM associated data to bind the ciphertext to the event coordinate:

```text
30078:<creator-pubkey>:<d-tag>
```

If someone copies the ciphertext to a different event coordinate, decryption should fail.

### 5.4 Preview Strategy

For premium designs, Artstr needs enough public information to sell the design without revealing the source project.

Recommended preview options:

1. Creator uploads a flattened watermarked preview image URL.
2. Artstr generates a watermarked JPEG at publish time and asks the creator to host it.
3. In a later version, support Blossom/NIP-96 for preview image storage.

Do not put the full editable layer stack in public metadata.

---

## 6. Soft-Gate Decryption Method

### 6.1 Purpose

The v1 soft gate encrypts the Nostr payload at rest and makes casual copying hard. It does not provide strong DRM.

### 6.2 Key Derivation Overview

The premium AES key is derived from public and obfuscated material, including a rotating soft-gate epoch:

```text
premiumKey = HKDF-SHA256(
  inputKeyMaterial = softGatePepperForEpoch(epoch),
  salt = publicDesignSalt,
  info = "artstr-softgate-v1" + epoch + creatorPubkey + premiumAddress + payloadSchemaVersion
)
```

Where:

```text
epoch = envelope.softgate.epoch or softgate-epoch tag
premiumAddress = 30078:<creator-pubkey>:<d-tag>
publicDesignSalt = envelope.softgate.publicDesignSalt
```

The creator's browser uses the same derivation when publishing the premium design. A buyer's browser uses the derivation after a valid split zap purchase.

The recommended v1 purchase scope is **address-based**, not event-ID-based, so a buyer's purchase can survive edit-in-place replacements of the same premium `d` tag.

### 6.3 Soft-Gate Epoch Pepper

The epoch pepper is not a real secret because it ships with the static app. Still, it should be annoying to extract.

Implement `softGatePepperForEpoch(epoch)` as a nuisance layer:

* Maintain a small supported epoch registry in the client, e.g. `2026-05`, `2026-06`.
* Split epoch constants across several functions/modules.
* Hide fragments in unrelated-looking lookup tables.
* Use byte arrays rather than readable strings.
* Mix in CSS custom property fragments if practical.
* Optionally run the reconstruction inside a Web Worker.
* Optionally include a tiny WASM helper later.
* Avoid one obvious string such as `PREMIUM_SECRET`.

This is obfuscation, not security. The code comments should say so clearly.

### 6.4 Inputs to KDF

Use these inputs:

```text
softgate epoch
creator pubkey
premium address coordinate
payload schema version
public per-design salt
static obfuscated epoch pepper
optional puzzle nonce
```

Do not use the zap receipt itself as the encryption key. The creator cannot know a buyer's future zap receipt at publish time.

The zap receipt is only the permission signal that tells the client it may run the key path.

### 6.5 Epoch Rotation

Soft-gate epochs provide damage control.

If the `2026-05` derivation gets reverse-engineered, Artstr can ship a new client epoch, such as `2026-06`, and new premium designs can use the new epoch. Old `2026-05` premium designs should be treated as compromised once that epoch is public.

Epoch rotation does not retroactively protect old encrypted events.

Implementation rules:

* New premium designs default to the latest supported epoch.
* Existing premium designs keep their original epoch unless republished with a new `premium-edition` boundary.
* The client should keep older epoch derivations available so legitimate buyers can still open old purchases.
* The UI/docs should describe this as **rotation** or **damage control**, never true forward secrecy.

### 6.6 Salt Scope

Use multiple salts for different jobs:

| Salt                       | Location                               | Purpose                                                 | Secret?                               |
| -------------------------- | -------------------------------------- | ------------------------------------------------------- | ------------------------------------- |
| `publicDesignSalt`         | Premium event envelope                 | Makes each premium design key unique                    | No                                    |
| `vaultSalt`                | Buyer purchase vault encrypted content | Helps wrap/store purchase keys per buyer/device/account | Private to buyer                      |
| future `creatorSecretSalt` | Creator/bot private storage            | Enables real secure unlock path                         | Yes, only if never shipped to browser |

The only salt that can create real secrecy is a creator/platform-side salt that is never delivered to the static client until after payment, encrypted to a buyer. That belongs to the future secure gate.

### 6.7 Optional CPU Puzzle

Add a disabled-by-default puzzle field for future friction:

```json
"puzzle": {
  "enabled": true,
  "difficultyBits": 18,
  "challenge": "<base64>"
}
```

If enabled, the buyer must find a nonce:

```text
SHA256(challenge + buyerPubkey + nonce) starts with N zero bits
```

The nonce becomes additional KDF info.

This does not create secrecy. It only makes bulk scraping more expensive.

### 6.8 Optional Buyer-Private Salt List

A buyer-private salt list can be merged into the purchase vault rather than implemented as a separate event in v1.

After a successful purchase, generate:

```text
vaultSalt = random 32 bytes
```

Use it to wrap or label the stored design key inside the encrypted vault. This is useful for future migrations and local key hygiene, but it does not protect the original premium event from reverse engineering.

Do not require the private salt list before first purchase, because a new buyer has no private salt for a design they have not unlocked yet.

---

## 7. Split-Zap Platform Fee

### 7.1 Goal

A buyer sees one purchase action, while Artstr executes multiple Lightning payments behind the scenes.

Example:

```text
Unlock for 1,000 sats
Designer: 700 sats
Artstr:   300 sats
```

Under the hood, this is two LNURL/NIP-57 zaps.

### 7.2 Split Policy

Initial platform default:

```text
70% designer
30% Artstr platform fee
```

Represent split recipients with `zap` tags:

```json
[
  ["zap", "<designer-pubkey>", "wss://designer-profile-relay.example", "70"],
  ["zap", "<platform-pubkey>", "wss://platform-profile-relay.example", "30"]
]
```

The weights are not necessarily percentages. Artstr should sum all weights and calculate shares.

### 7.3 Amount Calculation

For `totalSats = 1000` and weights `70 + 30`:

```text
designerAmount = floor(1000 * 70 / 100) = 700
platformAmount = 1000 - 700 = 300
```

Rules:

* Use integer sats.
* Assign rounding remainder to the last required recipient.
* Enforce minimum recipient amount against each LNURL endpoint's `minSendable`.
* If a split would be below recipient minimum, raise total minimum or block purchase with a clear message.

### 7.4 Payment Flow

```text
1. Buyer clicks Unlock.
2. Artstr loads split policy from premium event tags.
3. Artstr resolves each recipient's Lightning address from their Nostr profile.
4. Artstr fetches each recipient's LNURL-pay metadata.
5. Artstr confirms each endpoint supports zaps.
6. Artstr builds one zap request per recipient.
7. Each zap request points back to the same premium design event.
8. Artstr fetches one invoice per recipient.
9. Artstr pays invoices sequentially or in controlled parallel.
10. Artstr watches relays for one valid zap receipt per recipient.
11. Only after every required receipt is valid does the design unlock.
```

### 7.5 Sequential vs Parallel Payments

Prefer sequential payments for v1.

Sequential order:

1. Pay designer share.
2. Pay platform share.
3. Wait for receipts.

Reason:

* Easier retry model.
* Fewer simultaneous wallet prompts.
* Easier status display.

Downside:

* Partial payment can happen.

### 7.6 Partial Failure Handling

Lightning payments cannot be clawed back.

If one payment succeeds and another fails, Artstr must preserve partial state and let the buyer retry only the missing share.

Example UI state:

```text
Designer payment confirmed: 700 sats
Artstr platform payment pending: 300 sats

[Retry remaining payment]
```

Partial state should be stored locally and recovered by querying zap receipts on reload.

### 7.7 Unlock Rule

A premium design unlocks only if all required split recipients have valid receipts:

```text
For each required split recipient:
  receipt kind = 9735
  receipt targets this premium design event or address
  receipt P tag = current buyer pubkey
  receipt p tag = split recipient pubkey
  invoice amount >= required split amount
  receipt signer = recipient LNURL provider nostrPubkey
  receipt description contains the original zap request
```

If any required receipt is missing, do not derive or use the premium key.

### 7.8 Receipt Query Strategy

On unlock attempt, query relays for zap receipts using:

```json
{
  "kinds": [9735],
  "#e": ["<premium-event-id>"]
}
```

For addressable premium events, also support `a` tag matching:

```json
{
  "kinds": [9735],
  "#a": ["30078:<creator-pubkey>:<d-tag>"]
}
```

Artstr should prefer `a` where supported because replaceable premium designs may have multiple event IDs over time.

---

## 8. Buyer Purchase Vault

### 8.1 Purpose

The purchase vault stores the buyer's unlocked premium design references and decryption keys in an encrypted, Nostr-synced app-data event.

This is useful even in v1:

* Survives localStorage clearing.
* Works across devices using the same Nostr identity.
* Avoids re-checking/re-paying on each device.
* Creates a reusable upgrade path for future secure bot-delivered keys.

The vault does not solve first-time key delivery. It only persists a key after unlock.

### 8.2 Event Kind

Use kind `30078` app-specific data:

```json
{
  "kind": 30078,
  "tags": [
    ["d", "artstr:purchase-vault:v1"],
    ["client", "Artstr Studio"],
    ["encrypted", "nip44"]
  ],
  "content": "<NIP-44 self-encrypted JSON>"
}
```

Keep public tags minimal. Do not put purchase references or keys in public tags.

### 8.3 Encrypted Vault Content

Plaintext before NIP-44 encryption:

```json
{
  "v": 1,
  "updatedAt": 1760000000,
  "items": [
    {
      "a": "30078:<creator-pubkey>:premium:customart:poster-title-or-random-id",
      "eventId": "<specific-premium-event-id>",
      "creatorPubkey": "<creator-pubkey>",
      "title": "Premium Poster Template",
      "mode": "customart",
      "unlockedAt": 1760000000,
      "amountSats": 1000,
      "payment": {
        "mode": "split-zap-v1",
        "receipts": [
          {
            "recipientPubkey": "<designer-pubkey>",
            "amountSats": 700,
            "receiptId": "<kind-9735-event-id>"
          },
          {
            "recipientPubkey": "<platform-pubkey>",
            "amountSats": 300,
            "receiptId": "<kind-9735-event-id>"
          }
        ]
      },
      "key": {
        "source": "softgate-v1",
        "epoch": "2026-05",
        "alg": "aes-256-gcm",
        "vaultSalt": "<buyer-private-base64-random-32-bytes>",
        "wrap": "vault-aes-gcm-v1",
        "wrappedRawKeyBase64": "<vault-wrapped-base64-32-byte-design-key>"
      }
    }
  ]
}
```

Store the design key, not the decrypted project JSON.

Prefer storing the design key wrapped inside the encrypted vault using a buyer-private `vaultSalt`. This is not a second wall of real security if the buyer's Nostr encryption key is compromised, but it gives Artstr explicit per-item key metadata for migration, rotation, and future secure-gate compatibility.

Reasons:

* Smaller vault.
* Less duplication.
* If the premium event is updated, Artstr can decide whether the stored key applies.
* Keeps the vault as a key ledger, not a content mirror.
* Records the soft-gate epoch used for the purchase.
* Allows future re-wrapping or migration without changing the premium event.

### 8.4 Vault Read Flow

When opening a premium design:

```text
1. Query buyer's own kind 30078 event with d=artstr:purchase-vault:v1.
2. Decrypt content with NIP-44 encrypt-to-self/decrypt-to-self.
3. Find matching item by address coordinate first, event ID second.
4. If key exists, decrypt design immediately.
5. If no key exists, show purchase/unlock flow.
```

### 8.5 Vault Write Flow

After successful unlock:

```text
1. Load current vault.
2. Merge or update item by address coordinate.
3. Add receipt IDs, amounts, unlock timestamp, key metadata.
4. NIP-44 self-encrypt vault JSON.
5. Publish kind 30078 with same d-tag.
```

### 8.6 Conflict Handling

Because `30078` is replaceable, last-write-wins can lose entries if two devices update at the same time.

v1 mitigation:

* Always fetch latest vault before write.
* Merge by `a` coordinate.
* Preserve unknown fields.
* If publish verification fails, keep local pending vault update and retry.

Future mitigation:

* One vault item per purchase as separate `30078` events, e.g. `d=artstr:purchase:<sha256(a)>`.
* This reduces merge conflicts but creates more events.

For v1, a single vault is simpler.

---

## 9. UI/UX Changes

### 9.1 Publish Modal

Add commercial visibility controls:

```text
Publish type:
  ( ) Public free
  ( ) Private to me
  ( ) Premium encrypted
```

When **Premium encrypted** is selected:

```text
Price: [1000] sats
Platform fee: 30%
Designer receives: 700 sats
Artstr receives: 300 sats

[ ] I understand this is a static soft-gate, not strong DRM.
```

The creator should not be allowed to publish a premium design unless:

* They are signed in with NIP-07.
* Their profile has `lud16` or `lud06`.
* The platform fee recipient is configured.
* The design has a title.
* The design has a preview.
* The price is high enough to satisfy all split recipient LNURL minimums.

### 9.2 Feed Card

Premium cards should show:

```text
⚡ Premium
Title
Creator
Preview image
Unlock: 1,000 sats
Designer 70% / Artstr 30%
[Unlock]
```

After unlocked:

```text
Unlocked ✓
[Open]
[Import/Fork]
```

### 9.3 Purchase Modal

Before payment:

```text
Unlock "Premium Poster Template"

Total: 1,000 sats
Designer: 700 sats
Artstr platform fee: 300 sats

This purchase uses split zaps. You may see more than one wallet payment approval.

[Pay & Unlock]
```

During payment:

```text
Resolving recipients...
Fetching designer invoice...
Paying designer 700 sats...
Waiting for designer zap receipt...
Fetching Artstr invoice...
Paying Artstr 300 sats...
Waiting for Artstr zap receipt...
Decrypting design...
Saving to purchase vault...
Done.
```

Partial failure:

```text
Partial payment detected.

Designer payment confirmed: 700 sats
Artstr payment pending: 300 sats

Your first payment was successful. Retry only the remaining payment to unlock.

[Retry remaining payment]
```

### 9.4 My Purchases

Add a **My Purchases** tab or section.

It should:

* Load the private purchase vault.
* Show purchased premium designs.
* Show creator, title, amount, date, and availability status.
* Let buyer open/decrypt if the original premium event still exists on relays.
* Show a clear missing-event message if relays cannot return the original event.

---

## 10. Implementation Plan

### Phase 0 — Refactor Existing Zap Helpers

Extract reusable helpers from the current tip/zap code or planned NWC path:

```js
resolveLightningAddress(profile)
fetchLNURLPayInfo(lud16OrLud06)
buildAndSignZapRequest({ recipientPubkey, targetEvent, amountMsats, message })
fetchZapInvoice({ lnurlInfo, zapRequest, amountMsats })
payInvoice(invoice)
waitForZapReceipt({ target, senderPubkey, recipientPubkey, amountSats, lnurlInfo })
validateZapReceipt(receipt, expected)
```

Acceptance:

* Existing one-recipient tips still work.
* Helper can be called for arbitrary recipient/event/amount.

### Phase 1 — Premium Event Detection and UI

Add parser helpers:

```js
isPremiumEvent(event)
getPremiumMode(event)
getZapMin(event)
parseZapSplits(event)
getPremiumEnvelope(event)
```

Acceptance:

* Feed identifies premium events.
* Premium card shows lock/unlock state.
* Non-premium events unaffected.

### Phase 2 — Soft-Gate Crypto

Implement:

```js
deriveSoftGateKey({ epoch, creatorPubkey, dTag, schemaVersion, publicDesignSalt, puzzleNonce })
encryptPremiumPayload(payload, eventCoordinate)
decryptPremiumPayload(envelope, key, eventCoordinate)
softGatePepper()
```

Use WebCrypto AES-GCM.

Acceptance:

* Creator can publish premium encrypted event.
* Buyer cannot parse plaintext from event content.
* After deriving correct key, decrypted payload round-trips into existing loader.
* Wrong event coordinate fails AES-GCM authentication.

### Phase 3 — Split-Zap Purchase Flow

Implement:

```js
calculateSplitAmounts(totalSats, splits)
paySplitZapPurchase({ event, totalSats, splits })
getSplitPurchaseStatus({ event, buyerPubkey, splits })
resumePartialSplitPurchase(status)
```

Acceptance:

* 70/30 split produces two invoices.
* Both payments reference the same premium design.
* Unlock requires both receipts.
* Partial failure can resume without re-paying completed shares.

### Phase 4 — Purchase Vault

Implement:

```js
loadPurchaseVault()
decryptPurchaseVault(event)
wrapPurchaseVaultKey(rawDesignKey, vaultSalt)
unwrapPurchaseVaultKey(wrappedKey, vaultSalt)
upsertPurchaseVaultItem(item)
publishPurchaseVault(vault)
findPurchaseVaultItem({ eventId, address })
```

Acceptance:

* After unlock, key is saved to private Nostr vault.
* Reload/new session can decrypt premium design from vault key.
* Vault public tags do not reveal purchased design IDs.
* If NIP-44 is unavailable, vault feature gracefully disables or falls back only if intentionally supported.

### Phase 5 — My Purchases UI

Implement:

* My Purchases tab.
* Vault load/decrypt state.
* Purchased design cards.
* Open/decrypt actions.
* Missing-relay/error states.

Acceptance:

* Buyer can see purchase history.
* Buyer can reopen purchased designs without re-paying.

### Phase 6 — Hardening and Documentation

Add warnings and developer comments:

* Static soft-gate limitation.
* No plaintext localStorage caching.
* Receipts are validation signals, not private key delivery.
* Vault encrypts content but does not hide vault existence.

Acceptance:

* README and docs explain premium soft-gate honestly.
* UI copy does not overpromise security.

---

## 11. Data Model Helpers

### 11.1 Split Parser

```js
function parseZapSplits(event) {
  const tags = event.tags || [];
  const zapTags = tags.filter(t => t[0] === 'zap' && t[1] && t[2]);
  const hasAnyWeights = zapTags.some(t => t[3] != null);
  return zapTags.map(t => ({
    pubkey: t[1],
    relay: t[2],
    weight: hasAnyWeights ? Math.max(0, parseInt(t[3] || '0', 10) || 0) : 1
  })).filter(s => s.weight > 0);
}
```

### 11.2 Split Amounts

```js
function calculateSplitAmounts(totalSats, splits) {
  const totalWeight = splits.reduce((sum, s) => sum + s.weight, 0);
  if (!totalWeight) throw new Error('No payable zap split recipients.');

  let assigned = 0;
  return splits.map((split, index) => {
    const isLast = index === splits.length - 1;
    const amountSats = isLast
      ? totalSats - assigned
      : Math.floor(totalSats * split.weight / totalWeight);
    assigned += amountSats;
    return { ...split, amountSats };
  });
}
```

### 11.3 Unlock Predicate

```js
function hasCompleteSplitPurchase({ requiredPayments, validReceipts }) {
  return requiredPayments.every(payment =>
    validReceipts.some(receipt =>
      receipt.recipientPubkey === payment.pubkey &&
      receipt.senderPubkey === state.community.myPubkey &&
      receipt.amountSats >= payment.amountSats
    )
  );
}
```

---

## 12. Edge Cases

### Creator Has No Lightning Address

Do not allow premium publishing until the creator has a valid `lud16` or `lud06` in profile metadata.

### Platform Pubkey Has No Lightning Address

Do not allow premium publishing or premium unlocking. This is a configuration error.

### Split Amount Below LNURL Minimum

Show:

```text
This price is too low for the configured split recipients. Minimum unlock price is X sats.
```

### User Pays Designer but Platform Payment Fails

Store partial state and allow retry of only missing payment.

### Receipt Never Arrives

Show:

```text
Payment may have succeeded, but the zap receipt was not found yet. You can retry receipt detection or inspect your wallet.
```

Do not automatically re-pay unless the user explicitly chooses to retry a missing payment.

### Buyer Clears localStorage

The private purchase vault should recover the key if it was published successfully. If the vault was never saved, buyer must re-prove payment by receipts or re-pay if receipts cannot be found.

### Buyer Uses Another Device

If signed in with same Nostr identity and vault exists, the purchased key should sync.

### Premium Event Is Replaced

If creator republishes same `d` tag:

* If the key derivation includes event ID, old key will not unlock new ciphertext.
* If the key derivation uses only address coordinate, one purchase can unlock future updates.

Recommended v1 decision:

```text
Use address coordinate, not event ID, in the stable KDF info if purchases should include creator updates.
Use event ID if every update should require a fresh purchase.
```

Product recommendation:

* Use address-coordinate-based keys for v1.
* Store latest event ID in vault for reference.
* Let creator updates remain available to previous buyers unless a future `premium-edition` tag changes the purchase boundary.

### Buyer Shares Decrypted JSON

Cannot be prevented in a static app. The preview/publish UI should not claim otherwise.

---

## 13. Recommended Product Decisions

### 13.1 Do Not Market Salts as Forward Secrecy

Use this internal language:

```text
Rotating soft-gate epochs provide damage control and compartmentalization.
Buyer-private vault salts help key storage and migration.
Neither provides true forward secrecy in a static client.
```

User-facing copy should say:

```text
Premium encrypted designs are protected from casual copying and unlocked through Artstr after payment. Artstr may rotate premium protection versions over time, but this is not strong DRM.
```

### 13.2 Use Address-Based Purchases

A purchase should attach to:

```text
30078:<creator-pubkey>:<premium-d-tag>
```

not only to one event ID.

This makes edit-in-place work naturally and prevents buyers from losing access when creators fix typos or improve a design.

### 13.3 Enforce Platform Split at Publish Time

The platform fee recipient should be added automatically by Artstr when publishing premium designs. Creators should not be allowed to remove it from the UI.

### 13.4 Show the Split Transparently

The buyer should know the payment is split.

Do not hide the 30% platform fee. It is better to be transparent and avoid trust issues.

### 13.5 Keep Soft Gate Honest

Use wording like:

```text
Premium encrypted designs are protected from casual copying and unlocked through Artstr after payment. This is not strong DRM; buyers can still export or copy designs after unlocking.
```

---

## 14. Future Secure Gate Upgrade

The v2 secure version keeps the same premium design event and purchase vault, but changes how the key arrives.

### 14.1 Creator Unlock Bot

A creator or platform bot watches relays for valid split-zap receipts.

When receipts are valid, the bot publishes an unlock event:

```json
{
  "kind": 30078,
  "tags": [
    ["d", "artstr:unlock:<design-address-hash>:<buyer-pubkey>"],
    ["p", "<buyer-pubkey>"],
    ["a", "30078:<creator-pubkey>:premium:<design-id>"],
    ["encrypted", "nip44"],
    ["client", "Artstr Studio"]
  ],
  "content": "<NIP-44 encrypted key envelope for buyer>"
}
```

Plaintext inside content:

```json
{
  "v": 1,
  "a": "30078:<creator-pubkey>:premium:<design-id>",
  "key": {
    "alg": "aes-256-gcm",
    "rawKeyBase64": "<actual random design key>"
  },
  "payment": {
    "mode": "split-zap-v1",
    "receiptIds": ["<designer-receipt>", "<platform-receipt>"]
  }
}
```

The buyer then saves the received key into the same purchase vault.

### 14.2 Migration Path

The purchase vault should support:

```json
"key": {
  "source": "softgate-v1"
}
```

and later:

```json
"key": {
  "source": "creator-unlock-v1"
}
```

This lets the app support both old soft-gated purchases and future secure purchases.

---

## 15. Acceptance Checklist

### Premium Publishing

* [ ] Publish modal supports Premium encrypted.
* [ ] Creator sets total price in sats.
* [ ] Platform fee split is shown.
* [ ] Premium event includes `premium`, `premium-mode`, `softgate-epoch`, `zap-gate`, `zap-min`, `encrypted`, and split `zap` tags.
* [ ] Content is encrypted envelope, not plaintext JSON.
* [ ] Envelope includes `softgate.epoch` and `softgate.publicDesignSalt`.
* [ ] New premium designs default to the latest supported soft-gate epoch.
* [ ] Existing public and private publishing still work.

### Feed and Preview

* [ ] Premium designs appear as locked cards.
* [ ] Premium cards show price and split summary.
* [ ] Premium cards do not expose editable payload.
* [ ] Unlocked premium designs show Open/Import/Fork.

### Split Zap

* [ ] Artstr calculates weighted split amounts correctly.
* [ ] Artstr creates one zap invoice per recipient.
* [ ] Artstr pays invoices through NWC/WebLN/manual flow where available.
* [ ] Artstr waits for and validates all required receipts.
* [ ] Partial payment can resume without duplicate payment.

### Decryption

* [ ] Soft-gate key derives only after valid purchase state.
* [ ] AES-GCM decrypt succeeds for valid key and fails for wrong coordinate/key.
* [ ] Decrypted payload loads into existing project loader.
* [ ] Plaintext is not cached in localStorage.

### Purchase Vault

* [ ] Vault publishes as encrypted kind 30078 app data.
* [ ] Vault public tags do not leak purchases.
* [ ] Vault stores design key, soft-gate epoch, vault salt, and payment receipt references.
* [ ] Stored design key is wrapped per vault item rather than placed directly in plaintext vault JSON.
* [ ] Buyer can reopen purchased design after reload.
* [ ] Buyer can reopen purchased design on another browser/device with same Nostr identity.

### Documentation

* [ ] README documents premium soft-gate limitation.
* [ ] UI copy does not claim strong DRM.
* [ ] Future secure unlock bot path is documented.

---

## 16. Suggested File/Code Touch Points

Because Artstr is currently a single-file static app, keep changes organized by named sections inside `src/index.html` or split only if the project later introduces modules.

Suggested code groups:

```text
Premium design parsing
Premium envelope crypto
Soft-gate KDF
Zap split calculation
Split zap payment flow
Zap receipt validation
Purchase vault crypto/storage
Premium publish UI
Premium feed card UI
My Purchases UI
```

Suggested docs:

```text
docs/PREMIUM_DESIGNS_FEATURE.md
```

This spec can become that doc.

---

## 17. Final Recommendation

Build the feature in this order:

1. Reusable zap receipt validation.
2. Split-zap payment primitive.
3. Premium encrypted event format.
4. Soft-gate decrypt flow.
5. Private purchase vault.
6. My Purchases UI.
7. Later: creator unlock bot for real key delivery.

This gives Artstr a static, Nostr-native premium design marketplace without becoming a custodial Lightning platform. The buyer experiences one unlock action, while the app performs transparent split zaps and stores the resulting purchase key privately for future use.

---

## 18. Mapping to what's already shipped on `zap-gated`

The work already shipped under `ZAP_GATED_PREMIUM_FEATURE.md` covers
items 1–3 of the implementation plan above:

| Spec phase | What's shipped on the branch | Gap to close |
|---|---|---|
| 10.0 — Refactor zap helpers | `buildZapRequestEvent`, `fetchLnurlInvoice`, `parseZapReceiptAmount`, `startTipPaymentWatch` are reused unchanged from the existing tip flow. | None |
| 10.1 — Premium event detection + UI | `isZapGated`, `getZapMin`, lock CTA on feed cards, publish toggle. | Detection needs to read `premium-mode=softgate-v1` and parse the new envelope. Lock card needs the watermarked preview (it currently renders the plaintext payload). All three import paths — feed card Use/Fork, preview-pane Use/Fork, Save JSON — need gating, not just the feed card. |
| 10.2 — Soft-gate crypto | `NWC.encrypt04` (NIP-04 AES-CBC) + the existing private-publishing AES-GCM helpers exist; HKDF still to add. | Add HKDF-SHA256 to the noble bundle. Build `deriveSoftGateKey` / encrypt+decrypt with AES-GCM and AAD = event coordinate. Design the obfuscated `softGatePepperForEpoch` constant. |
| 10.3 — Split-zap purchase | `payZapSplit({creatorPubkey,…})` exists with the hard-coded `PLATFORM_NPUB` recipient. Pays creator, then platform via NWC. | Switch from hard-coded 70/30 to `parseZapSplits(event)` + `calculateSplitAmounts(total, splits)` so creators can in principle define their own splits (still platform-enforced by the publish modal). Use the address coordinate (`#a`) for the receipt fast-path instead of the event id. |
| 10.4 — Purchase vault | Not started. | New surface — kind-30078 with `d=artstr:purchase-vault:v1`, NIP-44 self-encryption, vault salt per item, design-key wrapping. |
| 10.5 — My Purchases UI | Not started. | New tab in the Nostr modal. |
| 10.6 — Hardening + docs | Spec exists; honest copy still to land in the publish modal and the unlock confirm. | Add the "soft gate, not strong DRM" copy in the right places. |

The unlock confirm modal and the existing `payZapSplit` already
match the buyer-side UX described in §9.3, including the "creator
first, platform second" payment order. The receipt query needs to
swap from `#e` only to `#a` first, falling back to `#e` for
backwards-compat.

---

## 19. Phasing forward from here

The shipped Phases 0–3 + the existing tip-NWC integration become the
foundation. The remaining work, in the order I'll build it next on
the `zap-gated` branch:

1. **Soft-gate crypto primitive** — `deriveSoftGateKey`,
   `encryptPremiumPayload`, `decryptPremiumPayload`, the obfuscated
   epoch pepper, the noble HKDF add-on. Round-trip tests on synthetic
   payloads.
2. **Watermarked preview** — re-use the JPEG export pipeline; add
   the diagonal watermark; size-budget ≤ 50 KB.
3. **Premium publish event** — emit the new envelope under `content`,
   the new tag set (`premium`, `premium-mode`, `softgate-epoch`,
   `encrypted`, `zap-split`, multiple `zap` tags), and embed the
   preview JPEG. Replaces the current tag-only publish path.
4. **Premium consume** — `isPremiumEvent`, `getPremiumEnvelope`; the
   feed card renders the watermarked preview only; all three import
   paths gate on `row.premium && !row.premium.decrypted`; on unlock,
   derive the key locally and decrypt.
5. **Receipt fast-path by address** — switch from `#e` to `#a`
   queries so edit-in-place works (already noted as a gap).
6. **Purchase vault** — NIP-44 self-encrypted kind-30078 vault;
   write on unlock, read on app load, merge-by-`a` on conflict.
7. **My Purchases tab** — vault-backed list, open/decrypt actions,
   missing-event states.
8. **Hardening + copy** — the honest soft-gate language in the
   publish + unlock modals; comment the pepper as obfuscation, not
   security.

Phase 4 (E2E) from the older spec runs after #8 against the full
encrypted flow. Items already shipped — NWC client, platform-fee
constants, lock CTA, partial-unlock retry, tip-NWC integration —
remain in place and don't need re-implementing.
