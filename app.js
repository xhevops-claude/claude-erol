(function () {
  const apps = [
    {
      slug: 'pie',
      name: 'Pie',
      meta: 'Planning',
      icon: '🥧',
      url: 'apps/pie/',
    },
    {
      slug: 'school',
      name: 'School',
      meta: 'Management',
      icon: '🏫',
      url: 'apps/school/',
    },
  ];

  // The morph + deep-link plumbing looks tiles up by url.
  const tiles = apps;

  const appsGrid = document.getElementById('apps-grid');
  const overlay = document.getElementById('game-overlay');
  const wrap = document.getElementById('frame-wrap');
  const frame = document.getElementById('game-frame');
  const skin = document.getElementById('frame-skin');
  const skinIcon = document.getElementById('skin-icon');
  const skinTitle = document.getElementById('skin-title');
  const skinTagline = document.getElementById('skin-tagline');
  const appsMeta = document.getElementById('apps-meta');
  const footMeta = document.getElementById('foot-meta');

  // Match the CSS transitions on .frame-wrap.
  const ZOOM_MS = 550;
  // Card border-radius applied at the small end of the morph.
  const CARD_RADIUS = 0;

  let lastCard = null;
  let lastCardRect = null;
  let lastGame = null;

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function cardInner(g) {
    return `
      <div class="card-art">
        <span class="card-icon" aria-hidden="true">${escapeHTML(g.icon)}</span>
      </div>
      <div class="card-body">
        <h2 class="card-title">${escapeHTML(g.name)}</h2>
        <p class="card-meta">${escapeHTML(g.meta)}</p>
      </div>
    `;
  }

  function cardHtml(g) {
    if (g.comingSoon) {
      return `
        <li class="card locked" data-tile="${escapeHTML(g.slug)}" data-locked="1">
          ${cardInner(g)}
        </li>
      `;
    }
    return `
      <li class="card" data-tile="${escapeHTML(g.slug)}" data-url="${escapeHTML(g.url)}">
        <a href="${escapeHTML(g.url)}">
          ${cardInner(g)}
        </a>
      </li>
    `;
  }

  function renderTiles(gridEl, items, metaEl) {
    if (!gridEl) return;
    gridEl.innerHTML = items.map(cardHtml).join('');
    if (metaEl) {
      const total = items.length;
      const ready = items.filter((g) => !g.comingSoon).length;
      metaEl.textContent = `${ready} / ${total}`;
    }
  }

  function render() {
    renderTiles(appsGrid, apps, appsMeta);
    if (footMeta) {
      const totalReady = tiles.filter((t) => !t.comingSoon).length;
      footMeta.textContent = `${totalReady} ${totalReady === 1 ? 'app' : 'apps'}`;
    }
  }

  function rectFromCard(card) {
    if (card) {
      const r = card.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    }
    const w = Math.min(180, window.innerWidth - 32);
    const h = w * 1.3;
    return {
      left: (window.innerWidth - w) / 2,
      top: (window.innerHeight - h) / 2,
      width: w,
      height: h,
    };
  }

  function transformForRect(rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return `translate(${rect.left}px, ${rect.top}px)`
         + ` scale(${rect.width / vw}, ${rect.height / vh})`;
  }

  function applySkinFromCard(card, game) {
    if (card) {
      const cs = getComputedStyle(card);
      const g1 = cs.getPropertyValue('--g1').trim();
      if (g1) skin.style.setProperty('--g1', g1);
    }
    skinIcon.textContent = game.icon;
    skinTitle.textContent = game.name;
    skinTagline.textContent = game.meta || '';
  }

  function nextFrame(fn) {
    requestAnimationFrame(() => requestAnimationFrame(fn));
  }

  function openGame(card, game) {
    if (overlay.dataset.state) return;

    const rect = rectFromCard(card);
    lastCard = card || null;
    lastCardRect = rect;
    lastGame = game;

    applySkinFromCard(card, game);

    overlay.hidden = false;
    overlay.dataset.state = 'open';

    wrap.style.transition = 'none';
    wrap.style.transformOrigin = '0 0';
    wrap.style.transform = transformForRect(rect);
    wrap.style.borderRadius = CARD_RADIUS + 'px';
    wrap.style.pointerEvents = 'none';

    skin.classList.add('visible');
    frame.classList.remove('visible');
    frame.src = game.url;

    void wrap.offsetWidth;

    nextFrame(() => {
      wrap.style.transition = '';
      wrap.style.transform = 'translate(0, 0) scale(1, 1)';
      wrap.style.borderRadius = '0';
      skin.classList.remove('visible');
      frame.classList.add('visible');
    });

    setTimeout(() => { wrap.style.pointerEvents = ''; }, ZOOM_MS + 40);

    try { history.pushState({ gameOpen: true }, '', '#' + game.url); } catch (_) {}
  }

  function closeGame() {
    if (overlay.dataset.state !== 'open') return;
    overlay.dataset.state = 'shrinking';

    let rect;
    if (lastCard && document.contains(lastCard)) {
      rect = rectFromCard(lastCard);
    } else if (lastCardRect) {
      rect = lastCardRect;
    } else {
      rect = rectFromCard(null);
    }
    lastCardRect = rect;

    if (lastGame) applySkinFromCard(lastCard, lastGame);

    wrap.style.pointerEvents = 'none';
    wrap.style.transition = 'none';
    wrap.style.transformOrigin = '0 0';
    void wrap.offsetWidth;

    nextFrame(() => {
      wrap.style.transition = '';
      wrap.style.transform = transformForRect(rect);
      wrap.style.borderRadius = CARD_RADIUS + 'px';
      skin.classList.add('visible');
      frame.classList.remove('visible');
    });

    setTimeout(finalizeClose, ZOOM_MS + 40);
  }

  function finalizeClose() {
    overlay.hidden = true;
    overlay.removeAttribute('data-state');
    frame.onload = null;
    frame.src = 'about:blank';
    frame.classList.remove('visible');
    skin.classList.remove('visible');
    wrap.style.transition = 'none';
    wrap.style.transform = '';
    wrap.style.transformOrigin = '';
    wrap.style.borderRadius = '';
    wrap.style.pointerEvents = '';
    lastCard = null;
    lastCardRect = null;
    lastGame = null;
  }

  function onGridClick(e) {
    const card = e.target.closest('.card');
    if (!card) return;

    if (card.dataset.locked === '1') {
      e.preventDefault();
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
      return;
    }

    const url = card.dataset.url;
    if (!url) return;
    const tile = tiles.find((t) => t.url === url);
    if (!tile) return;
    e.preventDefault();
    card.classList.add('tapped');
    setTimeout(() => { card.classList.remove('tapped'); }, 240);
    setTimeout(() => { openGame(card, tile); }, 90);
  }

  if (appsGrid) appsGrid.addEventListener('click', onGridClick);

  window.addEventListener('popstate', () => {
    if (overlay.dataset.state === 'open') {
      closeGame();
      if (location.hash) {
        history.replaceState(null, '', location.pathname + location.search);
      }
    }
  });

  // Allow embedded games to request close (their Quit button posts this).
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'close-game') {
      if (history.state && history.state.gameOpen) history.back();
      else closeGame();
    }
  });

  render();

  // Deep link: opening /#apps/<slug>/ goes straight into the tile.
  (function deepLink() {
    const hash = decodeURIComponent(location.hash.slice(1));
    if (!hash) return;
    const tile = tiles.find((t) => t.url === hash && !t.comingSoon);
    if (tile) {
      history.replaceState(null, '', location.pathname + location.search);
      openGame(null, tile);
    }
  })();
})();
