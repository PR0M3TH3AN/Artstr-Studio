# TMDB Auto-Fill Feature Plan

## Overview
When a user enters an IMDb ID (or searches by title), automatically populate the editor
with high-quality artwork and metadata from The Movie Database (TMDB): front cover poster,
backdrop image, title, year, and genre. This replaces the current manual "paste a URL"
workflow for the most common case — making a case wrap for a specific film.

## Complexity
**Low** — Estimated 2–3 hours
The app already stores `imdbId` in state. TMDB has a free API with IMDb ID lookup.
No new dependencies needed — vanilla `fetch()` is sufficient.

---

## Why TMDB Over OMDB

The app already has an `omdbApiKey` field. OMDB is text-only — it returns metadata but
no image URLs. TMDB provides:
- High-resolution poster images (up to 4K)
- Wide backdrop images (ideal for back cover / full wrap)
- Official logo PNGs with transparent backgrounds (via fanart.tv or TMDB images)
- Cast photos, disc art stills

TMDB API is free for non-commercial use with a v3 API key (takes ~1 minute to register).

---

## API Overview

### Step 1 — Resolve IMDb ID to TMDB ID
```
GET https://api.themoviedb.org/3/find/{imdb_id}?api_key={key}&external_source=imdb_id
```
Response includes `movie_results[0].id` (TMDB ID).

### Step 2 — Fetch Movie Details + Images
```
GET https://api.themoviedb.org/3/movie/{tmdb_id}?api_key={key}&append_to_response=images
```

Key image fields:
```json
{
  "poster_path": "/abc123.jpg",
  "backdrop_path": "/xyz789.jpg",
  "images": {
    "posters":   [{ "file_path": "...", "width": 2000, "height": 3000 }],
    "backdrops": [{ "file_path": "...", "width": 3840, "height": 2160 }],
    "logos":     [{ "file_path": "...", "width": 1000, "height": 200  }]
  }
}
```

### Image URL Construction
```javascript
// TMDB image CDN — choose size: w500, w780, w1280, original
function tmdbImageUrl(path, size = 'original') {
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
```

For case wraps, `original` size is best. The CDN serves CORS-friendly URLs.

---

## Key Components

### 1. API Key Storage

```javascript
// Add to state (alongside existing omdbApiKey):
state.tmdbApiKey = localStorage.getItem('casewrap-tmdb-api-key') || '';
```

Add a TMDB API key field to the settings panel next to the existing OMDB key field.

### 2. Core Fetch Functions

```javascript
async function tmdbFindByImdbId(imdbId, apiKey) {
  const res = await fetch(
    `https://api.themoviedb.org/3/find/${imdbId}?api_key=${apiKey}&external_source=imdb_id`
  );
  const data = await res.json();
  return data.movie_results?.[0] ?? null;
}

async function tmdbFetchImages(tmdbId, apiKey) {
  const res = await fetch(
    `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}&append_to_response=images&include_image_language=en,null`
  );
  return await res.json();
}
```

### 3. Auto-Fill Function

Called when the user clicks "Auto-fill from TMDB" or when `imdbId` changes and an API
key is present:

```javascript
async function autoFillFromTMDB() {
  const imdbId = state.metadata.imdbId?.trim();
  if (!imdbId || !state.tmdbApiKey) return;

  showStatus('Fetching artwork from TMDB…');

  const match = await tmdbFindByImdbId(imdbId, state.tmdbApiKey);
  if (!match) { showStatus('No TMDB match found for this IMDb ID.'); return; }

  const details = await tmdbFetchImages(match.id, state.tmdbApiKey);

  // Best poster → front cover
  const poster = bestImage(details.images.posters, 'portrait');
  if (poster) state.slots.front.src = tmdbImageUrl(poster.file_path);

  // Best backdrop → back cover
  const backdrop = bestImage(details.images.backdrops, 'landscape');
  if (backdrop) state.slots.back.src = tmdbImageUrl(backdrop.file_path);

  // Metadata
  state.metadata.title = details.title ?? state.metadata.title;

  renderAll();
  showStatus('Artwork loaded from TMDB.');
}
```

### 4. Image Picker (Best Selection Logic)

TMDB returns multiple images — pick the highest-resolution English-language one:

```javascript
function bestImage(images, orientation) {
  if (!images?.length) return null;
  const aspect = orientation === 'portrait' ? (h, w) => h > w : (h, w) => w > h;
  return images
    .filter(img => aspect(img.height, img.width))
    .sort((a, b) => (b.width * b.height) - (a.width * a.height))[0] ?? images[0];
}
```

### 5. Title Search (No IMDb ID)

For users who don't have an IMDb ID handy, add a search-by-title flow:

```
GET https://api.themoviedb.org/3/search/movie?api_key={key}&query={title}&year={year}
```

Show a small result picker (poster thumbnail + title + year) before auto-filling.

```javascript
async function searchTMDB(query, year) {
  const params = new URLSearchParams({ api_key: state.tmdbApiKey, query });
  if (year) params.set('year', year);
  const res = await fetch(`https://api.themoviedb.org/3/search/movie?${params}`);
  const data = await res.json();
  return data.results?.slice(0, 5) ?? [];
}
```

---

## UI Changes

### Settings Panel
Add TMDB API key field:
```
TMDB API Key: [___________________________]  [Get a free key ↗]
```

### Editor — IMDb ID Row
Add auto-fill button next to existing imdbId input:
```
IMDb ID: [tt0145487]  [⚡ Auto-fill from TMDB]
```

Or, if no IMDb ID is entered, show a search field:
```
[ Search by title…       ]  [🔍 Search TMDB]
```

### Auto-Fill Preview Modal
Before applying, show a confirmation panel so users can pick which slots to fill:

```
┌──────────────────────────────────────────┐
│  TMDB: Spider-Man (2002)                  │
│                                           │
│  [Poster 2000×3000]   [Backdrop 3840×2160]│
│                                           │
│  Apply to:                                │
│  ☑ Front cover (poster)                  │
│  ☑ Back cover (backdrop)                 │
│  ☐ Disc top (poster)                     │
│  ☑ Title metadata                        │
│                                           │
│        [Cancel]   [Apply Selected]        │
└──────────────────────────────────────────┘
```

---

## Performance Considerations
- Two sequential TMDB API calls (~200–400ms each) — show spinner, non-blocking
- Image URLs are hotlinked from TMDB CDN — no download or storage needed
- No caching required; TMDB images are stable URLs that don't expire
- `include_image_language=en,null` filter reduces result size significantly

---

## Limitations
- Requires user to register for a free TMDB API key (takes ~1 min at themoviedb.org)
- TMDB covers films and TV well but has sparse data for some older/obscure titles
- Backdrop images are widescreen (16:9); the back cover slot may need manual cropping
- No official disc art — for that, fanart.tv (separate API, free) provides disc art images
- TMDB API is rate-limited (40 requests/10 seconds) — fine for manual use, not bulk

---

## Future Enhancements
- fanart.tv integration: fetch official disc art, transparent logo PNGs, and CD art
- TV series support: fetch season/episode artwork for TV show case wraps
- Auto-fill spine text from TMDB year + runtime
- Bulk fill: apply TMDB artwork to all slots in one click (front, back, disc top, disc bottom)
- Cache TMDB results in `sessionStorage` to avoid redundant API calls when user tweaks the design

---

## Testing Checklist
- [ ] TMDB API key saves to localStorage and restores on reload
- [ ] `tmdbFindByImdbId` returns correct movie for a known IMDb ID (e.g. tt0145487)
- [ ] `tmdbFetchImages` returns poster and backdrop arrays
- [ ] Front cover slot is populated with best portrait image URL
- [ ] Back cover slot is populated with best landscape image URL
- [ ] Title metadata updates from TMDB response
- [ ] Confirmation modal shows correct poster and backdrop thumbnails
- [ ] Unchecked slots in the modal are not overwritten
- [ ] Title search returns results and clicking one auto-fills correctly
- [ ] Missing API key shows prompt to add one rather than a silent failure
- [ ] Invalid IMDb ID shows "no match found" message
- [ ] TMDB image URLs load correctly in the editor canvas
