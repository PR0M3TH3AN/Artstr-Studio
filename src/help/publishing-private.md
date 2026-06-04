# Private publishing

Encrypted-to-self designs. Same Nostr event format as a public
design, but `content` is an encrypted envelope and the metadata
tags are stripped down so the design doesn't appear in any
community feed.

## How the encryption works

1. The full design payload is JSON-serialised.
2. Gzipped (when the browser supports `CompressionStream`).
3. Encrypted with a fresh AES-256-GCM key.
4. The AES key is wrapped to **your own Nostr pubkey** via either
   NIP-44 (preferred) or NIP-04 (fallback).
5. The wrapped key + iv + ciphertext go into an `envelope` JSON
   object that becomes the event's `content` field.

Only someone signing with your Nostr key can derive the AES key
and decrypt the payload. The event is technically broadcast to all
relays, but it's mathematically opaque to everyone else.

## What's still visible

- Your **pubkey** (every Nostr event is signed and the pubkey is
  part of the signature).
- The event's `kind`, `created_at`, `d` tag, and `encrypted` tag.
- The fact that you published *something* at this time.

What's **not** visible: title, category, IDs, layers, dimensions,
images, or any other payload content.

## When to use it

- Working drafts you want backed up across devices but not shared.
- Personal projects you don't want indexed.
- Sensitive content where even the title shouldn't leak.

## Editing across devices

Open Artstr on another device, sign in with the same Nostr
extension, and click **Mine** in the community browser. Your
private events appear (decrypted lazily as you click them). The
**Private** tab specifically filters to your encrypted events.

## Caveats

- Requires a Nostr extension that supports NIP-44 or NIP-04
  encryption. Most do; alby and nos2x both work.
- The d-tag for a private design is a random opaque string
  (`artstr-private-<base36>`) so it can't be guessed. Don't lose
  the d-tag if you intentionally want to overwrite the event
  later — it's stored in your project's autosave under
  `state.privateDTag`.
- **Sharing privately with one specific other person** is *not*
  supported in v1. The current encryption only wraps the AES key
  to your own pubkey. Multi-recipient envelopes are a future arc.

## Books

The book sidebar has its own **🔒 Private** chip. Flipping it
encrypts the manifest **and** every sidecar event (pages,
masters, cover, chapters) on subsequent publishes. See
[Book Designer](#/help/book) for the full sidecar flow.

A private book's chapter events are kind-30078 (encrypted), not
kind-30023 NIP-23 articles, so external NIP-23 readers won't see
them — which is the desired behaviour for a private book.

## Deeper reference

- Spec: `docs/PRIVATE_PUBLISHING_FEATURE.md` in the GitHub repo.
