# Publishing — overview

Artstr Studio publishes designs to Nostr instead of a private
server. Every published design becomes a kind-30078 event (or
kind-30023 for book chapters) that anyone can fetch, fork, or
embed.

There are three visibility tiers:

| Tier | Who can open it | Use case |
|------|-----------------|----------|
| **[Public](#/help/publishing-public)** | Anyone with the naddr / nevent. | Default — discoverable in the community browser, forkable. |
| **[Private](#/help/publishing-private)** | Only you, via the same Nostr key (any device). | Working drafts, personal projects, archives. End-to-end encrypted. |
| **[Premium](#/help/publishing-premium)** | Anyone who pays a one-time zap (sats). | Paid templates / books. Watermarked preview + an unlock CTA. |

## Choosing a tier

The choice is made in the **Publish to Nostr** confirm modal:

- Top of the modal shows a **Public / Private** radio.
- A **Zap-gated (premium)** toggle below it (hidden when Private is
  selected — encrypted designs can't be feed-listed, so gating them
  for sale doesn't make sense).
- The book sidebar has its own **🔒 Private** chip that flips
  visibility for the whole book + every sidecar event.

## How the publish event differs per tier

| | Public | Private | Premium |
|---|---|---|---|
| Event kind | 30078 | 30078 | 30078 |
| `t` tag | `casewrap` + mode-specific | `encrypted` | `casewrap` + `premium` |
| `content` field | JSON payload | encrypted envelope | encrypted envelope |
| Preview JPEG | none | none | watermarked, embedded |
| Discovery | community browser + naddr share | naddr share only | community browser (premium tab) |
| Lightning | `zap` tags for tipping | none | `zap` tags split between creator + platform |

## Tipping vs unlocking (NIP-57 zaps)

Zaps are NIP-57 lightning payments. Two flavours:

- **Tipping** — any user can zap any design / page / chapter. Goes
  100% to the creator's lightning address (no platform share).
  Works on public, private (for you only), and premium designs.
- **Unlocking** — a premium design's zap requirement. The buyer zaps
  the required minimum; on receipt of a valid zap receipt, the
  client decrypts the design. Split: creator share + platform fee.

See [Zaps](#/help/zaps) for the full mechanics + how to enable
zapping in your profile.

## Sending zaps

You need a **NIP-47 wallet** (Nostr Wallet Connect, or NWC) connected
to Artstr so it can sign + send invoice payments without leaving the
app. See [NWC setup](#/help/nwc).

## Editing + republishing

All published events are **replaceable** (NIP-33). Re-publishing under
the same d-tag updates the event in place — old `naddr` share links
keep working; `nevent` (snapshot) share links point at the old
version.

The community browser's **Mine** tab shows every event you've
published with a "Republish" + "Delete" action per row.
