# Artstr Studio — TODO

Running list of deferred work. Detailed specs for the larger items live in
`docs/`. Each entry notes scope and where the spec is (if any).

## QR code layer — remaining phases

Phase A shipped (the `qr` layer type: data, error-correction level, quiet
zone, module / background colors, transparent background, renders on every
surface + canvas export, JSON round-trip).

- **Phase B — convenience inserts.** "Insert npub" and "Insert share link"
  buttons next to the QR data field. Insert npub fills the signed-in user's
  `npub`; Insert share link fills the design's `naddr`/`nevent` once it's
  been published. ~80 LoC.
- **Phase C — visual polish.** Optional center logo overlay and rounded
  modules. Riskier: a logo eats into the error-correction budget, so it
  should nudge the ECC level up. Skippable.

## Cleanup

- **Remove the IMDb import.** The OMDb prompt-based lookup isn't pulling its
  weight — rip out the `imdbImportBtn` button, its handler, and the OMDb
  fetch. (The `imdbId` metadata field itself stays — only the auto-import
  goes.)
- **Delete `docs/TMDB_AUTOFILL_FEATURE.md`.** TMDB auto-fill was declined —
  the metadata fields work fine filled by hand and the IMDb-style import is
  being removed anyway.

## Profile pages — deferred polish

(Core profile pages at `/u/<npub>` already shipped.)

- Make author chips clickable in the **community thread view** (comments and
  reposts) — currently only feed-card and preview-meta author chips route to
  `openProfilePage`.
- **About-text clamp** — long bios overflow the profile header; clamp to ~4
  lines with a "Show more" toggle.
- **Profile-grid pagination** — an author with 100+ designs renders them all
  at once; cap the initial render and add a "Show more" pager.

## Edit-published-designs — deferred polish

(Core edit-in-place via NIP-33 replaceable semantics already shipped.)

- Replace the remaining `confirm()` calls in the edit / publish flow with the
  styled in-app modal pattern, for consistency with the close-project and
  publish-confirm modals.
- "Editing a previously-deleted design" warning — if the user opens Edit on a
  design they had tombstoned with a kind-5, warn that publishing will
  republish it.

## Drafted-but-unbuilt features

Each has a full spec in `docs/`.

- **Badges (NIP-58)** — `docs/BADGES_FEATURE.md`. Award / display Nostr
  badges on profile pages.
- **Collections (NIP-51 sets)** — `docs/COLLECTIONS_FEATURE.md`. Let users
  organize favorite community templates into named sets.
- **Zap-gated premium templates** — `docs/ZAP_GATED_TEMPLATES_FEATURE.md`.
  Creators mark a template premium with a minimum-zap threshold.
- **Zaps via Nostr Wallet Connect** — `docs/ZAPS_NWC_FEATURE.md`. In-app
  zapping without the wallet handoff. (Tracked LNURL-pay tips already ship;
  this would be the NWC path.)
