# From Crypt Base to Villus Tip — interactive 3D model

An interactive three-dimensional model that follows one intestinal epithelial cell from the stem-cell
niche at the crypt base to its extrusion at the villus tip. Along the way it shows the changes in cell
shape, force and signalling discussed in the review, with a cut-away overview of a villus and its
crypts, a close-up section of the followed cell and its neighbours, and colour modes for actomyosin,
traction, Wnt/BMP, EphB/ephrin-B, enterocyte zones (Moor), migration speed and Confetti lineage
tracing.

**Authors:** Daniel Krueger and Hans Clevers (Hubrecht Institute, Utrecht) · Companion to
Krueger & Clevers, *From Crypt Base to Villus Tip: Coordinating Cell Production and Removal in the
Intestine*, Genes & Development (2026). Cite the archived release (Zenodo DOI), not the repository
URL — see `CITATION.cff`.

## What it is and is not

A schematic teaching model. Cells move in a simple tissue model (division in the crypt, flow up the
villus, removal at the tip), and the shape and force read-outs follow the direction of change reported
in the cited work; they are not measured magnitudes. Each statement in the side panel is tagged by its
evidence: tissue, organoid, preprint, or *model (this review)* for the review's own proposals. Model
time runs in seconds; the real journey takes days.

## Running it

Open `index.html` in any current browser. It is a single self-contained file (three.js is bundled), so
it runs straight from disk with no server and no network access.

Controls: drag to rotate, right-drag or shift-drag to pan, scroll to zoom; play/pause, the time slider
and the stage chips at the bottom; the colour menu, cut-away, follow, labels, legend and gradients
toggles. The line between the overview and the side panel, and the line below the close-up, can be
dragged to resize the close-up.

Link parameters open a given state, e.g. `index.html?t=100&mode=conf&cut=0&follow=1&speed=4`
(`t` in seconds; `mode` one of `id am tr sig eph conf moor v`; `outline` `white|none|dark`;
`labels`, `cut`, `follow` as `0|1`).

## Rebuilding

`source/build.py` inlines `three.min.js`, `sim.js` (tissue model) and `app.js` (rendering and
interface) into `shell.html` and writes `index.html`.

```bash
python3 source/build.py
```

## Licence

Code under the MIT licence; explanatory text under CC BY 4.0; three.js (bundled) under its own MIT
licence. See `LICENSE`.
