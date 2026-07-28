# Pie · Verifying a change

There is no unit-test suite and no framework to render into. The way to know a
change works is to run the app and drive it. This is the recipe that has been
used for the last few features.

---

## 1. Static checks (what CI runs)

From the **repo root**:

```sh
npm install
npm run lint        # htmlhint (.htmlhintrc) + stylelint (.stylelintrc.json)
shopt -s globstar nullglob
for f in **/*.js; do [[ "$f" == node_modules/* ]] || node --check "$f"; done
```

Things these actually catch here:

- `htmlhint` enforces `doctype-first`, `tag-pair`, `id-unique`,
  `spec-char-escape`, `title-require`. It also means **you must not add `?v=`
  query strings to local asset refs** — the deploy pipeline appends them.
- `stylelint` (recommended config, with `no-descending-specificity` and
  `no-duplicate-selectors` off) will flag unknown properties and empty blocks.
- `node --check` is a syntax check only. It will not catch a typo in a
  `data-*` attribute or a renderer that never gets called.

---

## 2. Run it

```sh
npm run dev     # npx serve@14 on :8080, serving the repo root
```

Then open `http://localhost:8080/apps/pie/`.

Useful entry points:

| URL | Lands on |
|---|---|
| `/apps/pie/` | dashboard shell (home) |
| `/apps/pie/#b/team` | Team Board |
| `/apps/pie/#b/objectives` | ART Objectives board (ART context) |
| `/apps/pie/#b/artplan` | a placeholder board |
| `/apps/pie/#p/art-sync` | a page (page plane) |
| `/apps/pie/#s/settings` | PIE Recipe |

To start from clean sample data, clear `localStorage['pie-pi-planning-v1']`
(or use PIE Recipe → Data → Reset).

---

## 3. Driving it with Playwright

Playwright and Chromium are preinstalled in the Claude Code web environment;
the repo has no Playwright dependency and should not gain one. Require it from
the global install:

```js
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
```

(If that path is wrong in your environment, `npm ls -g --depth=0` will show it;
browsers live under `/opt/pw-browsers`. Never run `playwright install`.)

Put throwaway scripts in your scratchpad directory, not in the repo.

### Skeleton

```js
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const URL = 'http://localhost:8080/apps/pie/';

async function boot(browser, hash, viewport) {
  const page = await browser.newPage({ viewport: viewport || { width: 1440, height: 900 } });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.errs = errs;
  await page.goto(URL + (hash || ''), { waitUntil: 'load' });
  await page.waitForTimeout(3500);          // the loading screen holds for 3s
  return page;
}

(async () => {
  const browser = await chromium.launch();
  const p = await boot(browser, '#b/team');

  await p.locator('#sl-fab').click();
  await p.locator('#sl-input').fill('are we over capacity?');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(1700);             // the fake "thinking" delay
  await p.screenshot({ path: '/tmp/.../shot.png' });

  console.log(JSON.stringify({ errs: p.errs }));
  await browser.close();
})();
```

Then **look at the screenshots** — read them back with the Read tool. Layout
regressions (a panel under a floating bar, a chip row colliding with the
version pill) are invisible to assertions and obvious in an image.

### Traps specific to this app

1. **The 3-second loading screen.** Any wait shorter than ~3.5 s screenshots a
   black splash.
2. **Hash-only `goto` does not reload.** `page.goto(URL + '#b/x')` after
   `page.goto(URL + '#b/y')` is a fragment navigation on the same document, and
   Pie has no `hashchange` listener — the app keeps its previous state and your
   assertions silently test the wrong screen. Use a fresh page per scenario (or
   `page.reload()`).
3. **State persists between pages in the same browser context.** `navVersion`,
   `workMode` and any edits are in `localStorage`. Use a new context, or reset
   deliberately, when a scenario depends on defaults.
4. **Elements exist but are blank.** Layers are always in the DOM; renderers
   blank them. Assert on computed style or content, not existence:
   `getComputedStyle(el).display !== 'none'`.
5. **Clicking a rail button for a board the context doesn't own** silently does
   nothing — the rail only lists `boardsFor(ctx.type)`. Switch context first,
   or deep-link to the board.
6. **`renderBoardView()` re-fits the canvas**, so a screenshot taken after any
   navigation shows the board at 100 % fit, not wherever you had panned.

### A state probe worth reusing

```js
const state = (page) => page.evaluate(() => {
  const s = document.getElementById('sightline'), f = document.getElementById('sl-fab');
  return {
    fab: getComputedStyle(f).display !== 'none',
    panel: getComputedStyle(s).display !== 'none',
    cls: document.getElementById('board-screen').className,
    canvasRight: getComputedStyle(document.getElementById('canvas-wrap')).right,
  };
});
```

The `board-screen` class list is the fastest way to assert layout state —
`sl-open`, `convo-open`, `obj-open`, `nav-v3`, `mode-exec` etc. are all there.

---

## 4. A sensible matrix for board-chrome changes

Anything that touches board layout should be checked across:

- **chrome versions** — v1 (default), v3 (`document.querySelector('[data-ver="v3"]').click()`);
- **planes** — a board and a page;
- **contexts** — a team (Team Board) and an ART (ART Objectives, which forces
  the rail right and opens a 474 px left panel);
- **work modes** — Planning and Execution;
- **viewports** — 1440×900 and ~430×860.

That is ~8 screenshots and catches essentially every layout regression this app
has produced so far.

---

## 5. Deploy previews

Every push to a non-`main` branch deploys to
`https://xhevops-claude.github.io/claude-erol/preview/<branch-slug>/`
(slug = branch name with `/`, `_`, space → `-`, lowercased). Deep links work
there too, e.g. `…/preview/<slug>/apps/pie/#b/team`.

The deploy step rewrites relative `.js`/`.css` refs to `?v=<sha>` so a preview
never serves a stale `app.js`. If a preview looks unchanged, check the Deploy
workflow run before suspecting the cache.
