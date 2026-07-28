# Pie · State model

Everything Pie knows lives in one object, `state`, held in a module-level `let`
and mirrored into `localStorage`. This document describes its shape, how it is
created, migrated, persisted and exported — and the quirks worth knowing before
you trust a number on screen.

---

## 1. Lifecycle

```
let state = load() || sampleState();
```

| Function | What it does |
|---|---|
| `sampleState()` | Builds the built-in demo plan from scratch, then runs it through `normalize()`. |
| `load()` | Reads `localStorage['pie-pi-planning-v1']`, JSON-parses it, rejects anything without `teams[]` and `sprints[]`, backfills `cards/deps/risks`, then `normalize()`s it. Any throw → `null` → sample. |
| `normalize(s)` | The migration layer. Fills in every field added after v1, seeds generated data once, and clamps enums. Runs on **every** load, import and reset. |
| `save()` | Debounced 150 ms, `JSON.stringify(state)` into the same key, wrapped in try/catch (quota/private-mode safe). |
| `exportPlan()` | Downloads the whole `state` as pretty JSON, filename from `piName`. |
| import (`#import-file`) | Parses, validates the same two arrays, `normalize()`s, saves, `fullRender()`s. Invalid file → `alert`. |
| `resetPlan()` | Confirms, then `state = sampleState()`. |

**Rule:** any new field must be defaulted in `normalize()`. A returning user's
saved plan predates your change, and nothing else guards against `undefined`.

---

## 2. Top-level shape

```js
{
  // identity / cadence
  piName:   'PI 2026.Q3',
  artName:  'Digital Experience ART',
  iterationWeeks: 2,
  defaultCapacity: 20,
  sprints: ['Iteration 1', …, 'IP Iteration'],   // 1–12, last may be "IP Iteration"

  // people & hierarchy
  user:  { name: 'Erol Nas', role: 'Release Train Engineer' },
  st:    { id, name: 'Horizon Solution Train' },  // one Solution Train
  arts:  [ { id, name, teamIds: [teamId, …] } ],  // two by default
  teams: [ { id, name, capacity, objectives: [] } ],
  myTeamId,                                       // "my" team, highlighted on the objectives board

  // plan content
  cards:   [ … ],          // stickies
  deps:    [],             // reserved; the real links live on cards
  risks:   [ { id, text, cat } ],
  objectives:    [ … ],    // LEGACY global list (see §5)
  artObjectives: [ … ],    // the ART's objectives
  pages:   [ … ],          // page-plane documents
  threads: [ … ],          // conversations

  // modes & preferences (persisted UI)
  navVersion: 'v1' | 'v2' | 'v3' | 'v4',
  workMode:   'planning' | 'execution',
  boardCfg:   { dates: true, grid: true, compact: false },
  accent:     '#f59e0b',
  kinds:      { story|feature|enabler|milestone: { label, color } },

  // dashboard-shell data
  plan: { name: 'Team', teamLimit: 60, renews: '92d' },
  org:  { arts: 3, users: 42 },
  sessions: [ { id, name, updated, live? } ],   sessionTotal: 12,
  connections: [ { id, name, type, ok } ],      connectionTotal: 7,
  events: [ { id, text, source, ago, ok } ],

  // misc / one-time seed flags
  context: { board, program, team, dates },     // dates string shown in panel headers
  vote: null,
  payTeams: true, payMix: true, linksSeeded: true,
}
```

---

## 3. The entities

### Team — `state.teams[]`

```js
{ id, name, capacity, objectives: [ { id, text, bv, links, committed } ] }
```

`capacity` is **points per iteration**. Total team capacity for the PI is
`capacity × sprints.length` — every capacity calculation in the app (metrics
panel, page stats block, Sightline) computes it that way.

Teams belong to exactly one ART via `arts[].teamIds`. `artOf(teamId)` resolves
upward; `ctxTeams()` resolves the current context downward to a team list.

### Sticky / card — `state.cards[]`

```js
{
  id, teamId, sprintIdx,        // sprintIdx indexes into state.sprints
  title, points, kind,          // kind: story | feature | enabler | milestone
  status: 'todo'|'doing'|'done',
  links: [cardId, …],           // seeded once by normalize()
  stype?: 'feature'|'story'|'dependency'|'note',   // set when the user changes type
  activity?: [ { who, what, ago } ],               // lazily created by activityOf()
}
```

- `kind` is the original card type (drives colour); `stype` is the newer
  "sticky type" shown in the action bar. `stypeOf(c)` falls back from `stype`
  to a `KIND_TO_STYPE` mapping, so both stay consistent.
- **Links are symmetric by convention**: `linkedIdsFor(c)` returns
  `c.links` ∪ every card that lists `c`. Always add/remove via `addLink()` /
  `removeLink()`, never by pushing to the array directly.
- Positions are not stored. `noteHtml(c, i)` lays notes out in a 4-column grid
  by index with a deterministic jitter derived from `hashCode(c.id)` — the same
  sticky always lands in the same spot, but moving one is not modelled.

### ART objective — `state.artObjectives[]`

```js
{ id, title, desc, bv, av, rag: 'red'|'amber'|'green', links: number, committed }
```

`links` is a **count**, not an array (older code may also hand it an array;
`objLinkedCards()` tolerates both). Linked cards are *derived*, not stored:
`objLinkedCards(o)` picks `n` cards deterministically with `seededRng('objlinks-' + o.id)`.
That means an objective's "linked items" are stable across renders but are not
a real relationship — treat them as demo data. `objProgress(o)` buckets those
derived cards by status to draw the execution progress bar.

### Team objective — `teams[].objectives[]`

```js
{ id, text, bv, links: number, committed }
```

Generated by `genTeamObjectives(i)` (small ARTs) or `genManyObjectives(i)`
(the deliberately crowded Payments ART). Three teams are emptied on purpose
(`payMix`) so the "no objectives yet" state is always visible somewhere.

### Risk — `state.risks[]`

```js
{ id, text, cat }   // cat ∈ ROAM: U(nassigned) R(esolved) O(wned) A(ccepted) M(itigated)
```

### Page — `state.pages[]`

```js
{ id, owner: 'st'|'art'|'team', title, purpose, updated, blocks: [ … ] }
```

`purpose` groups pages in menus ('Strategy', 'Reporting', 'Facilitation').
`owner` gates visibility: `pagesFor()` returns only pages whose owner matches
the current context type. Block types understood by `blockHtml()`:

| `type` | Renders |
|---|---|
| `text` | a paragraph (`b.text`) |
| `stats` | four live tiles: load, capacity, committed objectives, risks |
| `burndown` | a static SVG burndown + note |
| `deps` | three synthetic cross-team dependency rows (`sampleDeps()`) |
| `risk` | a prose risk callout built from `state.risks[0]` |
| `convo` | a summary of `state.threads` + three fixed "decisions" |
| `okr` | the first four ART objectives with fixed progress percentages |
| `file` | an uploaded-file affordance (inert) |

Blocks may carry `title` and `src` ("from ART Planning Board") — the `src`
label is decorative, not a live query.

### Thread — `state.threads[]`

```js
{
  id, kind: 'team' | 'chat' | 'sticky',
  board?: boardId,        // which board it belongs to
  sticky?: cardTitle,     // sticky threads key on the note's TITLE, not its id
  pageRef?: pageId,       // renders a "jump to page" chip
  who, ini, color, ago, where, text,
  replies: [ { who, ini, color, ago, text } ],
}
```

Sticky threads are matched by **title** (`stickyThreadFor(title)`), which is
why the sticky conversation popover takes a title rather than an id. Renaming a
sticky would orphan its thread — nothing renames stickies today.

---

## 4. Generated data and seed flags

`normalize()` performs one-time seeding, guarded by boolean flags stored in the
plan so it never runs twice:

| Flag | What it seeds |
|---|---|
| `payTeams` | Adds five teams (Lynx, Heron, Badger, Osprey, Viper) to the **second** ART and gives every team there a heavy objective load — the crowding stress case. |
| `payMix` | Empties Badger / Osprey / Viper's objectives so "no objectives yet" is represented. |
| `linksSeeded` | Gives every card two links (offsets +3 and +7 around the array) so the breakdown graph and the Links overlay always have something real to show. |
| `myTeamId` | Points at Marlin (inside the crowded ART) if present, else the first team. |

`normalize()` also seeds `status` on every card in a fixed repeating pattern so
execution-mode progress bars are non-trivial, and replaces `pages` / `threads`
wholesale if they look stale (missing `owner`, missing `kind`, or missing the
`pi-agenda` page). That last rule means **editing `defaultPages()` changes what
existing users see** only if you also bump one of those sentinel checks.

---

## 5. Known inconsistencies (deliberate, don't "fix" blindly)

1. **Two objective models.** `state.objectives` is the original global list
   (lorem text, 10 entries) and is rendered *only* by the Team Board's "Team
   Objectives" panel. The newer model is per-team (`teams[].objectives`) plus
   ART-level (`state.artObjectives`), and is what the ART Objectives board, the
   page blocks and Sightline read. Numbers between the Team Board panel and
   everything else therefore differ. Pick a model before unifying.
2. **`deps` is empty.** Cross-team dependencies are derived from card links;
   `sampleDeps()` invents rows for page documents. The `deps` array survives
   only because import/export and `setIterationCount()` still prune it.
3. **`objLinkedCards()` is synthetic** (see above) — an objective's links do
   not correspond to any user action.
4. **`context.dates`** is one string reused as the date range on every
   iteration panel header. It is decoration, not a schedule.
5. **`vote`, `sessionTotal`, `connectionTotal`, `org`, `plan`** exist to make
   the dashboard shell look plausible; nothing computes them.

---

## 6. Where state is mutated

Mutations are deliberately spread across the handlers that own each surface;
these are the ones with invariants worth respecting:

| Function | Invariant it maintains |
|---|---|
| `addLink` / `removeLink` | symmetry of `links` on both cards + an activity entry |
| `deleteCard` | strips the deleted id from every other card's `links`, un-pins it, closes the action bar |
| `duplicateCard` | copies without `links` and without `activity` |
| `setPoints` / `setType` / `setStatus` | log to `activityOf(c)` and re-render the note |
| `setIterationCount` | shrinking confirms and deletes out-of-range cards and their deps |
| `finishObjEdit` / `closeObjEditModal` | commit or revert from a pre-edit snapshot; a blank brand-new objective is discarded |
| `reorderObj` / `moveObj` | reorder **within** the committed/uncommitted group, then splice back into `artObjectives` |
| `normalize` | the only place that may invent data |

Every one of them calls `save()` (directly or via `refreshSticky()`).
