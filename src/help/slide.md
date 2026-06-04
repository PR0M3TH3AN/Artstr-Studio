# Slide

A 16:9 standalone slide. Same flat-canvas model as Custom Art but
locked to 16:9 + carries a speaker-notes field.

## When to use

- A single one-off slide you want to share or embed (16:9 social
  card, lecture insert, recap card).
- The slide is the artwork — you don't need a multi-slide deck shell.

## Geometry

Default 1920 × 1080 at 96 DPI. The aspect lock keeps you on 16:9; you
can resize via Presets in the sidebar.

## Speaker notes

The **Notes** field in the sidebar attaches a freeform string to the
slide event. Shown in:

- Presenter Mode (Deck mode only).
- The published event's payload — anyone who forks gets your notes.

## Importing into a deck

A standalone Slide is also a Deck-importable unit:

1. In **Deck** mode, click **Import slide** on a slide tile.
2. Pick from Nostr or paste a slide event id.
3. The slide drops in as a new entry; can be edited inline.

## Publish

Posts a `casewrap-slide` event. The full layer state ships in
`payload.slide.layers`; the canvas dimensions + background + notes
live in `payload.slide`.

## Tips

- For multi-slide presentations, jump to [Slide deck](#/help/deck)
  instead. A deck owns its own ordered slide list; standalone
  slides import as forkable units.
- Linked-design layers work in slides too — embed someone else's
  Custom Art / Pixel Art as a layer.
