# CaseWrap Studio

CaseWrap Studio is a static print-layout editor for physical media packaging.
It handles DVD and Blu-ray case wraps, Avery 8960-style disc labels, and freeform image/text layers.

## What it supports

- Separate front, spine, and back artwork
- One combined wrap image
- Avery 8960 / 8944 disc-label layouts
- Reusable disc designs that can be assigned to either Avery sheet position
- Additional image layers
- Editable text layers
- A Nostr community feed for browsing and sharing templates
- Publishing the current design as a Nostr template event
- Publishing a single disc design independently from a two-up print sheet
- Reactions, replies, follows, and reposts for selected posts
- Drag positioning, z-order changes, rotation, sizing, and opacity
- PDF export through the browser print dialog

## Important workflow change

All image sources are now remote URLs.

That means:

- Case art, disc art, combined wrap art, and extra image layers are entered as `http` or `https` URLs
- Saved project JSON stays portable
- Nostr exports can fully reconstruct the layout from the event content alone
- The community feed reads from the relays listed in the Community panel
- Publishing and social actions require a NIP-07 Nostr extension in the browser

If a URL stops working later, the image will no longer render. For permanent restoration, use stable hosted image URLs.

## Main file

- `src/index.html` is the app. Open it directly in a browser or host it on any static server.

## Export

- Use `Print / Save PDF` for a print-ready PDF
- Keep browser scale at `100%`
- Disable browser headers and footers

## Restore and sharing

- `Save project` writes a JSON file with the full layout state
- `Export to Nostr` writes a signed Nostr event containing the same layout data
- `Import from Nostr` restores the template from a copied event
- The Community panel can refresh a relay-backed feed, open a selected template, publish the current design, and interact with selected posts
- Disc designs are separate from the printable Avery sheet, so one sheet can print two different designs or two copies of the same design

## Notes

- The app is static and does not need a backend
- Local browser autosave is still available
- Older saved projects that contain embedded data URLs may still load, but new work should use remote URLs only
