# Slide deck

An ordered list of slides published as a single event. Every slide's
full layer data is embedded inline — Presenter Mode + previews never
depend on additional relay fetches.

## Sorter view

The deck-sorter grid shows every slide as a thumbnail:

- **+ Add slide** — append a blank slide.
- **Import PowerPoint (.pptx)** — imports `.pptx` files via a
  vendored parser. Shapes, text runs, images, charts, tables, theme
  fills, and slide notes all convert.
- **→ Convert to book** — turn the deck into a Book Designer book
  (each slide → one designed page, letterbox-fit into the trim).
- Click a thumbnail to edit that slide; the canvas opens with the
  slide's layers as canvas layers.
- Drag thumbnails to reorder. Right-click for duplicate / delete.

## Theme

Deck-wide theme overrides under **Deck theme** in the sidebar:

- **Font family** — applied to every slide's text layers (unless
  the slide explicitly opts out via "Ignore deck theme").
- **Background colour** — applied to every slide's canvas
  background. Same opt-out applies.

A slide can pin its own font + background by toggling **Ignore deck
theme** in the slide-editor sidebar.

## Presenter Mode

Click **Present** to launch a full-screen reader:

- Arrow keys flip slides.
- **S** toggles speaker-notes overlay.
- **F** toggles fullscreen.
- **Esc** exits.
- Footer counter shows `N / total`.

## Embed

A published deck's `naddr` works in the embed iframe:

```html
<iframe src="…/#/embed/<naddr>" width="1280" height="720"></iframe>
```

The embed renders a paginated player with prev/next + a slide
counter, plus fullscreen + reduced-motion handling.

## Publish

Posts a `casewrap-deck` event with every slide inlined. Forks land
with the full deck intact; remixers can swap slides + republish.

## Tips

- For just one slide, the [Slide](#/help/slide) mode is lighter —
  standalone slides import into decks as forkable units later.
- The deck's `deck.theme` overrides apply at render time only — a
  slide's own `fontFamily` / `background` stay in the event payload.
