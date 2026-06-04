# Credits panel

Surfaces every contributor whose published design you've imported
into the current project — typically via a **Linked Designs** layer.

## When the panel appears

- Hidden by default.
- Appears under Project Metadata once you add a layer whose source
  is another author's Nostr event.
- Hides again if you remove every linked layer.

## What it shows

For each contributor:

- **Avatar + display name** — pulled from their kind-0 profile.
- **One-line link count** — how many distinct linked designs of
  theirs you've used.
- **Tip button** — opens a lightning-tip flow if the author has
  a `lud16` on their profile.

## How it feeds publish

At publish time the resolver walks the linked tree once and adds
two tag families to your event:

- `['p', <contributor-pubkey>, <relay-hint>, 'design-contributor']`
- `['link', '<kind>:<pubkey>:<dTag>', <relay-hint>]`

External clients reading your event can resolve those links and
credit the right authors.

## Private designs

Private publishes intentionally **don't** emit the link / p tags
(it would leak the link graph through unencrypted tags). The
panel still shows you the credits in-app for awareness.

## Tips

- If a contributor's avatar shows as a placeholder, their profile
  hasn't been cached yet — wait a few seconds for the profile
  request to resolve.
- Premium-locked linked sources are credited the same way once
  you unlock them.
