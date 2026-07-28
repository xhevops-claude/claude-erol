# claude-erol

[![CI](https://github.com/xhevops-claude/claude-erol/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/xhevops-claude/claude-erol/actions/workflows/ci.yml)
[![Deploy](https://github.com/xhevops-claude/claude-erol/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/xhevops-claude/claude-erol/actions/workflows/pages.yml)
[![Live](https://img.shields.io/badge/live-arcade-22d3ee?style=flat&labelColor=18181b)](https://xhevops-claude.github.io/claude-erol/)

A static shell that hosts self-contained apps: **Pie** (PI planning) and **School** (school management). The first screen shows the app tiles; tap one and the card morphs into the app, tap back and the app morphs back into the card. Deployed to GitHub Pages.

**Live**: https://xhevops-claude.github.io/claude-erol/

## Layout

```
.
├── index.html              Shell (home page)
├── styles.css              Shell layout + iframe morph
├── app.js                  Shell logic — tile rendering, open/close animation
├── theme.js                Theme picker (shell only)
├── themes.css              Theme variables (shell only)
└── apps/
    ├── pie/                Self-contained PI-planning app
    │   ├── index.html
    │   ├── styles.css
    │   ├── app.js
    │   ├── CLAUDE.md       Scoped guide for working on Pie
    │   └── docs/           Deep dives (architecture, state model, …)
    └── school/             Self-contained school-management app
        ├── index.html
        ├── styles.css
        └── app.js
```

Each embedded app is fully self-contained: it links no shared CSS or JS and ships its own palette. The shell embeds it via an `<iframe>`. The theme picker on the home page only affects the home page.

## Adding a new app

1. Create `apps/<slug>/` with its own `index.html`, `styles.css`, `app.js`.
2. Append an entry to the `apps` array in `app.js`:
   ```js
   {
     slug: 'pong',
     name: 'Pong',
     meta: 'Classic',
     icon: '🏓',
     url: 'apps/pong/',
   }
   ```
3. (Optional) Mark it `comingSoon: true` and omit `url` to render the tile as a non-clickable "Coming soon" card.
4. Add a `--tile-<slug>` color in `themes.css` and a matching `.card[data-tile="<slug>"]` rule in `styles.css` so the card keeps its identity color across themes.
5. Do **not** add an Exit/Quit button inside the app — closing is the shell's job (browser back closes the embedded app via the shell's `popstate` handler).

## App loading screen

Each embedded app's `index.html` includes a critical inline `<style>` block plus a loading element (`#app-loading`) so a branded splash paints on the very first frame, before any external stylesheet loads. The app's `app.js` removes it once the app is ready and at least 3 seconds have elapsed.

## Open / close animation

The iframe is wrapped in `#frame-wrap`. On open, the wrap is positioned at the tapped tile's bounding rect with `transform: translate(...) scale(...)`, then transitioned to fullscreen. A `.frame-skin` layer carries the tile's color + icon + name so the wrap visually reads as the card at the small end. The skin and iframe crossfade in 220ms — faster than the wrap's 550ms size animation — so the user sees the card design morph into the app smoothly. Close runs the same animation in reverse.

## Local development

```sh
npm install
npm run dev      # http://localhost:8080
```

## Linting

CI runs on every PR to `main` and every push to a non-`main` branch (`.github/workflows/ci.yml`):

- JS syntax check via `node --check` for every `.js` file
- HTML linting via [`htmlhint`](https://htmlhint.com/) using `.htmlhintrc`
- CSS linting via [`stylelint`](https://stylelint.io/) using `.stylelintrc.json`

Run them locally:

```sh
npm run lint            # all of the below
npm run lint:html
npm run lint:css
```

## Deployment

`.github/workflows/pages.yml` deploys every push:

| Branch | Path on Pages | URL |
|---|---|---|
| `main` | `/` (root) | `https://xhevops-claude.github.io/claude-erol/` |
| any other | `/preview/<slug>/<short-sha>/` | `https://xhevops-claude.github.io/claude-erol/preview/<slug>/<short-sha>/` |

`<slug>` is the branch name lowercased with `/`, `_`, and spaces turned into `-`, and `<short-sha>` is the first 7 characters of the pushed commit. So pushing commit `abc1234` on `claude/foo-bar` deploys to `…/preview/claude-foo-bar/abc1234/`. Each push gets its own preview route, so preview URLs are immutable and never affected by browser caching.

The workflow uses [`peaceiris/actions-gh-pages`](https://github.com/peaceiris/actions-gh-pages) to publish to the `gh-pages` branch with `keep_files: true`, so production and previews coexist without overwriting each other.

Local `.js`/`.css` references are rewritten at deploy time to `?v=<short-sha>` (this matters for production, whose path never changes); previews additionally live under a unique per-commit route, so nothing about a preview deploy can be hidden by a stale browser cache.

### One-time setup

GitHub Pages must be configured to serve from the `gh-pages` branch. Go to **Settings → Pages → Build and deployment**:

- **Source**: *Deploy from a branch*
- **Branch**: `gh-pages` / `(root)`

The first push after this PR merges will create the `gh-pages` branch automatically.

### Cleaning up old previews

Preview folders accumulate on `gh-pages` over time — one per pushed commit, under `/preview/<slug>/`. To remove stale previews, just delete the folders (or a whole branch's `/preview/<slug>/` directory) on the `gh-pages` branch (e.g. via the GitHub web UI) and the URLs stop resolving on the next deploy.

## Themes

`themes.css` defines variables per `[data-theme="..."]`:
- `noir` (default dark), `bone` (light), `steel`, `jade`, `ember`

`theme.js` reads `localStorage.getItem('arcade-theme')` and wires the swatch buttons. The choice persists. Embedded apps never read this — they ship their own palette.
