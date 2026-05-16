# Collections Feature Plan (NIP-51)

## Overview
Let users organize their favorite community templates into named collections — "My Pixar Set",
"Horror Night", "Criterion Shelf" — and share them publicly via Nostr. Anyone can browse a
collection and import templates from it directly. Collections are standard NIP-51 bookmark
sets (kind 30001), so they sync across Nostr clients automatically.

## Complexity
**Low–Moderate** — Estimated 3–5 hours

---

## Nostr Primitive: NIP-51 Bookmark Sets (kind 30001)

Kind 30001 is an addressable (replaceable) event that holds a named list of references.
For template collections, each list item is an `a` tag pointing to a kind 30078 template:

```json
{
  "kind": 30001,
  "pubkey": "<user-pubkey>",
  "tags": [
    ["d", "my-pixar-set"],
    ["title", "My Pixar Set"],
    ["description", "All my Pixar case wraps"],
    ["image", "https://...cover.jpg"],
    ["a", "30078:<creator-pubkey>:<d-tag>", "<relay-hint>"],
    ["a", "30078:<creator-pubkey>:<d-tag>", "<relay-hint>"]
  ],
  "content": ""
}
```

- The `d` tag is the collection's unique identifier (slug). Updating with the same `d`
  replaces the previous version — no duplicate events accumulate.
- `title`, `description`, and `image` are optional display metadata.
- Each `a` tag references one template (kind 30078 addressable event).

---

## Key Components

### 1. Creating a Collection

```javascript
async function createCollection(name, description) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const event = {
    kind: 30001,
    tags: [
      ['d', slug],
      ['title', name],
      ['description', description],
    ],
    content: '',
    created_at: Math.floor(Date.now() / 1000),
  };
  await publishToRelays(await window.nostr.signEvent(event));
  return slug;
}
```

### 2. Adding/Removing a Template from a Collection

Since kind 30001 is a replaceable event, adding an item means fetching the current
version, appending the new `a` tag, and re-publishing:

```javascript
async function addToCollection(collectionSlug, templateEvent) {
  const aTag = buildATag(templateEvent);        // '30078:<pubkey>:<d-tag>'
  const current = await fetchMyCollection(collectionSlug);
  const tags = current ? [...current.tags] : [['d', collectionSlug]];
  if (!tags.some(t => t[0] === 'a' && t[1] === aTag)) {
    tags.push(['a', aTag, '']);
  }
  await publishToRelays(await window.nostr.signEvent({
    kind: 30001, tags, content: '', created_at: Math.floor(Date.now() / 1000),
  }));
}

async function removeFromCollection(collectionSlug, templateEvent) {
  const aTag = buildATag(templateEvent);
  const current = await fetchMyCollection(collectionSlug);
  if (!current) return;
  const tags = current.tags.filter(t => !(t[0] === 'a' && t[1] === aTag));
  await publishToRelays(await window.nostr.signEvent({
    kind: 30001, tags, content: '', created_at: Math.floor(Date.now() / 1000),
  }));
}
```

### 3. Fetching Collections

```javascript
async function fetchMyCollections() {
  // Query kind 30001 authored by myPubkey
  return await queryRelays(relays, {
    kinds: [30001],
    authors: [state.community.myPubkey],
  }, { timeoutMs: 3000 });
}

async function fetchCollectionByAddress(pubkey, slug) {
  // Fetch a specific collection by pubkey + d-tag for sharing/browsing
  return await queryRelays(relays, {
    kinds: [30001],
    authors: [pubkey],
    '#d': [slug],
  }, { timeoutMs: 3000 });
}
```

### 4. Browsing a Shared Collection

Collections are shareable via a URL fragment or Nostr address (`naddr`):
```
casewrap.app/#collection/naddr1...
```

When a collection address is opened:
1. Fetch the kind 30001 event by naddr
2. Extract all `a` tags → list of template addresses
3. Fetch each kind 30078 template event
4. Render them as a mini-feed with "Import All" option

### 5. State Additions

```javascript
// Add to state:
collections: {
  mine: [],              // user's own kind 30001 events
  viewing: null,         // currently browsed collection (own or external)
}
```

---

## UI

### Template Card — "Save to Collection" Menu Item
Add to the card action menu (⋮):
```
⑃ Remix this design
📁 Save to collection  ▶  [My Pixar Set]
                          [Horror Night]
                          [+ New collection…]
```

### Collections Panel (in sidebar or settings)
```
┌─────────────────────────────────────────┐
│  📁 My Collections            [+ New]   │
│                                          │
│  My Pixar Set          8 templates  [→]  │
│  Horror Night          3 templates  [→]  │
│  Criterion Shelf      12 templates  [→]  │
└─────────────────────────────────────────┘
```

### Collection Detail View
Clicking a collection opens a mini-feed inside the community panel:
```
← Back    My Pixar Set  (8 templates)
─────────────────────────────────────
[Import All]  [Share]  [Edit]  [Delete]

[Card] [Card] [Card] ...
```

"Share" copies the `naddr` Nostr address to the clipboard for sharing.

### Feed Cards — Collection Badge
If a template is in one of the user's collections, show a small 📁 icon on the card corner.

---

## Performance Considerations
- Kind 30001 events are small (just tags) — fast to fetch and publish
- Fetch the user's collections once at login, cache in `state.collections.mine`
- Re-fetch lazily when the collections panel is opened
- Template events inside a collection are fetched only when the collection detail is opened

---

## Limitations
- Requires NIP-07 login to create or modify collections
- Read-only browsing of other users' shared collections works without login
- Nostr clients that don't parse kind 30001 `a` tags (only `e` tags) may not display templates correctly — this is a client compatibility issue, not a bug here
- No private/encrypted collections — kind 30001 is a public event (NIP-51 has a draft for private lists but it is not widely supported)

---

## Future Enhancements
- Collaborative collections: multiple pubkeys can contribute (needs a separate coordination event)
- Collection cover image: auto-generated from the first template's preview image
- "Import All" bulk-imports every template in a collection into a local queue
- Featured collections: curated by app admins on a discovery page
- RSS/Atom feed for a collection (static export)

---

## Testing Checklist
- [ ] Creating a collection publishes a valid kind 30001 event with `d` and `title` tags
- [ ] Adding a template adds the correct `a` tag and re-publishes the event
- [ ] Removing a template removes the `a` tag without affecting others
- [ ] Duplicate adds are ignored (same `a` tag not added twice)
- [ ] Collections panel lists all user's kind 30001 events with correct counts
- [ ] Collection detail fetches and renders referenced template events
- [ ] "Share" copies a valid naddr to clipboard
- [ ] Shared collection URL loads and renders without login
- [ ] "Import All" imports each template in the collection
- [ ] 📁 badge appears on feed cards that are in a user collection
- [ ] Collections sync correctly after page reload (re-fetched from relays)
