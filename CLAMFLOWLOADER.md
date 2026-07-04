# ClamFlowLoader — Implementation Guide

> SVG wave loader derived from the ClamFlow mark.  
> Wave draws left → right in ~0.125 s, holds fully visible for ~2 s, then fades.  
> Teal palette (`#58d3c1 → #16656f`), transparent background, no images, no external deps.

---

## Why `width + overflow:hidden` — not `clip-path`

Every approach that applied `clip-path: inset()` directly to an `<svg>` element failed in Chrome. Root cause: Chrome evaluates `clip-path` on SVG elements in **SVG user-unit space** (the viewBox), not CSS pixel space. `inset(0 100% 0 0)` on a 950-unit-wide viewBox clips only a fraction of a pixel, leaving a permanent sliver visible.

The reliable fix: animate `width` on a plain HTML wrapper div/span with `overflow:hidden`. CSS layout properties operate in CSS pixels unconditionally, across all elements and browsers.

Additionally, the SVG must **not** have `overflow:visible` — that causes Chrome to composite the SVG's overflow into a separate layer that bypasses the wrapper's `overflow:hidden` box, re-introducing the sliver.

---

## 1. Splash Screen — `public/index.html`

Fully self-contained: own `<style>` block, hardcoded colours, unique IDs (`cfs-*`), no dependency on `styles.css` loading first.

### DOM Structure

```
<div style="width:320px;height:90px;position:relative;">          ← fixed-size flex placeholder
  <div id="cfs-wrap" style="position:absolute;left:0;top:0;      ← animated reveal wrapper
       height:90px; width:0; overflow:hidden;
       mask-image: linear-gradient(to right, black 75%, transparent 100%);
       animation: cfs-form 2.5s linear infinite">
    <svg width="320" height="90" viewBox="0 0 950 267">           ← static, no animation
      ...paths + glint...
    </svg>
  </div>
</div>
```

### Keyframes

```css
@keyframes cfs-form {
  0%  { width:0;     opacity:1; animation-timing-function:ease-out }  /* draw starts */
  5%  { width:320px; opacity:1; animation-timing-function:linear  }  /* draw complete — 0.125 s */
  82% { width:320px; opacity:1; animation-timing-function:ease    }  /* hold — 1.925 s */
  96% { width:320px; opacity:0; animation-timing-function:linear  }  /* fade out — 0.35 s */
 100% { width:0;     opacity:0 }                                      /* invisible reset */
}

@keyframes cfs-sweep {
  0%   { transform: translateX(-320px) skewX(-12deg) }
  100% { transform: translateX(1070px) skewX(-12deg) }
}
```

### Timing breakdown (2.5 s cycle)

| Phase | Keyframe range | Duration | Easing |
|---|---|---|---|
| Draw 0 → 320 px | 0 % → 5 % | **0.125 s** | `ease-out` — fast start, decelerates |
| Hold full width | 5 % → 82 % | **1.925 s** | `linear` (no motion) |
| Fade out | 82 % → 96 % | 0.35 s | `ease` |
| Invisible reset | 96 % → 100 % | 0.1 s | `linear` |

The partial-draw window is ~50 ms — shorter than a human blink. The complete mark is visible for nearly 2 seconds per cycle.

### Soft trailing edge

`mask-image: linear-gradient(to right, black 75%, transparent 100%)` on `#cfs-wrap` softens the right clip edge as the wave draws in, so the reveal looks organic rather than hard-cut.

### Glint sweep

Applied to the `<rect id="cfs-streak">` **inside** the SVG, clipped by the wave's own `<clipPath id="cfs-clip">`. Runs on its own independent 1.7 s loop.

```css
/* On the rect element, inline style: */
mix-blend-mode: screen;
animation: cfs-sweep 1.7s cubic-bezier(.5,0,.3,1) infinite;
```

### `prefers-reduced-motion`

```css
@media(prefers-reduced-motion:reduce){
  #cfs-wrap { animation:none; width:320px; opacity:1 }
  #cfs-streak { display:none }
}
```

---

## 2. Bill Capture page — `public/capture.html`

Same `width + overflow:hidden` mechanism. Sized at 200 px wide (56 px tall). IDs prefixed `cfc-` to avoid collisions with the splash screen's `cfs-` IDs.

Keyframes (`cfc-form`): identical timing to the splash screen — 5 % draw-in (0.125 s), 77 % hold, 14 % fade/reset.

The `loading-screen` div is hidden/shown via a `hide()`/`show()` JavaScript helper; no code touches `.cf-loader` class names (which no longer exist).

---

## 3. React Component — `public/app.js`

### Signature

```jsx
<ClamFlowLoader width={200} label="Loading" />
```

| Prop | Type | Default | Notes |
|---|---|---|---|
| `width` | `number \| string` | `200` | CSS px width — height auto-computed |
| `label` | `string` | `'Loading'` | `aria-label` on the SVG |

### Component structure

```jsx
<span style={{ display:'inline-block', width:w, height:h,
               lineHeight:0, verticalAlign:'middle',
               flexShrink:0, position:'relative' }}>

  <span className="cf-wave-wrap"
        style={{ display:'block', position:'absolute',
                 left:0, top:0, height:h,
                 width:0,             /* ← animated from 0 → 100% */
                 overflow:'hidden',   /* ← clips SVG to current width */
                 animation:'cf-form 3s ease-out infinite' }}>

    <svg width={w} height={h} viewBox="0 0 950 267"
         style={{ display:'block' }}>   /* NO overflow:visible */
      ...defs + paths...
    </svg>

  </span>
</span>
```

### Injected keyframes (self-injected once via `<style id="clamflow-keyframes">`)

```css
@keyframes cf-form {
  0%   { width:0%;   opacity:1 }
  20%  { width:100%; opacity:1 }   /* 3s × ease-out → full width by ~0.3 s */
  80%  { width:100%; opacity:1 }
  95%  { width:100%; opacity:0 }
  100% { width:0%;   opacity:0 }
}
@keyframes cf-sweep {
  0%   { transform: translateX(-320px) skewX(-12deg) }
  100% { transform: translateX(1070px) skewX(-12deg) }
}
@media(prefers-reduced-motion:reduce){
  .cf-wave-wrap  { animation:none; width:100%; opacity:1 }
  .cf-wave-streak{ display:none }
}
```

> **Note:** The React component's `cf-form` keyframe still uses `20%` for the draw phase (vs `5%` in the splash screen). The splash screen is optimised for maximum first-impression visibility; the React component runs inside the authenticated app where full-page loading states are less prominent.

### Unique IDs

A module-level counter (`_cfCounter`) is incremented inside `useState` lazy initialiser so every mounted instance gets its own gradient/clipPath IDs (`cf1-f`, `cf2-f`, …). No ID collisions even with dozens of simultaneous spinners.

### Sizes used in Relish Approvals

| Context | `width` | Approx height |
|---|---|---|
| Splash screen (`index.html`) | 320 px (HTML, not component) | 90 px |
| Button / inline (`Icons.loader`) | 56 px | 16 px |
| Full-page loading state | 200 px | 56 px |
| Capture page (`capture.html`) | 200 px | 56 px |

---

## 4. Full-page loading state pattern

```jsx
if (loading) return (
  <div className="loading-state">
    <ClamFlowLoader width={200} label="Loading"/>
    <span>Loading…</span>
  </div>
);
```

`.loading-state` CSS (in `styles.css`) — flex column, centred, `min-height:180px`.

---

## 5. Porting to other Relish apps

Copy the splash screen block from `public/index.html` — the `<style>`, outer `<div>`, `#cfs-wrap` div, and `<svg>` — into the target page. No external stylesheet needed.

**To recolour**, change the `stop-color` values on the two `<linearGradient id="cfs-fill">` stops:

```html
<stop offset="0" stop-color="#7fe6d5"/>   <!-- lighter teal top -->
<stop offset="1" stop-color="#1c6f78"/>   <!-- deeper teal bottom -->
```

**To resize**, change `width="320" height="90"` on the `<svg>` and `width:320px;height:90px` on the outer div. Keep aspect ratio 950:267 (≈ 3.56:1).

**Multiple colours on one page**: give the three IDs a unique suffix — `cfs-fill2`, `cfs-glint2`, `cfs-clip2` — so gradient definitions don't collide.

---

## 6. Known gotchas

| Gotcha | Cause | Fix |
|---|---|---|
| Permanent left-edge sliver | `clip-path:inset()` on `<svg>` uses SVG user-unit coords, not CSS px | Use `width` animation + `overflow:hidden` on wrapper (current approach) |
| SVG overflow bypasses wrapper | `overflow:visible` on `<svg>` composites content outside wrapper's layout box | Remove `overflow:visible` from the SVG element |
| Stale splash from service worker | Old SW pre-cached `index.html` | SW v39+ no longer pre-caches HTML; always fetched network-first |
| Partial draw visible too long | Draw phase too long; `ease` starts slow | Draw phase = 5 % of cycle (0.125 s); `ease-out` on draw keyframe |

---

*Private — FoodStream Ltd. Hong Kong*


> SVG wave loader derived from the ClamFlow mark.  
> Wave draws left → right; a white glint sweeps through.  
> Teal palette (`#58d3c1 → #16656f`), transparent background, no images.

---

## Quick Reference — Three live implementations

| File | Variant | IDs | Mechanism |
|---|---|---|---|
| `public/index.html` | Splash screen | `cfs-*` | `width` anim + `overflow:hidden` on `#cfs-wrap` div |
| `public/capture.html` | Bill Capture loading | `cfc-*` | Same — `width` anim + `overflow:hidden` on `#cfc-wrap` div |
| `public/app.js` | React component | `cf{N}-f/g/c` (counter) | Same — `width %` anim on `.cf-wave-wrap` span |

All three use identical mechanics. IDs are namespaced per-file to avoid collisions (`cfs-`, `cfc-`, `cf{counter}-`). The old `clip-path: inset()` approach has been fully removed from all three files.

| File | What lives there |
|---|---|
| `public/app.js` | `ClamFlowLoader` React component + `CF_PATHS` geometry |
| `public/styles.css` | `.cf-loader` / `.cf-loader__form` CSS (for plain-HTML splash screen) |
| `public/index.html` | Splash screen — plain HTML `.cf-loader` markup |
| `public/capture.html` | Self-contained HTML version with own `<style>` block |

---

## 1. React Component (`app.js`)

The component is defined **once** near the top of `app.js`, before the `Icons` object.

### Signature

```jsx
<ClamFlowLoader width={200} label="Loading" />
```

| Prop | Type | Default | Notes |
|---|---|---|---|
| `width` | `number \| string` | `200` | CSS width — height is automatic via `aspect-ratio: 950/267` |
| `label` | `string` | `'Loading'` | `aria-label` on the SVG for screen readers |

### How it works

- **Unique IDs per instance** — uses a module-level counter (`_cfCounter`) incremented inside `useState` lazy initialiser. Each mounted instance gets its own `cf1-f`, `cf1-g`, `cf1-c` (fill, glint, clip) IDs. No ID collisions even with dozens of simultaneous spinners.
- **Self-injecting keyframes** — on first mount, appends a `<style id="clamflow-keyframes">` to `<head>`. Subsequent mounts skip the injection (`getElementById` guard).
- **Hardcoded teal colours** — `stopColor="#58d3c1"` / `stopColor="#16656f"` directly on `<stop>` elements; no CSS custom-property inheritance needed.
- **`prefers-reduced-motion`** — `.cf-wave-svg` has `animation:none` and `.cf-wave-streak` is hidden via the keyframe `<style>` block.

### Sizes used in the app

| Context | `width` | Approx height |
|---|---|---|
| Button / inline (`Icons.loader`) | `56` | ~16 px |
| Full-page loading state | `200` | ~56 px |
| Payees page loading state | `200` | ~56 px |
| Splash screen (`index.html`) | `280` | ~79 px |
| Capture page (`capture.html`) | `200` | ~56 px |

### Full-page loading state pattern

```jsx
if (loading) return (
  <div className="loading-state">
    <ClamFlowLoader width={200} label="Loading vouchers"/>
    <span>Loading…</span>
  </div>
);
```

`.loading-state` CSS (in `styles.css`) centres the content in a flex column with `min-height: 180px`.

### Inline button pattern

```jsx
// Icons.loader is pre-built as <ClamFlowLoader width={56}/>
// Every reference creates a fresh component instance automatically.
<button disabled={loading}>
  {loading && Icons.loader} Save
</button>
```

---

## 2. Plain-HTML Version (`index.html`, `capture.html`)

For pages that load before React, use the CSS-class approach.

### Required CSS (from `styles.css` or inline `<style>`)

```css
.cf-loader {
  --cf-c1: #58d3c1;   /* top tint */
  --cf-c2: #16656f;   /* deep tint */
  --cf-streak: #fff;
  --cf-speed: 2.6s;
  --cf-streak-speed: 1.7s;
  display: inline-block;
  aspect-ratio: 950 / 267;
  line-height: 0;
  vertical-align: middle;
}
.cf-loader__form {
  display: block; width: 100%; height: 100%; overflow: visible;
  animation: cf-form var(--cf-speed) cubic-bezier(.45,.05,.35,1) infinite;
}
.cf-loader .cf-streak {
  mix-blend-mode: screen;
  animation: cf-sweep var(--cf-streak-speed) cubic-bezier(.5,0,.3,1) infinite;
}
@keyframes cf-form {
  0%   { clip-path: inset(0 100% 0 0); opacity: 1; }
  52%  { clip-path: inset(0 0 0 0);    opacity: 1; }
  82%  { clip-path: inset(0 0 0 0);    opacity: 1; }
  94%  { clip-path: inset(0 0 0 0);    opacity: 0; }
  100% { clip-path: inset(0 100% 0 0); opacity: 0; }
}
@keyframes cf-sweep {
  0%   { transform: translateX(-320px) skewX(-12deg); }
  100% { transform: translateX(1070px) skewX(-12deg); }
}
@media (prefers-reduced-motion: reduce) {
  .cf-loader__form { animation: none; clip-path: none; opacity: 1; }
  .cf-loader .cf-streak { animation: none; display: none; }
}
```

> **Important — multiple loaders with the same colour:** All instances can share the same gradient IDs (`cf-fill`, `cf-glint`, `cf-clip`). If you need **different colours** on the same page, give each a unique suffix:  
> `id="cf-fill2"` / `id="cf-glint2"` / `id="cf-clip2"` — and update `fill="url(#cf-fill2)"` etc.

### Markup (copy one block per loader)

```html
<span class="cf-loader" style="width:280px">
  <svg class="cf-loader__form" viewBox="0 0 950 267"
       xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Loading">
    <defs>
      <linearGradient id="cf-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style="stop-color:var(--cf-c1)"/>
        <stop offset="1" style="stop-color:var(--cf-c2)"/>
      </linearGradient>
      <linearGradient id="cf-glint" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" style="stop-color:var(--cf-streak);stop-opacity:0"/>
        <stop offset=".5" style="stop-color:var(--cf-streak);stop-opacity:1"/>
        <stop offset="1" style="stop-color:var(--cf-streak);stop-opacity:0"/>
      </linearGradient>
      <clipPath id="cf-clip">
        <path d="M300.0 61.0L230.0 79.0L164.0 111.0L118.0 143.0L38.0 209.0L12.0 227.0L9.0 230.0L9.0 236.0L12.0 239.0L20.0 241.0L34.0 239.0L58.0 231.0L82.0 219.0L174.0 155.0L230.0 127.0L276.0 115.0L330.0 115.0L364.0 123.0L432.0 155.0L536.0 219.0L568.0 235.0L610.0 249.0L664.0 257.0L694.0 255.0L734.0 245.0L760.0 233.0L765.0 228.0L762.0 223.0L692.0 219.0L646.0 207.0L572.0 171.0L478.0 113.0L416.0 81.0L382.0 69.0L354.0 63.0L302.0 61.0Z"/>
        <path d="M408.0 9.0L372.0 15.0L340.0 25.0L333.0 34.0L334.0 51.0L339.0 48.0L344.0 37.0L352.0 35.0L398.0 39.0L436.0 51.0L492.0 79.0L578.0 135.0L624.0 161.0L670.0 179.0L756.0 197.0L802.0 197.0L864.0 183.0L888.0 173.0L918.0 153.0L939.0 134.0L936.0 127.0L920.0 125.0L890.0 143.0L850.0 153.0L830.0 153.0L828.0 155.0L776.0 153.0L754.0 147.0L716.0 131.0L664.0 101.0L590.0 53.0L532.0 25.0L498.0 15.0L464.0 9.0L410.0 9.0Z"/>
        <path d="M306.0 141.0L262.0 149.0L212.0 169.0L170.0 193.0L120.0 227.0L109.0 238.0L110.0 247.0L156.0 245.0L182.0 237.0L212.0 223.0L280.0 181.0L312.0 165.0L354.0 155.0L355.0 150.0L346.0 143.0L308.0 141.0Z"/>
      </clipPath>
    </defs>
    <g>
      <path d="M300.0 61.0L230.0 79.0L164.0 111.0L118.0 143.0L38.0 209.0L12.0 227.0L9.0 230.0L9.0 236.0L12.0 239.0L20.0 241.0L34.0 239.0L58.0 231.0L82.0 219.0L174.0 155.0L230.0 127.0L276.0 115.0L330.0 115.0L364.0 123.0L432.0 155.0L536.0 219.0L568.0 235.0L610.0 249.0L664.0 257.0L694.0 255.0L734.0 245.0L760.0 233.0L765.0 228.0L762.0 223.0L692.0 219.0L646.0 207.0L572.0 171.0L478.0 113.0L416.0 81.0L382.0 69.0L354.0 63.0L302.0 61.0Z" fill="url(#cf-fill)"/>
      <path d="M408.0 9.0L372.0 15.0L340.0 25.0L333.0 34.0L334.0 51.0L339.0 48.0L344.0 37.0L352.0 35.0L398.0 39.0L436.0 51.0L492.0 79.0L578.0 135.0L624.0 161.0L670.0 179.0L756.0 197.0L802.0 197.0L864.0 183.0L888.0 173.0L918.0 153.0L939.0 134.0L936.0 127.0L920.0 125.0L890.0 143.0L850.0 153.0L830.0 153.0L828.0 155.0L776.0 153.0L754.0 147.0L716.0 131.0L664.0 101.0L590.0 53.0L532.0 25.0L498.0 15.0L464.0 9.0L410.0 9.0Z" fill="url(#cf-fill)"/>
      <path d="M306.0 141.0L262.0 149.0L212.0 169.0L170.0 193.0L120.0 227.0L109.0 238.0L110.0 247.0L156.0 245.0L182.0 237.0L212.0 223.0L280.0 181.0L312.0 165.0L354.0 155.0L355.0 150.0L346.0 143.0L308.0 141.0Z" fill="url(#cf-fill)"/>
    </g>
    <g clip-path="url(#cf-clip)">
      <rect class="cf-streak" fill="url(#cf-glint)" x="0" y="-60" width="240" height="387"/>
    </g>
  </svg>
</span>
```

### Recolour

Override the CSS vars on the wrapper:

```html
<!-- Darker ocean teal -->
<span class="cf-loader" style="width:240px; --cf-c1:#7fe6d5; --cf-c2:#1c6f78">
```

### Tempo

```html
<!-- Faster draw, slower glint -->
<span class="cf-loader" style="width:240px; --cf-speed:1.8s; --cf-streak-speed:2.2s">
```

---

## 3. TypeScript Component (`ClamFlowLoader.tsx`)

The TypeScript version (in `C:\Users\user\Downloads\ClamFlowLoader.tsx`) is the canonical reusable component for React + TypeScript projects (Next.js, Vite, CRA, etc.).

```tsx
import ClamFlowLoader, { type ClamFlowLoaderProps } from "./ClamFlowLoader";

<ClamFlowLoader width={220} c1="#7fe6d5" c2="#1c6f78" speed={2.4} label="Fetching data" />
```

| Prop | Type | Default | Notes |
|---|---|---|---|
| `width` | `number \| string` | `240` | CSS width |
| `c1` | `string` | `'#58d3c1'` | Top tint |
| `c2` | `string` | `'#16656f'` | Deep tint |
| `streak` | `string` | `'#ffffff'` | Glint colour |
| `speed` | `number` | `2.6` | Draw loop seconds |
| `streakSpeed` | `number` | `1.7` | Glint sweep seconds |
| `className` | `string` | — | Wrapper class |
| `style` | `CSSProperties` | — | Wrapper style |
| `label` | `string` | `'Loading'` | `aria-label` |

Differences from the JS/HTML versions:
- `useId()` for truly unique IDs (React 18 +)
- Props let you change colours and speed per-instance without CSS vars
- Keyframes injected once into `<head>` (SSR-safe guard on `typeof document`)

---

## 4. Animation Anatomy

```
Timeline (2.6 s cycle, cubic-bezier .45 .05 .35 1):

 0 %   ──────► Fully clipped from right (invisible)
               clip-path: inset(0 100% 0 0)
               Wave rushes in left → right ↓
52 %   ──────► Fully visible
               Glint sweeps through (1.7 s, independent loop)
82 %   ──────► Still visible
               Fade starts ↓
94 %   ──────► opacity: 0  (invisible)
100 %  ──────► Reset → clip-path: inset(0 100% 0 0)  ── loop
```

The loop restarts seamlessly because both the start and end frames are invisible (`opacity: 0` at 94 %–100 %, `clip-path: 100%` at 0 %–∼5 %).

---

## 5. Porting to Other Relish Apps

1. **Copy the CSS block** (section 2 above) into the project stylesheet.
2. **Copy the HTML markup** (section 2 above) wherever a loader is needed.
3. **Size with `width` only** — height is automatic via `aspect-ratio`.
4. **Dark backgrounds**: works out of the box (`mix-blend-mode: screen` on the glint creates a bright streak on dark).
5. **Light backgrounds**: teal wave is visible; glint is subtle (screen blend on teal ≈ lighter teal). Optionally set `--cf-streak: #4dd9c5` for a more visible glint on white.

For React/TypeScript apps — copy `ClamFlowLoader.tsx` from `C:\Users\user\Downloads\` into the project's `components/` folder and `npm install @types/react` if not already present.

---

*Private — FoodStream Ltd. Hong Kong*
