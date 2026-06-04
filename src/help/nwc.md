# NWC — Nostr Wallet Connect setup

NWC (NIP-47) lets Artstr send Lightning payments through your
wallet without leaving the app. Required for one-click zapping +
unlocking premium designs.

## Quick start (CoinOS, recommended)

CoinOS is a free web-based wallet that supports NWC. Easiest path
if you don't already have a Lightning wallet:

1. Sign up at <https://coinos.io>.
2. Open **Settings → Connect** in the CoinOS app.
3. Create a new Nostr Wallet Connect link. Set a **budget** that
   comfortably covers the zaps + unlocks you expect (a few
   thousand sats is plenty to start).
4. Copy the connection string (starts with `nostr+walletconnect://`).
5. In Artstr, open **Settings → Lightning wallet**.
6. Paste the connection string + click **Connect**.
7. The status line confirms the connection + lists the wallet's
   advertised capabilities (`pay_invoice` is the required one).

## Other supported wallets

Any NIP-47 wallet works:

- **Alby Hub** — self-hosted; nostr-native; great for power users.
- **Mutiny** — browser-based, open-source.
- **Phoenix** — mobile-first, advertises NWC.
- **Cashu.me** — ecash custodial.
- **LNbits** — self-hosted; the NWC extension exposes a
  connection string per wallet.

In every case the pattern is the same: the wallet generates a
`nostr+walletconnect://...` URI that you paste into Artstr.

## Multi-device sync

The **Sync this wallet to my Nostr account** checkbox (appears
once connected) publishes your NWC URI as a kind-30078 event,
encrypted to your own pubkey via NIP-44. On any other device where
you sign in with the same Nostr key, Artstr finds the synced event,
decrypts it, and auto-reconnects without you pasting the URI
again.

Privacy: the synced event is NIP-44-encrypted to **only your own
pubkey**. Relays + other clients can't read the URI — only an
extension holding your nsec can decrypt it.

## Sending a zap with NWC connected

1. Click the **⚡ Zap** button on any design / page / chapter (or
   the **Unlock with ⚡ zap** on a premium row).
2. Amount picker opens with presets.
3. Artstr builds a zap request, gets the BOLT11 invoice from the
   recipient's LSP, and sends `pay_invoice` through your NWC
   connection.
4. The wallet pays; the LSP issues the zap receipt; the UI
   refreshes.

End-to-end usually completes in under 3 seconds.

## Test connection

The **Test connection** button (next to Disconnect) runs a
zero-amount pay_invoice round-trip to verify the wallet is
reachable + capable. Useful before assuming the integration is
broken.

## Capability warnings

If the wallet doesn't advertise `pay_invoice`, the UI shows an
⚠ banner — unlocks will fail. Reconnect via a different wallet's
URI or enable `pay_invoice` in the source wallet (most wallets
ship it on; some self-hosted setups disable it by default).

## Security model

- The connection string contains the wallet's relay URL + a
  client-side secret key Artstr uses to sign NIP-04 messages to
  the wallet. **Treat it like a password** — anyone with the URI
  can send `pay_invoice` up to the configured budget.
- Set a **budget** on the wallet side that caps total spending.
  Most NWC wallets let you renew the budget periodically.
- Setting a low per-payment maximum (e.g., 1 000 sats) is a good
  default for unlocking designs.
- Revoking NWC is a one-click action on the wallet side — the URI
  becomes inert immediately.

## Caveats

- NWC over relays adds latency (signed event → relay → wallet →
  signed receipt → relay → client). Expect 1-3 seconds per zap on
  a healthy connection.
- If the wallet's relay is down, zaps queue but won't complete.
  The wallet usually has multiple relays as fallbacks.
- Mobile browsers sometimes throttle background WebSockets; if
  zaps time out, foreground the Artstr tab + retry.
