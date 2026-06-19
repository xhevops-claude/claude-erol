(function () {
  'use strict';

  const STORE_KEY = 'pie-pi-planning-v1';
  const KINDS = ['story', 'feature', 'enabler', 'milestone'];
  // Default card-type palette mirrors the CSS :root fallbacks.
  const KIND_DEFAULTS = {
    story: { label: 'Story', color: '#38bdf8' },
    feature: { label: 'Feature', color: '#a78bfa' },
    enabler: { label: 'Enabler', color: '#fbbf24' },
    milestone: { label: 'Milestone', color: '#fb7185' },
  };
  const ROAM = [
    { cat: 'U', label: 'Unassigned' },
    { cat: 'R', label: 'Resolved' },
    { cat: 'O', label: 'Owned' },
    { cat: 'A', label: 'Accepted' },
    { cat: 'M', label: 'Mitigated' },
  ];

  // ---------- DOM ----------
  const loading = document.getElementById('app-loading');
  const shell = document.getElementById('shell');
  const sideEl = document.getElementById('side');
  const mainEl = document.getElementById('main');
  const boardScreen = document.getElementById('board-screen');
  const grid = document.getElementById('grid');
  const boardContent = document.getElementById('board-content');
  const boardScroll = document.getElementById('board-scroll');
  const svg = document.getElementById('dep-svg');
  const linkHint = document.getElementById('link-hint');
  const piName = document.getElementById('pi-name');
  const roamEl = document.getElementById('roam');
  const riskInput = document.getElementById('risk-input');
  const riskCount = document.getElementById('risk-count');
  const cfButtons = document.getElementById('cf-buttons');
  const cfResult = document.getElementById('cf-result');

  // ---------- State ----------
  let state = load() || sampleState();
  let linkSrc = null;          // card id we are linking FROM
  let drag = null;             // active drag context

  function uid() { return Math.random().toString(36).slice(2, 9); }

  function sampleState() {
    const t = (name, capacity) => ({ id: uid(), name, capacity });
    const teams = [t('Falcon', 26), t('Otter', 22), t('Nimbus', 30)];
    const sprints = ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'IP'];
    const C = (teamIdx, sprintIdx, title, points, kind) => ({
      id: uid(), teamId: teams[teamIdx].id, sprintIdx, title, points, kind,
    });
    const cards = [
      C(0, 0, 'Auth service spike', 5, 'enabler'),
      C(0, 0, 'Login screen', 8, 'story'),
      C(0, 1, 'SSO integration', 13, 'feature'),
      C(0, 3, 'Beta launch', 0, 'milestone'),
      C(1, 0, 'Billing API', 8, 'feature'),
      C(1, 1, 'Invoice PDF export', 5, 'story'),
      C(1, 2, 'Dunning emails', 5, 'story'),
      C(2, 0, 'Event pipeline', 13, 'enabler'),
      C(2, 1, 'Usage dashboard', 8, 'feature'),
      C(2, 2, 'Alerts v1', 5, 'story'),
    ];
    const deps = [
      { id: uid(), from: cards[4].id, to: cards[1].id }, // billing needs login
      { id: uid(), from: cards[8].id, to: cards[7].id }, // dashboard needs pipeline
    ];
    return normalize({
      piName: 'PI 2026.Q3',
      teams, sprints, cards, deps,
      risks: [
        { id: uid(), text: 'Third-party SSO vendor SLA unclear', cat: 'O' },
        { id: uid(), text: 'Data migration window may slip', cat: 'A' },
      ],
      vote: null,
    });
  }

  // Fill in fields added after v1 so older saved plans keep working.
  function normalize(s) {
    s.piName = s.piName || 'PI Planning';
    s.user = s.user || {};
    s.user.name = s.user.name || 'Erol Nas';
    s.user.role = s.user.role || 'Release Train Engineer';
    s.artName = s.artName || 'Acme ART';
    s.iterationWeeks = s.iterationWeeks || 2;
    s.defaultCapacity = s.defaultCapacity || 20;
    s.accent = s.accent || '#f59e0b';
    s.kinds = s.kinds || {};
    KINDS.forEach((k) => {
      s.kinds[k] = Object.assign({}, KIND_DEFAULTS[k], s.kinds[k]);
    });
    // Shell / dashboard data (illustrative — distinct from the reference app)
    s.plan = Object.assign({ name: 'Team', teamLimit: 60, renews: '92d' }, s.plan);
    s.org = Object.assign({ arts: 3, users: 42 }, s.org);
    if (!Array.isArray(s.sessions)) {
      s.sessions = [
        { id: uid(), name: 'PI 2026.Q3 — Core Platform', updated: '2h ago', live: true },
        { id: uid(), name: 'PI 2026.Q2 — Mobile ART', updated: '3d ago' },
        { id: uid(), name: 'Hardening & launch review', updated: '5d ago' },
        { id: uid(), name: 'PI 2026.Q1 — Payments', updated: '2w ago' },
      ];
      s.sessionTotal = 12;
    }
    if (!Array.isArray(s.connections)) {
      s.connections = [
        { id: uid(), name: 'platform-jira', type: 'Jira', ok: true },
        { id: uid(), name: 'Mobile delivery board', type: 'Azure DevOps', ok: true },
        { id: uid(), name: 'Payments RTC', type: 'Rally', ok: true },
        { id: uid(), name: 'Insights GitLab', type: 'GitLab', ok: false },
      ];
      s.connectionTotal = 7;
    }
    if (!Array.isArray(s.events)) {
      s.events = [
        { id: uid(), text: 'Synced 38 features from platform-jira', source: 'platform-jira', ago: '2h', ok: true },
        { id: uid(), text: 'Capacity recalculated for Core Platform', source: 'system', ago: '5h', ok: true },
        { id: uid(), text: 'Webhook delivered: PI objective updated', source: 'Mobile delivery board', ago: '1d', ok: true },
        { id: uid(), text: 'Sync failed: rate limit on Insights GitLab', source: 'Insights GitLab', ago: '1d', ok: false },
        { id: uid(), text: '12 stories imported into Payments', source: 'Payments RTC', ago: '2d', ok: true },
        { id: uid(), text: 'Connection check failed: auth token expired', source: 'Insights GitLab', ago: '2d', ok: false },
      ];
    }
    return s;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !Array.isArray(s.teams) || !Array.isArray(s.sprints)) return null;
      s.cards = s.cards || []; s.deps = s.deps || []; s.risks = s.risks || [];
      return normalize(s);
    } catch (_) { return null; }
  }

  let saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (_) {}
    }, 150);
  }

  // ---------- Helpers ----------
  function el(tag, attrs, kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    }
    if (kids) (Array.isArray(kids) ? kids : [kids]).forEach((c) => {
      if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }
  const team = (id) => state.teams.find((t) => t.id === id);
  const card = (id) => state.cards.find((c) => c.id === id);
  const cellCards = (teamId, s) => state.cards.filter((c) => c.teamId === teamId && c.sprintIdx === s);

  // ---------- Board render ----------
  function renderBoard() {
    grid.style.setProperty('--sprints', state.sprints.length);
    grid.innerHTML = '';

    // corner
    grid.appendChild(el('div', { class: 'hcell corner' }, [
      el('div', { class: 'ct', text: 'Teams' }),
      el('div', { class: 'cs', text: state.teams.length + ' teams · ' + state.sprints.length + ' iterations' }),
    ]));

    // sprint headers
    state.sprints.forEach((name, s) => {
      const committed = state.cards
        .filter((c) => c.sprintIdx === s)
        .reduce((a, c) => a + (Number(c.points) || 0), 0);
      const nameEl = el('span', { class: 'sprint-name', contenteditable: 'true', spellcheck: 'false', text: name });
      nameEl.addEventListener('blur', () => { state.sprints[s] = nameEl.textContent.trim() || ('Sprint ' + (s + 1)); save(); });
      nameEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); } });
      grid.appendChild(el('div', { class: 'hcell' }, [
        el('div', { class: 'h-top' }, [
          nameEl,
          el('button', { class: 'x-del', title: 'Remove iteration', type: 'button',
            onclick: () => removeSprint(s) }, '×'),
        ]),
        el('div', { class: 'sprint-sub', text: committed + ' pts committed' }),
      ]));
    });

    // rows
    state.teams.forEach((tm, ti) => {
      const nameEl = el('span', { class: 'team-name', contenteditable: 'true', spellcheck: 'false', text: tm.name });
      nameEl.addEventListener('blur', () => { tm.name = nameEl.textContent.trim() || 'Team'; save(); });
      nameEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); } });

      const capIn = el('input', { type: 'number', min: '0', value: tm.capacity, 'aria-label': 'capacity' });
      capIn.addEventListener('change', () => { tm.capacity = Math.max(0, Number(capIn.value) || 0); save(); renderBoard(); });

      grid.appendChild(el('div', { class: 'team-cell' }, [
        el('div', { class: 't-top' }, [
          nameEl,
          el('button', { class: 'x-del', title: 'Remove team', type: 'button', onclick: () => removeTeam(tm.id) }, '×'),
        ]),
        el('div', { class: 'cap-row' }, [capIn, el('span', { text: 'pts / sprint' })]),
      ]));

      state.sprints.forEach((_, s) => {
        const cell = el('div', { class: 'cell' + (ti % 2 ? ' alt' : '') });
        cell.dataset.team = tm.id; cell.dataset.sprint = s;
        const cards = cellCards(tm.id, s);
        cards.forEach((c) => cell.appendChild(renderCard(c)));

        const load = cards.reduce((a, c) => a + (Number(c.points) || 0), 0);
        const cap = Number(tm.capacity) || 0;
        const over = cap > 0 && load > cap;
        const pct = cap > 0 ? Math.min(100, (load / cap) * 100) : (load > 0 ? 100 : 0);
        cell.appendChild(el('button', { class: 'add-card', title: 'Add card', type: 'button',
          onclick: () => addCard(tm.id, s) }, '+'));
        cell.appendChild(el('div', { class: 'load' + (over ? ' over' : '') }, [
          el('div', { class: 'bar' }, el('div', { class: 'fill', style: 'width:' + pct + '%' })),
          el('span', { class: 'lab', text: load + (cap ? '/' + cap : '') }),
        ]));
        grid.appendChild(cell);
      });
    });

    drawDeps();
  }

  function renderCard(c) {
    const kc = 'var(--' + c.kind + ')';
    const node = el('div', { class: 'card', style: '--kc:' + kc });
    node.dataset.card = c.id;
    if (linkSrc === c.id) node.classList.add('link-src');

    const dot = el('button', { class: 'dot', title: 'Type: ' + (state.kinds[c.kind] || {}).label + ' — click to change', type: 'button' });
    dot.addEventListener('click', (e) => { e.stopPropagation(); cycleKind(c.id); });

    const title = el('span', { class: 'title', contenteditable: 'true', spellcheck: 'false', text: c.title });
    title.addEventListener('blur', () => { c.title = title.textContent.trim() || 'Untitled'; save(); });
    title.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); title.blur(); }
      e.stopPropagation();
    });
    title.addEventListener('pointerdown', (e) => e.stopPropagation());

    const pts = el('input', { class: 'pts', type: 'number', min: '0', value: c.points, 'aria-label': 'points' });
    pts.addEventListener('change', () => { c.points = Math.max(0, Number(pts.value) || 0); save(); renderBoard(); });
    pts.addEventListener('pointerdown', (e) => e.stopPropagation());

    const nDeps = state.deps.filter((d) => d.from === c.id || d.to === c.id).length;
    const foot = el('div', { class: 'c-foot' }, [
      pts, el('span', { class: 'pts-unit', text: 'pts' }),
      el('span', { class: 'spacer' }),
      nDeps ? el('span', { class: 'dep-badge', title: nDeps + ' dependencies', text: '⤳ ' + nDeps }) : null,
      el('button', { class: 'ico-btn c-link', title: 'Link dependency', type: 'button' }, '🔗'),
      el('button', { class: 'ico-btn c-del', title: 'Delete card', type: 'button' }, '🗑'),
    ]);
    foot.querySelector('.c-link').addEventListener('click', (e) => { e.stopPropagation(); startLink(c.id); });
    foot.querySelector('.c-del').addEventListener('click', (e) => { e.stopPropagation(); deleteCard(c.id); });

    node.appendChild(el('div', { class: 'c-head' }, [dot, title]));
    node.appendChild(foot);

    node.addEventListener('pointerdown', (e) => onCardPointerDown(e, c.id));
    return node;
  }

  // ---------- Mutations ----------
  function addCard(teamId, s) {
    const c = { id: uid(), teamId, sprintIdx: s, title: 'New story', points: 3, kind: 'story' };
    state.cards.push(c); save(); renderBoard();
    const node = grid.querySelector('[data-card="' + c.id + '"] .title');
    if (node) { node.focus(); document.getSelection().selectAllChildren(node); }
  }
  function deleteCard(id) {
    state.cards = state.cards.filter((c) => c.id !== id);
    state.deps = state.deps.filter((d) => d.from !== id && d.to !== id);
    if (linkSrc === id) cancelLink();
    save(); renderBoard();
  }
  function cycleKind(id) {
    const c = card(id); if (!c) return;
    c.kind = KINDS[(KINDS.indexOf(c.kind) + 1) % KINDS.length];
    save(); renderBoard();
  }
  function addTeam() {
    state.teams.push({ id: uid(), name: 'New Team', capacity: state.defaultCapacity || 20 });
    save(); renderBoard();
  }
  function removeTeam(id) {
    if (state.teams.length <= 1) return;
    if (!confirm('Remove this team and its cards?')) return;
    state.teams = state.teams.filter((t) => t.id !== id);
    const removed = state.cards.filter((c) => c.teamId === id).map((c) => c.id);
    state.cards = state.cards.filter((c) => c.teamId !== id);
    state.deps = state.deps.filter((d) => !removed.includes(d.from) && !removed.includes(d.to));
    save(); renderBoard();
  }
  function addSprint() {
    state.sprints.push('Sprint ' + (state.sprints.length + 1));
    save(); renderBoard();
  }
  function removeSprint(s) {
    if (state.sprints.length <= 1) return;
    if (!confirm('Remove this iteration and its cards?')) return;
    const removed = state.cards.filter((c) => c.sprintIdx === s).map((c) => c.id);
    state.sprints.splice(s, 1);
    state.cards = state.cards
      .filter((c) => c.sprintIdx !== s)
      .map((c) => (c.sprintIdx > s ? { ...c, sprintIdx: c.sprintIdx - 1 } : c));
    state.deps = state.deps.filter((d) => !removed.includes(d.from) && !removed.includes(d.to));
    save(); renderBoard();
  }

  // ---------- Dependency linking ----------
  function startLink(id) {
    if (linkSrc === id) { cancelLink(); return; }
    linkSrc = id;
    boardContent.classList.add('linking');
    linkHint.hidden = false;
    renderBoard();
  }
  function cancelLink() {
    linkSrc = null;
    boardContent.classList.remove('linking');
    linkHint.hidden = true;
    renderBoard();
  }
  function completeLink(toId) {
    if (!linkSrc || toId === linkSrc) { cancelLink(); return; }
    const exists = state.deps.some((d) =>
      (d.from === linkSrc && d.to === toId) || (d.from === toId && d.to === linkSrc));
    if (!exists) state.deps.push({ id: uid(), from: linkSrc, to: toId });
    save(); cancelLink();
  }

  // ---------- Dependency arrows ----------
  function drawDeps() {
    // clear existing path nodes (keep <defs>)
    svg.querySelectorAll('path.dep').forEach((p) => p.remove());
    const cr = boardContent.getBoundingClientRect();
    svg.setAttribute('width', boardContent.scrollWidth);
    svg.setAttribute('height', boardContent.scrollHeight);
    svg.style.width = boardContent.scrollWidth + 'px';
    svg.style.height = boardContent.scrollHeight + 'px';

    const anchor = (id, side) => {
      const node = grid.querySelector('[data-card="' + id + '"]');
      if (!node) return null;
      const r = node.getBoundingClientRect();
      const y = r.top + r.height / 2 - cr.top;
      const x = (side === 'right' ? r.right : r.left) - cr.left;
      return { x, y, top: r.top - cr.top, bottom: r.bottom - cr.top, left: r.left - cr.left, right: r.right - cr.left };
    };

    state.deps.forEach((d) => {
      const a = grid.querySelector('[data-card="' + d.from + '"]');
      const b = grid.querySelector('[data-card="' + d.to + '"]');
      if (!a || !b) return;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      // exit from the side of A that faces B
      const fromRight = rb.left + rb.width / 2 >= ra.left + ra.width / 2;
      const p1 = anchor(d.from, fromRight ? 'right' : 'left');
      const p2 = anchor(d.to, fromRight ? 'left' : 'right');
      if (!p1 || !p2) return;
      const dx = Math.max(28, Math.abs(p2.x - p1.x) * 0.45);
      const c1x = p1.x + (fromRight ? dx : -dx);
      const c2x = p2.x + (fromRight ? -dx : dx);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'dep');
      path.setAttribute('marker-end', 'url(#arrow)');
      path.setAttribute('d', `M ${p1.x} ${p1.y} C ${c1x} ${p1.y}, ${c2x} ${p2.y}, ${p2.x} ${p2.y}`);
      svg.appendChild(path);
    });
  }

  // ---------- Pointer drag (cards between cells) ----------
  function onCardPointerDown(e, id) {
    if (e.button != null && e.button !== 0) return;
    // editing controls handle their own pointer events
    if (e.target.closest('input, [contenteditable="true"], .ico-btn, .dot')) return;
    if (linkSrc) return; // in link mode, a tap completes the link instead

    const node = e.currentTarget;
    drag = {
      id, node, startX: e.clientX, startY: e.clientY,
      moved: false, lift: null, dropCell: null, pointerId: e.pointerId,
    };
    try { node.setPointerCapture(e.pointerId); } catch (_) {}
    node.addEventListener('pointermove', onCardPointerMove);
    node.addEventListener('pointerup', onCardPointerUp);
    node.addEventListener('pointercancel', onCardPointerUp);
  }

  function onCardPointerMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;

    if (!drag.moved) {
      drag.moved = true;
      const r = drag.node.getBoundingClientRect();
      drag.offX = drag.startX - r.left;
      drag.offY = drag.startY - r.top;
      drag.w = r.width;
      drag.node.classList.add('dragging');
      const lift = drag.node.cloneNode(true);
      lift.classList.remove('dragging');
      lift.classList.add('lift');
      lift.style.width = r.width + 'px';
      document.body.appendChild(lift);
      drag.lift = lift;
      svg.style.opacity = '0.25';
    }
    drag.lift.style.left = (e.clientX - drag.offX) + 'px';
    drag.lift.style.top = (e.clientY - drag.offY) + 'px';

    // find cell under pointer
    drag.lift.style.display = 'none';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    drag.lift.style.display = '';
    const cell = under && under.closest ? under.closest('.cell') : null;
    if (cell !== drag.dropCell) {
      if (drag.dropCell) drag.dropCell.classList.remove('drop-on');
      drag.dropCell = cell;
      if (cell) cell.classList.add('drop-on');
    }
  }

  function onCardPointerUp(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const node = drag.node;
    node.removeEventListener('pointermove', onCardPointerMove);
    node.removeEventListener('pointerup', onCardPointerUp);
    node.removeEventListener('pointercancel', onCardPointerUp);
    try { node.releasePointerCapture(e.pointerId); } catch (_) {}

    if (drag.moved) {
      if (drag.lift) drag.lift.remove();
      node.classList.remove('dragging');
      svg.style.opacity = '';
      const cell = drag.dropCell;
      if (cell) cell.classList.remove('drop-on');
      if (cell) {
        const c = card(drag.id);
        const newTeam = cell.dataset.team;
        const newSprint = Number(cell.dataset.sprint);
        if (c && (c.teamId !== newTeam || c.sprintIdx !== newSprint)) {
          c.teamId = newTeam; c.sprintIdx = newSprint;
          save();
        }
      }
      drag = null;
      renderBoard();
    } else {
      // treated as a click — handled by document click for link completion
      drag = null;
    }
  }

  // click a card (no drag) while linking -> complete link
  grid.addEventListener('click', (e) => {
    if (!linkSrc) return;
    if (e.target.closest('.ico-btn, .dot, input, [contenteditable="true"]')) return;
    const node = e.target.closest('.card');
    if (node) completeLink(node.dataset.card);
  });
  // click empty board area cancels link
  boardScroll.addEventListener('click', (e) => {
    if (linkSrc && !e.target.closest('.card')) cancelLink();
  });

  // ---------- Risks / ROAM ----------
  function renderRisks() {
    roamEl.innerHTML = '';
    const n = state.risks.length;
    riskCount.textContent = n ? '(' + n + ')' : '';
    ROAM.forEach(({ cat, label }) => {
      const list = state.risks.filter((r) => (r.cat || 'U') === cat);
      const col = el('div', { class: 'roam-col', 'data-cat': cat }, [
        el('h4', null, [
          el('span', { class: 'badge', text: cat }),
          el('span', { text: label }),
          el('span', { class: 'ct-n', text: String(list.length) }),
        ]),
      ]);
      if (!list.length) col.appendChild(el('div', { class: 'empty-note', text: '—' }));
      list.forEach((r) => col.appendChild(renderRisk(r)));
      roamEl.appendChild(col);
    });
  }
  function renderRisk(r) {
    const node = el('div', { class: 'risk', style: '--rc:var(--' + roamColorVar((r.cat || 'U')) + ')' });
    node.appendChild(el('div', { class: 'r-text', text: r.text }));
    const foot = el('div', { class: 'r-foot' });
    ['R', 'O', 'A', 'M'].forEach((cat) => {
      foot.appendChild(el('button', {
        class: 'roam-btn' + ((r.cat || 'U') === cat ? ' on' : ''), 'data-cat': cat, type: 'button',
        title: ROAM.find((x) => x.cat === cat).label,
        onclick: () => { r.cat = (r.cat === cat ? 'U' : cat); save(); renderRisks(); },
      }, cat));
    });
    foot.appendChild(el('button', { class: 'r-del', title: 'Delete risk', type: 'button',
      onclick: () => { state.risks = state.risks.filter((x) => x.id !== r.id); save(); renderRisks(); } }, '×'));
    node.appendChild(foot);
    return node;
  }
  function roamColorVar(cat) {
    return { U: 'ink-faint', R: 'ok', O: 'story', A: 'enabler', M: 'feature' }[cat] || 'ink-faint';
  }
  function addRisk() {
    const text = riskInput.value.trim();
    if (!text) return;
    state.risks.unshift({ id: uid(), text, cat: 'U' });
    riskInput.value = '';
    save(); renderRisks();
  }

  function renderVote() {
    cfButtons.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      cfButtons.appendChild(el('button', {
        class: state.vote === i ? 'on' : '', type: 'button',
        onclick: () => { state.vote = (state.vote === i ? null : i); save(); renderVote(); },
      }, String(i)));
    }
    if (state.vote) {
      const msg = ['Low confidence — replan', 'Concerns — discuss', 'Cautious commit', 'Good confidence', 'Full commit!'][state.vote - 1];
      cfResult.innerHTML = 'Your vote: <b>' + state.vote + '/5</b> — ' + msg;
    } else {
      cfResult.textContent = 'Tap a finger to register your confidence in the plan.';
    }
  }

  // ---------- Tabs ----------
  document.getElementById('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b === btn));
    const tab = btn.dataset.tab;
    document.getElementById('view-board').hidden = tab !== 'board';
    document.getElementById('view-risks').hidden = tab !== 'risks';
    if (tab === 'board') requestAnimationFrame(drawDeps);
    if (tab === 'risks') { renderRisks(); renderVote(); }
  });

  // ---------- Theming (driven by PIE Recipe) ----------
  function hexToRgba(hex, a) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return 'rgba(245,158,11,' + a + ')';
    const n = parseInt(m[1], 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function applyTheme() {
    const root = document.documentElement.style;
    KINDS.forEach((k) => root.setProperty('--' + k, state.kinds[k].color));
    root.setProperty('--accent', state.accent);
    root.setProperty('--accent-soft', hexToRgba(state.accent, 0.16));
  }
  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'PI';
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }
  function updateLegend() {
    document.querySelectorAll('.legend .lg[data-kind]').forEach((sp) => {
      const k = sp.dataset.kind;
      if (state.kinds[k] && sp.childNodes[1]) sp.childNodes[1].nodeValue = ' ' + state.kinds[k].label;
    });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // ---------- Data operations ----------
  const importFile = document.getElementById('import-file');
  function exportPlan() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (state.piName || 'pi-plan').replace(/[^\w.-]+/g, '-') + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  importFile.addEventListener('change', () => {
    const f = importFile.files && importFile.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const s = JSON.parse(reader.result);
        if (!s || !Array.isArray(s.teams) || !Array.isArray(s.sprints)) throw new Error('bad');
        s.cards = s.cards || []; s.deps = s.deps || []; s.risks = s.risks || [];
        state = normalize(s);
        save(); fullRender();
      } catch (_) { alert('That file is not a valid Pie plan.'); }
      importFile.value = '';
    };
    reader.readAsText(f);
  });
  function resetPlan() {
    if (!confirm('Reset the plan to the sample? This clears your changes.')) return;
    state = sampleState(); save(); fullRender();
  }
  function quit() {
    if (window.self !== window.top) window.parent.postMessage({ type: 'close-game' }, '*');
    else location.href = '../../';
  }

  // ---------- Board toolbar ----------
  document.getElementById('add-team').addEventListener('click', addTeam);
  document.getElementById('add-sprint').addEventListener('click', addSprint);
  document.getElementById('export-btn').addEventListener('click', exportPlan);
  document.getElementById('board-back').addEventListener('click', exitBoard);
  document.getElementById('risk-add-btn').addEventListener('click', addRisk);
  riskInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addRisk(); });

  piName.addEventListener('blur', () => { state.piName = piName.textContent.trim() || 'PI Planning'; save(); });
  piName.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); piName.blur(); } });

  // ---------- Light shell: sidebar + routed pages ----------
  let currentPage = 'home';

  function icon(name, cls) {
    const P = {
      home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
      sessions: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="16" rx="1"/><rect x="17" y="8" width="4" height="12" rx="1"/>',
      org: '<circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="19" r="2.2"/><circle cx="19" cy="19" r="2.2"/><path d="M12 7.2v3.8M12 11H5v5.8M12 11h7v5.8"/>',
      users: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0111 0"/><path d="M16 5.5a3 3 0 010 5"/><path d="M20.5 19a5 5 0 00-3.5-4.5"/>',
      alm: '<path d="M9.5 13.5a4 4 0 005.7 0l2.3-2.3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14.5 10.5a4 4 0 00-5.7 0l-2.3 2.3a4 4 0 005.7 5.7l1-1"/>',
      sso: '<path d="M12 3l8 3v6c0 4.8-3.4 7.6-8 9-4.6-1.4-8-4.2-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
      billing: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9L19 19M19 5l-2.1 2.1M7.1 16.9L5 19"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      refresh: '<path d="M20 11a8 8 0 10-1.7 5.4"/><path d="M20 4v5h-5"/>',
    };
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (P[name] || '') + '</svg>';
  }

  function closeUserMenu() { const m = document.getElementById('user-menu'); if (m) m.hidden = true; }

  function renderSide() {
    const u = state.user;
    const teams = state.teams.length;
    const lim = state.plan.teamLimit || 1;
    const pct = Math.max(4, Math.min(100, Math.round((teams / lim) * 100)));
    const nav = [
      ['home', 'Home', 'home'], ['sessions', 'PI Sessions', 'sessions'],
      ['org', 'Organization', 'org'], ['users', 'Users', 'users'],
      ['connections', 'ALM Connections', 'alm'], ['sso', 'SSO', 'sso'],
      ['billing', 'Billing', 'billing'], ['settings', 'Settings', 'settings'],
    ];
    sideEl.innerHTML =
      '<div class="side-brand"><span class="logo">🥧</span><b>pieplanning</b></div>' +
      '<button class="side-app" type="button" data-act="open-app">Pie app <span>↗</span></button>' +
      '<nav class="side-nav">' + nav.map((n) =>
        '<button class="nav-i' + (currentPage === n[0] ? ' active' : '') + '" type="button" data-page="' + n[0] + '">' +
        icon(n[2]) + '<span>' + n[1] + '</span>' + (n[0] === 'org' ? '<span class="chev">▾</span>' : '') + '</button>').join('') +
      '</nav>' +
      '<div class="side-foot">' +
        '<div class="plan-card"><div class="pc-label">' + esc(state.plan.name) + ' plan</div>' +
          '<div class="pc-val"><b>' + teams + '</b> / ' + lim + ' teams</div>' +
          '<div class="pc-bar"><i style="width:' + pct + '%"></i></div></div>' +
        '<div class="user-chip-wrap">' +
          '<button class="user-chip" type="button" data-act="user-menu"><span class="avatar">' + esc(initials(u.name)) + '</span>' +
            '<span class="u-name">' + esc(u.name) + '</span><span class="u-chev">⌄</span></button>' +
          '<div class="menu" id="user-menu" role="menu" hidden>' +
            '<button class="menu-item" type="button" data-act="settings"><span>⚙</span> Settings</button>' +
            '<button class="menu-item" type="button" data-act="export"><span>⤓</span> Export plan</button>' +
            '<div class="menu-sep"></div>' +
            '<button class="menu-item danger" type="button" data-act="quit"><span>⤴</span> Exit to arcade</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }
  function updateAvatar() { renderSide(); }

  sideEl.addEventListener('click', (e) => {
    const nav = e.target.closest('.nav-i');
    if (nav) { navigate(nav.dataset.page); return; }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    const a = act.dataset.act;
    if (a === 'open-app') enterBoard(state.piName);
    else if (a === 'user-menu') { e.stopPropagation(); const m = document.getElementById('user-menu'); m.hidden = !m.hidden; }
    else if (a === 'settings') { closeUserMenu(); navigate('settings'); }
    else if (a === 'export') { closeUserMenu(); exportPlan(); }
    else if (a === 'quit') quit();
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.user-chip-wrap')) closeUserMenu(); });

  function navigate(page) { currentPage = page; renderSide(); renderPage(page); mainEl.scrollTop = 0; }
  function renderPage(page) {
    if (page === 'home') return renderHome();
    if (page === 'sessions') return renderSessions();
    if (page === 'connections') return renderConnections();
    if (page === 'settings') return renderSettings();
    return renderStub(page);
  }

  function statHtml(k, v, s) {
    return '<div class="stat"><div class="s-k">' + esc(k) + '</div><div class="s-v">' + esc(v) + '</div><div class="s-s">' + esc(s) + '</div></div>';
  }
  function sessionRows() {
    return state.sessions.map((s) =>
      '<div class="p-row" data-act="open-session" data-name="' + esc(s.name) + '">' +
        (s.live ? '<span class="dot-ok"></span>' : '') +
        '<span class="p-name">' + esc(s.name) + '</span>' +
        '<span class="p-time">' + esc(s.updated || '') + '</span>' +
        '<button class="p-kebab" type="button" data-act="kebab" aria-label="More">⋮</button>' +
      '</div>').join('');
  }
  function connectionRows() {
    return state.connections.map((c) =>
      '<div class="p-row" data-act="goto" data-page="connections">' +
        '<span class="' + (c.ok ? 'dot-ok' : 'dot-err') + '"></span>' +
        '<span class="p-name">' + esc(c.name) + '</span>' +
        '<span class="p-tag">' + esc(c.type) + '</span>' +
        '<button class="p-kebab" type="button" data-act="kebab" aria-label="More">⋮</button>' +
      '</div>').join('');
  }
  function panel(iconName, title, addAct, addPage, rows, footLabel, footTotal, footPage) {
    return '<div class="panel">' +
      '<div class="panel-head">' + icon(iconName, 'ph-ico') + '<h2>' + esc(title) + '</h2>' +
        '<button class="panel-act" type="button" data-act="' + addAct + '" data-page="' + addPage + '" data-name="' + esc(state.piName) + '" aria-label="Add">' + icon('plus') + '</button></div>' +
      '<div class="p-list">' + rows + '</div>' +
      '<div class="panel-foot"><a data-act="goto" data-page="' + footPage + '">' + esc(footLabel) + ' ›</a><span class="pf-total">' + esc(footTotal) + '</span></div>' +
    '</div>';
  }

  function renderHome() {
    const u = state.user;
    const first = esc(String(u.name).trim().split(/\s+/)[0] || 'there');
    const date = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' });
    const teams = state.teams.length;
    const events = state.events.map((ev) =>
      '<div class="p-row">' +
        '<span class="' + (ev.ok ? 'dot-ok' : 'dot-err') + '"></span>' +
        '<span class="p-name">' + esc(ev.text) + '</span>' +
        '<span class="p-tag">' + esc(ev.source) + '</span>' +
        '<span class="p-time">' + esc(ev.ago) + '</span>' +
      '</div>').join('');
    mainEl.innerHTML =
      '<section class="page">' +
        '<div class="dash-head">' +
          '<div class="dash-hi"><h1>Hi ' + first + '</h1><div class="d-date">' + esc(date) + '</div></div>' +
          '<div class="stats">' +
            statHtml('ARTS', state.org.arts, 'active') +
            statHtml('TEAMS', teams, 'of ' + (state.plan.teamLimit)) +
            statHtml('USERS', state.org.users, 'registered') +
            statHtml('PLAN', state.plan.name, 'renews ' + state.plan.renews) +
          '</div>' +
        '</div>' +
        '<div class="cards-2">' +
          panel('sessions', 'PI sessions', 'open-session', '', sessionRows(), 'View all sessions', state.sessionTotal + ' total', 'sessions') +
          panel('alm', 'ALM connections', 'goto', 'connections', connectionRows(), 'View all connections', state.connectionTotal + ' total', 'connections') +
        '</div>' +
        '<div class="panel events">' +
          '<div class="panel-head">' + icon('refresh', 'ph-ico') + '<h2>Recent ALM events</h2>' +
            '<button class="panel-act" type="button" data-act="refresh-events" aria-label="Refresh">' + icon('refresh') + '</button></div>' +
          '<div class="p-list">' + events + '</div><div style="height:8px"></div>' +
        '</div>' +
      '</section>';
  }
  function renderSessions() {
    mainEl.innerHTML =
      '<section class="page"><h1 class="page-h">PI Sessions</h1>' +
      '<p class="page-sub">Open a planning board or start a new increment.</p>' +
      '<div class="panel"><div class="p-list" style="padding-top:8px">' + sessionRows() + '</div>' +
      '<div class="panel-foot"><a data-act="open-session" data-name="' + esc(state.piName) + '">+ New session</a>' +
      '<span class="pf-total">' + state.sessionTotal + ' total</span></div></div></section>';
  }
  function renderConnections() {
    mainEl.innerHTML =
      '<section class="page"><h1 class="page-h">ALM Connections</h1>' +
      '<p class="page-sub">Where Pie syncs features, stories and objectives.</p>' +
      '<div class="panel"><div class="p-list" style="padding-top:8px">' + connectionRows() + '</div>' +
      '<div class="panel-foot"><span class="pf-total">' + state.connectionTotal + ' total</span></div></div></section>';
  }
  function renderStub(page) {
    const meta = {
      org: ['Organization', 'Manage ARTs, value streams and team topology.'],
      users: ['Users', 'Invite teammates and manage their roles.'],
      sso: ['SSO', 'Configure single sign-on for your organization.'],
      billing: ['Billing', 'Plan, invoices and usage.'],
    };
    const m = meta[page] || [page, ''];
    mainEl.innerHTML =
      '<section class="page"><h1 class="page-h">' + esc(m[0]) + '</h1><p class="page-sub">' + esc(m[1]) + '</p>' +
      '<div class="page-empty"><h2>Coming soon</h2><div>This area isn’t wired up yet — the PIE Recipe (Settings) and your planning board are the live surfaces for now.</div></div></section>';
  }

  mainEl.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    if (act === 'kebab') { e.stopPropagation(); return; }
    if (act === 'open-session') enterBoard(a.dataset.name || state.piName);
    else if (act === 'goto') navigate(a.dataset.page);
    else if (act === 'refresh-events') renderHome();
  });

  // ---------- Board navigation ----------
  function enterBoard(name) {
    closeUserMenu();
    if (name) { state.piName = name; piName.textContent = name; save(); }
    shell.hidden = true; boardScreen.hidden = false;
    renderBoard(); renderRisks(); renderVote(); updateLegend();
    requestAnimationFrame(() => requestAnimationFrame(drawDeps));
  }
  function exitBoard() {
    boardScreen.hidden = true; shell.hidden = false;
    navigate(currentPage);
  }

  // ---------- PIE Recipe (Settings page) ----------
  // small light-form builders
  function rRow(title, sub, ctls) {
    return el('div', { class: 'r-row' }, [
      el('div', { class: 'r-label' }, [el('b', { text: title }), sub ? el('small', { text: sub }) : null]),
      el('div', { class: 'r-ctl' }, ctls),
    ]);
  }
  function rText(value, onInput) {
    const i = el('input', { type: 'text' }); i.value = value;
    i.addEventListener('input', () => onInput(i.value));
    return i;
  }
  function rNum(value, min, onChange) {
    const i = el('input', { type: 'number', min: String(min) }); i.value = value;
    i.addEventListener('change', () => onChange(Math.max(min, Number(i.value) || 0)));
    return i;
  }
  function rColor(value, onInput) {
    const i = el('input', { type: 'color' }); i.value = value;
    i.addEventListener('input', () => onInput(i.value));
    return i;
  }
  function rStepper(value, min, max, onChange) {
    const dec = el('button', { type: 'button', text: '−' });
    const inc = el('button', { type: 'button', text: '+' });
    dec.disabled = value <= min; inc.disabled = value >= max;
    dec.addEventListener('click', () => onChange(value - 1));
    inc.addEventListener('click', () => onChange(value + 1));
    return el('div', { class: 'stepper' }, [dec, el('span', { class: 'val', text: String(value) }), inc]);
  }
  function rToggle(checked, onChange) {
    const input = el('input', { type: 'checkbox' }); input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    return el('label', { class: 'switch' }, [input, el('span', { class: 'track' })]);
  }
  function rCard(title, desc, kids) {
    return el('div', { class: 'r-card' }, [
      el('h3', { text: title }),
      desc ? el('p', { class: 'r-desc', text: desc }) : null,
    ].concat(kids));
  }

  function setIterationCount(n) {
    n = Math.max(1, Math.min(12, n));
    const cur = state.sprints.length;
    if (n === cur) return;
    if (n < cur) {
      const lost = state.cards.filter((c) => c.sprintIdx >= n);
      if (lost.length && !confirm('Removing ' + (cur - n) + ' iteration(s) deletes ' + lost.length + ' card(s). Continue?')) return;
      const lostIds = lost.map((c) => c.id);
      state.sprints = state.sprints.slice(0, n);
      state.cards = state.cards.filter((c) => c.sprintIdx < n);
      state.deps = state.deps.filter((d) => !lostIds.includes(d.from) && !lostIds.includes(d.to));
    } else {
      for (let i = cur; i < n; i++) state.sprints.push('Sprint ' + (i + 1));
    }
    save(); renderBoard(); renderSettings();
  }

  function renderSettings() {
    mainEl.innerHTML = '';
    const page = el('section', { class: 'page' }, [
      el('h1', { class: 'page-h', text: 'PIE Recipe' }),
      el('p', { class: 'page-sub', text: 'RTE Cockpit · ' + state.artName + ' · ' + state.piName }),
    ]);
    const body = el('div', { class: 'recipe' });

    // Profile
    body.appendChild(rCard('Profile', 'Identity shown on your avatar and menu.', [
      rRow('Display name', 'Initials appear on the avatar', [rText(state.user.name, (v) => { state.user.name = v; updateAvatar(); save(); })]),
      rRow('Role', 'e.g. Release Train Engineer', [rText(state.user.role, (v) => { state.user.role = v; updateAvatar(); save(); })]),
    ]));

    // PI details
    body.appendChild(rCard('PI details', 'The increment you are planning.', [
      rRow('PI name', '', [rText(state.piName, (v) => { state.piName = v; piName.textContent = v || 'PI Planning'; save(); })]),
      rRow('ART name', 'Agile Release Train', [rText(state.artName, (v) => { state.artName = v || 'ART'; save(); })]),
    ]));

    // Cadence
    const lastIsIP = state.sprints[state.sprints.length - 1] === 'IP';
    const chips = el('div', { class: 'iter-chips' }, state.sprints.map((s) => el('span', { text: s })));
    body.appendChild(rCard('Cadence', 'Shape the iterations that make up the PI.', [
      rRow('Iterations', '1–12 sprints', [rStepper(state.sprints.length, 1, 12, setIterationCount)]),
      chips,
      rRow('Iteration length', 'Weeks per iteration', [rNum(state.iterationWeeks, 1, (v) => { state.iterationWeeks = v || 1; save(); }), el('span', { class: 'pts-unit', text: 'wks' })]),
      rRow('Last iteration is IP', 'Innovation & Planning buffer', [rToggle(lastIsIP, (on) => {
        const last = state.sprints.length - 1;
        if (on) state.sprints[last] = 'IP';
        else if (state.sprints[last] === 'IP') state.sprints[last] = 'Sprint ' + (last + 1);
        save(); renderBoard(); renderSettings();
      })]),
    ]));

    // Capacity
    body.appendChild(rCard('Capacity', 'Defaults for team load planning.', [
      rRow('Default team capacity', 'Points / iteration for new teams', [rNum(state.defaultCapacity, 0, (v) => { state.defaultCapacity = v; save(); })]),
      rRow('Apply to existing teams', 'Overwrite every team with the default', [
        el('button', { class: 'r-btn', type: 'button', text: 'Apply to ' + state.teams.length + ' teams',
          onclick: () => { state.teams.forEach((t) => { t.capacity = state.defaultCapacity; }); save(); renderBoard(); renderSide(); renderSettings(); } }),
      ]),
    ]));

    // Card types
    const typesCard = rCard('Card types', 'Rename and recolor the card types used across the board.', []);
    KINDS.forEach((k) => {
      const kd = state.kinds[k];
      const chip = el('span', { class: 'kind-chip', style: '--kc:' + kd.color }, [el('i'), document.createTextNode(' ' + kd.label)]);
      const txtNode = chip.lastChild;
      const tIn = rText(kd.label, (v) => { kd.label = v || k; txtNode.nodeValue = ' ' + kd.label; updateLegend(); save(); });
      const cIn = rColor(kd.color, (v) => { kd.color = v; chip.style.setProperty('--kc', v); applyTheme(); save(); });
      typesCard.appendChild(el('div', { class: 'kind-row' }, [chip, tIn, cIn]));
    });
    body.appendChild(typesCard);

    // Appearance
    const presets = ['#f59e0b', '#38bdf8', '#a78bfa', '#34d399', '#fb7185', '#f472b6'];
    const presetEls = el('div', { class: 'presets' }, presets.map((c) =>
      el('button', { type: 'button', class: c.toLowerCase() === state.accent.toLowerCase() ? 'on' : '',
        style: 'background:' + c, 'aria-label': c,
        onclick: () => { state.accent = c; applyTheme(); save(); renderSettings(); } })));
    body.appendChild(rCard('Appearance', 'Accent color for the app chrome.', [
      rRow('Accent color', 'Pick a preset or a custom color', [
        presetEls,
        rColor(state.accent, (v) => { state.accent = v; applyTheme(); save(); }),
      ]),
    ]));

    // Data
    body.appendChild(rCard('Data', 'Your plan is stored in this browser only.', [
      rRow('Export plan', 'Download the full plan as JSON', [el('button', { class: 'r-btn', type: 'button', text: 'Export', onclick: exportPlan })]),
      rRow('Import plan', 'Load a previously exported .json', [el('button', { class: 'r-btn', type: 'button', text: 'Import', onclick: () => importFile.click() })]),
      rRow('Reset plan', 'Restore the built-in sample', [el('button', { class: 'r-btn danger', type: 'button', text: 'Reset', onclick: resetPlan })]),
    ]));

    body.appendChild(el('div', { class: 'r-foot-note', text: '🥧 Pie · PI Planning — changes save automatically' }));

    page.appendChild(body);
    mainEl.appendChild(page);
  }

  // ---------- Global ----------
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!boardScreen.hidden && linkSrc) { cancelLink(); return; }
    closeUserMenu();
  });
  window.addEventListener('resize', () => { if (!boardScreen.hidden) requestAnimationFrame(drawDeps); });
  boardScroll.addEventListener('scroll', () => { /* deps are content-relative; no redraw needed */ }, { passive: true });

  function fullRender() {
    applyTheme();
    piName.textContent = state.piName || 'PI Planning';
    renderBoard();
    updateLegend();
    renderRisks();
    renderVote();
    renderSide();
    renderPage(currentPage);
  }

  // ---------- Boot ----------
  fullRender();
  shell.hidden = false;
  boardScreen.hidden = true;

  const startTime = Date.now();
  function reveal() {
    const delay = Math.max(0, 3000 - (Date.now() - startTime));
    setTimeout(() => { loading.classList.add('hidden'); }, delay);
  }
  if (document.readyState === 'complete') reveal();
  else window.addEventListener('load', reveal);
})();
