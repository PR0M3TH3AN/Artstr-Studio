# Template tab

The **Template** tab is where you author finished artwork — anything
you'd hand off to a printer, post as a slide, or publish to a community
feed. Each option below the tab switcher picks a different artboard.

## Choosing a layout

Click an item in the left sidebar's *Template type* picker. The
canvas reshapes to that mode's geometry and the right-side options
(layers, export) re-scope to it.

| Mode | When to use |
|------|-------------|
| **[Cover wrap](#/help/cover)** | DVD / Blu-ray / softcover case wraparound. |
| **[Disc-label sheet](#/help/disc)** | Two-up CD/DVD label sheet for printing on full-page label stock. |
| **[Jewel-case insert](#/help/jewel)** | Front + tray inserts for a CD jewel case. |
| **[Custom art](#/help/customart)** | Any-aspect freeform canvas. Posters, social art, anything. |
| **[Slide](#/help/slide)** | 16:9 single slide with speaker-notes field. |
| **[Slide deck](#/help/deck)** | Ordered list of slides; publishes as one event with all slides inlined. |
| **[Pixel art](#/help/pixelart)** | Palette-indexed grid editor up to 128×128 with multi-frame animation. |
| **[Book](#/help/book)** | Multi-page reflowable book with cover, masters, chapters, PDF export. |

## Project metadata

Above the type picker is the **Project Metadata** block:

- **Title** — required for publish.
- **Category** — required for publish; chooses the discovery facet
  (`movie`, `comic`, `book`, etc).
- **IMDb / UPC / TVDB / MusicBrainz IDs** — optional external IDs;
  used to deduplicate against other community designs.
- **Language** — affects search / browser filters.
- **Custom tag** — free-form discovery tag.

## Layers panel

Once you add anything to the canvas, the **Layers** panel surfaces:

- Per-layer visibility / lock toggles.
- Drag to reorder z.
- Multi-select with shift/cmd, then use the **Align / Distribute**
  panel + the **Pathfinder** ops (Unite / Subtract / Intersect /
  Exclude) for vector shapes.
- Layer-target dropdown picks which sub-surface a new layer belongs
  to (e.g. cover front vs spine vs back; jewel front vs tray).

## Export + publish

- **Save / Save as** — local JSON download of the project.
- **Open** — load a previously-saved JSON file.
- **Print / Save as PDF** — opens the browser print dialog with
  proper trim + bleed.
- **Export JPEG / PNG** — direct raster export.
- **Publish to Nostr** — opens a confirmation modal. Public, private
  (encrypted to self), or premium (zap-gated, watermarked preview).

## Common gotchas

- The Layers panel respects the active layer-target. If you don't see
  a layer you just added, switch the dropdown to its surface.
- "Custom" book size unlocks the trim inputs in Document settings.
- Mode-specific guides + bleed lines toggle on the canvas via the
  show-guides / show-bleed / show-crops checkboxes in the right-side
  Export fieldset.
