# QR Code Layer Feature Plan

## Overview
Add a QR code as a first-class layer type in the editor. Users can place a scannable QR
code anywhere on a case wrap or disc label — linking to the film's IMDb page, the Nostr
template event, a personal website, or any custom URL. The QR code renders live in the
editor canvas and is included in the print export.

## Complexity
**Low** — Estimated 2–3 hours
QR generation is a solved problem with a small, dependency-free library. The main work
is wiring it into the existing layer system.

---

## Library

**qrcode-generator** (or `qrcode.js`) — pure JavaScript, no dependencies, ~15 KB:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
```

Alternatively, use the browser's `canvas` API directly via **qr-creator** (5 KB ESM):
```html
<script type="module">
  import QrCreator from 'https://esm.sh/qr-creator@1';
  window.QrCreator = QrCreator;
</script>
```

Both render directly to a `<canvas>` element — a natural fit since the editor already
uses canvas for layout rendering.

---

## Layer Type: `qr`

Extend the existing layer system with a new `type: 'qr'` alongside the existing image
and text layer types:

```javascript
// New layer schema
{
  type:       'qr',
  url:        'https://imdb.com/title/tt0145487',  // content to encode
  size:       200,     // px — width and height (always square)
  x:          50,      // position offset
  y:          50,
  fgColor:    '#000000',
  bgColor:    '#ffffff',
  bgTransparent: false,
}
```

---

## Key Components

### 1. QR Rendering Function

Generate a QR canvas and draw it into the main layout canvas at the layer's position:

```javascript
function renderQRLayer(ctx, layer) {
  const offscreen = document.createElement('canvas');
  offscreen.width  = layer.size;
  offscreen.height = layer.size;

  QrCreator.render({
    text:        layer.url,
    radius:      0,           // square modules
    ecLevel:     'M',         // medium error correction (good balance for print)
    fill:        layer.fgColor,
    background:  layer.bgTransparent ? null : layer.bgColor,
    size:        layer.size,
  }, offscreen);

  ctx.drawImage(offscreen, layer.x, layer.y, layer.size, layer.size);
}
```

### 2. Add QR Layer UI

Add "Add QR Code" to the existing "Add Layer" menu (alongside "Add Image" and "Add Text"):

```
+ Add layer
  ├ Image layer
  ├ Text layer
  └ QR Code layer   ← new
```

Clicking it opens a small setup modal:

```
┌──────────────────────────────────────┐
│  Add QR Code                          │
│                                       │
│  URL to encode:                       │
│  [https://imdb.com/title/tt0145487 ] │
│                                       │
│  Quick links:                         │
│  [IMDb page] [This template] [Custom] │
│                                       │
│  Size: [200] px                       │
│  Colors: ■ Dark [#000000] □ Light [#ffffff] │
│  ☐ Transparent background             │
│                                       │
│        [Cancel]   [Add to design]     │
└──────────────────────────────────────┘
```

### 3. Quick Link Presets

Pre-populate the URL field from context:

```javascript
const QR_PRESETS = {
  imdb:     () => `https://imdb.com/title/${state.metadata.imdbId}`,
  template: () => `https://njump.me/${buildNaddr(state.community.myPubkey, state.publishedEventDTag)}`,
  letterboxd: () => `https://letterboxd.com/film/${slugify(state.metadata.title)}`,
};
```

"This template" preset is only enabled after the user has published the template (so there
is an event address to link to).

### 4. Layer Edit Panel

When a QR layer is selected in the editor, show its properties in the layer panel:
- URL input (live re-renders QR on change)
- Size slider (64px–512px)
- Foreground / background color pickers
- Transparent background toggle (useful for dark case backgrounds)

### 5. Undo/Redo Integration

QR layer add/edit/delete should trigger `saveUndoSnapshot()` — same as all other layer
operations (already planned in UNDO_REDO_FEATURE.md).

---

## Rendering in Print Export

The QR layer renders identically in both the live preview and the print/PDF export since
both paths use the same canvas drawing code. No special print handling needed.

Recommended minimum size for print legibility:
- Disc label (small area): 80px minimum at 150 DPI → ~13mm physical
- Case wrap: 120px+ for comfortable scanning

Show a warning if the user sets size below 64px: "QR code may be too small to scan when printed."

---

## Error Handling

Some URLs produce QR codes too dense to scan reliably at small sizes:
- `qr-creator` will throw if the content is too long for the selected error correction level
- Fall back to lower error correction (`'L'`) automatically, warn the user if it still fails

```javascript
function safeRenderQR(canvas, layer) {
  for (const ecLevel of ['M', 'L']) {
    try {
      QrCreator.render({ ...options, ecLevel }, canvas);
      return;
    } catch {
      continue;
    }
  }
  renderQRErrorPlaceholder(canvas, 'URL too long for QR at this size');
}
```

---

## Performance Considerations
- QR generation is synchronous and fast (<5ms for typical URLs)
- Offscreen canvas is created and discarded per render — no memory leak
- Live re-render on URL change is instant; no debounce needed

---

## Limitations
- QR codes only encode text/URLs — no binary data
- Very long URLs (>200 chars) produce dense QR codes that may not scan reliably at small print sizes; recommend URL shorteners for long links
- Transparent background only works if the printing surface is light-colored

---

## Future Enhancements
- Rounded module style (aesthetic option for modern-looking QR codes)
- Center logo/image inside QR code (common branding pattern — works with high EC level)
- NFC tag companion: generate NFC URI payload alongside QR (informational only)
- Batch QR: auto-place IMDb QR on all designs in a session

---

## Testing Checklist
- [ ] "Add QR Code" option appears in the Add Layer menu
- [ ] QR setup modal opens and pre-populates IMDb quick link when imdbId is set
- [ ] QR code renders correctly in the editor canvas at added position
- [ ] Live re-render triggers when URL is edited in the layer panel
- [ ] Size slider updates QR dimensions in real time
- [ ] Foreground/background color changes reflect immediately
- [ ] Transparent background renders correctly over a dark case wrap
- [ ] QR layer is included in the print/PDF export
- [ ] Sub-64px size shows legibility warning
- [ ] Overly long URL falls back to lower EC level gracefully
- [ ] QR add/edit/delete triggers undo snapshot
- [ ] QR layer saves and restores correctly in project JSON export/import
- [ ] Rendered QR code is actually scannable (test with phone camera)
