# CLAUDE.md — `apps/pie`

Guidance for Claude Code sessions working inside `apps/pie/`. The repo-root
`CLAUDE.md` still applies (no build step, preview deploys, PR + green CI to land
on `main`, always end a reply with the preview link). This file covers Pie
itself.

---

## What Pie is

A **PI Planning (SAFe) prototype**: a design study of the whole product, not a
production app. It ships as one static page that contains two screens —

1. **the light shell** (`#shell`): a SaaS dashboard — sidebar, home, PI
   sessions, ALM connections, and the "PIE Recipe" settings page;
2. **the whiteboard** (`#board-screen`): a zoomable planning canvas with
   floating chrome, side panels, sticky notes, overlays and modals.

Everything is fake-but-coherent: the plan lives in `localStorage`, there is no
server, no auth, no network call anywhere in the app. Data is generated to be
*plausible under stress* (one small ART, one deliberately crowded ART) so
designs can be judged with realistic crowding.

Because it is a design study, **several competing designs ship side by side**.
`state.navVersion` (`v1`–`v4`) switches navigation chrome and the ART Objectives
card design live, from a draggable pill on any board. Do not "clean up" by
deleting a version — the comparison is the point.

---

## Commands

Run from the **repo root**, not from `apps/pie/`:

```sh
npm install
npm run dev        # http://localhost:8080 → open /apps/pie/
npm run lint       # htmlhint + stylelint (CI runs this)
```

CI also runs `node --check` on every `.js` file outside `node_modules`:

```sh
shopt -s globstar nullglob; for f in **/*.js; do [[ "$f" == node_modules/* ]] || node --check "$f"; done
```

There is no test runner. Verify UI work in a real browser — the recipe (with a
ready-to-paste Playwright script) is in `docs/testing.md`.

---

## The three files

| File | Size | What lives there |
|---|---|---|
| `index.html` | ~90 lines | Boot script, inline loading-screen CSS, and the **empty DOM layers** every renderer paints into. |
| `app.js` | ~4000 lines | One IIFE, `'use strict'`. All state, all rendering, all event handling. |
| `styles.css` | ~2100 lines | Everything visual. Sectioned with `/* ---------- Name ---------- */` banners. |

Nothing is imported from the shell or from other sub-experiences, and nothing
here may be imported by them. That isolation is load-bearing for the iframe
morph in the arcade shell.

### `index.html` is a layer stack, not markup

Every element inside `#board-screen` is an empty container that one render
function owns (`#bnav`, `#srail`, `#canvas`, `#art-side`, `#convo`,
`#sightline`, `#navtree`, `#dock`, `#btools`, `#stickypanel`, `#stickybar`,
`#pinbanner`, `#verfab`, `#zoomctl`, plus `#sl-fab`). Overlays (`#hub`,
`#pmodal`, `#palette`) are siblings of `#board-screen`. Add a surface = add one
empty layer here + one `renderX()` in `app.js` + one CSS section.

---

## Read these before changing anything non-trivial

| Doc | Read it when |
|---|---|
| `docs/architecture.md` | Touching the render pipeline, event handling, layout, z-index, or the view transform. |
| `docs/state-model.md` | Touching `state`, `normalize()`, persistence, or generated sample data. |
| `docs/navigation.md` | Touching context/boards/pages, the four chrome versions, hub, palette or deep links. |
| `docs/surfaces.md` | Touching any panel, popover, overlay or modal (there are ~15). |
| `docs/sightline.md` | Touching the Sightline AI assistant, or wiring a real model behind it. |
| `docs/testing.md` | Verifying a change, or writing a browser check. |

---

## Hard rules

**1. Render functions own their layer, completely.**
Every `renderX()` writes `innerHTML` on its own container and returns. Never
mutate another layer's DOM, never cache a node across a render — the node is
gone. State lives in module variables; the DOM is a projection of it.

**2. Events are delegated to the stable container, never to rendered nodes.**
Listeners are attached once, to the layer element, and dispatch on
`e.target.closest('[data-…]')`. Re-rendering must not re-bind. (The few
exceptions — a `<form>` submit inside a freshly rendered panel, the hub and
palette inputs — are re-bound inside the same render that created them, which
is safe precisely because the old nodes were discarded.)

**3. `esc()` everything interpolated into an HTML string, and quote attributes
with `"`.**
`esc()` escapes `& < > "` — **not** `'`. Single-quoted attributes are
unescaped-apostrophe injection waiting to happen. Board names, team names,
titles, user text, thread bodies: all go through `esc()`.

**4. `renderBoardView()` is the only full repaint.**
It toggles the `board-screen` state classes, then calls every layer renderer in
a fixed order, then `renderCanvas()` + `fitView()`. If a surface needs to
appear/disappear with app state, add its class toggle and its renderer call
there — do not paint it from an event handler and hope.

**5. Board-plane surfaces must check the plane in JS.**
`mode` is `'board'` or `'page'`. Anything that only makes sense over a board —
the ART Objectives panel (`mode !== 'board' || railActive !== 'objectives'`),
Sightline (`slBoardPlane()`), the v3 tools bar (`chromeV() !== 'v3' ||
boardScreen.hidden`) — starts its renderer with that guard, blanks its
container and returns. Some older chrome (the side rail) is hidden by CSS
alone; that is fine for pure decoration, but any surface with behaviour must
not rely on it.

**6. `save()` after every state mutation.**
It is debounced (150 ms) and cheap. Anything not written into `state` is
runtime-only and dies on reload — that is usually the correct choice for
"which panel is open", and the wrong choice for user data.

**7. Keep the loading screen contract.**
`#app-loading` is painted by an inline `<style>` in `<head>` *before*
`styles.css` loads, and `app.js` removes it only once ≥ 3 s have elapsed. Don't
move that CSS, don't shorten the delay — and remember every browser check must
wait it out.

**8. Don't navigate the parent window.**
Pie runs inside the arcade shell's iframe. `quit()` posts
`{ type: 'close-game' }` to `window.parent` when embedded, and only falls back
to `location.href` when standalone. The hash is written with `replaceState`,
never `pushState`, so the shell's `popstate` close keeps working.

**9. No build step, no dependency, no framework.**
If a feature seems to need one, it doesn't. Plain DOM, plain CSS, plain
strings.

---

## Where things are in `app.js`

Search for the `// ---------- Name ----------` banners; they are the file's
table of contents. In rough order:

```
State & normalize            sample data, migrations, load/save
Helpers                      el(), esc(), team(), card(), cellCards()
Whiteboard icons             bIcon(name, cls) — the whole SVG set
Boards registry              BOARD_LIST + boardsFor/boardName/boardIcon
Chrome state                 every runtime `let` that drives the UI
Top navigation               v1/v2 bar, dropdown menus
v2 Navigator tree            the workspace as a sidebar tree
v3 dock + Hub                breadcrumb dock, full-screen Hub overlay
v3 utility bar               history / metrics / config / facilitation panels
Floating version switcher    the draggable v1–v4 pill
v3 bottom bar                board tools (add, magnify, scale, zoom, trail)
v3 modals                    timer, confidence vote, plan readout, help
Breakdown model + Graph      the full-page sticky breakdown (grid + node graph)
Side rail                    the floating board rail
Sticky notes + metadata      note HTML, type/status/links/activity
Panels                       iteration / objectives / risk panels
Canvas                       board sheet renderers
Pages plane                  documents assembled from board data
ART Objectives side panel    objective cards, inline editing, drag reorder
Conversation panel           team / chat / board threads
Sightline                    the AI assistant (button + panel + answers)
Sticky conversation popover  a single note's thread, anchored to the note
Sticky action bar            the 16-button bar above a clicked note
Zoom control / view transform bounded pan + zoom
Chrome interactions          rail, top-nav and zoom click handlers
renderBoardView              the full repaint
Theming / data ops           accent + card colors, export/import/reset
Light shell                  sidebar, home, sessions, connections, stubs
Board navigation             enterBoard / exitBoard
Command palette              ⌘K in v1/v2
Deep links                   #b/ #p/ #s/
PIE Recipe                   the settings page (built with el(), not strings)
Global                       keydown ladder, fullRender, boot
```

---

## Adding things — the shapes to copy

**A new board.** Append to `BOARD_LIST` (`[id, railIcon, 'Name', ownerType]`)
and give it a branch in `renderCanvas()`. Without a branch it renders the
"isn't wired up yet" placeholder, which is a perfectly good intermediate state.
Owner type decides which context can see it (`st` / `art` / `team` / `any`).

**A new page.** Append to `defaultPages()` with `{ id, owner, title, purpose,
updated, blocks: [...] }` using existing block types, or add a block type to
`blockHtml()`. Note pages are replaced wholesale by `normalize()` when the
shape looks stale — see `docs/state-model.md`.

**A new floating surface.** Empty layer in `index.html` → `renderX()` that owns
it → a delegated listener on the layer → a CSS section → a call inside
`renderBoardView()` → an entry in the `Escape` ladder if it is dismissible.
`docs/surfaces.md` lists the existing ones and the conventions they share
(anchoring, flipping, click-away).

**A new icon.** Add a path to the `P` map inside `bIcon()`. 24×24 viewBox,
stroke-based, no `fill` unless you also set `fill` in CSS.

**A new sample-data field.** Default it in `normalize()` so old saved plans keep
working. Never assume a field exists on `state` loaded from `localStorage`.

---

## Gotchas that have already bitten

- **Hash changes don't route.** `applyHash()` runs once at boot. There is no
  `hashchange` listener, so setting `location.hash` in a live page does nothing
  — and in Playwright, `page.goto(url + '#other')` on the same document is a
  *fragment* navigation that never reloads. Use a fresh page or `reload()`.
- **`state.objectives` vs `team.objectives`.** The Team Board's "Team
  Objectives" panel renders the legacy global `state.objectives` (lorem text);
  the ART Objectives board and Sightline read per-team `team.objectives`. The
  two counts legitimately differ. Don't "fix" one to match the other without
  deciding which is the model.
- **The v3 chrome hides v1 chrome, it doesn't replace it.** `bnav`, `srail` and
  `zoomctl` are still rendered and then hidden by CSS. Guard on `chromeV()`
  when behaviour (not just looks) must differ.
- **`chromeV()` ≠ `state.navVersion`.** v4 uses v3's chrome. Use `chromeV()`
  for navigation checks and `state.navVersion` for design-variant checks.
- **The canvas re-fits on every repaint.** `renderBoardView()` ends with
  `fitView()`, which resets zoom/pan. If you call it from an interaction, the
  user loses their viewport — prefer `renderCanvas()` alone where that matters.
- **Pointer capture on the canvas is deferred.** `pointerdown` records the
  start; capture only happens once movement exceeds 4 px, otherwise a click on
  a sticky would be swallowed. Preserve that when touching pan code.
- **Two right-hand panels exist.** The conversation panel and Sightline both
  occupy the right edge and are mutually exclusive by hand: every place that
  opens one closes the other. If you add a third, extend that rule rather than
  layering panels.
- **Markdown in this folder deploys with the site** (harmless — nothing links
  to it). Add patterns to `exclude_assets` in `.github/workflows/pages.yml` if
  that ever matters.
