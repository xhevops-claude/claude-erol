# Pie · Navigation model

Pie's navigation answers three orthogonal questions at once, and almost every
bug in this area comes from conflating them:

1. **Who am I working as?** → `ctx` (a team, an ART, or the Solution Train)
2. **Which plane am I on?** → `mode` (`'board'` or `'page'`)
3. **Which artifact?** → `railActive` (a board id) or `activePage` (a page id)

On top of that sits a fourth, purely presentational axis: **which chrome
version** is active (`state.navVersion`, v1–v4).

---

## 1. Working context — `ctx`

```js
let ctx = { type: 'team' | 'art' | 'st', id };
```

The hierarchy is Solution Train → ARTs → teams. Everything else is scoped by
the current context:

| Helper | Returns |
|---|---|
| `ctxName()` | display name of the current context |
| `ctxArt()` | the relevant ART (itself, its parent, or the first one) |
| `ctxTeams()` | the user-teams in scope: one team / an ART's teams / all teams |
| `inScope(teamId)` | is that team inside the current context |
| `pagesFor()` | pages whose `owner` equals `ctx.type` |
| `boardsFor(type)` | boards owned by that team type (+ `any`) |
| `ensureCtxValid()` | repairs a context pointing at a deleted team/ART |
| `setCtx(type, id)` | switches context **and** snaps board/page to something the new context owns |

`TYPE_LABEL` maps the three types to 'Team' / 'ART' / 'Solution Train'.

Switching context never leaves you on an artifact you can't see: `setCtx()`
falls back to the first board of the new type, and drops to the board plane if
the new type owns no pages.

---

## 2. Boards registry

```js
const BOARD_LIST = [
  ['solbacklog', 'solbacklog', 'Solution Backlog Board', 'st'],
  ['solplan',    'solplan',    'Solution Planning Board','st'],
  ['artbacklog', 'artbacklog', 'ART Backlog Board',      'art'],
  ['artplan',    'artplan',    'ART Planning Board',     'art'],
  ['objectives', 'objectives', 'ART Objectives',         'art'],
  ['risk',       'risk',       'Risk Board',             'art'],
  ['team',       'teamrail',   'Team Board',             'team'],
  ['collab',     'collab',     'Collaboration Boards',   'any'],
];
// [id, rail icon name, display name, owning team type]
```

Accessors: `boardDef(id)`, `boardName(id)`, `boardIcon(id)`, `boardsFor(type)`.

**Only two boards render real content** — `team` (`renderTeamBoard`) and
`objectives` (`renderObjectivesBoard`). Everything else falls through to
`renderPlaceholderBoard()` ("This board isn't wired up yet — coming next"),
which is an intentional, shippable state.

`gotoBoard(id)` adopts the owning context automatically: opening an ART board
from a team context promotes `ctx` to that ART; opening the Team Board from an
ART context demotes it to the first team in scope. `gotoPage(id)` does the same
using the page's `owner`.

---

## 3. The two planes — `mode`

| `mode` | Renders | Chrome differences |
|---|---|---|
| `'board'` | a board sheet on the zoomable canvas | side rail visible; Sightline available |
| `'page'` | a document (`renderPageCanvas`) on the same canvas | `.page-mode` hides the rail; Sightline and the ART panel hide themselves |

The v1 top bar has an explicit plane toggle (`data-plane`); v2 switches planes
by picking an item in the tree; v3 switches by picking in the Hub or the dock's
Pages dropdown.

---

## 4. Chrome versions

`state.navVersion` ∈ `v1 | v2 | v3 | v4`, switchable from the **draggable pill**
on any board (`#verfab`, position remembered in `localStorage['pie-vfpos']`) or
from PIE Recipe → Navigation.

```js
const chromeV = () => (state.navVersion === 'v4' ? 'v3' : state.navVersion);
```

Use `chromeV()` for navigation behaviour; use `state.navVersion` for
design-variant behaviour (the ART Objectives card designs, the breakdown graph
edge encodings).

### v1 — switcher chips + floating rail

- `#bnav`: home, ⌘K search, boards dropdown, (disabled) history, Planning /
  Execution segmented control; centre = board (or page) chip + session chip +
  context chip, each a dropdown; right = avatars, conversation toggle with
  badge, (disabled) snapshot/edit, plane toggle, user initials.
- `#srail`: floating vertical rail of the current context's boards, with a
  "shift" button that moves it left/right (`railRight`). It is **forced right**
  and locked while the ART Objectives panel is open.
- `#zoomctl`: bottom-right fit / − / % / + / help.

### v2 — navigator tree

- `#navtree` (264 px, left): session picker, Recent list, then the whole
  workspace as an expandable tree (ST → ARTs → teams, each with Boards and
  Pages). `expanded` is lazily initialised to reveal the current context.
- The top bar collapses to a breadcrumb (`session / context / artifact`) plus
  hamburger and search. The side rail is hidden.

### v3 — dock + Hub

- `#dock` (50 px, top): breadcrumb button that opens the **Hub** (⌘K), a Pages
  dropdown, the mode switcher, the conversations button, avatar.
- `#btools` (bottom, centred): search, history, metrics, board config,
  facilitation, board conversation | **add sticky** | magnifier, sticky scale,
  pointer trail, zoom popover, help. The utility buttons open a panel
  (`utilPanel`) above the bar; the tools open small popovers (`btPanel`).
- `#bnav`, `#srail` and `#zoomctl` are still rendered but hidden by CSS.

### v4 — v3 chrome, alternate objectives design

Only the ART Objectives cards (and the breakdown graph encodings) differ.

---

## 5. The Hub (v3) and the Command Palette (v1/v2)

Both answer "jump anywhere", and ⌘K picks whichever fits the current chrome.

**Hub** (`#hub`, full-screen): a search field, a session `<select>`, and either

- *browse mode* — hierarchy on the left, the selected node's Boards (tiles) and
  Pages (rows) on the right; or
- *results mode* (as soon as you type) — a flat list of matching boards, pages
  and up to 12 matching **stickies**, capped at 60 rows.

Keyboard: ↑/↓ move `hubSel` across `.hb-act` items, Enter clicks the selection,
Esc closes. The backdrop closes the hub, but only 400 ms after opening
(`hubOpenedAt`) so a double-click on the breadcrumb doesn't immediately cancel
itself. `openHub()` is wrapped in a try/catch by its caller which resets hub
state and retries — a corrupt hub must never trap the user.

**Palette** (`#palette`): grouped list — Boards, Pages, Working as, PI Sessions,
App (shell pages) and Actions (toggle conversations, *Ask Sightline about this
board*). Filter by typing, ↑/↓/Enter to pick.

**Recents** (`recents`, runtime only, max 5) are recorded by `recordRecent()` on
every board render, keyed `mode:ctxType:ctxId:artifactId`. They surface in the
v2 tree and the Hub.

---

## 6. Entering, leaving, deep links

```
enterBoard(name?)  shell.hidden = true;  boardScreen.hidden = false;  renderBoardView(); updateHash();
exitBoard()        boardScreen.hidden = true; shell.hidden = false;   clears pin/link/sticky state; navigate(currentPage)
```

Hashes (written with `replaceState` **only**, so the arcade shell's
`popstate`-driven close still works):

| Hash | Meaning |
|---|---|
| `#b/<boardId>` | board plane, that board |
| `#p/<pageId>` | page plane, that page |
| `#s/<shellPage>` | shell page other than home |

`applyHash()` runs **once at boot**. There is no `hashchange` listener, so
changing the hash at runtime does not navigate — see `docs/testing.md` for what
that means when driving the app from Playwright.

---

## 7. Work mode

`state.workMode` (`'planning'` | `'execution'`) is set from the mode switcher in
both the v1 bar and the v3 dock, persists, and adds `.mode-exec` to the board
screen. In execution mode:

- ART Objective cards gain an **Actual Value** field, a clickable **RAG** dot
  (`red → amber → green`) and a progress bar derived from their linked cards;
- sticky notes show their status bar;
- Sightline's answers switch to delivery framing (progress, RAG spread) and its
  context chip reads "Execution".
