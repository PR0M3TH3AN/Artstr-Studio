# Hand tool (H)

Pans the canvas viewport. Useful for navigating large artboards
when the canvas extends beyond the visible area.

## Behaviour

- **Drag** the canvas to pan in any direction.
- The cursor changes to a closed grab while dragging.
- Doesn't select, modify, or create layers.

## Pen-mode Spacebar reposition

A specific case: while mid-draw with the **Pen tool**, holding
**Spacebar** repositions the anchor you're currently placing (and
slides its handles with it). This is a Pen-tool-only behaviour, not
a global "temp-pan". Release to commit the anchor.

## Zoom controls

Zoom isn't tied to the Hand tool — it works from any tool via the
canvas toolbar at the top of the canvas:

- **− / +** buttons step by 10 % each.
- **Zoom dropdown** chooses a preset level.
- **Fit** button auto-fits the artboard to the viewport.

## Tips

- A trackpad two-finger swipe also pans without a tool change.
- For pixel-precise alignment, zoom in via the **+** button until
  pixel boundaries are visible, then pan with the Hand tool.
