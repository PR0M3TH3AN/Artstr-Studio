# Private (Encrypted) Publishing

## Goals

Let any Artstr design — cover, disc, jewel, custom art, slide, deck — be
published to Nostr **encrypted**, so only the author can read it. An
encrypted design is a normal `kind:30078` addressable event (still
editable in place), but its contents are an encrypted blob instead of
plaintext JSON.

### Product goal (v1 = Phase 1)

**"Private to me."** A design published privately:

- is encrypted so only the author can decrypt it;
- never appears in the public community feed;
- shows in **My Designs**, where the author decrypts and opens it normally;
- stays editable in place — republishing the same `d`-tag supersedes it.

### Non-goals (v1)

- **Sharing with other people** (private-to-selected-pubkeys) — Phase 3.
- **Public ⇄ private toggling** of an already-published design — Phase 2.
- **NIP-59 gift-wrap** metadata privacy — Phase 4.
- **Blossom / NIP-96 offload** for oversized encrypted blobs — Phase 4.
- Hiding that an encrypted Artstr event *exists* — the event, the author
  pubkey, and the timestamp are always public. Encryption hides the
  design *contents*, nothing more.

### Decisions (locked)

1. **Private designs are invisible in the public feed** — they omit the
   `["t","casewrap"]` discovery tag entirely, so the feed query never
   fetches them. No "locked card" in New/Popular/etc.
2. **Phase 1 only** for now — "private to me", no recipients.
3. **Key-wrap uses NIP-44 when available, NIP-04 as fallback** — so the
   feature works with as many NIP-07 extensions as possible.
4. **No `SCHEMA_VERSION` bump** — the decrypted payload is unchanged
   (still v5). The *encryption envelope* is versioned separately.

### Implementation status

- **Phase 0 — codebase audit: done.** The app uses only `getPublicKey` /
  `signEvent`; **no NIP-04/44 anywhere** — the `kind:10000` mute list is
  plain `p` tags, so there is no crypto codepath to reuse. `CompressionStream`
  is assumed (with a `compression:"none"` fallback). Extension-runtime
  checks (encrypt-to-self on Alby/nos2x, relay size) are validated by the
  user in-browser; the build is defensive (capability probe + NIP-04
  fallback) so it works regardless.
- **Phase 1 — built (pending in-browser testing).** Done:
  - Crypto helpers — `encryptProjectEnvelope` / `decryptProjectEnvelope`
    (AES-256-GCM over gzip, NIP-44 key-wrap with NIP-04 fallback,
    `nostrEncryptCapability` probe).
  - `publishEncryptedDesign` — feed-invisible event: random persistent
    `d`-tag, only `d` / `alt` / `encrypted` tags, no `casewrap` tag.
  - Publish-confirm modal Public/Private control + private warning +
    capability gate; private branch wired into `publishCurrentTemplate`
    and `publishDiscDesign`.
  - My Designs decrypts the author's own private events and shows a
    🔒 Private badge; `buildRowsFromEvents` skips stray encrypted events.
  - `state.visibility` / `state.privateDTag`; restored on load, cleared
    on close.
  - Known v1 gaps: file-save writes plaintext without a `visibility`
    flag (re-pick Private on publish); a failed decrypt in My Designs is
    skipped silently rather than shown as a locked card.
- **Phase 2 — built (pending in-browser testing).** An owner-only
  **Make Public / Make Private** button on a design's preview page
  (`republishDesignVisibility`) re-publishes the design under the same
  `d`-tag with the opposite wrapper — a NIP-33 in-place replace — behind
  a confirm that states the public→private caveat. The button is gated
  on encryption capability for the →private direction.
- **Phases 3–4 — not started.**

### The honest caveat

Encryption protects the design *contents*. It does **not** hide that an
encrypted event exists, who authored it, or when. And replacement is not
deletion: if a design was ever public, old public copies may persist on
relays regardless of what is published later. The publish UI must say so.

### Threat model

**Protected:** design *contents* — layers, artwork URLs, text, title,
category and identifiers — from relays, feed scrapers, and anyone
browsing Artstr or any other Nostr client.

**Not protected — and the UI must not imply otherwise:**

- The **existence** of the event, the **author pubkey**, the
  **`created_at`** timestamp, and the event **size** — all public on
  every relay it touches.
- Anything on the **author's own device** — the `localStorage` autosave
  and any "Save project (JSON)" file are plaintext. Encryption applies
  *only* to what is published to Nostr.
- Against a **malicious or compromised NIP-07 extension** — it holds the
  signing key and performs the key-wrap.
- **Forward secrecy** is a non-goal; a fresh AES key per publish is a
  weak bonus, not a guarantee.

---

## Why this fits the repo

- Designs already publish as `kind:30078` addressable events with a
  mode-prefixed `d`-tag; owners already edit in place by republishing the
  same `d`-tag (`publishCurrentTemplateToNostr`, `isEditing()`).
- The project JSON is already the portable, publishable artifact — we
  encrypt *that*, unchanged.
- The community feed already filters by `#t:['casewrap']`; omitting that
  one tag is all it takes to keep a design out of the feed.
- **My Designs** already queries by author pubkey, so the author's own
  encrypted events are fetched there without any query change.
- Image references are remote URLs, never embedded binary — so the
  plaintext to encrypt is bounded to layer JSON.

### Current-state facts the plan is built on

- Publish path: `publishCurrentTemplateToNostr()` builds `payload` per
  mode, a `typeTag`, a `dTag` (`${mode}:${title|imdb|dims}`), tags via
  `getTemplateTags()`, then `{ kind:30078, tags, content:
  JSON.stringify(payload) }`, signed/sent by `publishCommunityEvent()`.
- Feed: `queryRelays(relays, { kinds:[30078], '#t':['casewrap'] }, …)`,
  then `buildRowsFromEvents()` does `JSON.parse(e.content)` and
  `normalizeTemplateMode(payload)` on every event.
- **My Designs** (`loadMyDesigns`) fetches events authored by
  `state.community.myPubkey`.
- NIP-07 surface used today: `window.nostr.getPublicKey`,
  `signEvent`. NIP-44 / NIP-04 are **not** used yet.

---

## Data model

### Public design — UNCHANGED

Public events stay exactly as today: `content` is the raw project JSON
(`{ version:5, templateMode, meta, … }`). Old clients keep working. A
flat, additive `"visibility":"public"` field *may* be added to the
payload, but no wrapper — nothing that moves `templateMode`.

### Encrypted design — new envelope

The event `content` is the **encryption envelope**, not a design payload:

```json
{
  "v": 1,
  "visibility": "encrypted",
  "enc": {
    "alg": "aes-256-gcm",
    "keywrap": "nip44",          // or "nip04"
    "compression": "gzip"        // or "none"
  },
  "iv": "<base64>",
  "ciphertext": "<base64>",
  "recipients": [
    { "pubkey": "<author-pubkey>", "wrappedKey": "<wrapped>" }
  ]
}
```

- `ciphertext` = AES-256-GCM of `gzip(JSON.stringify(projectPayload))`.
- `projectPayload` is the **ordinary, current design JSON** — the exact
  thing `customArtPayload()` / `deckPayload()` / `coverTemplatePayload()`
  / etc. already produce. Decryption yields a payload `loadProjectFromText`
  already understands.
- `recipients[]` carries the AES key wrapped per recipient. In Phase 1
  there is exactly one entry: the author (encrypt-to-self). `wrappedKey`
  is `nostr.nip44.encrypt(authorPubkey, base64(rawAesKey))`, or the NIP-04
  equivalent when `keywrap === "nip04"`.

### Event tags — encrypted designs

Minimal, leak-free:

```
["d",   "artstr-private-<random-id>"]   // random, NOT title/imdb derived
["alt", "Encrypted Artstr design"]      // NIP-31 generic
["encrypted", "nip44"]                  // or "nip04"
```

Deliberately **absent**: `["t","casewrap"]`, `title`, `i` (imdb/upc/…),
`category`, `language`, `template_type`, and the `["t","casewrap-*"]`
tags. `getTemplateTags()` is **not** called for a private design.

The `d`-tag is random but **persistent for that design** — minted once on
first private publish, reused on every edit so replacement works.

---

## Crypto

All in-browser, no new vendored libraries:

- **AES-256-GCM** via WebCrypto (`crypto.subtle`).
- **gzip** via `CompressionStream('gzip')` (fallback: `compression:"none"`
  when unavailable).
- **Key-wrap** via the NIP-07 extension: `window.nostr.nip44.encrypt`,
  falling back to `window.nostr.nip04.encrypt`. Encrypt-to-self is valid —
  ECDH(my privkey, my pubkey) is a well-defined shared secret.

### Encrypt (publish)

```
rawKey   = crypto.getRandomValues(32 bytes)      // fresh per publish
iv       = crypto.getRandomValues(12 bytes)
plain    = gzip(utf8(JSON.stringify(projectPayload)))
cipher   = AES-GCM.encrypt(rawKey, iv, plain)
wrapped  = nostr.nip44.encrypt(authorPubkey, base64(rawKey))   // or nip04
envelope = { v:1, visibility:"encrypted", enc:{…}, iv, ciphertext:cipher,
             recipients:[{ pubkey:authorPubkey, wrappedKey:wrapped }] }
```

### Decrypt (My Designs / open)

```
mine     = envelope.recipients.find(r => r.pubkey === myPubkey)
rawKey   = base64decode(nostr.nip44.decrypt(mine.pubkey, mine.wrappedKey))
plain    = AES-GCM.decrypt(rawKey, envelope.iv, envelope.ciphertext)
payload  = JSON.parse(gunzip(plain))             // ordinary design JSON
```

`keywrap` in the envelope says which of nip44/nip04 to use for the unwrap.

### Capability gate

On opening the publish modal, probe `window.nostr?.nip44?.encrypt ||
window.nostr?.nip04?.encrypt`. If neither exists, the **Private** option
is disabled with a tooltip ("Your Nostr extension doesn't support
encryption"). In practice NIP-04 is near-universal, so this rarely bites.

---

## The surfaces

### 1. Publish modal — visibility control

A radio / segmented control:

```
Publish visibility:
  ( ) Public — listed in the community feed, anyone can open it
  (•) Private — encrypted; only you can open it; not in the feed
```

When **Private** is selected the confirm modal swaps its warning text:

> Private designs are encrypted — relays and other people can't read the
> contents. The event still reveals that *something* was published, by
> your pubkey, at this time. Encryption can't undo a past public publish.

Pre-validation: a private design does **not** require a category (it's
never categorized in a feed). A title is still kept — it rides inside the
encrypted payload and labels the design in My Designs.

### 2. Publish path

`publishCurrentTemplateToNostr()` branches on visibility:

- **Public** — unchanged.
- **Private** — build `payload` as today, then: encrypt → envelope →
  `content`; tags = the minimal leak-free set above; `d`-tag = the
  design's persistent random private id (minted if absent); sign + send
  via `publishCommunityEvent()`.

Editing an already-private design re-encrypts (fresh AES key + iv) and
reuses the same random `d`-tag.

### 3. My Designs — decrypt + render

`loadMyDesigns()` already fetches the author's own events. Decryption is
**progressive**, never a blocking wall:

1. Build rows immediately. An encrypted event (content parses to
   `visibility:"encrypted"`, or the `encrypted` tag is present) first
   renders a placeholder **🔒 locked card** with no contents.
2. Decrypt each locked card asynchronously; as each resolves, swap the
   placeholder for the real card built from the decrypted payload,
   flagged `row.private = true` with a 🔒 badge. Preview / open / fork
   then work on the decrypted payload as usual.
3. If the NIP-07 extension is **absent or locked**, every decrypt fails —
   show one clear "Unlock your Nostr extension to view private designs"
   state, not N broken cards.
4. A genuine decrypt failure on a single design renders a disabled
   "🔒 Could not decrypt" card and never blocks the rest.

### 4. Feed / discovery

No change. Private events lack `["t","casewrap"]`, so `queryRelays` with
`#t:['casewrap']` never returns them. They are invisible everywhere except
My Designs.

### 5. Load / open / fork

Opening a private design from My Designs decrypts first, then calls the
existing `loadProjectFromText(decryptedJSON)`. The loaded project keeps
`visibility:"private"` and its random `d`-tag in state; opening it for
**edit** sets the existing edit context (`editingDTag` = that random
`d`-tag, `editingEventId`, `editingKind`) so a re-publish replaces it in
place and stays private.

**Fork** is a fresh start, so a fork of a private design defaults to
**Private** as well (and mints a *new* random `d`-tag — a fork is a new
design, not a replacement). The user can still switch it to Public in the
publish modal.

"Save project (JSON)" writes the **decrypted** payload — a local file is
plaintext (see Threat model). Encryption is applied only at Nostr publish
time, never to the on-disk JSON.

### 6. Share links

A `/share/<naddr>` for a private design resolves to the encrypted event,
which a non-author cannot decrypt. For Phase 1 the share page shows a
"This design is private" locked state; per-recipient sharing is Phase 3.
"Copy share link" on a private design warns that only you can open it.

---

## State

- `state.visibility` — `"public" | "private"`, default `"public"`.
- `state.privateDTag` — the persistent random `d`-tag for this design once
  it's been published privately (so edits replace correctly).
- Both ride in the saved/loaded project JSON (additive fields) and in
  autosave. The decrypted payload carries `visibility` so a reloaded
  private design stays private.

---

## Phased delivery

### Phase 0 — Validation spike  *(do first; ~half a day)*

Three unknowns can sink the design — probe them before building Phase 1:

1. **NIP-44 / NIP-04 encrypt-to-self** — confirm the target extensions
   (Alby, nos2x, …) accept encrypting to the user's *own* pubkey, and
   that the NIP-04 fallback behaves the same. Self-addressed NIP-04 is
   the established pattern for encrypted NIP-51 lists, so this is *likely*
   fine — but the whole feature rests on it, so verify.
2. **`CompressionStream('gzip')`** — confirm availability on target
   browsers; if absent, the `compression:"none"` path must work.
3. **Relay event-size limits** — publish a deliberately large encrypted
   blob (a ~20-slide deck) to the default relay set and read it back.
   This decides whether Blossom offload (Phase 4) is needed sooner.

If the app already self-encrypts its `kind:10000` mute/block list with
NIP-04, **reuse that codepath** rather than writing a new one.

### Phase 1 — Private to me  *(current target)*

- Encryption helpers (`encryptProjectEnvelope`, `decryptProjectEnvelope`),
  AES-GCM + gzip + NIP-44/NIP-04 key-wrap, capability gate.
- Publish modal visibility control + private warning copy.
- Private publish path: envelope content, minimal tags, random persistent
  `d`-tag, no feed tag.
- My Designs async decrypt pass + 🔒 badge + open/fork on decrypted JSON.
- `visibility` / `privateDTag` in state, save/load, autosave.

**Ship gate:** publish a design privately; confirm it does **not** appear
in the public feed; see it in My Designs with a 🔒 badge; open it — it
decrypts and edits normally; republish — it replaces in place.

### Phase 2 — Public ⇄ Private toggle

Re-publish an existing design with the opposite wrapper under the same
address. Going public→private keeps the *old* public event on relays
(documented, unavoidable).

### Phase 3 — Private to selected pubkeys

Add recipients: wrap the AES key once per recipient into `recipients[]`. A
recipient with a share link decrypts their own `wrappedKey`. Adds a
recipient-picker UI.

### Phase 4 — Hardening

- NIP-59 gift-wrap to hide *who* the recipients are.
- Blossom / NIP-96 offload when an encrypted blob (esp. a large deck)
  exceeds relay event-size limits; chunking as a fallback.

---

## Risks & tradeoffs

| Risk | Mitigation |
|---|---|
| Replacement ≠ deletion — public→private can't erase the past | Documented in UI; Phase 1 is encrypt-first so the design is never public to begin with. |
| NIP-44 plaintext cap (64 KB) | We encrypt with AES-GCM and only *key-wrap* with NIP-44/04 — the wrapped key is tiny, well under the cap. |
| Relay event-size caps — a large encrypted deck may not fit one event | Compress before encrypt; warn on oversized blobs; Blossom offload deferred to Phase 4. |
| Extension lacks `nip44` | NIP-04 fallback; capability gate disables Private if neither exists. |
| `buildRowsFromEvents` is synchronous; decryption is async | Decrypt outside the sync parser — render 🔒 placeholders, then swap in decrypted cards progressively (surface 3). |
| Encrypted event still leaks existence / pubkey / timestamp | Stated plainly in the Threat model and the publish warning; NIP-59 (Phase 4) reduces metadata leakage for shared designs. |
| Fresh AES key per republish | Intentional and harmless — only the author needs it, and it's re-wrapped each publish. |
| An extension might reject `nip44`/`nip04` encrypt-to-self | Validated up front in Phase 0; gate the Private option on a successful capability probe, not just method presence. |
| Many private designs → slow My Designs load | Progressive decrypt: the page is usable immediately; cards fill in as they resolve. |
| A relay rejects an event with no `t` tags / unusual shape | `kind:30078` app-data with a `d` tag is standard; verified against the default relay set in Phase 0. |

---

## Acceptance summary

### Phase 0
- [ ] NIP-44 and NIP-04 encrypt-to-self confirmed working on the target
      extensions.
- [ ] `CompressionStream` availability checked; `compression:"none"`
      fallback exercised.
- [ ] A large encrypted deck publishes to and reads back from the default
      relay set (or the size ceiling is documented).

### Phase 1
- [ ] Publish modal offers Public / Private; Private is gated on
      nip44-or-nip04 capability.
- [ ] A privately-published design is absent from New / Popular / Zapped /
      Search (no `casewrap` tag).
- [ ] The encrypted event carries no title / category / identifier tags
      and a random `d`-tag.
- [ ] My Designs shows the private design with a 🔒 badge; opening it
      decrypts and loads it into the editor.
- [ ] Editing and re-publishing a private design replaces it in place
      (same `d`-tag) and stays private.
- [ ] Decrypted payload is identical to the pre-encryption project JSON
      (round-trip clean) — no `SCHEMA_VERSION` change.
