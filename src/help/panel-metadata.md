# Project Metadata panel

Lives near the top of the left sidebar. The fields here feed both
the local project file (when you Save as JSON) and the published
Nostr event's discovery tags.

## Fields

- **Title** *(required for publish)* — the human-readable name of
  your design. Used as the event's `title` tag + as part of the
  d-tag for replaceable events. For books, also drives
  `{book-title}` token resolution.
- **Category** *(required for publish)* — discovery facet. The
  picker offers common categories (movie / comic / book / album /
  game / etc); custom values land as `category:custom`.
- **IMDb ID** — for movies. Emits an `i` tag with `imdb:<id>`
  (NIP-73). Lets you deduplicate against other community designs
  for the same title.
- **UPC / TVDB ID / MusicBrainz Disc ID** — same idea for other
  media types. Each emits an `i` tag with its scheme prefix.
- **Custom tag** — free-form discovery `t` tag. Lowercases +
  hyphenates on emit.
- **Language** — affects feed filters in the community browser.
  Defaults to `en`.

## How the fields feed publish

When you click **Publish to Nostr**, the publish-confirm modal
shows every metadata field with a side-by-side preview. Anything
empty stays out of the event's tags. The event's d-tag is built
from `<mode>:<imdbId-or-title>`; once published, re-publishing
under the same d-tag replaces the event in place (NIP-33).

## Designer-mode equivalent

The Designer tab has its own metadata fieldset
(`designerMetadataFieldset`) with the same fields but scoped to the
single-disc design event (`casewrap-disc-design`). Switching tabs
preserves both sets independently.

## Tips

- Setting an IMDb / UPC ID lets the community browser group your
  design with other releases of the same title — useful for finding
  forks + remixes.
- Leave Category set sensibly: the default feed filters use it.
- For private publishes, the metadata fields still emit but the
  event's content is encrypted — tags stay public, only the design
  payload is hidden.
