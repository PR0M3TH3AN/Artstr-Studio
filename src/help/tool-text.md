# Text tool (T)

Drops a text layer. Drag to size the bounding box; the layer is
created with `contentEditable` set so you can type immediately.

## Creating

- **Click** the canvas. A default-sized text box drops at the click
  point, the tool auto-flips back to Select, and the box's
  contentEditable area gains focus so you can start typing
  immediately. The placeholder text is pre-selected so your first
  keystroke replaces it.

## Editing

A text layer's content is HTML (rich text). Inline marks are
applied via the text-layer-options inline buttons (or the browser's
native rich-text shortcuts when the contenteditable area has focus
— browser behaviour differs):

- **Bold**, *italic*, underline, strikethrough — via the inline
  toolbar buttons that appear with a text layer selected.
- Inline link — use the link button in the layer-options pane to
  add a URL to selected text.

Block formatting:

- Alignment (left / center / right) via the **Alignment** dropdown.
- Font, size, colour via the **Type** options pane.

## Right-side Type panel

When a text layer is selected:

- Font family picker (system fonts + a vendored Google Fonts subset).
- Font size + weight + style.
- Colour (with the [Eyedropper](#/help/tool-eyedropper) inline).
- Letter spacing, line height.
- Horizontal + vertical alignment within the box.
- Padding (inset from the box edge).

## Behaviour notes

- Text rasterizes via the browser's font engine — what you see is
  what the PNG export captures. PDF export emits real PDF text for
  fonts on the embeddable allowlist (Times / Helvetica / Courier
  families); other fonts fall back to vector paths in the PDF.
- Linked-design and pixel-art layers can sit on top of text without
  the text losing its editability.
- For multi-page **books**, place body-text headings via the chapter
  editor's markdown (the reflow engine handles pagination there) —
  the Text tool is for designed-page captions / titles, not body.

## Tips

- A locked layer (lock icon in the Layers panel) refuses clicks —
  unlock first if a text box won't activate.
- Token text (`{page-number}` etc) in a **book master** text layer
  resolves per-page. Token text in a designed-page text layer stays
  literal.
