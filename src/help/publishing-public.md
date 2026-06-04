# Public publishing

The default tier. Plain-text event the relays distribute to anyone
who asks for it. Discoverable in the community browser, forkable,
embeddable.

## What the event looks like

- `kind: 30078` (or `30023` for book chapters).
- `tags`:
  - `['d', '<mode>:<id-or-title>']` — the addressable identifier.
    Replaceable per NIP-33: re-publishing under the same d-tag
    replaces the event in place.
  - `['t', 'casewrap']` + `['t', '<mode-specific>']` (e.g.
    `casewrap-cover`, `casewrap-deck`, `casewrap-book`).
  - `['title', '<your title>']`, `['category', '<…>']`,
    `['language', '<…>']`.
  - External ID tags when you've filled them in: `['i', 'imdb:…']`,
    `['i', 'upc:…']`, `['i', 'tvdb:…']`, etc.
  - `['client', 'Artstr Studio']`.
  - For books / linked designs: `['p', '<contributor>', …,
    'design-contributor']` + `['link', '<kind:pubkey:dTag>', …]`.
- `content`: JSON-serialised design payload. Every layer, every
  mode-specific block, every reference.

## Discoverability

- Listed in the **community browser** under the New / Popular /
  Zapped tabs, filterable by category + language.
- Searchable via the Search tab + Nostr search relays that index
  `casewrap` content.
- Linked from share URLs: `<host>/#/share/<naddr>` resolves to a
  read-only view + Fork button.

## Publishing flow

1. Set **Title** + **Category** in Project Metadata.
2. Click the **Publish to Nostr** button (top right).
3. Confirm modal opens with:
   - A preview pane.
   - Metadata list (Type / Title / Category / Author / etc).
   - **Public / Private** radio (defaults to Public).
   - **Zap-gated (premium)** toggle (defaults off → public free).
4. Click **Publish**.
5. The event signs through your Nostr extension + broadcasts to
   the relay list in **Settings → Relays**.

## Editing a published design

Loading a public design from the community browser drops you in
**edit mode** — the publish button now says "Publish update" and
preserves the original d-tag. Republishing replaces the event in
place via NIP-33.

To **fork** instead of edit (so your version becomes a new event
under your pubkey), use the community browser's **Fork** action on
the design row — it clears the editing state so your next publish
mints a fresh d-tag.

## Forking + attribution

Linked-design layers from other authors auto-emit:

- `p` tags for each contributor (so they get notifications + can
  be discovered as design contributors).
- `link` tags so external clients can resolve the sub-designs.

See the [Credits panel](#/help/panel-credits) for what gets surfaced
in-app + at publish time.

## Caveats

- Anything you upload as an image layer is embedded in the event
  payload as a `data:` URL — Nostr relays may reject very large
  events. For high-res photo layers, prefer publishing the photo
  somewhere else and linking via an `https://` URL.
- Even with private toggles off, the metadata tags (title,
  category) are public. The encryption only protects the `content`
  field.
