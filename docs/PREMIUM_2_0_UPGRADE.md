# Artstr Studio Premium 2.0 Upgrade

## Admin Policy, Private Purchase Copies, Claim Windows, and Repair Tools

### Status

Implementation in progress. The core Premium 2.0 purchase path is now
implemented in the static browser client:

- admin-signed premium policy lookup and publish stamping;
- encrypted premium public storefront events;
- split-zap unlock through NWC;
- buyer-private purchase-copy publication;
- purchase-vault v2 index entries that point at private copies;
- partial-payment resume;
- pending private-copy retry;
- legacy vault migration;
- purchase repair tools;
- claim-window enforcement for first-time public claims.

Premium 1.0 already shipped the static soft-gate, split-zap unlock flow,
watermarked previews, and NIP-44 purchase vault. This Premium 2.0 plan
keeps that working base but changes the paid-design lifecycle:

```text
public premium event = storefront / checkout object
buyer-private purchase copy = owned usable copy
purchase vault = private index and repair surface
admin policy event = platform-controlled premium rules
```

Creators should not manage epochs. A creator should only choose
`Premium encrypted`, set price/title/category/license fields, and publish.
Artstr should automatically stamp new premium publishes with the current
admin-controlled policy.

---

## 0. Current Implementation Summary

Premium 2.0 now treats a paid design purchase as a multi-step browser
transaction. Each step is independently recoverable because payment,
decryption, private-copy publication, and vault-index publication can fail
at different times.

The happy path is:

1. Buyer clicks `Unlock` or `Resume payment` on a premium card.
2. Artstr resolves the creator's Lightning endpoint from the creator kind-0
   profile. If the feed cache is cold after a browser refresh, Artstr
   fetches the profile before deciding the creator lacks `lud16`/`lud06`.
3. Artstr resolves the platform Lightning endpoint from the pinned platform
   profile.
4. Artstr asks the buyer's NIP-07 signer to sign creator and platform
   NIP-57 zap requests.
5. Artstr fetches BOLT11 invoices for both split-zap legs.
6. Artstr pays both invoices through the buyer's NWC wallet connection.
7. Artstr records each returned preimage in local partial-payment state.
8. When both legs are paid, Artstr derives the soft-gate key and decrypts
   the public premium payload locally.
9. Artstr publishes a buyer-private encrypted purchase-copy event under the
   buyer's pubkey.
10. Artstr upserts the buyer's encrypted purchase-vault index with a v2 item
    pointing at that private copy.
11. Artstr clears pending local save state, updates the Purchased tab if it
    is open, and shows final unlock success.

The user-facing status toasts intentionally show these boundaries:

```text
Starting unlock...
Resolving Lightning endpoints...
Signing zap requests...
Fetching invoices...
Paying creator + platform fee...
Paying creator...
Paying platform fee...
Unlocked
Decrypting design...
Unlocked. Saving your private purchased copy...
Private copy saved. Syncing purchase vault...
Unlocked "<title>"
```

If the last visible status is `Private copy saved. Syncing purchase vault...`,
the payment and private-copy publication have already succeeded. The next
state is either final success or a recoverable vault-sync error.

### 0.1 Event Roles

Premium 2.0 uses three separate Nostr objects:

```text
public premium event
  kind: 30078
  author: creator
  role: storefront, preview, price, encrypted source payload

buyer-private purchase copy
  kind: 30078
  author: buyer
  d: artstr:purchase-copy:<hash>
  role: buyer-owned encrypted snapshot of the purchased design

purchase vault
  kind: 30078
  author: buyer
  d: artstr:purchase-vault:v1
  role: encrypted private index of owned premium designs
```

The public premium event remains useful as a storefront and provenance
source. The buyer-private purchase copy is the durable usable asset. The
purchase vault is the private inventory index that lets the Purchased tab
find and open buyer-owned copies across browsers/devices.

### 0.2 Purchased Tab Behavior

The Purchased tab is backed by the buyer's encrypted purchase vault. It does
not list a design merely because the public card is currently unlocked in
memory. It lists designs once Artstr can load a vault item, and for v2 items
it then fetches and decrypts the referenced private purchase copy.

Current behavior:

- on tab open, render cached vault items immediately if `_vaultCache` exists;
- retry locally pending private-copy saves before rendering;
- re-query relays for the latest vault;
- render each vault item as a normal feed card that opens the decrypted
  payload;
- show `Retry saving private copy` if a payment/decrypt succeeded but relay
  publish did not finish;
- show `Repair purchases` to retry pending saves, migrate legacy inline
  entries, and validate private-copy pointers;
- after a successful new purchase, refresh the Purchased tab if it is
  already open.

Because relays are eventually consistent, a just-purchased item may be
visible from the in-memory cache before every relay has the latest vault
event. The `Refresh` button forces a relay re-query.

### 0.3 NWC Timeout and Partial-Payment Recovery

NWC responses are not the same thing as Lightning settlement. A wallet can
settle an invoice but fail to return a `pay_invoice` response before the
browser timeout. Premium 2.0 handles that as a recoverable state.

Artstr now:

- uses a longer timeout for `pay_invoice` than ordinary NWC requests;
- stores fetched BOLT11 invoices and returned preimages per leg;
- calls `lookup_invoice` before paying a cached invoice on retry;
- sends BOLT11 invoices to `lookup_invoice` as `{ invoice }`, and non-invoice
  values as `{ payment_hash }`;
- after a `pay_invoice` timeout, immediately calls `lookup_invoice` on that
  BOLT11 before treating the leg as failed;
- only retries legs without a cached preimage.

This matters for split zaps. If the platform fee succeeds and the creator leg
times out, the buyer should be able to click `Resume payment`; Artstr checks
cached invoices/preimages and should not repay the platform leg.

### 0.4 Local Pending Save State

Payment success does not guarantee relay persistence. If the buyer paid and
the browser decrypted the design, but private-copy or vault publication
fails, Artstr stores a local pending private-copy record.

The pending record exists so the buyer can recover without paying again. The
Purchased tab surfaces it with `Retry saving private copy`, and the repair
workflow attempts the same retry automatically.

Pending state should be cleared only after:

```text
private purchase copy published
purchase vault index published
vault cache updated
```

### 0.5 Success Criteria for a Completed Purchase

A Premium 2.0 purchase is complete when all of these are true:

- both split-zap legs have preimages;
- the premium payload decrypts;
- the buyer-private purchase-copy event publishes;
- the purchase vault publishes with a v2 pointer to that private copy;
- the local pending-save record is cleared;
- the Purchased tab can render the vault item.

If only the public premium card says unlocked, the buyer has local access.
If the Purchased tab also shows the design, the buyer has the intended
Premium 2.0 durable inventory path.

---

## 1. Goals

Premium 2.0 should:

- make the buyer's durable asset a private encrypted Nostr event under the
  buyer's pubkey;
- keep the public premium event as a checkout/storefront object;
- let the Artstr admin rotate claim/softgate policy only when needed;
- keep creators out of epoch management;
- preserve all existing Premium 1.0 purchases;
- improve partial-payment and relay-publish recovery;
- normalize receipt evidence for future support and migration;
- prepare for a future real unlock bot without changing buyer UX.

Non-goals:

- hard DRM;
- retroactive revocation;
- storing secrets in public Nostr events;
- remote executable code from Nostr;
- taking purchased designs away from honest buyers.

Compatibility gate:

```text
Every Premium 2.0 phase must prove that Premium 1.0 purchases still open.
```

That means old `softgate-v1` events, vault v1 inline payload entries, and
address-tolerant purchase lookups remain supported while the new private
purchase-copy model is added.

---

## 2. Security Model

This remains a static-client soft gate until a future unlock bot exists.

If the public Artstr app can fetch public Nostr events and derive an unlock
key, a modified client can also do that. Claim windows and epochs do not
delete old relay events, stop relay archives, or prevent old clients from
ignoring newer policy.

Premium 2.0 is valuable anyway because it improves:

- honest-client behavior;
- buyer ownership durability;
- migration safety;
- admin damage control;
- long-term separation between purchase and storefront;
- operational recovery after partial failures.

Do not publish JavaScript, WASM, or arbitrary unlock code in a Nostr event.
The admin policy event contains signed data/config only. The static client
contains the interpreter and rejects untrusted or malformed policy.

---

## 3. Current Premium 1.0 Flow

Current behavior:

1. Creator publishes a public premium kind-30078 event.
2. Public event includes metadata, watermarked preview, zap split tags,
   encrypted payload, and `softgate-epoch`.
3. Buyer clicks unlock.
4. Artstr pays creator/platform split zaps through NWC.
5. Artstr confirms required zap receipts.
6. Browser derives the static soft-gate key locally.
7. Browser decrypts the premium payload.
8. Browser saves the unlocked payload/key in the buyer's NIP-44 purchase
   vault.

The current weak point is architectural: the public premium event remains
the long-term source object. The buyer depends on the public event plus
soft-gate logic unless the vault contains enough inline payload data.

---

## 4. Backward Compatibility Contract

Premium 2.0 must be additive. It can prefer private purchase copies for
new purchases, but it must not strand old buyers or old creator events.

### 4.1 Vault v1 Purchases

Existing vault entries may store the decrypted payload inline. Those must
continue to open exactly as they do today.

Resolution order:

```text
if vault item has privateCopy:
  fetch/decrypt private purchase copy
else if vault item has inline payload:
  open inline payload and offer/save private copy
else:
  show repairable missing-purchase state
```

Do not require a private purchase-copy event for old purchases.

### 4.2 Old softgate-v1 Events

The client must keep `softgate-v1` decryption available. Admin policy is
not required to open already-owned old purchases.

Policy may influence new first-time unlocks from old public premium
events, but it must not block:

- buyer-private purchase copies;
- vault v1 inline payload items;
- self-authored premium event recovery.

### 4.3 Old Clients Reading New Events

Old clients will not understand `softgate-v1.5`, `claim-epoch`, or
`private-snapshot-required`. That is acceptable.

New premium events should be explicit enough that old clients fail clearly
rather than silently treating a new purchase as a normal `softgate-v1`
unlock:

```json
["premium-mode", "softgate-v1.5"]
["post-purchase-action", "private-snapshot-required"]
```

### 4.4 Edit-In-Place Events

Private purchase copies snapshot the purchased event. They should record
both:

```text
source address coordinate = 30078:<creator-pubkey>:<d-tag>
source event id at purchase = <event-id>
```

The address coordinate preserves provenance across creator edits. The
event id captures what the buyer actually purchased. The buyer's private
copy does not automatically mutate when the creator republishes the
source.

### 4.5 Relay and Publish Failures

Payment success, payload decrypt, private-copy publish, and vault-index
publish are separate states.

If private-copy publication fails after payment/decrypt:

- keep local decrypted access;
- do not show final synced success;
- persist enough local pending state to retry;
- show `Retry saving private copy`;
- let `Repair Purchases` finish the save later.

---

## 5. Premium 2.0 Flow

Premium 2.0 changes the post-payment path:

1. Artstr fetches and verifies the signed admin premium policy event.
2. Creator publishes a premium event as usual. Artstr automatically stamps
   policy fields such as `softgate-epoch`, `claim-epoch`, optional
   `claim-until`, and `post-purchase-action`.
3. Buyer unlocks and pays split zaps as today.
4. Artstr verifies all required receipts.
5. Browser decrypts the public premium payload once.
6. Browser publishes a buyer-private NIP-44 purchase-copy event.
7. Browser upserts a purchase vault v2 item pointing at that private copy.
8. Artstr marks the purchase `unlocked_synced`.
9. Future opens prefer the buyer-private copy, not the public premium
   event.

Important rule:

```text
Do not show final "Unlocked" success until the private copy and vault index
are published.
```

If payment/decrypt succeeds but relay publishing fails, the buyer keeps
local access and sees a recoverable "Retry saving private copy" state.

---

## 6. Admin Premium Policy Event

The Artstr admin controls premium epochs and defaults by publishing one
signed replaceable event. Relays are only transport. Trust comes from a
pinned Artstr platform pubkey.

Event:

```json
{
  "kind": 30078,
  "pubkey": "<ARTSTR_PLATFORM_PUBKEY>",
  "tags": [
    ["d", "artstr:premium-policy:v1"],
    ["client", "Artstr Studio"],
    ["policy", "premium-policy-v1"]
  ],
  "content": "{...json...}"
}
```

Content:

```json
{
  "v": 1,
  "activeSoftgateEpoch": "2026-07",
  "activeClaimEpoch": "2026-07",
  "defaultClaimDays": 0,
  "claimWindow": "manual",
  "minClaimDays": 0,
  "maxClaimDays": 3650,
  "privateCopies": "required",
  "firstUnlockDefault": "allowed",
  "issuedAt": 1783200000,
  "epochs": {
    "2026-05": {
      "status": "legacy",
      "firstUnlock": "allowed",
      "privateCopies": "allowed",
      "softgateKdf": "artstr-softgate-v1",
      "minClientPolicy": 1
    },
    "2026-07": {
      "status": "active",
      "firstUnlock": "allowed",
      "privateCopies": "required",
      "softgateKdf": "artstr-softgate-v1.5",
      "workFactor": 1,
      "manifestFragment": "<base64-public-fragment>"
    }
  }
}
```

Verification rules:

- event kind must be `30078`;
- author pubkey must equal the pinned Artstr platform pubkey;
- `d` tag must be `artstr:premium-policy:v1`;
- event signature must verify;
- content must parse as JSON;
- unknown major `v` fails closed for first-time unlocks;
- policy fetch failure must not block already-claimed private copies.

Admin rotation is rare. Use it when:

- bypass scripts are widely shared;
- a soft-gate epoch is reverse-engineered publicly;
- buggy unlock behavior must be retired;
- Artstr moves to a new KDF/policy version;
- a future unlock bot replaces static soft-gate key delivery.

---

## 7. Creator Publishing

Creators should not choose epochs.

Creator-controlled fields:

- price;
- title;
- category;
- language;
- preview generated from current artboard/deck;
- optional license template;
- normal publish/update action.

Artstr-controlled automatic fields:

```json
[
  ["premium-mode", "softgate-v1.5"],
  ["softgate-epoch", "<policy.activeSoftgateEpoch>"],
  ["claim-epoch", "<policy.activeClaimEpoch>"],
  ["claim-until", "<now + policy.defaultClaimDays, omitted when manual>"],
  ["claim-policy", "private-snapshot-required"],
  ["post-purchase-action", "private-snapshot-required"]
]
```

Envelope additions:

```json
{
  "premiumMode": "softgate-v1.5",
  "softgate": {
    "version": 1,
    "epoch": "2026-07",
    "claimEpoch": "2026-07",
    "publicDesignSalt": "<base64-random-32-bytes>",
    "purchaseScope": "address",
    "claimUntil": 0,
    "postPurchaseAction": "private-snapshot-required"
  },
  "license": {
    "type": "personal-use-template",
    "summary": "Personal use template"
  }
}
```

Creator UI should stay simple:

```text
Premium purchases stay claimable until Artstr closes the epoch. Buyers keep
a private encrypted copy after purchase.
```

Do not expose `epoch`, `KDF`, or `policy manifest` language in normal
creator UI.

---

## 8. Claim Windows

Claim windows are honest-client policy.

Rules:

- `claim-until` is optional. If it is absent or `0`, the public listing stays
  claimable until the admin manually closes the epoch;
- when `claim-until` is present, it controls first-time public-premium
  unlock attempts;
- after `claim-until`, honest clients stop offering a new first-time unlock
  from that public event;
- already-claimed private purchase copies keep opening;
- self-authored premium events can keep auto-unlocking for the creator;
- expired source events remain browseable as previews;
- expired source CTA becomes "Claim period ended" unless the buyer owns a
  copy.

Recommended defaults:

- default claim window: unlimited/manual close (`defaultClaimDays: 0`);
- creator does not configure it in v2.0;
- admin can later expose creator choice within `minClaimDays` and
  `maxClaimDays` if there is real demand;
- old `softgate-v1` events remain claimable until the admin policy closes
  the epoch.

Claim windows should never be described as cryptographic expiry.

If an epoch is manually closed and a creator wants an old public listing to
be purchasable again, the creator should use the owner-only `Refresh epoch`
action or otherwise update/republish the listing under the current active
policy. The new public event reuses the same replaceable-event `d` tag, gets
the new active epoch, and becomes the current storefront for that address.
Existing buyers keep their older private purchase copies as snapshots of what
they bought.

The `Refresh epoch` action does not silently publish. It:

1. decrypts the creator's existing premium payload;
2. loads it into the editor without requiring design edits;
3. enters normal edit/update mode for the original `d` tag;
4. enables Premium with the existing price;
5. opens the standard publish confirmation;
6. publishes through the normal Premium path, which stamps the current admin
   policy and encrypts with the current soft-gate epoch.

If old epoch crypto has been reverse-engineered, that old derivation should
not unlock the refreshed listing because the refreshed event has a newly
encrypted payload under the active epoch. This is still a static-client
soft gate, not hard DRM, but it prevents old-epoch bypass tooling from
automatically carrying forward to the refreshed storefront.

---

## 9. Buyer-Private Purchase Copy

After decrypting a paid design, the buyer publishes a private encrypted
copy under their own pubkey.

Event:

```json
{
  "kind": 30078,
  "tags": [
    ["d", "artstr:purchase-copy:<sha256-address-b64url>"],
    ["client", "Artstr Studio"],
    ["encrypted", "nip44"],
    ["t", "casewrap-purchase-copy"],
    ["purchase-copy", "true"]
  ],
  "content": "<NIP-44 self-encrypted purchase-copy JSON>"
}
```

Public tags intentionally do not include title, creator, source address,
amount, license, or receipts.

Encrypted content:

```json
{
  "v": 1,
  "kind": "artstr-purchase-copy",
  "createdAt": 1783200000,
  "source": {
    "a": "30078:<creator-pubkey>:premium:customart:poster",
    "eventId": "<premium-event-id-at-purchase>",
    "creatorPubkey": "<creator-pubkey>",
    "title": "Poster Template",
    "premiumMode": "softgate-v1.5",
    "softgateEpoch": "2026-07",
    "claimEpoch": "2026-07"
  },
  "purchase": {
    "buyerPubkey": "<buyer-pubkey>",
    "amountSats": 1000,
    "unlockedAt": 1783200000,
    "receipts": [
      {
        "recipientPubkey": "<creator-pubkey>",
        "amountSats": 700,
        "receiptId": "<kind-9735-id>",
        "preimage": "<optional-if-known>"
      },
      {
        "recipientPubkey": "<platform-pubkey>",
        "amountSats": 300,
        "receiptId": "<kind-9735-id>",
        "preimage": "<optional-if-known>"
      }
    ]
  },
  "license": {
    "type": "personal-use-template",
    "snapshot": true,
    "sourceCanChange": true
  },
  "payloadSchemaVersion": 5,
  "payload": {
    "...": "full decrypted Artstr project JSON"
  }
}
```

The purchase copy is a snapshot. If the creator edits the public premium
event later, the buyer's copy does not mutate. That is the safer default
for purchased digital goods.

---

## 10. Purchase Vault v2

The purchase vault remains the buyer's private index. New entries should
point at private purchase copies instead of carrying the full durable
ownership burden inline.

Vault v2 item:

```json
{
  "schema": "purchase-vault-v2",
  "a": "30078:<creator-pubkey>:premium:customart:poster",
  "eventId": "<premium-event-id-at-purchase>",
  "privateCopy": "30078:<buyer-pubkey>:artstr:purchase-copy:<sha256-address-b64url>",
  "privateCopyEventId": "<optional-latest-event-id>",
  "creatorPubkey": "<creator-pubkey>",
  "title": "Poster Template",
  "mode": "customart",
  "unlockedAt": 1783200000000,
  "amountSats": 1000,
  "claimEpoch": "2026-07",
  "softgateEpoch": "2026-07",
  "licenseType": "personal-use-template",
  "receiptSummary": {
    "requiredCount": 2,
    "confirmedCount": 2,
    "totalSats": 1000
  }
}
```

Compatibility:

- vault v1 items with inline `payload` remain valid;
- vault v2 readers first try `privateCopy`;
- if `privateCopy` is missing but inline `payload` exists, open the inline
  payload and offer/save a private copy;
- if a vault stub exists but the private copy is missing, show a repairable
  missing-copy state.

The existing split-vault per-item design should be reused. Per-item events
can carry either a legacy inline payload item or a v2 pointer.

---

## 11. Partial Payment Recovery

Split zaps make partial payment the most important failure mode.

Premium 2.0 should persist a local pending unlock record as soon as each
invoice is issued/paid:

```json
{
  "source": "30078:<creator-pubkey>:premium:customart:poster",
  "eventId": "<event-id>",
  "buyerPubkey": "<buyer-pubkey>",
  "status": "payment_partial",
  "requiredPayments": [
    {
      "role": "creator",
      "recipientPubkey": "<creator-pubkey>",
      "amountSats": 700,
      "invoice": "<bolt11>",
      "paid": true,
      "receiptId": "<kind-9735-id>"
    },
    {
      "role": "platform",
      "recipientPubkey": "<platform-pubkey>",
      "amountSats": 300,
      "invoice": "<bolt11>",
      "paid": false,
      "receiptId": ""
    }
  ]
}
```

Recovery behavior:

- query receipts on reload before asking the buyer to pay again;
- retry only missing legs;
- never ask the buyer to repay a confirmed leg;
- if all receipts are found, continue decrypt/private-copy/vault flow;
- expose "payment confirmed, saving private copy failed" separately from
  "payment incomplete."

---

## 12. Receipt Evidence Normalization

Vault and purchase-copy content should preserve normalized evidence:

- source address coordinate;
- event id at purchase time;
- buyer pubkey;
- recipient pubkeys;
- amount per split leg;
- total amount;
- zap receipt ids;
- invoice/preimage if available;
- unlock timestamp;
- policy event id;
- claim epoch;
- softgate epoch;
- premium mode;
- app version or client policy version.

This supports:

- cross-device repair;
- future disputes/debugging;
- migration to unlock bot;
- "already paid, finish claim" flows;
- analytics without exposing private details publicly.

---

## 13. Repair Purchases Tool

Add a buyer-facing "Repair Purchases" action under My Designs / Premium.

It should:

1. load the purchase vault;
2. fetch each `privateCopy`;
3. decrypt and validate each private copy;
4. detect legacy inline payload items;
5. publish missing private copies when a payload is available;
6. republish the vault index if private-copy pointers are missing;
7. query receipts for pending/partial purchases;
8. report a concise result.

Possible results:

```text
All purchases are synced.
Saved 3 private copies.
1 purchase is missing its private copy; retry failed on all relays.
Found 1 paid purchase that still needs to be claimed.
```

This is a practical buyer-trust feature and should ship before more KDF
friction.

---

## 14. UX Language

Use buyer-centered language:

- `Claim your private copy`
- `Private copy saved`
- `Claim period ends Aug 31, 2026`
- `Claim period ended`
- `Already claimed`
- `Retry saving private copy`
- `Repair purchases`

Avoid normal-user language like:

- DRM;
- revocation;
- epoch;
- KDF;
- manifest;
- cryptographic expiry.

Creator-facing copy:

```text
Premium buyers get a private encrypted copy after purchase. Artstr manages
the claim window automatically.
```

Buyer-facing failure copy:

```text
Payment confirmed. Your design opened on this device, but your private
purchased copy has not synced yet.
```

---

## 15. Soft-Gate KDF 2.0

The admin policy event can be part of the KDF input, but it must not be
the whole key material.

Recommended derivation:

```text
premiumKey = HKDF-SHA256(
  inputKeyMaterial =
    bakedClientEpochMaterial(softgateEpoch)
    || canonicalSignedPolicyMaterial(claimEpoch)
    || optionalPublicManifestFragment,
  salt = publicDesignSalt,
  info =
    "artstr-softgate-v1.5"
    || softgateEpoch
    || claimEpoch
    || creatorPubkey
    || premiumAddress
    || payloadSchemaVersion
)
```

This is still public/obfuscated material. It improves rotation and breaks
old hardcoded scripts more often. It does not create a hidden secret.

Do not over-invest here before private purchase copies and repair tooling.

---

## 16. Future Secure Gate

Premium 2.0 should make the future secure gate easy:

```text
buyer pays
unlock bot verifies receipts
bot encrypts design key or full purchase copy to buyer pubkey
buyer stores private copy + vault pointer
```

When that arrives, the buyer-side storage model can stay the same. The
only change is who creates the private copy or unlock envelope:

- Premium 2.0: buyer browser decrypts static soft-gate public event and
  publishes private copy;
- future Premium 3.0 / secure gate: bot publishes buyer-specific encrypted
  key/copy after payment.

---

## 17. Implementation Plan

### Phase A: Policy Read Path

- Add pinned Artstr platform policy pubkey.
- Fetch latest `d=artstr:premium-policy:v1`.
- Verify signature, author, kind, d-tag, and schema.
- Cache verified policy locally.
- Continue opening existing private copies when policy fetch fails.

Tests:

- accepts valid signed policy;
- rejects wrong pubkey;
- rejects wrong `d` tag;
- rejects malformed content;
- rejects unknown major version for first-time unlock;
- opens already-claimed private copy without policy network access;
- opens vault v1 inline payload without policy network access.

### Phase B: Automatic Publish Stamping

- New premium publishes use the active policy epochs automatically.
- Add claim tags and envelope fields.
- Keep creator UI simple.
- Preserve `softgate-v1` compatibility.

Tests:

- new premium publish emits expected tags;
- creator does not choose epoch;
- missing policy blocks new premium publish with actionable message;
- existing non-premium publish unaffected;
- existing `softgate-v1` premium publish/edit path remains readable.

### Phase C: Private Purchase Copy

- Add purchase-copy event builder.
- Publish private copy after decrypt and before final unlock success.
- Store vault v2 pointer.
- Add retry state for private-copy publish failure.

Tests:

- paid unlock publishes encrypted `casewrap-purchase-copy`;
- public purchase-copy tags do not leak source/title/amount;
- vault v2 item points to private copy;
- cache wipe plus Nostr login restores from private copy;
- old vault v1 inline payload opens when no private copy exists.

### Phase D: Claim Window Enforcement

- First-time unlock checks `claim-until` and admin epoch status.
- Already-owned copies bypass source claim expiry.
- Expired premium cards render preview plus ended state.

Tests:

- unowned expired source blocks first-time unlock;
- owned expired source opens from private copy;
- owned legacy vault v1 inline payload opens after source expiry;
- self-authored premium still opens for creator;
- legacy policy behavior matches admin epoch config.

### Phase E: Partial Payment Recovery

- Persist pending split-zap state locally.
- Query receipts on reload.
- Retry only missing legs.
- Resume decrypt/private-copy/vault after all receipts exist.

Tests:

- creator leg paid/platform leg failed resumes correctly;
- reload after partial payment finds receipt and asks only for missing leg;
- all receipts found continues without repayment;
- no duplicate payment prompt for confirmed leg;
- pending payment recovery does not overwrite existing vault v1 purchases.

### Phase F: Vault Migration

- Read vault v1 inline-payload entries.
- Offer/save private copy for legacy purchases.
- Keep split-vault per-item behavior.
- Write v2 pointers after migration.

Tests:

- v1 vault item still opens;
- v1 item migrates to private copy;
- missing private-copy event is repairable if inline payload exists;
- split vault still hydrates;
- migration preserves source address and event id at purchase.

### Phase G: Repair Purchases

- Add My Designs / Premium repair action.
- Validate vault entries and private copies.
- Republish missing private copies where possible.
- Surface concise results.

Tests:

- all-good state reports clean;
- legacy inline payload creates private copy;
- missing private copy with no payload reports unrecoverable state;
- pending paid purchase resumes claim flow;
- repair never deletes or rewrites a working v1 purchase unless the v2 copy
  publish succeeds.

### Phase H: Admin Rotation Playbook

- Add `SECURITY.md` or premium security section.
- Document how to publish a new admin policy event.
- Include active/legacy/closed epoch fixtures.
- Explain soft-gate limits honestly.

Tests:

- active epoch used by publish path;
- closed epoch blocks first-time unlock;
- legacy epoch still opens existing private copies;
- legacy epoch still opens vault v1 inline payload purchases;
- malformed policy cannot change unlock behavior.

---

## 18. Test Strategy

Premium 2.0 should be built behind tests from the start. The highest-risk
regression is breaking already-paid purchases, so compatibility tests are
not optional.

### 18.1 Unit Tests

Pure helper tests should cover:

- admin policy verification;
- claim-window status calculation;
- vault v1/v2 item resolution order;
- purchase-copy d-tag derivation;
- receipt normalization;
- partial-payment state reducer;
- source address/event id preservation;
- public-tag privacy for purchase-copy events.

### 18.2 Golden Fixtures

Add stable fixtures under `tests/fixtures/premium/`:

```text
softgate-v1-envelope.json
softgate-v1_5-envelope.json
vault-v1-inline-payload.json
vault-v2-private-copy-pointer.json
purchase-copy-v1.json
policy-valid-active.json
policy-wrong-pubkey.json
policy-malformed-content.json
policy-active-legacy-closed.json
partial-payment-creator-paid.json
partial-payment-all-paid.json
```

Fixtures should be small but structurally realistic. They should encode
the old shapes and the new shapes so test failures reveal incompatible
schema changes.

### 18.3 Fake Relay Integration Tests

Use a fake relay/publish/query adapter before real-money testing:

1. publish a premium event;
2. simulate split-zap receipts;
3. decrypt payload;
4. publish private copy;
5. publish vault v2 index;
6. wipe local cache;
7. reload from fake relay;
8. verify the purchase opens from the private copy.

Failure-path fake relay tests:

- private-copy publish fails after payment;
- vault-index publish fails after private copy;
- private copy missing but v1 inline payload exists;
- policy fetch unavailable;
- malformed policy event present;
- expired source event with owned private copy.

### 18.4 Browser Smoke Tests

Use Playwright with fake Nostr/NWC adapters for the full UI path:

- old v1 purchase still opens;
- new purchase creates private copy before final unlocked state;
- cache wipe restores from private copy;
- repair tool migrates legacy inline payload to private copy;
- expired premium card shows `Claim period ended`;
- partial payment resumes and retries only the missing leg.

### 18.5 Manual Real-Money Test

After fake adapters pass, run one real NWC/CoinOS smoke test:

```text
creator browser publishes premium
buyer browser pays split zap
private copy publishes
vault v2 pointer publishes
cache wipe
buyer logs in again
purchase opens from private copy
```

Do this only after fake relay and browser tests cover the failure matrix.

### 18.6 Per-Phase Regression Rule

Every implementation PR/phase must include one passing regression test
for:

```text
Premium 1.0 vault item opens successfully.
```

If a phase changes unlock, vault, policy, or premium event parsing and
cannot prove that, it is not done.

---

## 19. Recommended Build Order

Build in this order:

1. private purchase-copy event;
2. purchase vault v2 pointer support;
3. repair/migration path;
4. admin policy event read path;
5. automatic policy stamping for new premium publishes;
6. claim-window behavior;
7. partial-payment recovery hardening;
8. KDF policy-material mixing;
9. admin rotation playbook.

Reason: private copies and repair tools improve real buyer durability
immediately. Epoch/KDF work is useful, but it only becomes valuable once
buyers no longer depend on the public premium event as the durable source.

---

## 20. Final Recommendation

Premium 2.0 should be framed as:

```text
Claim your purchased private copy.
```

not:

```text
Stronger DRM.
```

The practical win is that paid designs become Nostr-native owned assets
instead of repeated unlocks of public storefront blobs. That makes the
system more durable, easier to migrate, easier to repair, and better
prepared for a real unlock bot later.
