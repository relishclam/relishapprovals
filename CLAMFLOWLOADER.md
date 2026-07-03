# ClamFlowLoader — Implementation Guide

> SVG wave loader derived from the ClamFlow mark.  
> Wave draws left → right; a white glint sweeps through.  
> Teal palette (`#58d3c1 → #16656f`), transparent background, no images.

---

## Quick Reference

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
