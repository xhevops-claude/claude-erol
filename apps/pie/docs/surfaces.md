# Pie · Surfaces

An inventory of every panel, popover, banner, overlay and modal, what opens and
closes it, and the conventions they share. Use this before adding a new one —
there is almost certainly a shape to copy.

Shared conventions:

- Each surface owns one container from `index.html` and one `renderX()`.
- Visibility is state → `renderBoardView()` → class/`hidden`, never an ad-hoc
  `style.display` from a handler.
- Anchored surfaces (sticky bar, sticky conversation) store a **screen rect**
  and are re-placed after render; a real canvas pan closes them.
- Dismissible surfaces appear in the `Escape` ladder and (where appropriate) in
  the `document` click-away handler.

---

## Left / right docked panels

### ART Objectives side panel — `#art-side` (left, 474 px)

`renderArtSide()` · shown only when `mode === 'board' && railActive ===
'objectives'`, gated by `objPanelOpen` (toggle in the top bar / dock).

One card per ART objective, grouped Committed / Uncommitted, rank numbered
within its group. Each card carries: drag grip, title, description with a
"See more" clamp (the button is hidden after render for descriptions that
actually fit), Business Value, links count, breakdown button, "…" menu
(edit / commit / move up / move down / delete). Execution mode adds Actual
Value, a RAG dot and a progress bar.

The **four design variants** are the point of this panel:

| Version | Card style | Edit idiom |
|---|---|---|
| v1 | "You" badge on my team | roomy inline form with Save / Cancel |
| v2 | tinted block + commit checkbox | quick inline, click-away saves |
| v3 | outline ring | always-live fields |
| v4 | corner ribbon + visible Edit button | focused modal (`objedit`) |

Reordering: HTML5 drag from the grip only; `reorderObj()` refuses to move a
card between groups. `finishObjEdit(commit)` reverts from `asEditSnap` on
cancel and discards a brand-new blank objective.

### Conversation panel — `#convo` (right, 340 px)

`renderConvo()` · `convoOpen` + `panelMode`:

- `panelMode === 'people'` — tabs **Team** / **Chats** (`cvFilter`), one thread
  per entry, composer posts a new thread tagged with the current context.
- `panelMode === 'board'` — "About this board" + "On sticky notes" for
  `railActive`, with a link from each sticky thread to the note itself.

Opened from the v1 conversation button, the v3 dock (people) and the v3 tools
bar (board), or from Sightline's "Open board conversation" chip.

### Sightline — `#sightline` (right, 384 px) + `#sl-fab`

The AI assistant. Board plane only, mutually exclusive with the conversation
panel. Full documentation in `sightline.md`.

---

## Anchored popovers

### Sticky action bar — `#stickybar`

`renderStickyBar()` · opened by clicking a note (`openStickyBar`), closed by
clicking it again, by Escape, by a canvas pan, or by clicking away.

16 buttons (`SB_ITEMS`); six open a sub-panel (`sbSub`): **type**, **status**,
**points** (form + 1/2/3/5/8/13 chips), **ALM** (synthetic Jira-ish record),
**links**, **activity**. Immediate actions: delete (confirm), duplicate, pin,
breakdown. The rest are `disabled` "soon" affordances — keep them, they show
the intended surface area.

Placement: centred over the note, above it, flipping below when there is no
room, clamped to the viewport. `placeStickyBar()` runs synchronously after
render (offsetWidth is valid then); re-anchor with `noteRectById(id)` after any
canvas repaint.

**String linking** starts here: "Link with string" sets `linkMode` to the
card id, closes the bar and shows the link hint banner; the next note click
creates the link.

### Sticky conversation — `#stickypanel`

`renderStickyPanel()` · opened by the 💬 badge on a note (not the note body),
`stickyOpen` holds the note's **title**. Anchored to the right of the note,
flipping left near the edge. Posting either appends a reply to the existing
thread or creates a new `kind: 'sticky'` thread, then re-renders the canvas so
the badge count updates.

### Pin / link hint banner — `#pinbanner`

One element, two jobs:

- `renderPinBanner()` — while a sticky is pinned (`pinned`), shows its title,
  the linked count and an "Exit focus" button. `.pin-focus` on the board dims
  every unrelated note.
- `setLinkHint(text)` — while `linkMode` is active, shows "Linking… Cancel".

Both write the same container; clearing one must not clobber the other (see
`setLinkHint('')`, which restores the pin banner if a pin is active).

---

## Bars and floating controls

### Side rail — `#srail` (v1)

`renderSideRail()` · the current context's boards plus a "shift" button that
flips the rail left/right (`railRight`). Forced right and disabled while the
ART Objectives panel is open.

### Board tools — `#btools` (v3)

`renderBtools()` · the bottom bar. Left: search (opens the Hub), history,
metrics, board configuration, facilitation, board conversation. Centre: add
sticky (enabled only on the Team Board). Right: magnifier, sticky scale
popover, pointer trail, zoom popover, help.

`utilPanel` (`'history' | 'metrics' | 'config' | 'facil'`) renders a panel above
the bar; `btPanel` (`'scale' | 'zoom'`) renders a small popover. Both close on
click-away and Escape. The facilitation panel launches the modals.

### Zoom control — `#zoomctl` (v1/v2)

`renderZoomCtl()` · fit / − / % / +. Hidden by CSS in v3 (the tools bar owns
zoom there). The `%` readout is updated imperatively by `applyView()` in both
places (`.z-val` and every `.bt-zoomval`).

### Version pill — `#verfab`

`renderVerfab()` · draggable v1–v4 switcher, position persisted in
`localStorage['pie-vfpos']` (separate from the plan). It is dev chrome: it sits
above almost everything (z-index 8650) and is not hidden on small screens, so
it can overlap other surfaces there — drag it out of the way.

---

## Full-screen overlays

### Hub — `#hub` (v3, ⌘K)

Browse or search the whole workspace. See `navigation.md` §5.

### Command palette — `#palette` (v1/v2, ⌘K)

Grouped jump list including the "Ask Sightline about this board" action.

### Modals — `#pmodal`

`openModal(type)` / `closeModal()`; `modalType` drives `renderModal()`.
`closeModal()` also clears the timer interval and the `pm-wide` / `pm-page`
size classes — always go through it.

| `modalType` | What it is |
|---|---|
| `timer` | facilitation timer, ±1 min, start/pause/reset |
| `vote` | fist-of-five confidence vote → histogram with five canned votes + yours |
| `readout` | plan readout: the ART's teams in order, previous / next |
| `help` | keyboard and gesture cheatsheet |
| `breakdown` | **full-page** sticky breakdown (grid + graph) — see below |
| `sblinks` | link picker: every sticky across the org, grouped ART → team |
| `objlinks` | read-only view of an objective's (synthetic) linked stickies |
| `objedit` | v4's focused objective editor with Save / Cancel |

---

## The Breakdown (the largest single feature)

Opened from a sticky's action bar or an objective card. `openBreakdown(c)`
resets its own view state and adds `pm-page`.

**Grid view.** `breakdownModel(c)` generates a seeded, plausible decomposition
of the sticky (features, stories with role/goal phrasing, dependencies, risks),
each item tagged with team / iteration / status / objective. `BD_DIMS` describes
those four dimensions uniformly (label, icon, values, accessor), so **any two of
them can be rows × columns** (`bdRows` × `bdCols`). Lanes collapse
(`bdCollapsed`), and the search box filters items live by re-rendering only
`.bd-scroll`.

The configurator itself has four designs, chosen by `state.navVersion`:
chips (v1), matrix (v2), preset thumbnails (v3), dropdowns (v4).

**Graph view.** `bdGraphModel(c)` walks the sticky's **real** links two levels
deep and lays nodes out in columns by level. The view is a mini whiteboard:
drag nodes (`bdGraphPos`), pan/zoom the world (`bdGraphView`), click a node to
focus its lineage (`lineageSet()` walks ancestors and descendants and dims the
rest). Cross-team edges are encoded differently per version — curve + label,
dashes, orthogonal elbows, per-team colour gradients — with a matching legend.

All three caches (`bdCache`, `bdGraphPos`, `bdGraphView`, `bdGraphFocus`) are
keyed by card id and are runtime-only.

---

## Board content surfaces

| Surface | Function | Notes |
|---|---|---|
| Iteration panel | `iterPanel(idx, name)` | header with dates + Load pill, then notes |
| Team Objectives panel | `objPanel()` | renders the **legacy** `state.objectives` (see `state-model.md` §5) |
| Risk panel | `riskPanel()` | ROAM badge + text |
| Sticky note | `noteHtml(c, i)` | type tab, status pip, 💬 badge, title, progress bar |
| Page document | `renderPageCanvas()` + `blockHtml(b)` | eight block types, ≤920 px wide |
| ART Objectives board | `renderObjectivesBoard()` | masonry of team blocks, auto-shrunk to fit |
