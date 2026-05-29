# Artstr Studio

Artstr Studio is a static, browser-only design tool for printable physical media packaging — and increasingly, a general-purpose Nostr-native graphics editor. It started as a DVD/Blu-ray case wrap maker and now also covers Avery 8960/8944 disc labels, Avery 8693/8943 CD jewel-case inserts, single-disc designs, free-form custom art canvases, 16:9 slides assembled into presentable slide decks, and palette-indexed animated pixel art. Designs publish to and load from Nostr, are forkable and editable in place, and can be tipped via Lightning.

## Tabs and layouts

The editor has two tabs at the top level, each with its own Layout panel:

- **Template** — designs that map to a real printed surface, plus the deck container.
  - **Case cover** — DVD / Blu-ray wraps with separate front / spine / back artwork or a single combined wrap image.
  - **Disc labels** — Avery 8960 / 8944 sheets with two disc positions.
  - **CD jewel inserts** — Avery 8693 / 8943 sheets with a front insert + tray insert (chosen via the Template preset).
  - **Slide deck** — an ordered, self-contained presentation deck that embeds its slides inline (see below).
- **Designer** — free-form and reusable designs.
  - **Custom art** (the Designer tab's default) — a free-form canvas with size presets (1920×1080, square sizes, etc.) or custom dimensions. Treats the project as generic art rather than packaging.
  - **Slide** — a 16:9 design surface (a Custom Art canvas locked to 16:9) with a speaker-notes field. A standalone, publishable design that can be imported into a slide deck.
  - **Disc design** — a reusable single-disc design you can publish on Nostr and import later into either disc position of a disc-label sheet.
  - **Pixel art** — a dedicated palette-indexed grid editor (single static sprite up to 128×128, or a multi-frame animation). Publishes as `casewrap-pixelart`; exports to PNG, sprite sheet, and animated GIF.

Each layout keeps its own metadata (title / identifiers / category / language) so switching layouts — or loading a project — doesn't overwrite a design already in progress.

## Tools

A left-edge tool palette drives canvas interaction; a matching right-edge panel
holds the active tool's options. Both are docked flush with the canvas.

- **Select** (`V`) — select, move, resize, and rotate layers.
- **Hand** (`H`) — drag to pan the canvas.
- **Pen** (`P`) — click to place Bézier anchors, click-drag to pull curve handles; closing a path fills it. Selecting an existing pen path — or a primitive / single-path SVG via **Make editable path** — exposes draggable anchors and handles.
- **Pencil** (`B`) — freehand strokes, committed as vector paths at a constant on-screen thickness.
- **Shape** (`S`) — drag out a rectangle / rounded-rect / circle / ellipse / triangle / polygon / star / line.
- **Text** (`T`) — click to drop a text box, then type.

The Pen / Shape / Text panels also edit the selected shape's fill and stroke.

## Layers

Layers compose on top of the per-mode artwork:

- **Image** — remote URL, with object-fit / object-position controls.
- **Text** — rich editable text with font-family picker (web-safe families), size, color, bold/italic, alignment.
- **Color block** — solid-color rectangle for tints and backgrounds.
- **Shape** — vector primitives (rectangle / rounded rectangle / circle / ellipse / triangle / polygon / star / line) with solid, linear-gradient, or radial-gradient fills and optional solid strokes (color / width / solid / dashed / dotted).
- **Custom path / SVG upload** — upload an `.svg` file. Single-path SVGs land as editable shapes; multi-element SVGs preserve their internal fills and stacking, with a per-element editor that lets you change each `<rect>` / `<path>` / `<circle>` etc. fill and stroke individually.
- **QR code** — encode any URL or text as a scannable QR layer. Adjustable error-correction level (L/M/Q/H), quiet zone, module / background colors, and an optional transparent background for placing over artwork.
- **Pixel art** — a palette-indexed editable grid up to 128×128 cells, with full pencil / eraser / fill / eyedropper / line / rect / ellipse tools, mirror X/Y, flip/rotate/resize transforms, multi-frame animation with playback and onion-skin, an in-app HSV picker, an inline screen-eyedropper, and PNG / sprite-sheet / animated-GIF export. Importable from a published design (Browse community), a local JSON file, or any image file (image → pixelize with median-cut palette quantization).

Every layer supports drag / resize / rotate / opacity / z-order, an aspect-ratio lock toggle on the W/H inputs (default on), a lock toggle that prevents accidental drags, and a visibility (eye) toggle in the layer list.

### Layer clipping / masking

Any layer (image, text, color, shape) can be clipped to a shape:

- **Inline shape clip** — pick a primitive (rect / circle / star / etc.) to mask the layer to that shape.
- **From another layer** — point at another shape layer in the same target and use its geometry as the mask.

Renders consistently in the editor, the preview surfaces, and the canvas / PDF / JPEG export.

### Layer clipboard

Cross-target and cross-tool copy/paste — Copy / Cut on a selected layer, Copy all / Paste for the whole panel. Paste retargets to the current sub-mode and clamps positions so layers copied from a wide cover don't land off-canvas on a narrow disc.

## Slide decks & presenting

Artstr Studio doubles as a Nostr-native presentation tool.

- **Slide** — a 16:9 design surface on the Designer tab. Mechanically a Custom Art canvas locked to 16:9, plus a **speaker-notes** field. A slide is a first-class design: publish it, fork it, load it.
- **Slide deck** — a Template-tab container holding an ordered, variable-length list of slides. The deck **embeds every slide's full data inline**, so a published deck is a single self-contained event — no external lookups.
  - **Deck Builder** — a reorderable grid of slide thumbnails. Add a blank slide, import a slide from Nostr or a file (non-16:9 imports are scaled-to-fit and letterboxed), duplicate, delete, and drag to reorder. Click a thumbnail to edit that slide in the canvas editor; edits write back into the deck.
  - **Deck theme** — a deck-level font and background that restyle every slide at render time without altering the slides themselves; any slide can opt out.
- **Presenter Mode** — a full-screen runtime that plays a deck: the themed current slide, speaker notes, a next-slide thumbnail, and a slide counter. Navigate with on-screen controls, click-to-advance, or the keyboard (arrows / space / Page keys / Home / End / Esc). A **Presenter ⇄ Audience** view toggle switches between the notes-and-thumbnail layout and a clean slide-only full-screen view. Launch it from the ▶ button in the Deck Builder tool palette, or from **Start Presentation** on a deck's preview page in the community browser.

## Pixel art

A dedicated palette-indexed editor for sprites and animations.

- **Two faces** — drop a `pixelart` layer into any other design (a cover, a slide, a custom-art canvas, etc.) or run **Pixel Art** as a standalone Designer-tab layout where the editor view *is* the whole canvas.
- **Tools** — pencil / eraser / fill bucket / colour eyedropper / line / rect / ellipse (with a Fill toggle), mirror X/Y, grid toggle, zoom; an in-app HSV picker (drag the saturation/value square + hue strip, then **+ Add** to push the colour into the palette).
- **Transforms** — flip H/V and rotate 90° CW/CCW apply across every frame; grid resize 4–128 per side, top-left anchored, transparent fill.
- **Animation** — a vertical timeline strip on the left holds the frames: add / duplicate / delete / drag-reorder / click to switch. Left / Right arrow keys cycle frames; **Space** plays / stops. Per-design FPS (1–60) and Loop, plus an Aseprite-style red-prev / blue-next **onion-skin** toggle.
- **Export** — crisp PNG at 1× / 2× / 4× / 8× / 16× / 32× (transparency, optional grid lines), sprite-sheet PNG (Grid or Row layout) with all frames tiled, and animated GIF via an inline GIF89a encoder (no vendored dependency — pixel-indexed input is what GIF expects natively).
- **Import** — *Browse community* opens the Nostr browser filtered to pixel-art designs and drops the chosen one in as a new layer; *Import from file* takes a local JSON design; *From image…* lets you pick any image file, then a live side-by-side preview tunes target W/H, colour count, and fit mode (Cover / Fit / Stretch) before applying.
- **Undo / redo** — fully integrated with the top-level toolbar; while the editor is open, **Ctrl+Z** / **Ctrl+Shift+Z** drive the pixel editor's local stack, restoring all frames plus the current-frame index together. Standalone-mode edits also push debounced entries to the global design history.
- **Animated previews** — multi-frame designs animate in the publish-confirm modal, the community browser, feed-card thumbnails, and profile pages. The RAF loop self-stops when the preview leaves the DOM, so closing a modal or scrolling a card out of view doesn't leak loops.

## Editor canvas

The canvas is a unified, Illustrator-style workspace: the tool palette, the
scrolling canvas, the contextual options panel, and the zoom bar are docked
flush around the artboard. Sidebar panels are collapsible (click the heading);
they start collapsed except the Layout panel, and selecting a layer opens the
Layers panel automatically. The whole side panel can also be **collapsed**
via a chunky vertical handle on the seam — handy when the canvas needs the
full width for a complex pixel sprite or a wide custom-art design. State
persists across reloads.

- **Undo / redo** — Ctrl+Z / Ctrl+Shift+Z (and Ctrl+Y), or the topbar buttons. A 50-deep in-memory history covering layer edits, mode switches, artwork loads, metadata, and more. Defers to the browser's native text-input undo while an input is focused.
- **Fit-to-view by default** — the canvas auto-scales so the whole artboard fits the preview area; it re-fits on window resize. The bottom zoom bar has zoom in/out, a 20–200% slider, Fit, and 1:1.
- **Off-canvas veil** — layer content that extends past the artboard edge renders under a translucent veil, so the printable area is always visually clear. The veil is dropped from PDF / JPEG export.
- **Keyboard** — `Delete` / `Backspace` removes the selected layer; arrow keys nudge it (`Shift` for a larger step); `[` / `]` send it back / forward; `Ctrl+D` duplicates; `Ctrl+C` / `X` / `V` copy / cut / paste a layer.

## Nostr integration

Every design surface participates in the same Nostr-backed community feed.

- **Identity** via NIP-07 (Alby, nos2x, etc.). The Login button opens a
  picker — NIP-07 today, NIP-46 remote signer and raw `nsec` paste
  reserved as future options. Once signed in, the Nostr widget becomes
  a dropdown with **View Profile**, **Settings**, and **Logout**.
- **Settings modal** — the per-relay list, the WoT trust filters, the
  NWC wallet connection, and the block-list management all live here.
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

Three flavors of Lightning are wired in:

- **Tips** — pure LNURL-pay, no NWC required. Pick an amount (21 / 100 / 500 / 1k / 5k / 21k / Custom), the recipient's `lud16` or `lud06` resolves to an LNURL-pay endpoint, and you get a bolt11 invoice + QR + lightning: deep-link. If the recipient's wallet supports zap requests (`allowsNostr: true`), we also sign a NIP-57 kind-9734 zap request and pass it along, so a kind-9735 receipt lands on relays after settlement.
- **NWC (NIP-47) wallet** — paste a `nostr+walletconnect://…` URI under Settings and Artstr can sign + send `pay_invoice` requests directly to your wallet (CoinOS-first onboarding, but any NWC-compatible wallet works). NWC powers one-click tips, premium unlocks, and the split-zap legs. The URI is **synced across logins** as an encrypted kind-30078 note keyed to your pubkey, so a new browser only needs your NIP-07 extension to reconnect the wallet.
- **Tracked zaps** — kind-9735 receipts feed a per-event aggregate, surfaced as `⚡ <total>` on feed cards / previews / profile pages, and as a sortable **Zapped** tab in the Community modal.
- **WebLN auto-pay** is offered as a one-click button when an extension is detected.
- **Payment detection** — after a tracked invoice is issued, a poll watches for the receipt and auto-closes the tip modal when payment is confirmed.

## Premium encrypted designs

Creators can publish paid templates. The publish modal exposes a **Premium encrypted** toggle that requires a sat amount and a short "soft-gate, not strong DRM" acknowledgment.

- **Static soft-gate.** The payload is AES-256-GCM encrypted in the browser with a key derived via HKDF-SHA256 from public event material plus an obfuscated per-epoch pepper baked into the static client. There is no server and no creator-online step. Honest framing: this raises friction against drive-by scraping but a determined reverse-engineer can recover the client pepper. Stronger DRM can swap in later without changing the buyer-side vault.
- **Watermarked preview.** A low-resolution JPEG of the design is rendered pre-encrypt and embedded in the envelope, so the community browser still has something to show.
- **Split-zap platform fee.** Every unlock is a Lightning split — creator 70 %, platform 30 % — both legs fired in parallel over NWC, with the platform leg's `lud16` resolved dynamically from the platform pubkey's kind-0 so it can change without a code release.
- **Purchase vault.** Once both receipts confirm, Artstr derives the key locally, decrypts in place, and records the unlock in a NIP-44 self-encrypted kind-30078 vault (`d=artstr:purchase-vault:v1`). The vault auto-splits into per-item events when over 40 KB. A fresh browser hydrates the vault on Nostr login (toast: "Restored N unlocks ✓"). Edit-in-place is address-tolerant, so re-publishing a premium design doesn't invalidate prior unlocks.
- **Premium browser tab.** New ⚡ **Premium** tab in the community modal lists encrypted designs; cards get a gradient stroke + PREMIUM ribbon. The **My Designs → Premium** sub-tab lists everything you've unlocked.

Spec lives in `docs/PREMIUM_DESIGNS_FEATURE.md`.

## Save, share, restore

- **Save project** writes the design (with metadata) to a JSON file.
- **Load from file** detects which layout the JSON belongs to (cover / disc / jewel / custom art / disc design) and switches to it automatically.
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
- `src/vendor/qrcode.min.js` — vendored QR encoder (used for Lightning tip invoices). The GIF89a encoder for pixel-art animation export is implemented inline in `index.html`.
- `docs/` — feature specs. `PEN_TOOL_FEATURE.md` covers the shipped pen / pencil / vector tooling; `SLIDE_DECK_FEATURE.md` covers the shipped slide / deck / presenter system (Phases A–D; dual-window presenter is future); `PIXEL_ART_FEATURE.md` covers the shipped palette-indexed pixel-art system (Phases A–D); `PREMIUM_DESIGNS_FEATURE.md` covers the shipped premium-encrypted-designs system (NWC split-zap + soft-gate + purchase vault); the older `ZAP_GATED_PREMIUM_FEATURE.md` / `ZAP_GATED_TEMPLATES_FEATURE.md` / `ZAPS_NWC_FEATURE.md` carry "superseded" banners and remain for history. Badges, collections, private publishing (Phases 3–4), and Stacks are still unbuilt.
- `TODO.md` — running list of deferred work and cleanup items.

## Schema

- Current project schema version: **5**.
- Minimum supported version: **4**. Older payloads load but won't round-trip cleanly.
- Template-mode discriminator in payloads: `cover`, `disc`, `jewel`, `customart`, `disc-design`, `slide`, `deck`, `pixelart`. A `slide` payload carries a `slide` object (canvas dims + speaker `notes`); a `deck` payload carries a `deck` object (`theme` + an inline ordered `slides` array); a `pixelart` payload carries a `pixelArt` object (`width` / `height` / `palette[]` of `#rrggbbaa` strings + `frames[]` of `{ id, pixels: <RLE> }` + optional `fps` and `loop`).
- Layer types: `image`, `text`, `color`, `shape`, `qr`, `pixelart`. Shape kinds: `rect`, `rounded-rect`, `circle`, `ellipse`, `triangle`, `polygon`, `star`, `line`, `path`, `svg`. Any layer may carry a `clip` field for masking. Pixel-art layers carry their own `pixelArt` object inline (same shape as the standalone payload).

## Defaults and stack

- No backend. Fully static. No build step.
- NIP-07 browser extension required for any signing-side action (publish, reply, react, follow, block-sync, zap request, edit, delete).
- Lightning is **optional**. Without a signed-in NIP-07 wallet, tips fall back to plain LNURL-pay and aren't tracked as zaps.
