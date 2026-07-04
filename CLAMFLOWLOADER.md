# ClamFlowLoader — Implementation Guide

> Teal wave loader derived from the ClamFlow mark.
> Draws left→right, holds fully visible, fades out, repeats.
> No external assets. No clip-path. No CSS variables.

---

## Why `width + overflow:hidden` — not `clip-path`

`clip-path: inset()` applied to an `<svg>` element evaluates in **SVG user-unit space** (the viewBox), not CSS pixel space. `inset(0 100% 0 0)` on a 950-unit viewBox clips a fraction of a pixel, leaving a permanent left-edge sliver. No amount of wrapper nesting or SVG attribute changes fixes this in Chrome.

The reliable fix: animate `width` on a plain HTML wrapper element with `overflow:hidden`. CSS layout properties operate in CSS pixels unconditionally.

**The removed keyframe collision:** `styles.css` previously contained `@keyframes cf-form` (the broken `clip-path`-based version). `app.js` injects `@keyframes cf-form` (the working `width`-based version). Both used the same name — whichever the browser parsed last would win, causing the React loaders to intermittently revert to the sliver bug depending on cache state and load order. The `styles.css` version has been deleted; only the `app.js`-injected version remains.

**The removed overflow collision:** `overflow:visible` on the `<svg>` element causes Chrome to composite SVG overflow into a separate layer that bypasses the wrapper's `overflow:hidden` box. All three implementations use `display:block` only on the SVG — no `overflow:visible`.

---

## Live implementations

Three files, same mechanism, namespaced IDs to prevent collisions.

| File | Purpose | ID prefix | Keyframe names |
|---|---|---|---|
| `public/index.html` | App splash screen | `cfs-` | `cfs-form`, `cfs-sweep` |
| `public/capture.html` | Bill Capture loading screen | `cfc-` | `cfc-form`, `cfc-sweep` |
| `public/app.js` | React component (all in-app loaders) | `cf{N}-` (counter) | `cf-form`, `cf-sweep` |

No CSS classes. `styles.css` contains no ClamFlow rules. Each implementation is fully self-contained.

---

## 1. Splash screen — `public/index.html`

### DOM structure

```html
<div style="width:320px;height:90px;position:relative;">
  <div id="cfs-wrap"
       style="position:absolute;left:0;top:0;height:90px;
              width:0; overflow:hidden;
              -webkit-mask-image:linear-gradient(to right,black 75%,transparent 100%);
              mask-image:linear-gradient(to right,black 75%,transparent 100%);
              animation:cfs-form 2.5s linear infinite">
    <svg width="320" height="90" viewBox="0 0 950 267" style="display:block">
      <!-- defs: cfs-fill gradient, cfs-glint gradient, cfs-clip clipPath -->
      <!-- paths fill="url(#cfs-fill)" -->
      <!-- rect id="cfs-streak" for glint sweep -->
    </svg>
  </div>
</div>
```

### Keyframes

```css
@keyframes cfs-form {
  0%  { width:0;     opacity:1; animation-timing-function:ease-out }
  5%  { width:320px; opacity:1; animation-timing-function:linear  }
  82% { width:320px; opacity:1; animation-timing-function:ease    }
  96% { width:320px; opacity:0; animation-timing-function:linear  }
 100% { width:0;     opacity:0 }
}
@keyframes cfs-sweep {
  0%   { transform: translateX(-320px) skewX(-12deg) }
  100% { transform: translateX(1070px) skewX(-12deg) }
}
```

### Timing (2.5 s cycle)

| Phase | Range | Duration | Notes |
|---|---|---|---|
| Draw 0→320 px | 0–5 % | **0.125 s** | `ease-out` — fast start, decelerates |
| Hold full width | 5–82 % | **1.925 s** | Complete wave visible |
| Fade out | 82–96 % | 0.35 s | `ease` |
| Invisible reset | 96–100 % | 0.1 s | |

The partial-draw window is ~50 ms. Shorter than a blink; impossible to screenshot mid-draw.

### Soft trailing edge

`mask-image: linear-gradient(to right, black 75%, transparent 100%)` on `#cfs-wrap` softens the right clip edge so the wave appears to organically emerge rather than be hard-cut.

### Glint sweep

Independent 1.7 s loop on `<rect id="cfs-streak">`, clipped by the wave's own `<clipPath id="cfs-clip">`.

```html
<rect id="cfs-streak" x="0" y="-60" width="240" height="387" fill="url(#cfs-glint)"
      style="mix-blend-mode:screen;animation:cfs-sweep 1.7s cubic-bezier(.5,0,.3,1) infinite"/>
```

### prefers-reduced-motion

```css
@media(prefers-reduced-motion:reduce){
  #cfs-wrap   { animation:none; width:320px; opacity:1 }
  #cfs-streak { display:none }
}
```

---

## 2. Bill Capture page — `public/capture.html`

Identical mechanism to the splash screen. Sized at 200 × 56 px. All IDs prefixed `cfc-`.

```html
<div class="cfc-outer"> <!-- width:200px;height:56px;position:relative -->
  <div id="cfc-wrap">   <!-- position:absolute;left:0;top:0;height:56px;width:0;overflow:hidden;
                              mask-image:...; animation:cfc-form 2.5s linear infinite -->
    <svg width="200" height="56" viewBox="0 0 950 267" style="display:block">
      <!-- defs: cfc-fill, cfc-glint, cfc-clip -->
    </svg>
  </div>
</div>
```

Keyframe `cfc-form` uses the same 0/5/82/96/100 % breakpoints with pixel values for 200 px width.
The `loading-screen` div is toggled via a `hide()`/`show()` JS helper; no code references `.cf-loader`.

---

## 3. React component — `public/app.js`

### Usage

```jsx
<ClamFlowLoader width={200} label="Loading" />
```

| Prop | Type | Default | Notes |
|---|---|---|---|
| `width` | `number` | `200` | px; height auto-computed as `Math.round(w * 267/950)` |
| `label` | `string` | `'Loading'` | `aria-label` on the SVG |

### DOM structure

```jsx
<span style={{ display:'inline-block', width:w, height:h,
               lineHeight:0, verticalAlign:'middle',
               flexShrink:0, position:'relative' }}>

  <span className="cf-wave-wrap"
        style={{ display:'block', position:'absolute', left:0, top:0,
                 height:h, width:0, overflow:'hidden',
                 animation:'cf-form 3s ease-out infinite' }}>

    <svg width={w} height={h} viewBox="0 0 950 267" style={{ display:'block' }}>
      {/* defs: uid+'-f' gradient, uid+'-g' glint, uid+'-c' clipPath */}
    </svg>
  </span>
</span>
```

### Injected keyframes

Injected once via `<style id="clamflow-keyframes">`. `getElementById` guard prevents duplicates.

```css
@keyframes cf-form {
  0%   { width:0%;   opacity:1 }
  20%  { width:100%; opacity:1 }   /* 3s ease-out → full width ~0.3 s */
  80%  { width:100%; opacity:1 }
  95%  { width:100%; opacity:0 }
  100% { width:0%;   opacity:0 }
}
@keyframes cf-sweep {
  0%   { transform: translateX(-320px) skewX(-12deg) }
  100% { transform: translateX(1070px) skewX(-12deg) }
}
@media(prefers-reduced-motion:reduce){
  .cf-wave-wrap   { animation:none; width:100%; opacity:1 }
  .cf-wave-streak { display:none }
}
```

> The React component uses 20 % for the draw phase (vs 5 % for the splash/capture screens).
> Both use `width + overflow:hidden` — no `clip-path` anywhere.

### Unique IDs

Module-level counter incremented in `useState` lazy initialiser.
Each mounted instance gets `cf{N}-f` / `cf{N}-g` / `cf{N}-c` for fill, glint, clipPath.
No ID collisions even with dozens of simultaneous spinners.

### Sizes used in Relish Approvals

| Context | `width` | Height |
|---|---|---|
| Button / inline (`Icons.loader`) | 56 px | 16 px |
| Full-page loading state | 200 px | 56 px |
| Payees page loading state | 200 px | 56 px |

---

## 4. Porting to other Relish apps

Copy the self-contained block from `public/index.html` — the `<style>` block, outer `<div>`, `#cfs-wrap` div, and `<svg>`. Give the IDs a fresh unique prefix to avoid collision.

**Resize:** change `width="320" height="90"` on the SVG and `width:320px;height:90px` on the outer div. Keep aspect ratio 950:267 (≈ 3.56:1).

**Recolour:** edit the two `stop-color` values on the fill gradient stops.

For TypeScript/React projects (Next.js, Vite): use `ClamFlowLoader.tsx` at `C:\\Users\\user\\Downloads\\ClamFlowLoader.tsx`.

---

## 5. Known gotchas

| Problem | Root cause | Resolution |
|---|---|---|
| Permanent left-edge sliver on SVG | `clip-path:inset()` on `<svg>` uses SVG user-unit coords, not CSS px | `width` animation + `overflow:hidden` on HTML wrapper |
| SVG overflow bypasses wrapper clipping | `overflow:visible` on SVG composites content outside wrapper box | Removed `overflow:visible` from all three SVG elements |
| Intermittent React sliver *(fixed)* | `@keyframes cf-form` in `styles.css` (clip-path) shadowed app.js injected `cf-form` (width) depending on parse order | Deleted `styles.css` definition; single source of truth in app.js |
| Orphaned SVG tail in HTML | `replace_string_in_file` matched only part of a block, leaving closing tags | Rewrite entire body section via Node.js; never partial-match across SVG boundaries |
| Stale HTML from service worker | `index.html` was in SW pre-cache; new HTML never reached browser | SW v39+: HTML removed from `urlsToCache`; navigations always network-first |

---

*Private — FoodStream Ltd. Hong Kong. Client: Relish Foods Pvt. Ltd.*
