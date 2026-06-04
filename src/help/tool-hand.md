# Hand tool (H)

Pans the canvas viewport. Useful for navigating large artboards
when the canvas extends beyond the visible area.

## Behaviour

- **Drag** the canvas to pan in any direction.
- The cursor changes to a closed grab while dragging.
- Doesn't select, modify, or create layers.

## Temp-pan from any tool

You rarely need to switch to the Hand tool explicitly:

- **Hold Spacebar** with any other tool active to temp-pan. The
  cursor switches to the grab cursor; release the spacebar to pop
  back to the previous tool. Works mid-stroke for the Pen + Pencil
  tools (the in-progress draft stays put).

## Zoom controls

Zoom isn't tied to the Hand tool — it works from any tool:

- **Cmd/Ctrl + scroll wheel** zooms toward the cursor.
- **Cmd/Ctrl + + / -** zoom in / out by one preset step.
- **Cmd/Ctrl + 0** fits the artboard to the viewport.
- The **Zoom** select at the top of the canvas chooses a preset
  level (25% → 400%) or "Fit".

## Tips

- The temp-pan modifier is essentially the only reason to flip to
  the Hand tool deliberately — it gives you a momentary pan without
  losing your active tool's modal state.
- A trackpad two-finger swipe also pans without a tool change.
