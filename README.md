# CaseWrap Studio

CaseWrap Studio is a static, browser-only design tool for printable physical media packaging — and increasingly, a general-purpose Nostr-native graphics editor. It started as a DVD/Blu-ray case wrap maker and now also covers Avery 8960/8944 disc labels, Avery 8693/8943 CD jewel-case inserts, single-disc designs, and free-form custom art canvases. Designs publish to and load from Nostr, are forkable and editable in place, and can be tipped via Lightning.

## Modes

The editor has two tools at the top level:

- **Template** — designs that map to a real printed surface.
  - **Case cover** — DVD / Blu-ray wraps with separate front / spine / back artwork or a single combined wrap image.
  - **Disc labels** — Avery 8960 / 8944 sheets with two disc positions.
  - **CD jewel inserts** — Avery 8693 / 8943 sheets with a front insert + tray insert.
  - **Custom art** — free-form canvas with size presets (1920×1080, square sizes, etc.) or custom dimensions. Treats the project as generic art rather than packaging.
- **Disc Designer** — make a reusable single-disc design, publish it on Nostr, and import it later into either disc position of a disc-label sheet.

Each mode keeps its own metadata (title / identifiers / category / language) so loading a template in the Disc Designer doesn't overwrite the Designer's work in progress, and vice versa.

## Layers

Layers compose on top of the per-mode artwork:

- **Image** — remote URL, with object-fit / object-position controls.
- **Text** — rich editable text with font-family picker (web-safe families), size, color, bold/italic, alignment.
- **Color block** — solid-color rectangle for tints and backgrounds.
- **Shape** — vector primitives (rectangle / rounded rectangle / circle / ellipse / triangle / polygon / star / line) with solid, linear-gradient, or radial-gradient fills and optional solid strokes (color / width / solid / dashed / dotted).
- **Custom path / SVG upload** — upload an `.svg` file. Single-path SVGs land as editable shapes; multi-element SVGs preserve their internal fills and stacking, with a per-element editor that lets you change each `<rect>` / `<path>` / `<circle>` etc. fill and stroke individually.

Every layer supports drag / resize / rotate / opacity / z-order, an aspect-ratio lock toggle on the W/H inputs (default on), and a lock toggle that prevents accidental drags.

### Layer clipping / masking

Any layer (image, text, color, shape) can be clipped to a shape:

- **Inline shape clip** — pick a primitive (rect / circle / star / etc.) to mask the layer to that shape.
- **From another layer** — point at another shape layer in the same target and use its geometry as the mask.

Renders consistently in the editor, the preview surfaces, and the canvas / PDF / JPEG export.

### Layer clipboard

Cross-target and cross-tool copy/paste — Copy / Cut on a selected layer, Copy all / Paste for the whole panel. Paste retargets to the current sub-mode and clamps positions so layers copied from a wide cover don't land off-canvas on a narrow disc.

## Nostr integration

Every design surface participates in the same Nostr-backed community feed.

- **Identity** via NIP-07 (Alby, nos2x, etc.).
- **Templates and designs** publish as kind-30078 parameterized replaceable events tagged `casewrap-<mode>`, with the `d`-tag mode-prefixed so cover/disc/jewel/custom-art/disc-design designs for the same title don't collide.
- **Community modal** browses New / Popular / Zapped / Search / My Designs with category and language filters, plus optional WoT trust filters when signed in.
- **Profile pages** at `/u/<npub>` show the author's banner, avatar, NIP-05, npub (copyable), about, Lightning address, and the grid of their published designs. Profile state is cached per session.
- **Replies** (kind-1), **reactions** (kind-7), **reposts** (kind-6), and **follows** (kind-3) all work from inside the app.
- **Soft moderation** — kind-10000 mute lists and kind-1984 reports from your hop-1 follows blur cards by default, with a one-click reveal.
- **Block list** — local first, syncs to your kind-10000 on the next login.
- **Edit published designs** — owners can republish a kind-30078 with the same d-tag to supersede the original on relays via NIP-33 semantics. The publish-confirm modal explains the trade-off (reactions and Lightning zaps on the old version stay on relays but orphan to the new event id).
- **Fork / remix** — every published design has a Fork button that loads it into the editor as a starting point under your own pubkey.
- **Share links** — `/share/<naddr>` or `/share/<nevent>` URLs resolve cold.

## Lightning

Two flavors of Lightning are wired in:

- **Tips** — pure LNURL-pay, no NWC required. Pick an amount (21 / 100 / 500 / 1k / 5k / 21k / Custom), the recipient's `lud16` or `lud06` resolves to an LNURL-pay endpoint, and you get a bolt11 invoice + QR + lightning: deep-link. If the recipient's wallet supports zap requests (`allowsNostr: true`), we also sign a NIP-57 kind-9734 zap request and pass it along, so a kind-9735 receipt lands on relays after settlement.
- **Tracked zaps** — kind-9735 receipts feed a per-event aggregate, surfaced as `⚡ <total>` on feed cards / previews / profile pages, and as a sortable **Zapped** tab in the Community modal.
- **WebLN auto-pay** is offered as a one-click button when an extension is detected.
- **Payment detection** — after a tracked invoice is issued, a poll watches for the receipt and auto-closes the tip modal when payment is confirmed.

## Save, share, restore

- **Save project** writes the design (with metadata) to a JSON file.
- **Load from file** detects whether the JSON is a template or a disc design and switches the active tool automatically.
- **Publish to Nostr** opens a preview/metadata confirmation modal before signing.
- **Copy share link** copies an `naddr1…` (replaceable-event address) or `nevent1…` (specific event id) URL.
- **Copy event ID** is available once a project has been published.
- **Export JPEG** — round-trips through the browser's PDF export and PDF.js to produce a flattened image. Useful when you want a single shareable asset.

## Print

- `Print / Save PDF` produces print-ready output. Keep browser zoom at 100% and disable headers/footers for predictable margins.
- Print-time toggles (`Show bleed`, `Show crops`, `Show guides`) control which guides are inked.

## Workflow notes

- All image references are **remote URLs**. Paste an `http`/`https` image URL into any slot or layer — the app never embeds binary image data into a project (keeps payloads small and Nostr-friendly).
- If a URL goes 404 later, the design still loads — the image just doesn't render. Pick stable hosts. We persist a broken-image set to `localStorage` so once we've detected a 404, it stays sunk to the bottom of ranked feeds across reloads.
- Saved project JSON is portable. The same JSON is what publishes to Nostr (after stripping local-only fields).

## Files

- `src/index.html` — the complete single-file app. Open it directly in a browser, or serve it from any static host. Vercel rewrites in `vercel.json` map `/share/:id` and `/u/:npub` to the SPA entry.
- `src/vendor/qrcode.min.js` — vendored QR encoder (used for Lightning tip invoices).
- `docs/` — feature plans for unbuilt work (badges, collections, QR layer, TMDB autofill, undo/redo, NWC zaps, zap-gated templates).

## Schema

- Current project schema version: **5**.
- Minimum supported version: **4**. Older payloads load but won't round-trip cleanly.
- Template-mode discriminator in payloads: `cover`, `disc`, `jewel`, `customart`, `disc-design`.
- Layer types: `image`, `text`, `color`, `shape`. Shape kinds: `rect`, `rounded-rect`, `circle`, `ellipse`, `triangle`, `polygon`, `star`, `line`, `path`, `svg`. Any layer may carry a `clip` field for masking.

## Defaults and stack

- No backend. Fully static. No build step.
- NIP-07 browser extension required for any signing-side action (publish, reply, react, follow, block-sync, zap request, edit, delete).
- Lightning is **optional**. Without a signed-in NIP-07 wallet, tips fall back to plain LNURL-pay and aren't tracked as zaps.
