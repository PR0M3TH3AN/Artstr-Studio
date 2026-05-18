# Edit Published Designs

## Goals
Let a user **update an already-published design** in place — fix a dead image URL, retitle it, change the category, swap art — without leaving a trail of orphaned versions or duplicate posts behind.

Designs in CaseWrap are kind-30078 parameterized replaceable events (NIP-33). The protocol-level mechanism for replacement is already there: publish a new event with the same `kind` + `pubkey` + `d`-tag, and compliant relays drop the old one. We just have to wire that into the editor flow.

### Product goals
1. Owners can fix mistakes without forking.
2. Replacement happens at the protocol layer — one publish, zero NIP-09 deletions required for the replace itself.
3. Editing is visually distinct from forking, so users never accidentally publish over their own design when they meant to remix.
4. Old preview / preview-broken state for the supplanted version doesn't poison the new version.

### Non-goals (v1)
- Editing someone else's design "on their behalf". Owner-only.
- A revision history UI ("show me previous versions"). Replaceable events overwrite by design; once superseded, the old version is gone from relays. If a user wants version history they fork.
- Merging zaps or reactions from the old event id into the new one. Reactions and zaps are tagged by event id, and the new event has a new id even though it shares the d-tag. Stats reset to zero on edit. This is a real trade-off and we surface it in the confirm dialog.
- Soft moderation history transfer.
- Editing the publication date / `created_at` (always = now).
- Editing the `d`-tag itself (would defeat the whole point — that's just a new design with a delete-old).

---

## How Nostr replaces parameterized events

For kind 30000–39999, `(kind, pubkey, d-tag)` is the address. The relay keeps only the latest event by `created_at` at that address. Older events at the same address are dropped by compliant relays at publish time.

So: publishing a new kind-30078 event with the same `d`-tag from the same pubkey replaces the prior version. No `kind: 5` deletion is needed for the replacement itself.

(NIP-09 deletion *can* still be used to remove a design entirely — that's our existing "Delete" flow and is unchanged.)

### Side effects of replacement
- **Event id changes.** The new event has its own hash, different from the old one.
- **Reactions (kind-7) tagged by old event id remain on relays** but are orphaned — they point at an event that no longer exists. Most clients hide them.
- **Zap receipts (kind-9735) tagged by old event id are similarly orphaned.** New zaps targeting the new event id won't merge with old totals.
- **Share links pointing at the old event id (`nevent1…`) will not resolve.** `naddr1…` links (which are `(kind, pubkey, d-tag)` based) **continue to work** after an edit. We already mint `naddr` for mode-prefixed d-tags.

This is the part to surface clearly in the confirm dialog: "Editing replaces the original. Existing zaps and reactions will no longer be linked to this design."

---

## UX

### Entry point
- **My Designs tab**: each card the user owns gets a new `Edit` button next to `Fork off!`.
- **Profile page (own profile)**: same `Edit` button on each design card in the grid.
- **Design preview (own)**: an `Edit` button in the preview action row, next to Save JSON / Copy share link / Tip.

Edit buttons are owner-only — only visible when `row.e.pubkey === state.community.myPubkey`.

### Editor state
When the user clicks Edit:
1. The editor loads the design (same code path as Fork).
2. We set new state fields:
   - `state.editingDTag = '<original d-tag>'`
   - `state.editingKind = 30078`
   - `state.editingEventId = '<original event id>'` (for orphan reactions / soft-mod warning copy)
3. A top-of-editor banner appears: `Editing published design — Cancel`.
4. The Save / Publish buttons relabel from "Save" → "Save changes" and "Publish" → "Publish update".

### Cancel
- Cancel button discards the editing context but keeps the editor open with whatever the user has typed. They can then choose to publish as a fork (new d-tag) or close.
- Optional second confirmation if they have unsaved changes.

### Publishing the edit
- On publish, we build the kind-30078 event with `tags: [['d', state.editingDTag], …]` instead of generating a new d-tag.
- `created_at = now()` (which signals "updated" to relays).
- Submit-and-verify (existing publish flow), then clear the editing context on success.
- A confirm dialog the first time only per session: "This replaces your published design. Existing zaps/reactions on the old version will be orphaned — they'll still exist on relays but won't show under this design anymore. Continue?"

### Visual cues
- Banner across the top of the editor while in edit mode: `Editing "<title>" · Cancel`
- Save button label: "Publish update" (instead of "Publish")
- After successful publish: toast "Design updated."
- The design's card in the feed should pick up the change as soon as the relay returns it (existing diff-render handles this).

---

## Engineering plan

### State additions
```js
state.editingDTag = '';
state.editingKind = 0;
state.editingEventId = '';
```

Reset on:
- Cancel edit
- After successful publish update
- "Close project" (already exists)
- Loading a fresh design from disk

### Helpers
- `enterEditMode(row)` — sets the three state fields, paints the banner.
- `exitEditMode()` — clears, hides the banner.
- `isEditing()` — boolean for templating.

### Publish-flow changes
Locate the existing publish function (the one that builds the kind-30078 event). Single insertion:

```js
const d = state.editingDTag || mintDTagFromTitleAndMode(...);
```

Plus on success:

```js
exitEditMode();
showToast('Design updated.');
```

No new event kinds, no new relay queries, no new infrastructure.

### Markup
One new banner element above the editor canvas:

```html
<div id="editingBanner" style="display:none">
  Editing <span id="editingBannerTitle"></span>
  <button id="editingBannerCancel">Cancel</button>
</div>
```

CSS: thin yellow stripe (`background:rgba(251,191,36,.12); border-bottom:1px solid rgba(251,191,36,.4); padding:8px 14px;`).

### Entry-point buttons
- `My Designs` tab: extend the card factory to insert an Edit button for owner-rows.
- `Profile page` grid: same factory is reused via `buildFeedCardForRow` — passing an `ownerActions` flag, or just always checking `row.e.pubkey === state.community.myPubkey` inside the factory.
- `Design preview` action row: insert Edit between existing buttons when owner.

### Wiring the load
The existing "Fork" path already calls `loadPayloadIntoEditor(row.payload, …)`. Edit calls the same function, then `enterEditMode(row)` immediately after.

---

## Risks and tradeoffs

| Risk | Mitigation |
|---|---|
| User accidentally overwrites their design when they meant to fork | Persistent banner + relabeled Publish button + first-time-per-session confirm dialog |
| Reactions / zap totals reset to zero after edit | Surface in the confirm copy. Acceptable cost of using replaceable events |
| User edits, then someone else's relay still serves the old version | Same risk as any publish. Some relays may lag; eventually the new event wins by `created_at` |
| Cancel + republish-as-fork generates a new d-tag, leaving the original untouched | Working as intended — Cancel exits edit context cleanly |
| User edits a design that was previously deleted via NIP-09 tombstone | Surface a warning: "You previously deleted this design. Editing republishes it." Or block editing — recommendation: warn but allow |
| Old share links (`nevent1…`) break | We already prefer `naddr1…` for mode-prefixed d-tags. `nevent` links are inherently version-pinned and can't survive any edit by design |
| Concurrent edit from two tabs / devices | Last write wins by `created_at` — same as any other multi-device usage. Not a v1 concern |
| Editing the original Fork — should we collapse with the original? | No. Forks are separate designs with separate d-tags; editing one doesn't affect the other |
| User publishes an edit, then later opens an old browser session that has the pre-edit state in localStorage | Same fork-vs-edit warning applies. If editing context is missing from state but the d-tag exists in My Designs, treat as fork (safer default) |

---

## Phased delivery

### Phase A — State, helpers, and banner
1. Add the three state fields and `enterEditMode` / `exitEditMode` / `isEditing` helpers.
2. Add the banner markup + CSS.
3. Wire the banner Cancel button.
4. Reset editing state on close-project and fresh-load.

**Acceptance**: setting state via the console shows the banner; clicking Cancel hides it.

### Phase B — Publish-flow rewire
1. Change the publish path to honor `state.editingDTag` if set.
2. Relabel buttons when editing.
3. First-time-per-session confirm dialog.
4. Toast on success; clear edit state.

**Acceptance**: manually entering edit mode and publishing replaces the original on relays (verified via `naddr` lookup returning the new content).

### Phase C — UI entry points
1. Owner-only Edit button on My Designs card.
2. Same on profile page grid (own profile).
3. Same in design preview action row when owner.

**Acceptance**: clicking Edit from any of the three surfaces loads the design and shows the banner.

### Phase D — Polish
1. Better toast / status text.
2. "Editing republishes a previously-deleted design" warning.
3. Test fork-then-edit and edit-then-fork flows for regressions.

---

## Open questions

1. **Should publishing an edit also bump `created_at` on relays that don't auto-replace?**
   Yes — `created_at = now()` is the natural "this is newer" signal. Non-compliant relays may keep the old one but compliant ones will replace.
2. **Should we visually mark edited designs (e.g., "Updated 2 days ago")?**
   v1: no. Designs already show created_at indirectly via sort order on the New tab; explicit "edited" labels are noise unless we keep history.
3. **Edit a design while it's still being published initially?**
   Block: the publish flow disables the editor until success. Re-edit only after publish succeeds.
4. **Edit from the Editor itself (when the user remembers they need to fix the live version)?**
   Not v1. Edit always starts from a card/preview/profile. Could be added later as a "Match published version → Edit" affordance.
5. **What about replies and reposts targeting the old event id?**
   Same orphan fate as reactions and zaps. We don't try to rewrite or migrate them.

---

## Acceptance summary

- [ ] Owner-only Edit button on My Designs cards, profile grid (own), and design preview.
- [ ] Clicking Edit loads the design and shows the editing banner.
- [ ] Banner Cancel exits edit mode without losing the editor's current state.
- [ ] Publish in edit mode reuses the original d-tag and replaces the event on relays.
- [ ] First-time-per-session confirm dialog explains the zap/reaction tradeoff.
- [ ] Save buttons relabel to "Publish update" while editing.
- [ ] After successful update, the editor returns to normal mode and the user sees a confirmation.
- [ ] Existing fork flow is untouched — clicking Fork on someone else's design still mints a new d-tag and creates a separate post.
