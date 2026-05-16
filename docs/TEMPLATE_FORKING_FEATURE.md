# Template Forking / Remix Feature Plan

## Overview
Allow users to import any community template as a starting point for their own design,
with automatic attribution to the original creator baked into the Nostr event. Forks are
discoverable — anyone can see a template's remix lineage — and the original creator gets
notified via a Nostr mention when someone forks their work.

## Complexity
**Low–Moderate** — Estimated 2–4 hours

---

## How It Works

### Forking Flow
1. User clicks "Remix this design" on a community template card
2. App imports the template payload into the editor (same as existing "Import" flow)
3. When the user publishes their remixed version, the new event includes a reference
   to the original template event ID in its tags
4. Original creator receives a Nostr notification (kind 1 mention) that their template
   was remixed

### Nostr Event Tags for a Fork
Add two tags to the published kind 30078 event:

```json
{
  "tags": [
    ["e", "<original-event-id>", "<relay-hint>", "fork"],
    ["p", "<original-creator-pubkey>"]
  ]
}
```

- `["e", ..., "fork"]` — marks this as a derivative work; the marker `"fork"` is a
  custom convention (Nostr allows arbitrary `e` tag markers)
- `["p", ...]` — notifies the original creator; their client will surface this as a mention

### Attribution Display
In the template detail view, show a "Forked from" row when a `fork` e-tag is present:

```
Forked from: [Alice's Spider-Man Wrap] by alice@getalby.com  →
```

Clicking the arrow navigates to the original template in the feed.

---

## Key Components

### 1. Remix Button
Add "Remix this design" to the template card action menu alongside existing Import option.
Visually distinguish it (⑃ fork icon) so users understand it's different from a plain import.

```javascript
function remixTemplate(event) {
  importDiscDesignFromPayload(event.content);  // existing import function
  state.community.forkSourceEventId = event.id;
  state.community.forkSourcePubkey  = event.pubkey;
  showNotification('Template loaded — your remix will credit the original creator.');
}
```

### 2. Fork State
Track pending fork metadata in state so it can be attached at publish time:

```javascript
// Add to state:
fork: {
  sourceEventId: null,   // event ID of the template being remixed
  sourcePubkey:  null,   // pubkey of the original creator
}
```

Clear `state.fork` when the user starts a fresh project or imports without remixing.

### 3. Publish Hook
In the existing publish function, inject fork tags when `state.fork.sourceEventId` is set:

```javascript
function buildPublishTags(existingTags) {
  const tags = [...existingTags];
  if (state.fork.sourceEventId) {
    tags.push(['e', state.fork.sourceEventId, '', 'fork']);
    tags.push(['p', state.fork.sourcePubkey]);
  }
  return tags;
}
```

### 4. Fork Detection on Render
When rendering a template detail card, check for a `fork` e-tag and fetch + display the
source template title and author:

```javascript
function getForkSource(event) {
  const tag = event.tags?.find(t => t[0] === 'e' && t[3] === 'fork');
  return tag ? { eventId: tag[1], relayHint: tag[2] } : null;
}
```

### 5. Remix Count
In the community feed, a template's remix count = number of kind 30078 events that
reference it with a `fork` e-tag. This can be fetched lazily:

```javascript
async function fetchRemixCount(eventId) {
  const events = await queryRelays(relays, {
    kinds: [30078],
    '#e': [eventId],
  }, { timeoutMs: 2000 });
  return events.filter(e => e.tags.some(t => t[0] === 'e' && t[3] === 'fork')).length;
}
```

---

## UI Changes
- Template card action menu: add "⑃ Remix this design" below "Import"
- Editor header: show "Remixing: [original title]" badge while fork state is active
- Editor header: "Clear remix" link to discard attribution and start fresh
- Template detail panel: "Forked from" row (when fork e-tag present)
- Template detail panel: "X remixes" count below reaction row

---

## Performance Considerations
- Fork source lookup is a single relay query — run it lazily when the detail panel opens
- Remix count query can be skipped on initial feed load and fetched on hover/click
- No new relay subscriptions needed — reuses existing `queryRelays()` helper

---

## Limitations
- Fork attribution is opt-in convention — anyone can publish a derivative without tagging;
  this feature makes attribution easy but cannot enforce it
- Relay hints in the `e` tag are best-effort; original event may not be on all relays
- No fork graph visualization (full lineage tree) — out of scope for initial version

---

## Future Enhancements
- Fork tree visualization: show the full remix lineage of popular templates
- "See all remixes" panel on template detail
- Notify original creator via kind 1 DM or push notification service
- Attribution in exported PDF metadata

---

## Testing Checklist
- [ ] "Remix this design" imports template content into editor correctly
- [ ] Fork state (`sourceEventId`, `sourcePubkey`) is set after remix
- [ ] Published event contains `["e", ..., "fork"]` and `["p", ...]` tags
- [ ] Fork state clears on new project / plain import
- [ ] "Remixing: [title]" badge shows in editor while fork is active
- [ ] "Clear remix" removes fork state and badge
- [ ] Template detail shows "Forked from" row when fork e-tag is present
- [ ] "Forked from" link navigates to source template in feed
- [ ] Remix count displays on template detail (fetched lazily)
- [ ] Publishing without remix produces no fork tags
