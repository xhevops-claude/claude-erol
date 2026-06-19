(function () {
  'use strict';

  const STORE_KEY = 'pie-pi-planning-v1';
  const KINDS = ['story', 'feature', 'enabler', 'milestone'];
  const ROAM = [
    { cat: 'U', label: 'Unassigned' },
    { cat: 'R', label: 'Resolved' },
    { cat: 'O', label: 'Owned' },
    { cat: 'A', label: 'Accepted' },
    { cat: 'M', label: 'Mitigated' },
  ];

  // ---------- DOM ----------
  const loading = document.getElementById('app-loading');
  const app = document.getElementById('app');
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
    return {
      piName: 'PI 2026.Q3',
      teams, sprints, cards, deps,
      risks: [
        { id: uid(), text: 'Third-party SSO vendor SLA unclear', cat: 'O' },
        { id: uid(), text: 'Data migration window may slip', cat: 'A' },
      ],
      vote: null,
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !Array.isArray(s.teams) || !Array.isArray(s.sprints)) return null;
      s.cards = s.cards || []; s.deps = s.deps || []; s.risks = s.risks || [];
      return s;
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

    const dot = el('button', { class: 'dot', title: 'Change type (' + c.kind + ')', type: 'button' });
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
    state.teams.push({ id: uid(), name: 'New Team', capacity: 20 });
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

  // ---------- Toolbar ----------
  document.getElementById('add-team').addEventListener('click', addTeam);
  document.getElementById('add-sprint').addEventListener('click', addSprint);
  document.getElementById('risk-add-btn').addEventListener('click', addRisk);
  riskInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addRisk(); });

  piName.textContent = state.piName || 'PI Planning';
  piName.addEventListener('blur', () => { state.piName = piName.textContent.trim() || 'PI Planning'; save(); });
  piName.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); piName.blur(); } });

  document.getElementById('export-btn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (state.piName || 'pi-plan').replace(/[^\w.-]+/g, '-') + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  const importFile = document.getElementById('import-file');
  document.getElementById('import-btn').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', () => {
    const f = importFile.files && importFile.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const s = JSON.parse(reader.result);
        if (!s || !Array.isArray(s.teams) || !Array.isArray(s.sprints)) throw new Error('bad');
        state = { piName: 'PI Planning', risks: [], deps: [], cards: [], vote: null, ...s };
        save(); fullRender();
      } catch (_) { alert('That file is not a valid Pie plan.'); }
      importFile.value = '';
    };
    reader.readAsText(f);
  });
  document.getElementById('reset-btn').addEventListener('click', () => {
    if (!confirm('Reset the board to the sample plan? This clears your changes.')) return;
    state = sampleState(); save(); fullRender();
  });

  document.getElementById('quit-btn').addEventListener('click', () => {
    if (window.self !== window.top) window.parent.postMessage({ type: 'close-game' }, '*');
    else location.href = '../../';
  });

  // ---------- Global ----------
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && linkSrc) cancelLink(); });
  window.addEventListener('resize', () => requestAnimationFrame(drawDeps));
  boardScroll.addEventListener('scroll', () => { /* deps are content-relative; no redraw needed */ }, { passive: true });

  function fullRender() {
    piName.textContent = state.piName || 'PI Planning';
    renderBoard();
    renderRisks();
    renderVote();
  }

  // ---------- Boot ----------
  fullRender();
  app.hidden = false;
  // redraw once layout settles (fonts/sticky measured)
  requestAnimationFrame(() => requestAnimationFrame(drawDeps));

  const startTime = Date.now();
  function reveal() {
    const delay = Math.max(0, 3000 - (Date.now() - startTime));
    setTimeout(() => { loading.classList.add('hidden'); drawDeps(); }, delay);
  }
  if (document.readyState === 'complete') reveal();
  else window.addEventListener('load', reveal);
})();
