# Tool Options pane (right side)

The floating panel next to the canvas. Its contents switch based on
the active tool + the currently-selected layer. Empty until you
pick a tool or a layer.

## Two modes of content

The pane swaps between two kinds of content depending on what's
active:

1. **Tool options** — when no layer is selected, shows the active
   tool's drawing parameters (fill / stroke / size / kind etc).
   These apply to the *next* layer you draw.
2. **Layer options** — when a layer IS selected, shows that
   layer's properties (x / y / w / h / rotation / opacity / fit /
   clip / fill / type-specific fields). Edits apply live.

You can have both modes briefly at once if you draw a new layer
while a different layer is selected — the new layer's options
take over the moment it lands.

## Per-tool contents

The per-tool docs cover the specific controls each tool surfaces:

- [Pen tool](#/help/tool-pen) — Fill toggle + colour, Stroke
  colour + width, mid-draw Finish / Cancel, path actions block
  (Pointed corner / Curved smooth / Delete anchor / Average /
  Join endpoints / Close path / Reverse direction).
- [Pencil tool](#/help/tool-pencil) — Stroke colour + width.
- [Shape tool](#/help/tool-shape) — Kind picker (rect / rounded
  rect / circle / ellipse / triangle / polygon / star / line),
  Fill toggle + colour, Stroke colour + width.
- [Text tool](#/help/tool-text) — Font / Colour / Point size /
  Alignment + Bold / Italic toggles.
- [Direct Selection](#/help/tool-direct-select) — Hint + the
  Path Actions block when anchors are selected.
- [Eyedropper](#/help/tool-eyedropper) — no panel; uses the
  active swatch.
- [Select](#/help/tool-select) / [Hand](#/help/tool-hand) — no
  panel of their own; they show the *selected layer's* options.

## Per-layer contents

When a layer is selected, the pane shows that layer's edit
controls. See the [Layers panel](#/help/panel-layers) page for the
full layer-options field list — the floating pane is the live
edit surface for those fields.

## Tips

- The pane is intentionally floating + slim so it stays out of the
  way on small viewports. On wider viewports it docks against the
  right side of the canvas.
- If you can't find a field you expect to see, check: (a) is the
  right tool active? (b) is a layer of the right type selected?
- Hiding the layers panel (sidebar collapse) does not hide the
  Tool Options pane.
