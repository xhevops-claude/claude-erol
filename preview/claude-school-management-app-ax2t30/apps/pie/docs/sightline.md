# Pie · Sightline (AI board assistant)

Sightline is the floating **AI chat for whatever board you are on**: a pill at
the bottom-right of the whiteboard that opens a right-hand side panel.

It is honest about what it is. There is **no model and no network call** — every
answer is computed from the plan in `localStorage`, and the panel footer says
so. `slAnswer()` is the single seam where a real completion would be plugged in
(§7).

All of it lives under the `// ---------- Sightline ----------` banner in
`app.js` (~430 lines) plus one CSS section in `styles.css` and two elements in
`index.html`.

---

## 1. Where it appears — and where it must not

```js
const slBoardPlane = () => !boardScreen.hidden && mode === 'board';
```

`renderSightline()` returns early and blanks both elements unless that is true.
So the button and panel exist on **boards only**:

| Screen | Button | Panel |
|---|---|---|
| Dashboard shell (home, sessions, settings…) | no | no |
| Board plane (any board, any chrome version) | yes | on demand |
| Page plane (Breakdown page, ART Sync, reports…) | no | no |
| Hub / palette / modal open | covered by the overlay (z-index) | — |

The rule is enforced in JS, not CSS, so a stale `sl-open` class can never leak
the panel onto a page.

---

## 2. DOM and state

```html
<aside class="sightline" id="sightline" aria-label="Sightline assistant" hidden></aside>
<button class="sl-fab" id="sl-fab" type="button" aria-label="Open Sightline" hidden></button>
```

| Variable | Meaning |
|---|---|
| `slOpen` | panel open? (runtime only — a reload starts closed) |
| `slMsgs` | `[{ role: 'you' \| 'ai', html }]` — the transcript, runtime only |
| `slThinking` | typing indicator showing (also blocks re-entrant sends) |
| `slDraft` | composer text, preserved across re-renders |
| `slSeenCtx` | the `board\|context\|workMode` key the last greeting was written for |
| `slTimer` | pending "reply" timeout |

Nothing Sightline holds is persisted. That is deliberate: a chat log is not
plan data, and `state` is exported to JSON.

---

## 3. Panel anatomy

`renderSightline()` rebuilds the whole panel each time (like every other layer):

1. **Header** — mark, "Sightline / AI assistant · reads this board", new-chat
   reset (`data-sl-reset`), close (`data-sl-close`).
2. **Context chips** — board name, working context, Planning/Execution. This is
   the honesty surface: it shows exactly what the assistant can see.
3. **Body** (`#sl-body`) — messages; assistant messages get the spark avatar and
   a light bubble, user messages a dark right-aligned bubble. Auto-scrolls to
   the bottom after every render.
4. **Suggestion chips** — contextual starters, rendered only once the
   conversation has started (the greeting already offers three).
5. **Composer** — auto-growing `<textarea>` (max 108 px), Enter sends,
   Shift+Enter newlines, plus the "nothing is sent anywhere" note.

Re-render safety: the draft is restored from `slDraft`, and focus + caret are
restored if the textarea was focused before the repaint.

**Greeting** (`slGreet()`): the first open writes a full introduction plus three
starter chips. Afterwards, whenever the board / context / work mode changes
while the panel is open, it appends a one-line "You moved to X — I'm reading
that board now" so the user can see the assistant's scope follow them.

---

## 4. Formatting helpers

Answers are HTML strings assembled from small builders. All of them escape
first, then apply markup — never the other way round.

| Helper | Output |
|---|---|
| `slInline(s)` | `esc(s)` then `*emphasis*` → `<b>` |
| `slP(t)` | `<p class="sl-p">` |
| `slGrp(t)` | small uppercase group label |
| `slList(items)` | `<ul class="sl-ul">` |
| `slStats(pairs)` | 2×N tile grid (`[label, value]`) |
| `slActs(list)` | chip row: `{ ask }` re-asks a question, `{ go }` navigates |

Action chips (`data-sl-go`) understand three targets:

| Value | Effect |
|---|---|
| `board:<boardId>` | `gotoBoard()` — jumps, adopting the owning context |
| `team:<teamId>` | `setCtx('team', id)` — switch working context |
| `convo` | hands off to the board conversation panel (closes Sightline) |

There is deliberately **no `page:` target**: pages are off the board plane, so
following one would close the assistant.

---

## 5. What it can see

| Helper | Returns |
|---|---|
| `slScope()` | `{ teams, ids, cards }` for the current context |
| `slIterRows()` | per iteration: cards, load, capacity, % utilisation |
| `slTeamRows()` | per team: cards, load, capacity (`capacity × sprints`), %, objective counts |
| `slCrossLinks()` | de-duplicated card pairs whose teams differ |
| `slPts`, `slPct`, `slPlural`, `slTeamName` | small formatting/aggregation utilities |

These read `state` directly and respect `ctx`, so the same question gives a
team-level answer in a team context and an ART-level answer in an ART context.

---

## 6. Intents

`slAnswer(q)` lowercases the question and matches keyword sets **in order** —
first match wins:

| # | Trigger words | Answer |
|---|---|---|
| 1 | help, what can you, who are you, what do you | `slHelpAnswer()` — capability list |
| 2 | a team name **+** capacity/load/over/room/busy/how is/how are/tell me about | `slTeamAnswer(t)` |
| 3 | capacity, load, overload, utilis(e/ation), balance, room, iteration, sprint | `slCapacityAnswer()` |
| 4 | risk, roam, blocked, blocker, impedim(ent) | `slRiskAnswer()` |
| 5 | objective, okr, business value, bv, commit | `slObjAnswer()` |
| 6 | depend, cross-team, hand-off, handoff, link | `slDepAnswer()` |
| 7 | split, estimate, points, biggest, heavy, too big, sizing | `slSplitAnswer()` |
| 8 | progress, done, on track, burndown, execution, actual | `slProgressAnswer()` |
| 9 | readout, summarise/summarize, draft, write, report, standup, update | `slReadoutAnswer()` |
| 10 | conversation, comment, thread, unanswered, discuss, said, saying, talk, chat | `slConvoAnswer()` |
| 11 | a team name alone | `slTeamAnswer(t)` |
| 12 | — | `slOverview(q)` — the board as it reads, plus starters |

What each answer actually says:

- **Capacity** — total load vs capacity for the context, a per-iteration table
  with over-capacity flags, and a concrete suggestion (which iteration to move
  work into, or which slot is tightest).
- **Team** — that team's points, capacity, done count, cross-team links,
  heaviest iteration, objective count, with chips to work as that team.
- **Risk** — every risk with its ROAM label, how many are still unROAMed, and
  what that implies before the confidence vote.
- **Objectives** — ART objectives with BV (and RAG + AV in execution mode), or
  the context's team objectives with committed/uncommitted BV split; names the
  teams with no objectives yet.
- **Dependencies** — count of cross-team links, busiest team pairs, three real
  examples by sticky title.
- **Split** — stickies at 13+ points, unestimated stickies, and which iteration
  splitting would rescue.
- **Progress** — done/doing/todo counts and points, the three iterations with
  the most work left, and a nudge about Planning vs Execution mode.
- **Readout** — a paragraph-form draft plan readout for the current context.
- **Conversations** — board threads, which have no reply, with a hand-off chip.

### Adding an intent

1. Write `slXAnswer()` returning an HTML string from the builders in §4.
2. Add one line to `slAnswer()` — order matters; put specific before general.
3. If it deserves a starter chip, add it to `SL_SUGG` (keyed by board id, with
   a generic fallback) — `slSuggestions()` always appends "What am I looking
   at?".

---

## 7. Wiring a real model

Replace `slAnswer(q)` with a call to your completion endpoint. Everything else
already fits:

- **The transcript** is `slMsgs` — map it to your messages array.
- **The context** you would send is exactly what §5's helpers compute; send
  those aggregates rather than raw `state`, and keep the board/context/mode
  chips truthful.
- **Async is already modelled**: `slSend()` sets `slThinking`, renders the
  typing indicator, and pushes the answer when the timeout fires. Swap the
  `setTimeout` for your `await` and keep the two `renderSightline()` calls.
- **Escaping is not optional.** Model output must not be inserted as raw HTML.
  Either run it through `slInline()` (which escapes, then allows `*emphasis*`),
  or render a strict subset. The current builders are safe by construction —
  keep it that way.
- **Then update the footer note and the header subtitle.** "Nothing is sent
  anywhere" becomes false the moment a request leaves the tab; that line and
  the "reads this board" subtitle are load-bearing honesty, not decoration.

---

## 8. Layout integration

CSS lives under `/* ---------- Sightline: floating AI assistant (boards only)
---------- */` at the end of `styles.css`.

- Button: `.sl-fab`, absolute, `right: 16px; bottom: 76px`, z-index 41 — clears
  the v1/v2 zoom control below it and the right-hand rail beside it. Hidden
  while the panel is open (`slFab.hidden = slOpen`).
- Panel: `.board-screen.sl-open .sightline`, 384 px, z-index 36, `top: 56px`
  (v1/v2) or `50px` (v3, under the dock).
- The `sl-open` class insets `canvas-wrap` (384 px), shifts `zoomctl`
  (402 px) and the right-hand rail (400 px), and re-centres the v3 tools bar.
- Under 700 px the panel goes full width, the canvas inset is dropped, and the
  rail / zoom / tools bar are hidden so they can't sit on top of it. The FAB
  collapses to an icon.
- **Mutual exclusion:** Sightline and the conversation panel both live on the
  right edge. `slToggle(true)` clears `convoOpen`; every site that opens the
  conversation panel (v1 button, dock, tools bar, palette action) clears
  `slOpen`. Adding a third right-hand panel means extending that rule.

Keyboard: Escape closes the panel (its rung sits below the sticky action bar
and above pin focus). ⌘K → *Ask Sightline about this board* opens it from the
palette.

---

## 9. Verified behaviour

Checked in Chromium via Playwright (see `testing.md`), no console errors in any
scenario:

- absent on the dashboard shell and on the page plane; present on every board;
- opens/closes from the FAB, the header ✕, Escape and the palette action;
- canvas, zoom control, right rail and v3 tools bar reflow around it in v1, v2
  and v3 chrome, and at a 430 px viewport;
- opening it closes the conversation panel and vice versa;
- suggestion chips, free-text questions, board-jump chips, the conversation
  hand-off chip and the new-chat reset all behave;
- answers match what the board shows (objective counts, capacity, risks) — with
  the one documented exception of the Team Board's legacy objectives panel
  (`state-model.md` §5).
