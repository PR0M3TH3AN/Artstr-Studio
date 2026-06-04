# Zaps — NIP-57 lightning payments

Artstr uses Nostr-native lightning zaps for both tipping creators
and unlocking premium designs. Same protocol either way; the
difference is who the zap goes to and what the client does on
receipt.

## How zaps work in two paragraphs

A zap is a kind-9735 receipt event proving that a Lightning
payment happened. The flow:

1. The user (you) signs a kind-9734 **zap request** event with the
   amount + recipient + intent.
2. The recipient's lightning address (`lud16` on their profile)
   resolves to a LNURL endpoint; the request becomes a BOLT11
   invoice.
3. You pay the invoice from your wallet. The wallet's LSP issues
   a **zap receipt** event back to the relays.
4. Clients that see the receipt update UI (zap-totals, unlock
   gated content, etc).

## Tipping any design / page / chapter

Every design preview pane has a **⚡ Zap** button (visible when
the author has a lightning address on their profile). Clicking:

1. Opens an amount picker (default presets 21 / 100 / 1000 sats +
   custom).
2. Builds + signs the zap request via your Nostr extension.
3. Pays through your connected **NWC wallet** (see
   [NWC setup](#/help/nwc)). If you don't have NWC connected, it
   falls back to copying the invoice for you to pay manually in
   any Lightning wallet.

The zap goes 100% to the author. No platform share.

## Unlocking a premium design

Same plumbing, different outcome. The locked design row shows an
**Unlock with ⚡ zap** button. Clicking sends the minimum required
amount, split between the creator + the platform per the event's
`zap` tags (currently 70/30). On receipt:

1. The client verifies the receipt's amount + recipient match the
   event's `zap-min` + `zap` tags.
2. Derives the soft-gate key from the event metadata.
3. Decrypts the payload + saves it to your **My Purchases**
   vault.

See [Premium publishing](#/help/publishing-premium) for the publish
side.

## Receiving zaps on your designs

To get tipped or sold-to:

1. Sign up at any LN-address service. **CoinOS** (free, web-based)
   is the easiest: <https://coinos.io>.
2. Edit your Nostr kind-0 profile to add `lud16` = your LN address
   (e.g. `you@coinos.io`). Any Nostr client that edits profiles
   works (Damus, Amethyst, primal.net, nos2x options page).
3. Wait a few minutes for your profile to propagate to the relays
   you care about.

Once `lud16` is set, every published design of yours becomes
zap-able automatically — Artstr discovers the lightning address
from your profile.

## Sending zaps without an NWC wallet

If you don't have NWC connected, the zap modal will:

- Build the BOLT11 invoice.
- Show a QR code + a copy button.
- Wait for the invoice to be paid externally (you can pay from any
  Lightning wallet — Phoenix, Wallet of Satoshi, etc).
- Verify the receipt on relays + update the UI.

This is slower than NWC (you switch apps to pay) but works
universally.

## Tips

- The **Zapped** tab in the community browser sorts designs by
  total zap volume — a quick way to find what people are paying
  for.
- Zaps are public on Nostr (the receipt event is signed by the
  LSP and broadcast). If you want anonymous payment, you'll need a
  separate Lightning identity.
- Failed zaps (invoice paid but receipt never arrives) can be
  diagnosed via the wallet's transaction log. The LSP issued the
  receipt; the relays may have dropped it.
