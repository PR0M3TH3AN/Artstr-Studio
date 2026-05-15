# Undo/Redo Feature Plan

## Overview
Add undo/redo functionality to allow users to fix mistakes and reverse unintended changes. State snapshots will be saved to browser localStorage.

## Complexity
**Moderate** - Estimated 1-2 hours to implement

## Key Components

### 1. Undo/Redo Stack
- Maintain two stacks: `undoStack` and `redoStack`
- Each stack stores snapshots of the entire `state` object
- Limit stack size to 20-50 snapshots to avoid filling localStorage (~2-5MB usage)

### 2. State Snapshot Capture
Save snapshots at major action points (not on every keystroke):
- Project import/load
- Add/delete/modify layers
- Design image URL changes
- Design property edits (fit, zoom, x, y, rotate)
- Metadata edits (title, category, imdbId)
- Add/remove disc designs in template slots

### 3. Storage Strategy
- Serialize state snapshots using `JSON.stringify()`
- Store in localStorage key like `undo-stack` and `redo-stack`
- Include timestamp with each snapshot for debugging
- Implement size checks to prevent localStorage overflow

### 4. Core Functions Needed
```javascript
function saveUndoSnapshot(label)
  // Save current state to undo stack, clear redo stack
  
function undo()
  // Restore previous state from undo stack, move current to redo stack
  
function redo()
  // Restore state from redo stack, move current to undo stack
  
function updateUndoRedoUI()
  // Enable/disable undo/redo buttons based on stack availability
```

### 5. UI Changes
- Add "Undo" button in toolbar/header
- Add "Redo" button next to undo
- Show disabled state when no undo/redo available
- Optional: Show keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z)
- Optional: Show snapshot label on hover

### 6. Integration Points
Modify existing functions to call `saveUndoSnapshot()` after:
- `importDiscDesignFromPayload()` - after design imported
- `addLayer()` - after layer created
- Layer deletion handlers
- Design image URL updates
- Metadata input change handlers
- Template preset changes

## Performance Considerations
- Serializing/deserializing state is fast (~1-5ms)
- No performance impact on normal operations
- localStorage access is synchronous and fast
- Consider debouncing rapid metadata edits

## Limitations
- Browser localStorage only (not synced across devices/browsers)
- Limited to current session if user closes browser
- Large image URLs could impact stack size
- No undo for external Nostr publishes (data already on network)

## Future Enhancements
- IndexedDB for larger storage capacity
- Undo history UI showing snapshots
- Selective undo (undo specific action)
- Cloud sync of undo history
- Keyboard shortcuts configuration

## Testing Checklist
- [ ] Undo works after layer add
- [ ] Undo works after image URL change
- [ ] Undo works after metadata edit
- [ ] Redo restores undone actions
- [ ] Stack limits prevent localStorage overflow
- [ ] Buttons disable when stacks empty
- [ ] Page refresh preserves undo stack (if kept in localStorage)
- [ ] Works across template/designer mode switches
