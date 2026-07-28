# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session start — read the docs first

At the start of every session, before writing or changing any code, read the repo docs:

1. `README.md` — repo layout and what each sub-experience is.
2. If the work touches `apps/pie/`, also read `apps/pie/CLAUDE.md` and the deep dives in `apps/pie/docs/` (`architecture.md`, `state-model.md`, `surfaces.md`, `navigation.md`, `sightline.md`, `testing.md`).

Don't skip this because the task looks small — the conventions below assume you have that context.

## Feature completion — document it

Completing a feature includes documenting it; the work isn't done until the docs reflect it. In the same branch/PR as the feature:

- Update `README.md` when the repo layout, tiles, or user-facing behaviour change.
- Update the relevant section of this file when a shell convention or architecture described here changes.
- For `apps/pie/` work, update `apps/pie/CLAUDE.md` and the matching deep dive in `apps/pie/docs/` (add a new doc there if the feature opens a new area).

## Commands

```sh
npm install
npm run dev            # http://localhost:8080  (npx serve@14)
npm run lint           # lint:html + lint:css
npm run lint:html      # htmlhint with .htmlhintrc
npm run lint:css       # stylelint with .stylelintrc.json
```

There is no test runner. CI (`.github/workflows/ci.yml`) additionally runs `node --check` against every `*.js` file outside `node_modules`; reproduce it locally with:

```sh
shopt -s globstar nullglob; for f in **/*.js; do [[ "$f" == node_modules/* ]] || node --check "$f"; done
```

CI runs on pull requests to `main` and on every push to a non-`main` branch.

## Architecture

### Static, no build step

The site is plain HTML/CSS/JS served as files. There is no bundler, no framework, no transpile step — `npm run dev` just statically serves the repo root. Anything that works in a modern browser works in production.

### Shell vs. embedded experiences

The repo is a "shell" home page (`index.html`, `styles.css`, `app.js`, `theme.js`, `themes.css`) that hosts independent sub-experiences in `apps/<slug>/`. Each sub-experience is fully self-contained: its own `index.html`, `styles.css`, `app.js`, no shared imports. The shell embeds them via `<iframe>`. That isolation is load-bearing — do not try to pull a sub-experience's JS/CSS into the shell or vice versa. Current sub-experiences: `apps/pie/` (PI planning) and `apps/school/` (school management — students, teachers, classes, attendance, gradebook, all in `localStorage`).

`apps/pie/` is large enough to carry its own scoped guide: read `apps/pie/CLAUDE.md` (and the deep dives in `apps/pie/docs/`) before working in there.

### Tile registry → grid → iframe morph

`app.js` declares one array at the top: `apps`. Each entry needs `{ slug, name, meta, icon, url }` (or `comingSoon: true` and no `url`). The array drives the rendered grid tiles, the iframe loader, and deep-link resolution. Adding a tile = create `apps/<slug>/` and append one entry to the array.

When a tile is tapped, `openGame` positions `#frame-wrap` over the tapped card's bounding rect with `transform: translate(...) scale(...)`, then transitions to fullscreen. A `.frame-skin` layer paints the card art on top of the loading iframe and crossfades out — `ZOOM_MS` (550ms) is the wrap's size animation, and the skin/frame crossfade is intentionally faster (220ms in CSS) so the morph reads as the card *becoming* the experience. `closeGame` runs the same animation in reverse. If you change the timing in CSS, mirror it in `ZOOM_MS`.

### Single-screen stage

The shell is a single screen: `<main class="stage">` holds one `.page` with the app grid, directly between the top bar and the footer. There used to be a swipeable section pager (Home / Apps / Tools / Games); it was removed when the arcade was pared down to just Pie. If sections ever come back, the pager code lives in git history (`app.js` before the pie-only change).

### Deep linking and embedded close

- The shell pushes `#apps/<slug>/` to history on open and listens for `popstate` to close. The deep-link IIFE at the bottom of `app.js` opens the matching tile if the page loads with such a hash.
- **No exit/quit buttons in apps.** Sub-experiences must not render their own Exit/Quit/"back to arcade" controls — closing is the shell's job: the user presses browser back and the shell's `popstate` handler runs `closeGame()`. Embedded experiences must NOT navigate the parent window either. The shell still listens for a `{ type: 'close-game' }` message and triggers `history.back()`, but that is plumbing for programmatic closes only — no app UI may expose it as a button.
- Each sub-experience adds `embedded` to `<html>` when iframed: `if (window.self !== window.top) document.documentElement.classList.add('embedded');`. CSS uses `.embedded` to hide elements that don't belong inside the shell (e.g. back links).

### Loading screens (mandatory pattern)

Every sub-experience's `index.html` ships an `#app-loading` element painted by an inline `<style>` block in `<head>`, BEFORE any external `<link rel="stylesheet">`. This guarantees a black/branded splash on the very first frame, before `styles.css` resolves. The sub-experience's `app.js` removes it once ready AND at least 3 seconds have elapsed. Don't move this CSS to `styles.css` — the whole point is that it paints before that file loads.

### Theme system

`themes.css` defines five palettes via `[data-theme="..."]` selectors: `noir`, `bone`, `steel`, `jade`, `ember`. `theme.js` reads `localStorage.getItem('arcade-theme')`, falls back to `prefers-color-scheme`, applies `document.documentElement.dataset.theme`, and dispatches a `themechange` CustomEvent. The shell's `index.html` runs an inlined boot script BEFORE `themes.css` loads to set the attribute pre-paint and avoid a flash. Sub-experiences are NOT themed — they ship their own palette. If you add a theme, update both `themes.css` and the `THEMES` array in `theme.js` and the `valid` array in `index.html`'s boot script.

## Deployment

`.github/workflows/pages.yml` deploys every push using `peaceiris/actions-gh-pages` with `keep_files: true`:

| Branch | Path |
|---|---|
| `main` | `/` |
| any other | `/preview/<slug>/` where `<slug>` = branch name with `/`, `_`, ` ` → `-` and lowercased |

So pushing to e.g. `claude/foo-bar` deploys to `https://xhevops-claude.github.io/claude-erol/preview/claude-foo-bar/`. Production and previews coexist on `gh-pages` because of `keep_files: true`.

The `exclude_assets` list in `pages.yml` controls what gets excluded from the deploy. If you add a new top-level dev-only file/dir (lockfiles, configs, docs), append it there.

### Asset cache-busting

Source HTML references local `.js`/`.css` with bare relative paths (`<script src="app.js">`, `<link rel="stylesheet" href="styles.css">`) — no `?v=` query strings in the repo. The "Cache-bust local assets" step in `pages.yml` rewrites every relative `.js`/`.css` ref to append `?v=<short-sha>` before the deploy lands on `gh-pages`. This applies to both production and preview deploys.

Don't add `?v=` query strings manually to source HTML — they'd be redundant with the deploy-time rewrite and would also break the `htmlhint` lint rule. CDN-pinned URLs (`https://unpkg.com/foo@1.2.3/...`) already have version tokens in the path and aren't touched by the rewrite. If you introduce a new local asset type (say, a `.wasm` or a `.json` config that has to bypass cache), extend the `sed` alternation in `pages.yml` accordingly.

### Always end with a clickable preview link

After pushing changes, the final line of every reply must be a clickable Markdown link to the deployed preview, in the form `[Preview](https://xhevops-claude.github.io/claude-erol/preview/<slug>/...)`. No bold, no surrounding `**`, no extra prose on that line — just the link. If the change targets a specific sub-experience, deep-link directly into it (e.g. `.../preview/<slug>/apps/pie/`). If pushed to `main`, link to the corresponding production path under `https://xhevops-claude.github.io/claude-erol/`.

### Branch names — match the work

Branch names should describe what's on the branch. Use the pattern `claude/<short-kebab-descriptor>` (lowercase, dashes, no random suffixes), e.g. `claude/terrain-app`, `claude/locator-cluster-fix`, `claude/cdn-pipeline-retry`. If the work pivots mid-branch (you started on X and ended up shipping Y), rename the branch before opening the PR so the name still tells the truth.

Auto-generated names like `claude/add-claude-documentation-0XFkn` get reused across unrelated work and end up meaning nothing. Don't keep them — rename on first push (`git branch -m`) or, if a PR is already open with a stale name, mention it to the user and offer to migrate.

### Merging to main — always via a PR with green CI

Direct pushes to `main` are blocked. To land changes on production:

1. Open a pull request from the feature branch into `main`.
2. Wait for CI on the PR to go green — the single `lint` job in `.github/workflows/ci.yml` (its steps run `node --check`, htmlhint, and stylelint) plus the preview deploy in `pages.yml`. Inspect any failures and fix them before merging; do not merge a PR with a red or pending check unless the user explicitly tells you to override.
3. Only then merge the PR (default to a normal merge commit so the feature-branch history stays inspectable; squash if the user asks).

This applies even when the user just says "merge it" — the PR + green-checks loop is the merge mechanism, not an extra step.

## Conventions worth preserving

- `escapeHTML` in `app.js` is used for any user-supplied or registry-supplied string interpolated into innerHTML. Anything that ends up in `cardHtml`/`cardInner` MUST go through it.
- Prefer adding `comingSoon: true` (with no `url`) over removing entries — the shell renders these as locked tiles with a shake animation on tap.
- Tile colors come from CSS variables `--tile-<slug>` defined in `themes.css` — these are constant across themes so each card keeps its identity. When adding a tile, add both the `--tile-<newslug>` variable in `themes.css` and the `.card[data-tile="<newslug>"] { --g1: ... }` mapping in `styles.css`.
- Don't introduce a build tool, package, or framework just to add one feature. The "no build step" property is what makes preview deploys, deep links, and the static CDN model work.
