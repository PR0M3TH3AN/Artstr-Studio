# CaseWrap Studio

CaseWrap Studio is a static print-layout editor for physical media packaging.
It supports DVD/Blu-ray case wraps, Avery 8960/8944 disc-label sheets, Avery 8693/8943 CD jewel-case insert sheets, and reusable single-disc designs.

## What it supports

- Separate front, spine, and back case artwork (or one combined wrap image)
- Disc-label sheet mode (two print positions on one Avery 8960/8944 sheet)
- CD jewel insert mode (front + tray inserts on one Avery 8693/8943 sheet)
- Disc Designer mode for creating a reusable single-disc design
- Additional image and text layers
- Drag positioning, z-order changes, rotation, sizing, and opacity
- PDF export through the browser print dialog
- Nostr community browsing/sharing for templates and disc designs
- Publishing, replies, reactions, follows, and reposts from inside the app

## Important workflow

All image sources are remote URLs.

That means:

- Case art, disc art, jewel insert art, and extra image layers should use `http` or `https` URLs
- Saved project JSON remains portable across machines
- Exported/copied Nostr events can reconstruct layouts from event content
- Community feed data comes from relays listed in the Community panel
- Publishing/social actions require a NIP-07 browser extension (for example Alby or nos2x)

If a URL stops working later, the image will no longer render. For long-term reliability, use stable hosted URLs.

## Main file

- `src/index.html` is the complete app entrypoint. Open it directly in a browser or serve it from any static host.

## Export and print

- Use `Print / Save PDF` for print-ready output
- Keep browser scale at `100%`
- Disable browser headers and footers

## Save, restore, and sharing

- `Save project` writes project JSON
- `Load project` restores project JSON
- `Copy Nostr event` copies a signed event payload
- `Import from Nostr` restores a template/design from a copied event
- The Community modal lets you browse New/Popular/Search/Mine, preview templates, and import them
- Disc designs can be published and reused independently, then imported into Disc 1 or Disc 2 positions on a disc sheet

## Nostr data model

- Template/design payloads are published as kind `30078` app-data events with `casewrap` tags
- Typical social events use standard kinds (`1`, `7`, `6`, `3`, `0`)
- Template modes include `cover`, `disc`, `jewel`, and `disc-design`
- Current schema version is `5`; minimum supported schema version is `4`

## Notes

- The app is fully static and does not require a backend
- Local browser autosave is still available
- Older saved projects with embedded data URLs may still load, but new work should use remote URLs
