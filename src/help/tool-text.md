# Text tool (T)

Drops a text layer. Drag to size the bounding box; the layer is
created with `contentEditable` set so you can type immediately.

## Creating

- **Drag** a rectangle on the canvas to size the text box.
- The cursor lands inside the box at the end of the drag — start
  typing.
- **Click + release without dragging** drops a default-sized text
  box at the click point.

## Editing

A text layer's content is HTML (rich text). Inline marks supported:

- **Bold** (`**bold**` or **Cmd/Ctrl + B**)
- *Italic* (`*italic*` or **Cmd/Ctrl + I**)
- Underline (toolbar button or **Cmd/Ctrl + U**)
- Strikethrough
- Inline link (paste a URL while text is selected; or use the link
  button in the **Type** panel).

Block formatting:

- Headings via the right-side type panel.
- Bulleted / numbered lists (Enter continues the list; empty Enter
  exits).
- Alignment (left / center / right / justify).

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
