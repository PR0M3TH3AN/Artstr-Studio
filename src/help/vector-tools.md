# Vector tools — overview

The left-hand toolbar lives on every canvas-style artboard (Custom Art,
Slide, single deck slide, book pages, book masters). It picks the
active tool — what your pointer does when you click + drag the canvas.

## The toolbar

| Key | Tool | What it does |
|-----|------|-------------|
| **V** | [Select](#/help/tool-select) | Move / scale / rotate whole layers. The default. |
| **A** | [Direct Selection](#/help/tool-direct-select) | Edit anchors + handles on a single path. |
| **H** | [Hand](#/help/tool-hand) | Pan the canvas (hold spacebar for a quick temp-pan from any other tool). |
| **P** | [Pen](#/help/tool-pen) | Click to drop anchors, click-drag for Bézier handles. Illustrator-parity behaviour. |
| **B** | [Pencil](#/help/tool-pencil) | Freehand drawing. Smoothed into a Bézier path on release. |
| **S** | [Shape](#/help/tool-shape) | Drop primitives — rectangle / ellipse / polygon / star / line. |
| **T** | [Text](#/help/tool-text) | Drop a text layer. Drag to size, then type. |
| **I** | [Eyedropper](#/help/tool-eyedropper) | Sample a colour from anywhere on screen. |

## Supporting panels

These aren't toolbar tools — they're floating panels that operate on
whatever you've selected.

- [**Pathfinder**](#/help/pathfinder) — Unite / Subtract / Intersect /
  Exclude on two or more selected shapes.
- [**Align & Distribute**](#/help/align-distribute) — line up multiple
  layers; even-space-distribute.
- [**Free Transform**](#/help/free-transform) — rotate / scale handles
  around the selection bbox without flipping tools.

## How the toolbar interacts with the layer list

- Selecting a layer in the **Layers** panel acts like clicking it with
  the Select tool — handles appear, the canvas selects it.
- Double-clicking a vector shape with Select drops you into Direct
  Selection on that path (Illustrator-style "dive in"). Click outside
  the shape (or hit Esc) to pop back out.
- The active tool persists per session — switching tabs / modes keeps
  your last tool active.

## Keyboard shortcuts (canvas focus)

- **V / A / H / P / B / S / T / I** — switch tools.
- **Cmd/Ctrl + Z** / **Cmd/Ctrl + Shift + Z** — undo / redo.
- **Cmd/Ctrl + Y** — redo (alternate).
- **Cmd/Ctrl + D** — duplicate selected layer.
- **Cmd/Ctrl + C / X / V** — copy / cut / paste layer(s).
- **Cmd/Ctrl + G** — group selected layers.
- **Cmd/Ctrl + ] / [** — bring forward / send backward; add **Shift**
  for bring-to-front / send-to-back.
- **Cmd/Ctrl + J** — close path / join two selected endpoints
  (Pen / Direct Selection edit mode only).
- **Cmd/Ctrl + Alt + J** — average selected anchors to their centroid
  (Pen / Direct Selection edit mode only).
- **Delete / Backspace** — remove selected layer; remove selected
  anchor in Pen / Direct Selection edit mode.
- **Shift + click** (or Cmd / Ctrl + click) — additive multi-select.
- **Shift while drawing with the Pen tool** — constrain the next
  anchor to a 45° angle from the previous one.
