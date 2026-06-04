# Premium publishing (zap-gated)

Sell designs for sats. The published event ships a watermarked
preview anyone can browse + an encrypted payload only paying
viewers can decrypt. Discovery + browsing is public; the design
itself is gated.

## How it works

1. The full design payload is encrypted via the same AES-256-GCM
   pipeline as a private publish, but with a special **softgate**
   key derivation.
2. The key derives from public event material (event id, pubkey,
   d-tag) plus an obfuscated per-epoch pepper baked into the
   static Artstr client.
3. A watermarked JPEG preview (max 720 px long axis, ~50 KB
   budget) ships in the unencrypted envelope so buyers can see
   what they'd be unlocking.
4. The event publishes with:
   - `['t', 'casewrap']`, `['t', 'casewrap-<mode>']` — discovery.
   - `['title', …]`, `['category', …]` — public metadata.
   - `['premium', 'true']`.
   - `['zap-gate', 'true']`, `['zap-min', '<sats>']`, `['zap-split', 'required']`.
   - `['zap', <creator-pubkey>, <relay>, '<weight>']` — creator share.
   - `['zap', <platform-pubkey>, <relay>, '<weight>']` — platform fee.
5. When a buyer's zap receipt for this event lands on relays, the
   client computes the soft-gate key + decrypts.

## Soft-gate is "soft"

Honest framing: this raises friction against drive-by scraping but
a determined reverse-engineer can recover the client pepper and
decrypt without paying. The mode is for low-trust commercial
distribution, not DRM-grade gating. Stronger DRM can swap in later
without changing the buyer side.

## What you need before publishing premium

- A **lightning address** (`lud16`) on your kind-0 Nostr profile.
  Set this on any Nostr client that edits your profile metadata
  (Damus, Amethyst, nos2x, etc). Without it the platform can't
  route the buyer's payment to you.
- A non-empty title + category (same as any publish).
- A working artboard preview — the modal renders the watermarked
  JPEG live + refuses to publish if rendering fails (CORS images
  etc).

## Publishing flow

1. Set Title + Category.
2. Click **Publish to Nostr**.
3. In the confirm modal:
   - Keep visibility on **Public**.
   - Toggle **Zap-gated (premium)** on.
   - Set the **Minimum zap** in sats (default 100).
   - Read the split note (creator: 70 %, platform: 30 % by default;
     see the per-event `zap` tags for the exact split that ships).
4. Click **Publish**.

## How buyers unlock

In the community browser's **Premium** tab, a locked design shows
the watermarked preview + an **Unlock with ⚡ zap** button. Clicking
it:

1. Opens the buyer's connected NWC wallet (see
   [NWC setup](#/help/nwc)).
2. Builds a NIP-57 zap request for the minimum amount.
3. Sends `pay_invoice` through the NWC connection.
4. On a successful zap receipt, derives the soft-gate key + decrypts
   the design in-place.
5. Caches the decrypted payload in the **My Purchases** vault so
   later re-visits skip the re-zap.

## My Purchases vault

Your unlocks live in a **vault** encrypted to your own pubkey (so
they sync across devices the same way private publishes do).
Capped at a fixed size; if the vault overflows, the oldest items
get evicted with a visible failure rather than silently lost.

## Editing a premium event

The same NIP-33 replaceability applies — re-publishing updates the
event in place. Existing buyers' vault entries continue working
against the new event since the soft-gate key derives from the
d-tag, which stays stable.

## Caveats

- Decks ship a per-slide watermarked preview (up to 6 slides) so
  buyers can flip through what they'd unlock; non-deck modes get a
  single preview JPEG.
- The platform fee is currently a fixed 30/70 split on the event's
  zap tags. Future updates may make this configurable.
- The buyer's NWC wallet must support `pay_invoice` (almost all
  do).

## Deeper reference

- Spec: `docs/PREMIUM_DESIGNS_FEATURE.md` in the GitHub repo.
