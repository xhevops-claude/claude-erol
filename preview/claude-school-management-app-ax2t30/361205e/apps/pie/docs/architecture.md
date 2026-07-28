# Pie · Architecture

How the app is put together: DOM layers, the render pipeline, event handling,
the view transform, and the layout/stacking rules everything else obeys.

Companion docs: `state-model.md`, `navigation.md`, `surfaces.md`,
`sightline.md`, `testing.md`.

---

## 1. Shape of the program

`app.js` is a single IIFE in strict mode. No modules, no exports, no globals.
Order inside the file matters only for `const`/`let` initialisation — every
`function` declaration is hoisted, so renderers can call each other freely.
Boot happens at the very bottom, after everything is defined.

```
(function () {
  'use strict';
  …constants, sample data generators…
  …DOM refs…
  let state = load() || sampleState();
  …helpers, icons, registries…
  …chrome state (module-level `let`s)…
  …render functions + delegated listeners, section by section…
  fullRender();          // boot
  shell.hidden = false; boardScreen.hidden = true;
  applyHash();
  …reveal() removes the loading screen after ≥3s…
})();
```

Two kinds of variable, and the distinction is the app's spine:

| | Lives in | Survives reload | Examples |
|---|---|---|---|
| **Plan data** | `state` (persisted) | yes | teams, cards, objectives, risks, pages, threads, `navVersion`, `workMode`, `boardCfg` |
| **Chrome state** | module-level `let` | no | `mode`, `railActive`, `ctx`, `convoOpen`, `slOpen`, `sbCard`, `pinned`, `view`, `hubOpen` |

If you add UI state, decide deliberately which side it belongs to. "Which panel
is open" is chrome. "Which design version the user picked" is plan data.

---

## 2. DOM layers

`index.html` declares empty containers; each is owned by exactly one renderer.

### Shell (`#shell`, hidden while a board is open)

| Element | Owner |
|---|---|
| `#side` | `renderSide()` — brand, nav, plan card, user menu |
| `#main` | `renderPage()` → `renderHome` / `renderSessions` / `renderConnections` / `renderSettings` / `renderStub` |

### Board screen (`#board-screen`, `position: fixed; inset: 0; z-index: 1`)

| Element | Owner | Notes |
|---|---|---|
| `#canvas-wrap` → `#canvas` | `renderCanvas()` | the only transformed element |
| `#bnav` | `renderTopNav()` | v1/v2 top bar; empty in v3 |
| `#dock` | `renderDock()` | v3 top bar; empty otherwise |
| `#navtree` | `renderNavTree()` | v2 only |
| `#srail` | `renderSideRail()` | v1 only (hidden by CSS in v2/v3) |
| `#art-side` | `renderArtSide()` | ART Objectives editor, left, 474 px |
| `#convo` | `renderConvo()` | conversations, right, 340 px |
| `#sightline` + `#sl-fab` | `renderSightline()` | AI assistant, right, 384 px |
| `#btools` | `renderBtools()` | v3 bottom bar + utility panels |
| `#zoomctl` | `renderZoomCtl()` | v1/v2 bottom-right zoom |
| `#stickypanel` | `renderStickyPanel()` | a note's thread, anchored |
| `#stickybar` | `renderStickyBar()` | action bar above a clicked note |
| `#pinbanner` | `renderPinBanner()` / `setLinkHint()` | shared banner, two modes |
| `#verfab` | `renderVerfab()` | draggable v1–v4 switcher |

### Overlays (siblings of `#board-screen`)

| Element | Owner | z-index |
|---|---|---|
| `#hub` | `renderHub()` | 8500 |
| `#pmodal` | `renderModal()` | 8600 |
| `#palette` | `openPalette()` | 9000 |

`#import-file` is a hidden `<input type="file">` used by the settings page.

---

## 3. The render pipeline

### Full app render

`fullRender()` → `applyTheme()`, `ensureCtxValid()`, `renderSide()`,
`renderPage(currentPage)`, and `renderBoardView()` if the board screen is
visible. Called at boot, after import, and after reset.

### Full board render — `renderBoardView()`

The single entry point for "something changed, repaint the board". It:

1. toggles the state classes on `#board-screen` (see §5);
2. sets `--ns` (sticky scale) on the canvas;
3. `recordRecent()` — pushes the current artifact onto the Recent list;
4. calls, in this order:
   `renderTopNav`, `renderNavTree`, `renderSideRail`, `renderArtSide`,
   `renderConvo`, `renderSightline`, `renderBtools`, `renderStickyPanel`,
   `renderStickyBar`, `renderPinBanner`, `renderVerfab`, `renderZoomCtl`,
   `renderCanvas`;
5. `fitView()` — **resets zoom and pan to 100 % fit**;
6. re-anchors the sticky action bar if one is open.

Consequences worth internalising:

- Any handler that calls `renderBoardView()` throws away the user's viewport.
  For interactions that should preserve zoom (changing a sticky's points, for
  example) call `renderCanvas()` — or `refreshSticky()`, which re-renders the
  canvas, re-anchors the bar and saves.
- Every layer repaints on every board render. That is fine at this size
  (hundreds of nodes) and keeps the code honest: there is no partial-update
  path to get out of sync.

### Canvas render — `renderCanvas()`

```
mode === 'page'            → renderPageCanvas()
railActive === 'objectives'→ renderObjectivesBoard()
railActive === 'team'      → renderTeamBoard()
otherwise                  → renderPlaceholderBoard()
```

Each sets `canvas.style.width/height` and the module-level `boardW`/`boardH`,
which the view transform clamps against. `renderTeamBoard()` builds a
4-column CSS grid "sheet" of panels (4 iterations, objectives, risks, then the
rest). `renderObjectivesBoard()` builds a balanced masonry (shortest column
first) and then iteratively shrinks the sheet with a `transform: scale()` until
it fits the viewport height. `renderPageCanvas()` renders a ≤920 px document
and measures its height back into `boardH`.

---

## 4. Events

**One delegated listener per stable container**, attached once at definition
time, dispatching on `data-*` attributes:

| Container | Attributes it reads |
|---|---|
| `srail` | `data-rail` |
| `bnav` | `data-dd`, `data-mode`, `data-nav`, `data-plane`, `data-go-board`, `data-go-page`, `data-go-session`, `data-go-ctx`, `data-go-shell` |
| `dockEl` | `data-dock`, `data-go-dock-page`, `data-mode`, `data-nav` |
| `hubEl` | `data-hub-node`, `data-hub-board`, `data-hub-page`, `data-hub-sticky`, `data-hub-shell`, `data-hub-close`, `data-go-session` |
| `btoolsEl` | `data-cfg`, `data-fac`, `data-u`, `data-bt` |
| `modalEl` | `data-pm`, `data-bd-*`, `data-link-id`, … |
| `canvas` | `.note` clicks (+ `.n-cv` badge) |
| `sbEl` | `data-sb`, `data-stype`, `data-status`, `data-pts`, `data-unlink`, `data-link-string`, `data-link-browse` |
| `artSide` | `data-obj-*` (card, grip, menu, act, bv, av, rag, links, toggle, add) + `dragstart/over/drop/dragend` |
| `convoEl` | `data-cv-tab`, `data-open-page`, `data-open-sticky`, `data-nav="convo"` |
| `slEl` | `data-sl-close`, `data-sl-reset`, `data-sl-ask`, `data-sl-go` |
| `paletteEl` | `data-pal` |
| `sideEl` / `mainEl` | `.nav-i`, `data-act` |

Two global listeners:

- **`document` click** — closes anything that should dismiss on click-away:
  user menu, top-nav dropdowns, util/tool panels, dock panel, objective menu,
  inline objective edit (commits it), sticky action bar. Handlers inside
  re-rendering containers call `e.stopPropagation()` so this check doesn't
  misfire on a node that was just replaced.
- **`document` keydown** — ⌘/Ctrl+K (Hub in v3, palette otherwise) and the
  `Escape` ladder, in priority order:

  ```
  objective edit modal → any modal → hub → palette → link mode →
  sticky-bar sub-panel → sticky action bar → Sightline →
  pin focus → sticky conversation → dock panel → util/tool panel →
  nav dropdowns → user menu
  ```

  Insert new dismissibles at the right rung; the first match wins and returns.

`window` resize re-renders the board view (re-fits the canvas).

---

## 5. State classes on `#board-screen`

CSS layout is driven entirely by classes toggled in `renderBoardView()`:

| Class | Meaning | Layout effect |
|---|---|---|
| `obj-mode` | ART Objectives board is active | forces the side rail right |
| `obj-open` | + its side panel is open | `art-side` visible, canvas inset left 474 px |
| `page-mode` | pages plane | hides the side rail |
| `convo-open` | conversation panel open | canvas inset right 340 px |
| `sl-open` | Sightline open | canvas inset right 384 px |
| `nav-v2` | chrome v2 | navtree instead of rail |
| `nav-open` | + tree visible | canvas inset left 264 px |
| `nav-v3` | chrome v3/v4 | dock replaces top bar, canvas full-bleed under it |
| `mode-exec` | Execution work mode | objective cards gain AV/RAG/progress |
| `magnify` | sticky magnifier on | `.note:hover` scales |
| `cfg-nodates` / `cfg-nogrid` / `cfg-compact` | board configuration | header dates, canvas grid, panel padding |
| `pin-focus` | a sticky is pinned | dims unrelated notes |

Combinations are spelled out explicitly in CSS (e.g.
`.board-screen.nav-v2.nav-open.obj-mode.obj-open .canvas-wrap { left: 738px }`).
When adding a panel that insets the canvas, add its combinations too.

---

## 6. Stacking order

`#board-screen` is `z-index: 1` and creates a stacking context, so everything
inside it — including `position: fixed` children — stays below the overlays
that are its siblings.

| Layer | z-index |
|---|---|
| `art-side` | 30 |
| `navtree` | 34 |
| `convo` | 35 |
| `sightline` | 36 |
| `bnav`, `srail`, `zoomctl` | 40 |
| `sl-fab` | 41 |
| `btools` | 42 |
| `dock` | 45 |
| dropdown menus inside bars | 60–200 |
| `pinbanner` | 8100 |
| `stickybar` | 8200 |
| `hub` | 8500 |
| `pmodal` | 8600 |
| `verfab` | 8650 |
| `palette` | 9000 |

---

## 7. The view transform

`#canvas` is the only transformed element:
`translate(view.x, view.y) scale(view.scale)`.

- **100 % means "the whole board fits"**: `fitScale()` = viewport width minus
  padding, over `boardW`. `zoomPct()` and the zoom readouts are relative to
  that, so 100 % is a fit, not a pixel ratio.
- You can only zoom **in** from the fit: `setScale()` clamps to
  `[fitScale, fitScale * MAXZOOM]` (`MAXZOOM = 3`).
- `clampView()` keeps the board inside the viewport, centring it on any axis
  where it is smaller than the viewport.
- Wheel zooms toward the cursor; drag pans. Pointer capture is **deferred**
  until the pointer moves more than 4 px, so a plain click still reaches the
  sticky underneath. A real drag closes the sticky action bar and the sticky
  conversation popover (they are anchored to screen coordinates).
- `PAD = 20`, `PCOLS = 4` (board-sheet columns).

---

## 8. CSS conventions

- Sections are separated by `/* ---------- Name ---------- */` banners; keep
  new rules inside the matching section (or add a banner).
- Class prefixes map to surfaces, which makes grep reliable:

  | Prefix | Surface |
  |---|---|
  | `bn-` | v1/v2 top nav | 
  | `dd-` | top-nav dropdown menus |
  | `nt-` | v2 navigator tree |
  | `dk-` | v3 dock |
  | `hb-` | v3 Hub overlay |
  | `ub-` / `bt-` | v3 utility bar / board tools |
  | `sr-` | side rail |
  | `wb-` / `panel-` / `ph-` | board sheet + whiteboard panels |
  | `note`, `n-` | sticky notes |
  | `sb-` | sticky action bar |
  | `op-` / `ob-` | objectives panels on the board |
  | `as-` | ART Objectives side panel |
  | `cv-` / `sp-` | conversations / sticky conversation |
  | `sl-` | Sightline |
  | `pd-` | page documents |
  | `bd-` / `gn-` | breakdown grid / graph nodes |
  | `pm-` | modals |
  | `pal-` | command palette |
  | `r-` | PIE Recipe settings forms |

- Theme hooks: `--accent` and `--accent-soft` are set from `state.accent` by
  `applyTheme()`; `--story/--feature/--enabler/--milestone` come from
  `state.kinds`. Board surfaces also use local tokens `--r-line`, `--r-dim`,
  `--r-faint` defined on `.board-screen`.
- The board is deliberately **not** themed by the arcade shell's theme system —
  sub-experiences ship their own palette.

---

## 9. HTML-string rendering rules

Almost everything is built with string concatenation and `innerHTML`. The
exception is the PIE Recipe settings page, which uses the tiny `el(tag, attrs,
kids)` helper because its inputs need live listeners and values.

Rules that keep string rendering safe:

1. `esc(value)` on every interpolated value. It escapes `& < > "` only.
2. Attributes are always `"`-quoted (because `'` is not escaped).
3. Keep `data-*` hooks on the element you want to click, or on an ancestor —
   handlers use `closest()`.
4. Booleans render as presence: `(cond ? ' on' : '')`, `(cond ? ' disabled' :
   '')`. A global CSS rule makes `button:disabled` inert and 40 % opaque, which
   is how "coming soon" affordances are shown.
5. Icons come from `bIcon(name, cls)` (board) or `icon(name, cls)` (shell).
   They return an `<svg>` with `fill="none"` and `stroke-width="1.7"`; colour
   comes from CSS `stroke: currentColor` on the class you pass.
