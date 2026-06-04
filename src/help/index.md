# Artstr Studio docs

Welcome. Artstr Studio is a single-page design tool that publishes
everything to Nostr instead of a private server. Pick a topic below.

## The two app modes

- **[Template](#/help/template)** — print + screen artwork (cover wraps, disc
  labels, jewel inserts, custom-art canvases, slides, decks, pixel art,
  books). Every artboard publishes as one or more Nostr events that anyone
  can fork or remix.
- **[Designer](#/help/designer)** — a reusable single-disc design surface.
  Disc designs publish independently, then drop into any disc slot of a
  disc-label sheet.

## Template-mode layouts

- **[Case cover wrap](#/help/cover)** — front + spine + back wraparound
  for DVD / Blu-ray / softcover printable cases.
- **[Disc-label sheet](#/help/disc)** — two-up CD/DVD label sheet.
- **[Jewel-case insert](#/help/jewel)** — front + tray jewel inserts.
- **[Custom art](#/help/customart)** — any-aspect flat canvas.
- **[Slide](#/help/slide)** — 16:9 standalone slide with speaker notes.
- **[Slide deck](#/help/deck)** — ordered collection of slides.
- **[Pixel art](#/help/pixelart)** — palette-indexed grid editor with
  multi-frame animation.
- **[Book](#/help/book)** — multi-page reflowable book with cover,
  chapters, masters, PDF export, and Reader Mode.

## Working in Nostr

- Sign in with a browser extension (Alby, nos2x, etc) using the top-
  right widget. Without one you can still author and export locally;
  publishing + browsing the community requires a key.
- Every Artstr event is replaceable (NIP-33). Re-publishing under the
  same d-tag updates the design in place.
- Private publishing uses NIP-44 / NIP-04 to encrypt the payload to
  your own key — only you can decrypt on a fresh device.

## Tips

- Most modes autosave to localStorage as you edit, so you can close
  the tab and come back later. Publish to Nostr to share or to back
  up across devices.
- Linked Designs let you reference another author's published design
  as a layer in yours. Their event is fetched and rendered live; the
  manifest p-tags the contributors for attribution.
- The community browser (top-right Nostr widget) shows feeds you can
  filter and import from.
