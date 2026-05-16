# Trust, Mute, and Web-of-Trust (WoT) Plan

## Goals
Build an **abuse-resistant community feed** that still feels open and discoverable, using only Nostr-native data and client-side logic.

### Product goals
1. Reduce spam and low-quality content quickly.
2. Keep control in users’ hands (local + portable moderation).
3. Preserve feed performance for both logged-out and logged-in users.
4. Ship in small phases with measurable outcomes.

### Non-goals (v1)
- Centralized server moderation.
- Perfect Sybil resistance.
- Cross-relay consensus on reports.

---

## Current architecture assumptions
- Identity and signing via **NIP-07** browser extension.
- Community templates are already rendered from Nostr events.
- App can query multiple relays and currently has a feed render pipeline.

---

## Key Nostr primitives

| NIP | Kind | Usage in this feature |
|-----|------|------------------------|
| NIP-02 | `3` | Follow graph (hop-1, optional hop-2) |
| NIP-51 | `10000` | User mute list (`p` tags, optional words/events) |
| NIP-56 | `1984` | Abuse reports (advisory to relays/tools) |

---

## Phased delivery plan

## Phase 1 — Local block list (works logged out)

### Why first
Immediate abuse relief, zero protocol dependencies, and easy rollback.

### Data model
- `localStorage['casewrap:block:list:v1'] = string[]` (hex pubkeys)
- Normalize pubkeys to lowercase hex before insert.
- Keep a companion metadata object for analytics/debug (optional):
  - `localStorage['casewrap:block:meta:v1'] = { [pubkey]: { createdAt, source } }`

### UX
- Card menu action: **Block author**.
- Settings section: list blocked pubkeys + unblock button.
- Inline feed toast: “Author blocked. Undo”.
- Badge in settings: “N authors hidden”.

### Engineering notes
- Block filter is applied as the first feed filter stage.
- Use a `Set` in memory to avoid repeated array scans.
- Add defensive guard for malformed pubkeys.

### Acceptance criteria
- Blocking hides author content immediately in all feed views.
- Unblock restores content without full refresh.
- Block state persists across refresh.

---

## Phase 2 — Mute list sync (NIP-51)

### Why second
Makes moderation portable across devices and compatible with other Nostr clients.

### Sync strategy
On successful NIP-07 login:
1. Fetch latest kind `10000` authored by viewer pubkey.
2. Parse `p` tags into `remoteMuted` set.
3. Read local block set `localMuted`.
4. Merge union -> `effectiveMuted`.
5. If union differs from remote, publish updated kind `10000`.
6. Cache `effectiveMuted` locally.

### Conflict policy
- **Union wins** by default (safer for abuse prevention).
- Never silently remove remote mutes.
- If publish fails, keep local behavior and surface non-blocking warning.

### Event shape
```json
{
  "kind": 10000,
  "tags": [["p", "<hex-pubkey>"]],
  "content": ""
}
```

### Acceptance criteria
- Existing remote mute list is respected on login.
- New block actions publish updated mute list.
- Local filter still works if relays/signing fail.

---

## Phase 3 — WoT-aware ranking and filtering

### Why third
Highest feed-quality impact for signed-in users.

### Trust tiers
- **Blocked**: in effective mute set -> hidden.
- **Trusted (hop-1)**: directly followed by viewer.
- **Extended (hop-2)**: followed by someone viewer follows.
- **Unknown**: no graph evidence.

### Modes
- Default mode: **rank by trust**, don’t hard-hide unknown.
- Optional strict mode toggle: **show trusted only**.
- Optional toggle: enable/disable hop-2 expansion.

### Ranking algorithm (v1)
Sort key tuple:
1. Tier priority (`trusted` > `extended` > `unknown`)
2. Optional social score (# of hop-1 followers who follow author)
3. Existing recency score (keep current feed freshness behavior)

### Performance constraints
- Fetch hop-1 first; render immediately with partial trust state.
- Compute hop-2 only if user enables it.
- Cache graph in `sessionStorage` with TTL (e.g., 15 min).
- Hard cap hop-2 expansion fanout (e.g., max 500 hop-1 nodes queried).
- Use batched relay subscriptions; close on EOSE.

### Acceptance criteria
- Trust tiers display correctly for sampled known authors.
- “Trusted only” mode hides extended + unknown.
- Feed first paint is not blocked by hop-2 queries.

---

## Phase 4 — Reporting (NIP-56)

### Why fourth
Valuable ecosystem signal but lower immediate user impact than blocking/filtering.

### UX
- Card menu -> **Report**.
- Reason required (`spam`, `nudity`, `illegal`, `impersonation`, `other`).
- Optional note.
- Post-submit option: “Also block this author”.

### Event shape
```json
{
  "kind": 1984,
  "tags": [
    ["e", "<template-event-id>", "spam"],
    ["p", "<author-pubkey>"]
  ],
  "content": "Optional detail"
}
```

### Acceptance criteria
- Signed event is published with valid target tags.
- Failures are surfaced to user; no silent drop.

---

## Cross-cutting concerns

### Security & abuse hardening
- Validate all incoming pubkeys/event ids before use.
- Debounce block/report UI actions to avoid duplicate publishes.
- Protect against relay poisoning by taking latest replaceable event only.

### Privacy
- WoT computation occurs client-side.
- Do not log raw social graph by default.
- If telemetry is added, aggregate counts only.

### Observability (recommended)
Track coarse metrics:
- `% feed hidden by block list`
- `% users enabling trusted-only`
- `median feed render time (logged in/out)`
- `mute sync success rate`

### Failure handling
- If NIP-07 unavailable: Phase 1 fully operational; hide sync/report controls.
- If relay read fails: preserve local cache and degrade gracefully.
- If relay publish fails: keep local state, show retry affordance.

---

## Implementation slices (suggested task breakdown)
1. **Data layer**: block list store + normalization + helpers.
2. **Feed pipeline**: filter + tiering + ranking hooks.
3. **UI**: card menu actions, settings controls, trust badges.
4. **Nostr sync**: kind 10000 read/merge/publish.
5. **Reporting**: kind 1984 modal and publish flow.
6. **Instrumentation**: lightweight counters/timers.

---

## Revised testing plan

### Unit tests
- Pubkey normalization and dedupe logic.
- Union merge behavior for local vs remote mute lists.
- Trust-tier classifier and rank sort stability.

### Integration tests
- Logged-out: block/unblock lifecycle across refresh.
- Logged-in: mute sync read/merge/publish happy path.
- Logged-in degraded: relay failure + signer rejection handling.
- Trusted-only toggle behavior with mixed-tier fixture feed.

### Performance tests
- Feed render timing with:
  - 0 blocks
  - 500 blocked pubkeys
  - hop-1 only
  - hop-1 + capped hop-2

### Manual QA checklist
- [ ] Block author from card and confirm immediate hide.
- [ ] Undo block toast restores card.
- [ ] Login merges local + remote mute sets without loss.
- [ ] Trust badges are accurate for controlled fixture accounts.
- [ ] Trusted-only mode does not show unknown authors.
- [ ] Report flow publishes kind 1984 and handles failure visibly.

---

## Is the original plan good enough?
Short answer: **good foundation, but not quite “as good as it could be” for production**.

### What it already did well
- Correct NIP choices.
- Practical phased rollout.
- Good focus on no-backend architecture.

### Biggest gaps this revision closes
- Explicit conflict/merge policy for mute sync.
- Concrete degradation behavior on relay/signing failure.
- Performance guardrails for hop-2 fanout.
- Better UX defaults (rank-first vs hide-first).
- Test strategy split by unit/integration/perf.
- Observability so you can prove impact after launch.

