# Artstr Studio PPTX Chart Import

## Native rendering of OOXML charts into Artstr layers

### Status

Spec draft, not yet implemented. Follows on from
`docs/PPTX_IMPORT_FEATURE.md`, which currently lands every chart as
a single placeholder image layer (the `UNSUPPORTED_CHART_PLACEHOLDER`
path in §11.4 of that spec). This document scopes a phased
replacement that turns a real OOXML chart into a set of native
Artstr layers — shape layers for bars / wedges / segments, text
layers for axis labels / titles / legends.

---

## 1. Why this is its own arc

A chart in a PPTX package is its own sub-document:

```
ppt/slides/slide10.xml          ← references the graphic frame
ppt/slides/_rels/slide10.xml.rels
ppt/charts/chart1.xml           ← chart XML (this spec)
ppt/charts/_rels/chart1.xml.rels
ppt/embeddings/*.xlsx           ← the underlying spreadsheet (cached)
```

The chart XML has its own ~30 element vocabulary (`c:chartSpace`,
`c:barChart`, `c:pieChart`, `c:ser`, `c:cat`, `c:val`, `c:dLbls`,
`c:catAx`, `c:valAx`, …) and its own internal coordinate system
(0–1 plot-area relative). Folding all of that into
`pptx-importer.js` alongside the slide-walker would balloon the
file; the chart converter gets its own helpers and is gated by the
existing `convertGraphicFrame` dispatch.

---

## 2. Scope

### In scope for the first cut (Phase 1)

- **Bar / column charts** (`c:barChart` with `c:barDir val="col"` or
  `val="bar"`). Single or multiple series. Clustered grouping only.
- Read category labels from `c:cat/c:multiLvlStrRef/c:multiLvlStrCache`
  or `c:cat/c:strRef/c:strCache`. Read numeric values from
  `c:val/c:numRef/c:numCache`. Ignore the spreadsheet reference path —
  the cache is always present in OOXML output.
- Per-series fill colour from `c:ser/c:spPr/a:solidFill/a:srgbClr`,
  falling back to a small built-in palette when missing (matches the
  default Office theme order: accent1..6).
- Compute the plot area inside the chart's bounding box (the
  `p:graphicFrame/p:xfrm`) using a fixed inset for axis labels.
  Phase 6 of `PPTX_IMPORT_FEATURE.md` can refine this with the
  chart's own `c:layout/c:manualLayout` later.
- Emit each bar as a `rect` shape layer with the series fill.
- Emit category axis labels (Q1, Q2, …) as text layers below the
  plot area.
- Skip value-axis tick labels, title, legend, data labels, gridlines
  in Phase 1 — they all land in Phase 4 polish.

### Phase 2

- **Pie / doughnut charts** (`c:pieChart`, `c:doughnutChart`). Each
  slice becomes a shape layer. The slice geometry is a wedge that
  Artstr doesn't natively support as a preset; rendered as a
  `kind: 'path'` shape with an SVG arc-path d-attribute. Doughnut
  draws an inner-radius hole via even-odd fill rule on the path.

### Phase 3

- **Line charts** (`c:lineChart`). Each data point is a vertex; the
  series renders as a sequence of line shape layers between adjacent
  points (or one `kind: 'path'` polyline). Markers (`c:marker`) emit
  small `circle`/`rect` shape layers at each point.

### Phase 4 — polish

- Chart title (`c:title/c:tx/c:rich/a:p/a:r`).
- Legend (`c:legend`) — series name + colour swatch as paired
  text-layer + shape-layer.
- Data labels (`c:dLbls`) — value or category text above / inside
  each bar / wedge based on `c:showVal` / `c:showCatName` /
  `c:showPercent`.
- Value-axis tick labels with auto-rounding to a nice step (5, 10,
  20, 50, 100).
- Gridlines (`c:majorGridlines` / `c:minorGridlines`) — thin shape
  layers at each tick.

### Phase 5

- Stacked + percent-stacked variants of bar / column / line
  (`c:grouping val="stacked"` / `"percentStacked"`).
- Stacked rendering is sum-aware: bar heights are the running sum
  per category and the per-series rect is the delta segment.

### Out of scope (kept as placeholder images)

- Scatter (`c:scatterChart`), bubble (`c:bubbleChart`), area
  (`c:areaChart`), radar (`c:radarChart`), surface
  (`c:surface3DChart`), stock (`c:stockChart`).
- All 3D variants (`c:bar3DChart`, `c:line3DChart`, `c:pie3DChart`).
- Combo charts (`c:plotArea` containing multiple different chart
  types).
- Trendlines (`c:trendline`), error bars (`c:errBars`).
- Conditional formatting / per-point overrides (`c:dPt`).

Anything in this list keeps the current
`UNSUPPORTED_CHART_PLACEHOLDER` behavior from §11.4 of the PPTX
spec.

---

## 3. Target architecture

```
convertGraphicFrame(gfNode, ctx)
  uri === '…/chart'
  ├─ resolve r:id to ppt/charts/chartN.xml
  ├─ parseXml(chartText)
  ├─ chartImport.convertChart(chartDoc, gfBounds, ctx)
  │    ├─ read plot area bounds from gfBounds (with insets)
  │    ├─ dispatch on chart type:
  │    │    barChart  → buildBarChartLayers(plotArea, chartDoc, ctx)
  │    │    pieChart  → buildPieChartLayers(...)
  │    │    lineChart → buildLineChartLayers(...)
  │    │    else      → null (fall through to placeholder)
  │    └─ return Artstr layer array (or null)
  └─ if null: emit the existing placeholder image as before.
```

New file: `src/pptx-importer-charts.js` — exports
`window.ArtstrPptxImporter.charts` with the per-chart-type
builders. Lazy-loaded **inside** the existing pptx-importer.js
flow on first chart encountered; not a separate user-facing
button.

Update `pptx-importer.js`:

- `convertGraphicFrame` first parses the chart XML and tries the
  native builder. If it returns layers, emit them in place of the
  placeholder. If it returns null (unsupported type), keep the
  current placeholder behaviour + warning.
- Add `chartRels` to `ctx` (same shape as `slideRels`) to resolve
  the chart-XML relationship from the slide rels file.

---

## 4. Coordinate system inside a chart

PPTX charts use a 0–1 relative coord system inside their bounding
box. The chart's bounding box on the slide is the
`p:graphicFrame/p:xfrm/a:off + a:ext`, which we already convert to
Artstr inches in `convertGraphicFrame` via `readXfrm`.

For Phase 1 we use a fixed inset model:

```
plotArea = {
  x: chartBounds.x + chartBounds.w * 0.05,
  y: chartBounds.y + chartBounds.h * 0.05,
  w: chartBounds.w * 0.90,
  h: chartBounds.h * 0.80,   // leaves 15% for category labels below
};
```

Phase 4 will read `c:plotArea/c:layout/c:manualLayout` when present
to get the chart's actual plot-area placement.

---

## 5. Bar / column chart layout

Given a clustered column chart with N categories × S series, plot
area `pa = { x, y, w, h }`, and series values `data[s][c]`:

```
maxV = max over all data
catW = pa.w / N
gap  = catW * 0.15            // ~15% gap between category groups
barW = (catW - gap) / S       // S bars per category

for c in 0..N-1:
  for s in 0..S-1:
    h_bar = pa.h * data[s][c] / maxV
    x_bar = pa.x + c * catW + gap/2 + s * barW
    y_bar = pa.y + pa.h - h_bar
    emit rect layer (x_bar, y_bar, barW, h_bar) filled with series colour
```

Bar charts (`c:barDir val="bar"`) swap axes: categories on Y, value
extending in X. The same math applies with x/y swapped.

For "clustered" grouping only in Phase 1 — `stacked` and
`percentStacked` are Phase 5.

---

## 6. Pie chart layout (Phase 2)

Given a pie chart with K slices summing to T, plot area `pa`:

```
cx = pa.x + pa.w / 2
cy = pa.y + pa.h / 2
r  = min(pa.w, pa.h) / 2 * 0.9   // 90% of half-min, leaves margin

angle = 0
for k in 0..K-1:
  sweep = 2π * values[k] / T
  d = sliceArcPath(cx, cy, r, angle, angle + sweep)
  emit shape layer:
    kind: 'path'
    d: d
    viewBox: { x: 0, y: 0, w: 100, h: 100*pa.h/pa.w }
    fill: slice colour
  angle += sweep
```

`sliceArcPath` builds an SVG `<path d="...">` with `M`, `L`,
arc commands. Doughnut adds an inner-radius arc subtracted via
even-odd fill rule.

---

## 7. Series colour resolution

PPTX charts pick series colours in this order:

1. Explicit `c:ser/c:spPr/a:solidFill/a:srgbClr` (most decks).
2. Explicit `c:ser/c:spPr/a:solidFill/a:schemeClr` — resolves via
   the slide's theme (the existing `convertColor(node, theme)`
   helper handles this).
3. The theme's chart-style colour rotation (`accent1`, `accent2`,
   …) when neither is specified — falls back to a built-in
   palette matching the Office default.

The user's `gallery_template_layout_set.pptx` chart uses option 1
(explicit `#5E735D`, `#B05A44`), so Phase 1 should resolve to the
exact colours seen in PowerPoint.

---

## 8. Layer naming

So users can find chart pieces in the layer panel:

```
Chart placeholder: Chart 1                          ← (current; replaced)
Chart 1 / Plot background
Chart 1 / Bar [Q1, Baseline]                        ← series s, category c
Chart 1 / Bar [Q1, Target]
…
Chart 1 / Bar [Q4, Target]
Chart 1 / Category label: Q1
…
Chart 1 / Category label: Q4
```

`Chart 1` matches the source `c:cNvPr@name` (or
`Chart placeholder: <name>`). Square brackets contain the
category + series for bars / line points, the slice name for pie
wedges.

---

## 9. Report integration

Reuse the existing report counters:

- `report.imported.shapes += <num shapes emitted from chart>`
- `report.imported.text += <num text layers from chart>`
- `report.placeholders.charts` stays as the unsupported-fallback
  counter. Successfully-imported native charts don't bump this.

New warning codes:

- `CHART_TYPE_UNSUPPORTED` — chart type not yet handled (scatter,
  3D, combo, etc.), falling back to placeholder.
- `CHART_AXIS_LABELS_SKIPPED_PHASE1` — value-axis ticks deferred
  to Phase 4.
- `CHART_GRIDLINES_SKIPPED_PHASE1` — same.

---

## 10. Test plan

Build synthetic charts in-browser via `fflate.zipSync` (the same
pattern as the existing `/tmp/test_pptx_*.js` harnesses):

1. **2-series, 4-category clustered column chart**, explicit
   srgbClr per series. Mirrors the user's test deck (slide 10).
   Expected: 8 rect shape layers + 4 category-label text layers.
2. **Single-series, 6-category column chart** with very different
   values (1, 10, 100, 1000, …) to test axis-scale math.
3. **Empty / missing strCache** — chart that references a
   spreadsheet but has no cached data. Expected: fall through to
   placeholder + `CHART_TYPE_UNSUPPORTED` warning.
4. **3-slice pie chart** (Phase 2 milestone).
5. **2-series line chart** (Phase 3 milestone).
6. **Scatter chart** — expected: placeholder + warning, no crash.

Real-deck regression: `gallery_template_layout_set.pptx` slide 10's
chart should now appear with 8 bars (green + terracotta clustered
across Q1–Q4) and 4 category labels instead of the postimg
placeholder.

---

## 11. Implementation plan

### Phase 1 — bar / column

- Create `src/pptx-importer-charts.js`.
- Implement `convertChart(chartDoc, chartBounds, ctx)` dispatch.
- Implement `buildBarChartLayers`.
- Read series / categories / values from cache.
- Wire into `convertGraphicFrame` so chart URIs try the native
  builder first.
- Synthetic test 1 + real-deck slide 10 must pass.

### Phase 2 — pie / doughnut

- Add `buildPieChartLayers`.
- Add `sliceArcPath` helper.
- Synthetic test 4 must pass.

### Phase 3 — line

- Add `buildLineChartLayers`.
- Markers if `c:marker/c:symbol` is set and `!= none`.
- Synthetic test 5 must pass.

### Phase 4 — polish

- Title, legend, data labels, value-axis ticks, gridlines.

### Phase 5 — stacked variants

- Stacked + percent-stacked column / bar / line.

---

## 12. Open questions

- **Group layers.** Artstr doesn't expose a "layer group" primitive
  today (PPTX groups are flattened by `walkSpTree` per Phase 5 of
  `PPTX_IMPORT_FEATURE.md`). For now chart sub-layers will be
  individual editable layers with the `Chart N / …` naming
  convention. If Artstr later adds groups, the importer can opt-in.
- **Editing after import.** A user might want to "change a value"
  on an imported chart. Today that means moving a bar manually.
  True data-bound editing would require keeping the source values
  in a hidden layer-level field and re-deriving bars on change —
  out of scope for the initial arc.
- **Animated reveals / build-by.** PPTX charts can specify
  per-series animation. Artstr doesn't render slide animations, so
  these get ignored uniformly with the rest of `p:timing`.

---

## 13. Acceptance criteria for first release (Phase 1 done)

- Importing `gallery_template_layout_set.pptx` produces slide 10
  with 8 native bar shape layers in `#5E735D` and `#B05A44`, plus
  4 `Q1..Q4` text labels, instead of a single placeholder image.
- Synthetic 2-series 4-category test deck imports the same.
- Synthetic scatter / 3D / area decks still produce the
  placeholder image + warning (no regression on the existing
  unsupported-chart path).
- Pure-Node unit tests cover the cache-extraction helpers
  (`readCategoryLabels`, `readSeriesValues`, `readSeriesColor`).
