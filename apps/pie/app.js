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

  // Plausible PI objectives (our own copy — not lifted from the reference).
  const OBJ_POOL = [
    'Cut checkout latency by 30% across web and mobile.',
    'Ship the new onboarding flow to 100% of users.',
    'Reduce support tickets with in-app self-serve help.',
    'Migrate billing to the new ledger service.',
    'Improve search relevance for the top 50 queries.',
    'Launch the partner API public beta.',
    'Harden auth with passkeys and step-up MFA.',
    'Roll out usage-based pricing experiments.',
    'Halve cold-start time for the mobile app.',
    'Deliver the redesigned reporting dashboard.',
  ];
  const ART_OBJ = [
    { title: 'Unify the experience across surfaces', desc: 'Our objective is to give customers one coherent journey across web, mobile and email, removing the rough edges between channels.' },
    { title: 'Make insights trustworthy by default', desc: 'Tighten data accuracy and freshness so every team can rely on the numbers without second-guessing the pipeline.' },
    { title: 'Open the platform to partners', desc: 'Ship the public API and developer portal so integrators can build on top of us without hand-holding.' },
    { title: 'Pay down the auth & billing debt', desc: 'Consolidate identity and billing onto the new services to cut incidents and unlock faster iteration.' },
    { title: 'Grow self-serve adoption', desc: 'Lower the barrier to first value so new accounts can succeed without talking to sales.' },
  ];
  function genTeamObjectives(i) {
    const C = [1, 2, 2, 3, 2, 5], U = [1, 3, 2, 2, 1, 0];
    const bvs = [8, 10, 13, 5];
    const mk = (committed, seed) => ({ id: uid(), text: OBJ_POOL[seed % OBJ_POOL.length], bv: bvs[seed % bvs.length], links: 2, committed });
    const out = [];
    for (let k = 0; k < C[i % 6]; k++) out.push(mk(true, i + k * 3));
    for (let k = 0; k < U[i % 6]; k++) out.push(mk(false, i + 1 + k * 2));
    return out;
  }
  function genArtObjectives() {
    return ART_OBJ.map((o, i) => ({ id: uid(), title: o.title, desc: o.desc, bv: 0, links: [7, 5, 5, 5, 3][i] || 4, committed: i < 3 }));
  }

  // ---------- DOM ----------
  const loading = document.getElementById('app-loading');
  const shell = document.getElementById('shell');
  const sideEl = document.getElementById('side');
  const mainEl = document.getElementById('main');
  const boardScreen = document.getElementById('board-screen');
  const bnav = document.getElementById('bnav');
  const srail = document.getElementById('srail');
  const canvas = document.getElementById('canvas');
  const canvasWrap = document.getElementById('canvas-wrap');
  const artSide = document.getElementById('art-side');
  const zoomctl = document.getElementById('zoomctl');

  // ---------- State ----------
  let state = load() || sampleState();

  function uid() { return Math.random().toString(36).slice(2, 9); }

  function sampleState() {
    const t = (name, capacity) => ({ id: uid(), name, capacity });
    const teams = [t('Falcon', 26), t('Otter', 22), t('Nimbus', 30), t('Pangolin', 24), t('Marlin', 28), t('Comet', 20)];
    const sprints = ['Iteration 1', 'Iteration 2', 'Iteration 3', 'Iteration 4', 'Iteration 5', 'IP Iteration'];
    const C = (teamIdx, sprintIdx, title, points, kind) => ({
      id: uid(), teamId: teams[teamIdx].id, sprintIdx, title, points, kind,
    });
    const titles = [
      'Auth service spike', 'Login screen', 'SSO integration', 'Billing API',
      'Invoice PDF export', 'Dunning emails', 'Event pipeline', 'Usage dashboard',
      'Alerts v1', 'Search reindex', 'Profile settings', 'Audit log',
      'Rate limiter', 'Webhook retries', 'Feature flags', 'Onboarding flow',
      'Export to CSV', 'Mobile deep links', 'Cache warmup', 'Email templates',
    ];
    const pts = [2, 3, 5, 8, 13];
    const kindFor = (n) => (n % 6 === 0 ? 'feature' : n % 7 === 0 ? 'enabler' : n % 13 === 0 ? 'milestone' : 'story');
    const cards = [];
    let n = 0;
    sprints.forEach((_, s) => {
      const count = 7 + (s % 3);
      for (let i = 0; i < count; i++, n++) {
        cards.push(C(i % teams.length, s, titles[n % titles.length], pts[n % pts.length], kindFor(n)));
      }
    });
    const objectives = [];
    for (let i = 1; i <= 10; i++) {
      objectives.push({ id: uid(), text: "I'm baby wayfarers hexagon small batch, chicharrones", bv: 10, links: 2, committed: i <= 5 });
    }
    return normalize({
      piName: 'PI 2026.Q3',
      teams, sprints, cards, deps: [], objectives,
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
    s.artName = s.artName || 'Digital Experience ART';
    s.iterationWeeks = s.iterationWeeks || 2;
    s.defaultCapacity = s.defaultCapacity || 20;
    s.accent = s.accent || '#f59e0b';
    s.kinds = s.kinds || {};
    KINDS.forEach((k) => {
      s.kinds[k] = Object.assign({}, KIND_DEFAULTS[k], s.kinds[k]);
    });
    if (!Array.isArray(s.objectives)) s.objectives = [];
    s.teams.forEach((tm, i) => { if (!Array.isArray(tm.objectives)) tm.objectives = genTeamObjectives(i); });
    if (!Array.isArray(s.artObjectives)) s.artObjectives = genArtObjectives();
    s.context = Object.assign({ board: 'Team Board', program: 'Terra', team: 'Zürich', dates: '13 Jan - 13 Feb' }, s.context);
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

  // ---------- Whiteboard icons ----------
  function bIcon(name, cls) {
    const P = {
      apps: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
      search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-3.5-3.5"/>',
      board: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="11" rx="1"/><rect x="17" y="4" width="4" height="14" rx="1"/>',
      history: '<path d="M3 12a9 9 0 109-9 9 9 0 00-7 3.3"/><path d="M3 3v4h4"/><path d="M12 8v4l3 2"/>',
      view: '<rect x="3" y="4" width="8" height="16" rx="1.5"/><rect x="13" y="4" width="8" height="16" rx="1.5"/>',
      teamboard: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5v14M14 5v9"/>',
      folder: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
      people: '<circle cx="9" cy="9" r="3"/><path d="M3.5 19a5.5 5.5 0 0111 0"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.5a4.5 4.5 0 014.5 4.5"/>',
      camera: '<path d="M4 8a2 2 0 012-2h2l1.5-2h5L16 6h2a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2z"/><circle cx="12" cy="12.5" r="3.2"/>',
      edit: '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
      chev: '<path d="M6 9l6 6 6-6"/>',
      // side rail
      shift: '<path d="M4 12h12"/><path d="M11 7l5 5-5 5"/><path d="M20 5v14"/>',
      solbacklog: '<rect x="4" y="4" width="8" height="6" rx="1"/><path d="M14 7h5M16.5 4.5v5"/><rect x="4" y="14" width="8" height="6" rx="1"/><path d="M14 17h5M16.5 14.5v5"/>',
      solplan: '<path d="M5 5v8a2 2 0 002 2h3"/><rect x="13" y="11" width="7" height="7" rx="1.5"/><rect x="3" y="3" width="5" height="5" rx="1.5"/>',
      artbacklog: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="13" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M15 17h5M17.5 14.5v5"/>',
      artplan: '<rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="13" width="7" height="7" rx="1.5"/><path d="M10 7h3a2 2 0 012 2v4"/>',
      objectives: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1"/>',
      risk: '<path d="M12 3l8 3v6c0 4.8-3.4 7.6-8 9-4.6-1.4-8-4.2-8-9V6z"/><path d="M12 8.5v4"/><circle cx="12" cy="15.6" r="0.6" fill="currentColor" stroke="none"/>',
      teamrail: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="10" cy="10.5" r="2.2"/><path d="M6.5 16.5a3.5 3.5 0 017 0"/><circle cx="16" cy="10.5" r="1.6"/>',
      collab: '<rect x="4" y="5" width="7" height="6" rx="1"/><rect x="13" y="5" width="7" height="6" rx="1"/><rect x="8.5" y="14" width="7" height="6" rx="1"/>',
      // panels
      bookmark: '<path d="M6 4h12v16l-6-4-6 4z"/>',
      cols: '<rect x="4" y="5" width="6" height="14" rx="1"/><rect x="14" y="5" width="6" height="14" rx="1"/>',
      dots: '<circle cx="12" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="18" r="1.4" fill="currentColor" stroke="none"/>',
      expand: '<path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4"/>',
      // zoom
      plus: '<path d="M12 5v14M5 12h14"/>',
      minus: '<path d="M5 12h14"/>',
      fit: '<path d="M4 9V5a1 1 0 011-1h4M20 9V5a1 1 0 00-1-1h-4M4 15v4a1 1 0 001 1h4M20 15v4a1 1 0 01-1 1h-4"/>',
      help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 113.5 2.3c-.8.4-1 .8-1 1.7"/><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none"/>',
      snap: '<rect x="4" y="6" width="16" height="13" rx="2"/><path d="M9 6l1.5-2h3L15 6"/><circle cx="12" cy="12.5" r="3"/>',
    };
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (P[name] || '') + '</svg>';
  }

  function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
  function avatar(initials, color) {
    return '<span class="b-av" style="background:' + color + '">' + esc(initials) + '</span>';
  }

  // ---------- Top navigation (static, contextual to the active board) ----------
  function renderTopNav() {
    const c = state.context;
    const obj = railActive === 'objectives';
    const avatars = [['AR', '#e0746a'], ['MK', '#6a9be0'], ['TS', '#6ad0a8'], ['JD', '#caa15a']]
      .map((a) => avatar(a[0], a[1])).join('');
    let left, center;
    if (obj) {
      left =
        '<button class="bn-ico bn-home" type="button" data-nav="home" title="Dashboard">' + bIcon('apps') + '</button>' +
        '<button class="bn-chip" type="button" data-nav="toggle-art">' + bIcon('objectives', 'bn-cico') +
          '<span>' + (objPanelOpen ? 'Hide' : 'Show') + ' ART Objectives</span></button>';
      center =
        '<button class="bn-ico" type="button" title="Layout">' + bIcon('view') + '</button>' +
        '<span class="bn-here">' + bIcon('objectives', 'bn-cico') + '<span>ART Objectives</span></span>';
    } else {
      left =
        '<button class="bn-ico bn-home" type="button" data-nav="home" title="Dashboard">' + bIcon('apps') + '</button>' +
        '<button class="bn-ico" type="button" title="Search">' + bIcon('search') + '</button>' +
        '<button class="bn-ico" type="button" title="Boards">' + bIcon('board') + '</button>' +
        '<button class="bn-ico" type="button" title="History">' + bIcon('history') + '</button>';
      center =
        '<button class="bn-ico" type="button" title="Layout">' + bIcon('view') + '</button>' +
        '<button class="bn-chip" type="button">' + bIcon('teamboard', 'bn-cico') + '<span>' + esc(c.board) + '</span>' + bIcon('chev', 'bn-chev') + '</button>' +
        '<button class="bn-chip" type="button">' + bIcon('folder', 'bn-cico') + '<span>' + esc(c.program) + '</span>' + bIcon('chev', 'bn-chev') + '</button>' +
        '<button class="bn-chip" type="button">' + bIcon('people', 'bn-cico') + '<span>' + esc(c.team) + '</span>' + bIcon('chev', 'bn-chev') + '</button>';
    }
    bnav.innerHTML =
      '<div class="bn-group bn-left">' + left + '</div>' +
      '<div class="bn-group bn-center">' + center + '</div>' +
      '<div class="bn-group bn-right">' +
        '<div class="bn-avs">' + avatars + '<span class="bn-more">+1</span></div>' +
        '<button class="bn-ico" type="button" title="Snapshot">' + bIcon('snap') + '</button>' +
        '<button class="bn-ico" type="button" title="Edit">' + bIcon('edit') + '</button>' +
        '<button class="bn-ico bn-toggle on" type="button" title="Board view">' + bIcon('view') + '</button>' +
        '<button class="bn-ico bn-toggle" type="button" title="List view">' + bIcon('board') + '</button>' +
        '<span class="bn-me">' + esc(initials(state.user.name)) + '</span>' +
      '</div>';
  }

  // ---------- Floating side rail (static) ----------
  let railActive = 'team';
  function renderSideRail() {
    const items = [
      ['solbacklog', 'solbacklog', 'Solution Backlog Board'],
      ['solplan', 'solplan', 'Solution Planning Board'],
      ['artbacklog', 'artbacklog', 'ART Backlog Board'],
      ['artplan', 'artplan', 'ART Planning Board'],
      ['objectives', 'objectives', 'ART Objectives'],
      ['risk', 'risk', 'Risk Board'],
      ['team', 'teamrail', 'Team Board'],
      ['collab', 'collab', 'Collaboration Boards'],
    ];
    srail.innerHTML =
      '<button class="sr-btn" type="button" data-rail="shift" title="Move rail to the other side">' + bIcon('shift') + '</button>' +
      '<div class="sr-sep"></div>' +
      items.slice(0, 2).map((it) => srBtn(it)).join('') +
      '<div class="sr-sep"></div>' +
      items.slice(2).map((it) => srBtn(it)).join('');
  }
  function srBtn(it) {
    return '<button class="sr-btn' + (railActive === it[0] ? ' on' : '') + '" type="button" data-rail="' + it[0] + '" title="' + esc(it[2]) + '">' + bIcon(it[1]) + '</button>';
  }

  // ---------- Sticky notes ----------
  const NOTE_COLS = 4, NOTE_W = 96, NOTE_H = 66, NOTE_GX = 12, NOTE_GY = 14;
  function noteHtml(c, i) {
    const h = hashCode(c.id);
    const col = i % NOTE_COLS, row = Math.floor(i / NOTE_COLS);
    const jx = (h % 15) - 5, jy = ((h >> 4) % 13) - 5;
    const x = 6 + col * (NOTE_W + NOTE_GX) + Math.max(-4, jx);
    const y = 4 + row * (NOTE_H + NOTE_GY) + Math.max(-3, jy);
    const prog = 30 + (Math.abs(h) % 60);
    const done = Math.round(prog * 0.6);
    return '<div class="note k-' + c.kind + '" style="left:' + x + 'px;top:' + y + 'px">' +
      '<span class="n-tab"></span>' +
      '<div class="n-text">' + esc(c.title) + '</div>' +
      '<div class="n-bar"><i class="n-done" style="width:' + done + '%"></i><i class="n-doing" style="width:' + (prog - done) + '%"></i></div>' +
    '</div>';
  }

  // ---------- Panels ----------
  function iterPanel(idx, name) {
    const cards = state.cards.filter((c) => c.sprintIdx === idx);
    const load = cards.reduce((a, c) => a + (Number(c.points) || 0), 0);
    const notes = cards.map((c, i) => noteHtml(c, i)).join('');
    return '<div class="panel-h">' +
        '<div class="ph-row1">' + bIcon('bookmark', 'ph-bm') + '<span class="ph-name">' + esc(name) + '</span>' +
          '<span class="ph-dates">' + esc(state.context.dates) + '</span></div>' +
        '<div class="ph-row2">' +
          '<button class="cap-btn" type="button">Configure Capacity</button>' +
          '<span class="load-pill">Load: ' + load + '</span>' +
          '<span class="ph-sp"></span>' +
          '<button class="ph-ico2" type="button" title="Columns">' + bIcon('cols') + '</button>' +
          '<button class="ph-ico2" type="button" title="More">' + bIcon('dots') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="panel-b note-area">' + notes + '</div>';
  }
  function objPanel() {
    const committed = state.objectives.filter((o) => o.committed);
    const uncommitted = state.objectives.filter((o) => !o.committed);
    const grp = (label, list) =>
      '<div class="op-grp"><span>' + label + '</span><span class="op-n">' + list.length + '</span></div>' +
      list.map((o, i) =>
        '<div class="op-item"><div class="op-t"><b>' + (i + 1) + '</b> ' + esc(o.text) + '</div>' +
        '<div class="op-meta"><span class="op-bv">' + o.bv + ' BV</span><span class="op-lk">' + bIcon('collab', 'op-lkico') + ' ' + o.links + '</span></div></div>').join('');
    return '<div class="panel-h obj-h"><span class="ph-name">' + bIcon('bookmark', 'ph-bm') + 'Team Objectives</span>' +
        '<button class="ph-ico2" type="button" title="Expand">' + bIcon('expand') + '</button></div>' +
      '<div class="panel-b op-body">' + grp('Committed', committed) + grp('Uncommitted', uncommitted) + '</div>';
  }
  function riskPanel() {
    const rows = state.risks.map((r) =>
      '<div class="rk-item"><span class="rk-badge">' + esc(r.cat || 'U') + '</span><span>' + esc(r.text) + '</span></div>').join('');
    return '<div class="panel-h risk-h">' + bIcon('risk', 'rk-shield') + '<span class="ph-name rk-title">Risks</span></div>' +
      '<div class="panel-b rk-body">' + (rows || '<div class="rk-empty">No risks captured yet.</div>') + '</div>';
  }

  // ---------- Canvas (one continuous board sheet) ----------
  const PCOLS = 4, PAD = 20, MAXZOOM = 3;
  let boardW = 0, boardH = 0;
  const RAIL_NAMES = {
    solbacklog: 'Solution Backlog Board', solplan: 'Solution Planning Board',
    artbacklog: 'ART Backlog Board', artplan: 'ART Planning Board',
    objectives: 'ART Objectives', risk: 'Risk Board', collab: 'Collaboration Boards',
  };
  function renderCanvas() {
    if (railActive === 'objectives') return renderObjectivesBoard();
    if (railActive === 'team') return renderTeamBoard();
    return renderPlaceholderBoard();
  }
  function renderTeamBoard() {
    const iters = state.sprints.map((name, idx) => ({ type: 'iter', idx, name }));
    const items = iters.slice(0, 4).concat([{ type: 'obj' }, { type: 'risk' }]).concat(iters.slice(4));
    const rows = Math.ceil(items.length / PCOLS);
    boardW = canvasWrap.clientWidth - 2 * PAD;
    boardH = canvasWrap.clientHeight - 2 * PAD;
    canvas.style.width = boardW + 'px';
    canvas.style.height = boardH + 'px';
    const cells = items.map((it, k) => {
      const col = k % PCOLS, row = Math.floor(k / PCOLS);
      const cls = 'wb-panel' + (col === PCOLS - 1 ? ' last-col' : '') + (row === rows - 1 ? ' last-row' : '');
      if (it.type === 'iter') return '<section class="' + cls + ' iboard">' + iterPanel(it.idx, it.name) + '</section>';
      if (it.type === 'obj') return '<section class="' + cls + ' objp">' + objPanel() + '</section>';
      return '<section class="' + cls + ' riskp">' + riskPanel() + '</section>';
    }).join('');
    canvas.innerHTML = '<div class="board-sheet" style="grid-template-columns:repeat(' + PCOLS +
      ',1fr);grid-template-rows:repeat(' + rows + ',1fr)">' + cells + '</div>';
  }

  // ART Objectives: team blocks in a balanced masonry (shortest column first)
  function objRow(o, i) {
    return '<div class="ob-item"><div class="ob-t"><b>' + (i + 1) + '</b> ' + esc(o.text) + '</div>' +
      '<div class="ob-meta"><span class="ob-bv">' + o.bv + ' BV</span>' +
      '<span class="ob-lk">' + bIcon('collab', 'op-lkico') + ' ' + o.links + '</span></div></div>';
  }
  function objGroup(label, list) {
    return '<div class="ob-grp"><span>' + label + '</span><span class="ob-n">' + list.length + '</span></div>' +
      list.map(objRow).join('');
  }
  function teamBlock(tm) {
    const objs = tm.objectives || [];
    const com = objs.filter((o) => o.committed), unc = objs.filter((o) => !o.committed);
    return '<section class="obj-block"><div class="ob-head">' + esc(tm.name) + '</div>' +
      objGroup('Commited', com) + objGroup('Uncommitted', unc) + '</section>';
  }
  function estBlock(tm) {
    const objs = tm.objectives || [];
    return 56 + 2 * 34 + objs.length * 78; // header + 2 group labels + items
  }
  function renderObjectivesBoard() {
    const COLS = 3;
    const cols = [[], [], []], colH = [0, 0, 0];
    state.teams.forEach((tm) => {
      const ci = colH.indexOf(Math.min.apply(null, colH));
      cols[ci].push(tm); colH[ci] += estBlock(tm);
    });
    const availW = canvasWrap.clientWidth - 2 * PAD;
    const availH = canvasWrap.clientHeight - 2 * PAD;
    boardW = availW;
    canvas.style.width = boardW + 'px';
    canvas.style.height = 'auto';
    canvas.innerHTML = '<div class="obj-sheet">' + cols.map((teams, ci) =>
      '<div class="obj-col' + (ci === COLS - 1 ? ' last-col' : '') + '">' +
      teams.map(teamBlock).join('') + '</div>').join('') + '</div>';
    boardH = Math.max(canvas.firstChild.scrollHeight, availH);
    canvas.style.height = boardH + 'px';
  }

  function renderPlaceholderBoard() {
    boardW = canvasWrap.clientWidth - 2 * PAD;
    boardH = canvasWrap.clientHeight - 2 * PAD;
    canvas.style.width = boardW + 'px';
    canvas.style.height = boardH + 'px';
    canvas.innerHTML = '<div class="board-sheet wb-soon"><div class="soon-card">' +
      bIcon('apps', 'soon-ic') + '<h3>' + esc(RAIL_NAMES[railActive] || 'Board') + '</h3>' +
      '<p>This board isn’t wired up yet — coming next.</p></div></div>';
  }

  // ART Objectives side panel (collapsible)
  let objPanelOpen = true;
  function renderArtSide() {
    if (railActive !== 'objectives') { artSide.innerHTML = ''; return; }
    const list = state.artObjectives;
    const com = list.filter((o) => o.committed), unc = list.filter((o) => !o.committed);
    const card = (o, i) =>
      '<div class="as-card"><div class="as-top"><span class="as-num">' + (i + 1) + '</span>' +
        '<div class="as-title">' + esc(o.title) + '</div>' +
        '<button class="as-ico" type="button">' + bIcon('collab') + '</button>' +
        '<button class="as-ico" type="button">' + bIcon('dots') + '</button></div>' +
      '<div class="as-desc">' + esc(o.desc) + '</div><span class="as-more">See more</span>' +
      '<div class="as-foot"><span class="as-bv"><span class="as-bv-box">' + o.bv + '</span>Business Value</span>' +
        '<span class="as-lk">' + bIcon('collab', 'op-lkico') + ' ' + o.links + '</span></div></div>';
    const grp = (label, arr) =>
      '<div class="as-grp"><span>' + label + '</span><span class="as-n">' + arr.length + '</span></div>' +
      arr.map(card).join('');
    artSide.innerHTML =
      '<div class="as-head"><span class="as-art">' + esc(state.artName) + '</span>' +
        '<button class="as-add" type="button" title="Add objective">' + bIcon('plus') + '</button></div>' +
      '<div class="as-body">' + grp('Commited', com) + grp('Uncommitted', unc) + '</div>';
  }

  function renderCanvasIfVisible() { if (!boardScreen.hidden) { renderCanvas(); fitView(); } }

  // ---------- Zoom control ----------
  function renderZoomCtl() {
    zoomctl.innerHTML =
      '<button class="z-btn" type="button" data-z="fit" title="Fit board (100%)">' + bIcon('fit') + '</button>' +
      '<button class="z-btn" type="button" data-z="out" title="Zoom out">' + bIcon('minus') + '</button>' +
      '<span class="z-val">100%</span>' +
      '<button class="z-btn" type="button" data-z="in" title="Zoom in">' + bIcon('plus') + '</button>' +
      '<button class="z-btn z-help" type="button" title="Help">' + bIcon('help') + '</button>';
  }

  // ---------- Bounded view transform (pan + zoom) ----------
  // 100% = whole board fit in the viewport (with a little padding). You can
  // only zoom IN from there; panning is clamped to the board's edges.
  let view = { x: 0, y: 0, scale: 1 };
  let pan = null;
  function clampN(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function fitScale() {
    if (!boardW) return 1;
    return (canvasWrap.clientWidth - PAD * 2) / boardW;
  }
  function clampView() {
    const vw = canvasWrap.clientWidth, vh = canvasWrap.clientHeight, P = PAD;
    const bw = boardW * view.scale, bh = boardH * view.scale;
    view.x = bw <= vw - 2 * P ? (vw - bw) / 2 : clampN(view.x, vw - P - bw, P);
    view.y = bh <= vh - 2 * P ? (vh - bh) / 2 : clampN(view.y, vh - P - bh, P);
  }
  function applyView() {
    canvas.style.transform = 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.scale + ')';
    const z = zoomctl.querySelector('.z-val');
    if (z) z.textContent = Math.round((view.scale / (fitScale() || 1)) * 100) + '%';
  }
  function fitView() { view.scale = fitScale(); view.x = PAD; view.y = PAD; clampView(); applyView(); }
  function setScale(ns, mx, my) {
    const fs = fitScale();
    ns = clampN(ns, fs, fs * MAXZOOM);
    const wx = (mx - view.x) / view.scale, wy = (my - view.y) / view.scale;
    view.scale = ns; view.x = mx - wx * ns; view.y = my - wy * ns;
    clampView(); applyView();
  }
  function zoomBy(f) { setScale(view.scale * f, canvasWrap.clientWidth / 2, canvasWrap.clientHeight / 2); }

  canvasWrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = canvasWrap.getBoundingClientRect();
    setScale(view.scale * (1 - e.deltaY * 0.0012), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  canvasWrap.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, input, a, [contenteditable="true"]')) return;
    pan = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, id: e.pointerId };
    canvasWrap.classList.add('grabbing');
    try { canvasWrap.setPointerCapture(e.pointerId); } catch (_) {}
  });
  canvasWrap.addEventListener('pointermove', (e) => {
    if (!pan || e.pointerId !== pan.id) return;
    view.x = pan.vx + (e.clientX - pan.x);
    view.y = pan.vy + (e.clientY - pan.y);
    clampView(); applyView();
  });
  function endPan(e) { if (pan && e.pointerId === pan.id) { pan = null; canvasWrap.classList.remove('grabbing'); } }
  canvasWrap.addEventListener('pointerup', endPan);
  canvasWrap.addEventListener('pointercancel', endPan);
  window.addEventListener('resize', () => {
    if (!boardScreen.hidden) renderBoardView();
  });

  // ---------- Chrome interactions ----------
  srail.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rail]'); if (!b) return;
    const v = b.dataset.rail;
    if (v === 'shift') { srail.classList.toggle('srail--right'); requestAnimationFrame(fitView); return; }
    if (v === railActive) return;
    railActive = v; renderBoardView();
  });
  bnav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-nav]'); if (!b) return;
    const nav = b.dataset.nav;
    if (nav === 'home') exitBoard();
    else if (nav === 'toggle-art') { objPanelOpen = !objPanelOpen; renderBoardView(); }
  });
  zoomctl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-z]'); if (!b) return;
    const z = b.dataset.z;
    if (z === 'in') zoomBy(1.2);
    else if (z === 'out') zoomBy(1 / 1.2);
    else if (z === 'fit') fitView();
  });

  function renderBoardView() {
    boardScreen.classList.toggle('obj-mode', railActive === 'objectives');
    boardScreen.classList.toggle('obj-open', railActive === 'objectives' && objPanelOpen);
    renderTopNav();
    renderSideRail();
    renderArtSide();
    renderZoomCtl();
    renderCanvas();
    fitView();
  }

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
    if (name) { state.piName = name; save(); }
    shell.hidden = true; boardScreen.hidden = false;
    renderBoardView();
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
      for (let i = cur; i < n; i++) state.sprints.push('Iteration ' + (i + 1));
    }
    save(); renderCanvasIfVisible(); renderSettings();
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
      rRow('PI name', '', [rText(state.piName, (v) => { state.piName = v; save(); })]),
      rRow('ART name', 'Agile Release Train', [rText(state.artName, (v) => { state.artName = v || 'ART'; save(); })]),
    ]));

    // Cadence
    const lastIsIP = /IP/i.test(state.sprints[state.sprints.length - 1] || '');
    const chips = el('div', { class: 'iter-chips' }, state.sprints.map((s) => el('span', { text: s })));
    body.appendChild(rCard('Cadence', 'Shape the iterations that make up the PI.', [
      rRow('Iterations', '1–12 sprints', [rStepper(state.sprints.length, 1, 12, setIterationCount)]),
      chips,
      rRow('Iteration length', 'Weeks per iteration', [rNum(state.iterationWeeks, 1, (v) => { state.iterationWeeks = v || 1; save(); }), el('span', { class: 'pts-unit', text: 'wks' })]),
      rRow('Last iteration is IP', 'Innovation & Planning buffer', [rToggle(lastIsIP, (on) => {
        const last = state.sprints.length - 1;
        if (on) state.sprints[last] = 'IP Iteration';
        else if (/IP/i.test(state.sprints[last])) state.sprints[last] = 'Iteration ' + (last + 1);
        save(); renderCanvasIfVisible(); renderSettings();
      })]),
    ]));

    // Capacity
    body.appendChild(rCard('Capacity', 'Defaults for team load planning.', [
      rRow('Default team capacity', 'Points / iteration for new teams', [rNum(state.defaultCapacity, 0, (v) => { state.defaultCapacity = v; save(); })]),
      rRow('Apply to existing teams', 'Overwrite every team with the default', [
        el('button', { class: 'r-btn', type: 'button', text: 'Apply to ' + state.teams.length + ' teams',
          onclick: () => { state.teams.forEach((t) => { t.capacity = state.defaultCapacity; }); save(); renderCanvasIfVisible(); renderSide(); renderSettings(); } }),
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
    if (e.key === 'Escape') closeUserMenu();
  });

  function fullRender() {
    applyTheme();
    renderSide();
    renderPage(currentPage);
    if (!boardScreen.hidden) renderBoardView();
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
