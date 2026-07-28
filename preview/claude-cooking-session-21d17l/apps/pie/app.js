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
    const rags = ['green', 'amber', 'green', 'red', 'amber'];
    return ART_OBJ.map((o, i) => ({ id: uid(), title: o.title, desc: o.desc, bv: 0, av: 0, rag: rags[i] || 'green', links: [7, 5, 5, 5, 3][i] || 4, committed: i < 3 }));
  }
  // A heavy objective load (9 committed + 5 uncommitted) for crowding tests.
  function genManyObjectives(i) {
    const out = [];
    for (let k = 0; k < 9; k++) out.push({ id: uid(), text: OBJ_POOL[(i + k) % OBJ_POOL.length], bv: [8, 10, 13, 5][k % 4], links: (k % 3) + 1, committed: true });
    for (let k = 0; k < 5; k++) out.push({ id: uid(), text: OBJ_POOL[(i + k + 3) % OBJ_POOL.length], bv: [5, 8, 3][k % 3], links: k % 3, committed: false });
    return out;
  }

  // Pages: sets of purpose-specific documents assembled from boards + conversations.
  // Each page belongs to a team; the team's TYPE ('team' | 'art' | 'st') gates access,
  // so switching context swaps the whole page catalogue.
  function defaultPages() {
    return [
      { id: 'strategy-doc', owner: 'st', title: 'Strategy Document', purpose: 'Strategy', updated: '2w ago', blocks: [
        { type: 'file', name: 'strategy-2026.pdf', note: 'Uploaded as planning context — pages and reports below can cite it.' },
        { type: 'text', text: 'Three strategic themes for 2026: one coherent customer journey across surfaces, trustworthy insights by default, and an open platform partners can build on without hand-holding.' },
        { type: 'okr', title: 'How the portfolio pays into these themes', src: 'ART Objectives' },
      ] },
      { id: 'team-dashboard', owner: 'team', title: 'Team Dashboard', purpose: 'Reporting', updated: '10m ago', blocks: [
        { type: 'text', text: 'Live metrics for this team — assembled from the Team Board and Risk Board, refreshed on open.' },
        { type: 'stats', title: 'This increment at a glance', src: 'Team Board' },
        { type: 'burndown', title: 'Iteration burndown', src: 'Team Board' },
        { type: 'risk', title: 'What could hurt us next', src: 'Risk Board' },
      ] },
      { id: 'art-sync', owner: 'art', title: 'ART Sync Meeting', purpose: 'Facilitation', updated: '1h ago', blocks: [
        { type: 'deps', title: 'Critical dependencies to discuss', src: 'ART Planning Board' },
        { type: 'text', text: 'Focus for today: unblock the SSO handshake between Falcon and Otter, and confirm an owner for the event-pipeline schema before Iteration 3 starts.' },
        { type: 'burndown', title: 'Current iteration burndown', src: 'Team Boards' },
        { type: 'convo', title: 'Conversations & decisions — last 7 days', src: 'Conversations' },
        { type: 'risk', title: 'Riskiest part of the plan', src: 'Risk Board' },
      ] },
      { id: 'scrum-of-scrums', owner: 'art', title: 'Scrum of Scrums', purpose: 'Facilitation', updated: 'yesterday', blocks: [
        { type: 'text', text: 'Round-the-room notes for team representatives. Each team gets two minutes: progress, plans, problems.' },
        { type: 'deps', title: 'Cross-team hand-offs this week', src: 'ART Planning Board' },
        { type: 'risk', title: 'Escalations for the RTE', src: 'Risk Board' },
      ] },
      { id: 'pi-okrs', owner: 'art', title: 'PI OKRs', purpose: 'Strategy', updated: '3d ago', blocks: [
        { type: 'text', text: 'Our ART objectives for this increment, written as OKRs and linked live to the boards that pay into them.' },
        { type: 'okr', title: 'Objectives & key results', src: 'ART Objectives' },
      ] },
      { id: 'pi-agenda', owner: 'art', title: 'PI Planning Agenda', purpose: 'Facilitation', updated: '4d ago', blocks: [
        { type: 'text', text: 'Two-day agenda: business context, product vision, team breakouts, draft plan review, management review, final plan review and confidence vote.' },
      ] },
      { id: 'inspect-adapt', owner: 'art', title: 'Inspect & Adapt Workshop', purpose: 'Facilitation', updated: '1w ago', blocks: [
        { type: 'text', text: 'PI system demo, quantitative measurement, and the problem-solving workshop. Bring the metrics from the dashboards below.' },
        { type: 'risk', title: 'Biggest recurring impediment', src: 'Risk Board' },
      ] },
      { id: 'dependency-report', owner: 'art', title: 'Dependency Report', purpose: 'Reporting', updated: '6h ago', blocks: [
        { type: 'deps', title: 'All cross-team dependencies', src: 'ART Planning Board' },
        { type: 'text', text: 'Generated from the planning board — hand-offs sorted by iteration, blocked items first.' },
      ] },
      { id: 'capacity-report', owner: 'art', title: 'Capacity Report', purpose: 'Reporting', updated: '1d ago', blocks: [
        { type: 'stats', title: 'Load vs. capacity across the ART', src: 'Team Boards' },
        { type: 'burndown', title: 'Trend', src: 'Team Boards' },
      ] },
      { id: 'retro-notes', owner: 'team', title: 'Retro Notes', purpose: 'Facilitation', updated: '2d ago', blocks: [
        { type: 'text', text: 'What went well, what didn’t, what we try next iteration. Linked to the conversations that raised each point.' },
        { type: 'convo', title: 'Threads behind these notes', src: 'Conversations' },
      ] },
      { id: 'leadership-status', owner: 'art', title: 'Leadership Status Report', purpose: 'Reporting', updated: '2d ago', blocks: [
        { type: 'text', text: 'One-page status for business leaders: where the plan stands, what changed this week, and where we need decisions.' },
        { type: 'burndown', title: 'Delivery trend', src: 'Team Boards' },
        { type: 'okr', title: 'How the plan pays into our strategic themes', src: 'ART Objectives' },
        { type: 'risk', title: 'Decisions we need from you', src: 'Risk Board' },
      ] },
    ];
  }

  // Conversations belong to a team, to a single sticky note (comments), or to
  // individual users (chat). Team+chat threads live in the people panel;
  // board threads (including that board's sticky threads) in the board panel;
  // sticky threads also open directly on the note. `board` ties a thread to a board id.
  function defaultThreads() {
    return [
      { id: uid(), kind: 'team', board: 'artplan', who: 'Mara Kim', ini: 'MK', color: '#6a9be0', ago: '2h', where: 'ART Planning Board',
        text: '@Ari — the SSO handshake lands in Iteration 2. Can Falcon own the token-exchange piece?',
        replies: [{ who: 'Ari Ruiz', ini: 'AR', color: '#e0746a', ago: '1h', text: 'Yes — moving it next to the login-screen story now.' }] },
      { id: uid(), kind: 'team', board: 'risk', who: 'Tom Sato', ini: 'TS', color: '#6ad0a8', ago: '5h', where: 'Risk Board', pageRef: 'art-sync',
        text: 'Prepped tomorrow’s ART Sync page — the dependency list is pulled in already, please review.', replies: [] },
      { id: uid(), kind: 'team', board: 'team', who: 'Mara Kim', ini: 'MK', color: '#6a9be0', ago: '3h', where: 'Team Board',
        text: 'Iteration 2 looks overloaded — 13 points over capacity. Can we move a story right?', replies: [] },
      { id: uid(), kind: 'sticky', board: 'team', sticky: 'Billing API', who: 'Jo Deng', ini: 'JD', color: '#caa15a', ago: '1d', where: 'Sticky · Billing API',
        text: 'Should we split this into contract + implementation? 13 points feels heavy for one iteration.',
        replies: [{ who: 'Mara Kim', ini: 'MK', color: '#6a9be0', ago: '1d', text: 'Agreed — let’s decide in the huddle tomorrow.' }] },
      { id: uid(), kind: 'sticky', board: 'team', sticky: 'Login screen', who: 'Ari Ruiz', ini: 'AR', color: '#e0746a', ago: '6h', where: 'Sticky · Login screen',
        text: 'Design specs are attached in Figma — are these final?', replies: [] },
      { id: uid(), kind: 'chat', who: 'Ari Ruiz', ini: 'AR', color: '#e0746a', ago: '30m', where: 'Chat · Ari Ruiz',
        text: 'Got five minutes before standup? Want to huddle on the Otter dependency.', replies: [] },
      { id: uid(), kind: 'chat', who: 'Tom Sato', ini: 'TS', color: '#6ad0a8', ago: '2d', where: 'Chat · Tom Sato',
        text: 'Thanks for unblocking the migration window yesterday 🙌', replies: [] },
    ];
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
  const convoEl = document.getElementById('convo');
  const navEl = document.getElementById('navtree');
  const dockEl = document.getElementById('dock');
  const btoolsEl = document.getElementById('btools');
  const modalEl = document.getElementById('pmodal');
  const hubEl = document.getElementById('hub');
  const paletteEl = document.getElementById('palette');

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
    s.artObjectives.forEach((o) => { if (typeof o.av !== 'number') o.av = 0; if (!o.rag) o.rag = 'green'; });
    // Seed a realistic To Do / In Progress / Done spread so execution progress bars mean something.
    if (Array.isArray(s.cards)) s.cards.forEach((c, i) => { if (!c.status) c.status = ['done', 'doing', 'todo', 'todo', 'doing', 'done', 'todo', 'doing'][i % 8]; });
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
    // Team hierarchy: user-teams roll up into ARTs, ARTs into a Solution Train.
    // Every artifact (board, page, view, conversation) belongs to a team of some type.
    if (!Array.isArray(s.arts) || !s.arts.length) {
      const half = Math.ceil(s.teams.length / 2);
      s.arts = [
        { id: uid(), name: s.artName || 'Digital Experience ART', teamIds: s.teams.slice(0, half).map((t) => t.id) },
        { id: uid(), name: 'Payments ART', teamIds: s.teams.slice(half).map((t) => t.id) },
      ];
    }
    s.st = s.st || { id: uid(), name: 'Horizon Solution Train' };
    // Stress case: Payments ART is BIG — eight teams, each with a heavy
    // objective load, so the ART Objectives designs can be judged under crowding.
    if (!s.payTeams) {
      s.payTeams = true;
      const pay = s.arts[1];
      if (pay) {
        ['Lynx', 'Heron', 'Badger', 'Osprey', 'Viper'].forEach((nm) => {
          const t = { id: uid(), name: nm, capacity: 22, objectives: [] };
          s.teams.push(t);
          pay.teamIds.push(t.id);
        });
        s.teams.forEach((t, i) => { if (pay.teamIds.includes(t.id)) t.objectives = genManyObjectives(i); });
      }
    }
    // Mix it like a real planning wall: some teams have no objectives yet.
    if (!s.payMix) {
      s.payMix = true;
      ['Badger', 'Osprey', 'Viper'].forEach((nm) => {
        const t = s.teams.find((x) => x.name === nm);
        if (t) t.objectives = [];
      });
    }
    s.navVersion = ['v2', 'v3', 'v4'].indexOf(s.navVersion) >= 0 ? s.navVersion : 'v1';
    // Seed a couple of real links on every card so the Breakdown graph shows
    // genuine connections for any sticky (also powers the Links overlay & Pin).
    if (!s.linksSeeded && Array.isArray(s.cards) && s.cards.length > 4) {
      s.linksSeeded = true;
      const N = s.cards.length;
      s.cards.forEach((c, i) => {
        c.links = c.links || [];
        [3, 7].forEach((off) => {
          const t = s.cards[(i + off) % N];
          if (t && t.id !== c.id && !c.links.includes(t.id) && !(t.links || []).includes(c.id)) c.links.push(t.id);
        });
      });
    }
    // The viewer's own team — highlighted on the ART Objectives board so it's
    // easy to spot among many. Marlin sits in the crowded Payments ART.
    if (!s.myTeamId || !s.teams.some((t) => t.id === s.myTeamId)) {
      const mine = s.teams.find((t) => t.name === 'Marlin') || s.teams[0];
      s.myTeamId = mine ? mine.id : null;
    }
    s.workMode = s.workMode === 'execution' ? 'execution' : 'planning';
    s.boardCfg = Object.assign({ dates: true, grid: true, compact: false }, s.boardCfg);
    if (!Array.isArray(s.pages) || !s.pages.length || !s.pages[0].owner || !s.pages.some((p) => p.id === 'pi-agenda')) s.pages = defaultPages();
    if (!Array.isArray(s.threads) || !s.threads.length || !s.threads[0].kind || !s.threads.some((t) => t.board)) s.threads = defaultThreads();
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
      grip: '<circle cx="9" cy="6" r="1.35" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.35" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.35" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.35" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.35" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.35" fill="currentColor" stroke="none"/>',
      chevup: '<path d="M6 15l6-6 6 6"/>',
      expand: '<path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4"/>',
      // zoom
      plus: '<path d="M12 5v14M5 12h14"/>',
      minus: '<path d="M5 12h14"/>',
      fit: '<path d="M4 9V5a1 1 0 011-1h4M20 9V5a1 1 0 00-1-1h-4M4 15v4a1 1 0 001 1h4M20 15v4a1 1 0 01-1 1h-4"/>',
      help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 113.5 2.3c-.8.4-1 .8-1 1.7"/><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none"/>',
      snap: '<rect x="4" y="6" width="16" height="13" rx="2"/><path d="M9 6l1.5-2h3L15 6"/><circle cx="12" cy="12.5" r="3"/>',
      doc: '<path d="M7 3h7l5 5v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 16.5h6"/>',
      menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
      gauge: '<path d="M5 19a9 9 0 1114 0"/><path d="M12 13l3.5-3.5"/><circle cx="12" cy="13" r="1" fill="currentColor" stroke="none"/>',
      gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9L19 19M19 5l-2.1 2.1M7.1 16.9L5 19"/>',
      cursor: '<path d="M5.5 3.5l14 6.5-6 1.8-2.5 5.7z"/><path d="M13 13l5 5"/>',
      magnify: '<circle cx="10.5" cy="10.5" r="6"/><path d="M20 20l-5-5"/><path d="M8 10.5h5M10.5 8v5"/>',
      scale: '<rect x="3.5" y="12.5" width="7" height="7" rx="1.2"/><rect x="12" y="4" width="8.5" height="8.5" rx="1.5"/><path d="M9 9l2.5 2.5"/>',
      timer: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2"/><path d="M9.5 3h5"/>',
      vote: '<path d="M7 11l3-7a2 2 0 012 2v4h5.2a2 2 0 012 2.3l-1 5.4A2 2 0 0116.2 19H9a2 2 0 01-2-2z"/><path d="M7 11H4v8h3"/>',
      chat: '<path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2h-6l-5.2 4V6z"/><path d="M8 8.5h8M8 11.5h5"/>',
      present: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v3M8.5 21h7"/>',
      // sticky action bar
      sqtype: '<rect x="4" y="4" width="16" height="16" rx="3.5"/>',
      alm: '<path d="M12 3l8.5 9-8.5 9-8.5-9z"/>',
      statusdot: '<circle cx="12" cy="12" r="7.5"/>',
      link: '<path d="M9 15l6-6"/><path d="M8.4 12.6l-1.6 1.6a3.4 3.4 0 004.8 4.8l1.6-1.6"/><path d="M15.6 11.4l1.6-1.6a3.4 3.4 0 00-4.8-4.8l-1.6 1.6"/>',
      trash: '<path d="M4 7h16"/><path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2"/><path d="M6.5 7l1 12a1 1 0 001 1h7a1 1 0 001-1l1-12"/>',
      removebox: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M8.5 12h7"/>',
      unplan: '<path d="M20 5v14"/><path d="M16.5 12H4"/><path d="M9 7l-5 5 5 5"/>',
      move: '<path d="M6 7l5 5-5 5"/><path d="M13 7l5 5-5 5"/>',
      mirror: '<rect x="3.5" y="8" width="9" height="12" rx="1.5"/><rect x="13.5" y="4" width="7" height="9" rx="1.5" stroke-dasharray="2.6 2"/>',
      pin: '<circle cx="12" cy="8" r="4"/><path d="M12 12v9"/>',
      dupe: '<rect x="8" y="8" width="12" height="12" rx="2.2"/><path d="M4 16V6a2 2 0 012-2h10"/>',
      share: '<circle cx="6" cy="12" r="2.4"/><circle cx="17" cy="6" r="2.4"/><circle cx="17" cy="18" r="2.4"/><path d="M8.2 11l6.6-3.6M8.2 13l6.6 3.6"/>',
      breakdown: '<rect x="9" y="3" width="6" height="5" rx="1.2"/><rect x="3" y="16" width="6" height="5" rx="1.2"/><rect x="15" y="16" width="6" height="5" rx="1.2"/><path d="M6 16v-2h12v2M12 8v6"/>',
      activity: '<path d="M3 12h4l2.5 6 4-13 2.5 7H21"/>',
      // Sightline (AI assistant)
      spark: '<path d="M12 3.2l1.75 4.55L18.3 9.5l-4.55 1.75L12 15.8l-1.75-4.55L5.7 9.5l4.55-1.75z"/><path d="M18.4 15.1l.75 1.95 1.95.75-1.95.75-.75 1.95-.75-1.95-1.95-.75 1.95-.75z"/>',
      send: '<path d="M4.5 11.9L20 5l-6.9 15.5-2.4-6.2z"/><path d="M10.7 14.3L20 5"/>',
      restart: '<path d="M20 12a8 8 0 11-2.4-5.7"/><path d="M20 3.5V8h-4.5"/>',
    };
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (P[name] || '') + '</svg>';
  }

  function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
  function avatar(initials, color) {
    return '<span class="b-av" style="background:' + color + '">' + esc(initials) + '</span>';
  }

  // ---------- Boards registry: [id, rail icon, name, owning team type] ----------
  // Boards belong to teams; the team type decides which boards exist at that level.
  const BOARD_LIST = [
    ['solbacklog', 'solbacklog', 'Solution Backlog Board', 'st'],
    ['solplan', 'solplan', 'Solution Planning Board', 'st'],
    ['artbacklog', 'artbacklog', 'ART Backlog Board', 'art'],
    ['artplan', 'artplan', 'ART Planning Board', 'art'],
    ['objectives', 'objectives', 'ART Objectives', 'art'],
    ['risk', 'risk', 'Risk Board', 'art'],
    ['team', 'teamrail', 'Team Board', 'team'],
    ['collab', 'collab', 'Collaboration Boards', 'any'],
  ];
  const boardDef = (id) => BOARD_LIST.find((x) => x[0] === id);
  const boardName = (id) => { const b = boardDef(id); return b ? b[2] : 'Board'; };
  const boardIcon = (id) => { const b = boardDef(id); return b ? b[1] : 'board'; };
  const boardsFor = (type) => BOARD_LIST.filter((b) => b[3] === type || b[3] === 'any');

  // ---------- Chrome state ----------
  let railActive = 'team';
  let railRight = false;   // user's left/right preference (forced right on ART Objectives)
  let mode = 'board';      // 'board' | 'page' — the two planes of a session
  let activePage = null;   // page id when mode === 'page'
  let convoOpen = false;   // right-side conversation panel
  let panelMode = 'people'; // which panel: 'people' (team+chats) | 'board' (board incl. stickies)
  let cvFilter = 'team';   // people-panel tab: team | chat
  let stickyOpen = null;   // sticky title whose on-note thread is open
  let sbCard = null;       // card whose action bar is open
  let sbAnchor = null;     // screen rect of that note
  let sbSub = null;        // open action-bar sub-panel key
  let pinned = null;       // pinned card id (focus mode)
  let linkMode = null;     // source card id while string-linking
  let modalCard = null;    // card context for breakdown / links overlay
  let menuOpen = null;     // which top-nav dropdown is open

  // v4 exists only as a design variant slot (ART Objectives); its navigation
  // chrome is v3's. chromeV() is what version-of-chrome checks should use.
  const chromeV = () => (state.navVersion === 'v4' ? 'v3' : state.navVersion);

  // Working context: WHICH TEAM you are working as — a user-team, an ART
  // (team of teams) or the Solution Train (team of ARTs). Everything else
  // (boards, pages, conversations) is scoped by it.
  let ctx = { type: 'team', id: (state.teams[0] || {}).id };
  const TYPE_LABEL = { team: 'Team', art: 'ART', st: 'Solution Train' };
  const artById = (id) => state.arts.find((a) => a.id === id) || state.arts[0];
  const artOf = (teamId) => state.arts.find((a) => a.teamIds.includes(teamId)) || state.arts[0];
  function ctxArt() {
    if (ctx.type === 'art') return artById(ctx.id);
    if (ctx.type === 'team') return artOf(ctx.id);
    return state.arts[0];
  }
  function ctxName() {
    if (ctx.type === 'st') return state.st.name;
    if (ctx.type === 'art') return ctxArt().name;
    const t = team(ctx.id) || state.teams[0];
    return t ? t.name : 'Team';
  }
  // The user-teams inside the current scope (one for a team, the ART's teams
  // for an ART, everyone for the Solution Train).
  function ctxTeams() {
    if (ctx.type === 'team') return state.teams.filter((t) => t.id === ctx.id);
    if (ctx.type === 'art') return state.teams.filter((t) => ctxArt().teamIds.includes(t.id));
    return state.teams;
  }
  const inScope = (teamId) => ctxTeams().some((t) => t.id === teamId);
  function ensureCtxValid() {
    if (ctx.type === 'team' && !team(ctx.id)) ctx = { type: 'team', id: (state.teams[0] || {}).id };
    if (ctx.type === 'art' && !state.arts.find((a) => a.id === ctx.id)) ctx = { type: 'art', id: state.arts[0].id };
  }
  const pagesFor = () => state.pages.filter((p) => p.owner === ctx.type);

  // Switch the working context; snap board/page to something the new team owns.
  function setCtx(type, id) {
    ctx = { type, id };
    const list = boardsFor(type);
    if (!list.some((b) => b[0] === railActive)) railActive = list[0][0];
    if (mode === 'page') {
      const ps = pagesFor();
      if (!ps.some((p) => p.id === activePage)) activePage = ps[0] ? ps[0].id : null;
      if (!activePage) mode = 'board';
    }
  }
  // Jump to a board; adopt the team context of whoever owns it.
  function gotoBoard(id) {
    const owner = (boardDef(id) || [])[3];
    if (owner === 'st') ctx = { type: 'st', id: state.st.id };
    else if (owner === 'art') ctx = { type: 'art', id: ctxArt().id };
    else if (owner === 'team' && ctx.type !== 'team') {
      const t = ctxTeams()[0] || state.teams[0];
      ctx = { type: 'team', id: t.id };
    }
    mode = 'board'; railActive = id;
  }
  // Jump to a page; adopt the context of the team type that owns it.
  function gotoPage(id) {
    const p = state.pages.find((x) => x.id === id);
    if (!p) return;
    if (p.owner === 'st') ctx = { type: 'st', id: state.st.id };
    else if (p.owner === 'art') ctx = { type: 'art', id: ctxArt().id };
    else if (ctx.type !== 'team') { const t = ctxTeams()[0] || state.teams[0]; ctx = { type: 'team', id: t.id }; }
    mode = 'page'; activePage = id;
  }

  // ---------- Top navigation: the model's spine as live switcher chips ----------
  function ddWrap(key, btnHtml, menuHtml) {
    const open = menuOpen === key;
    return '<div class="bn-dd' + (open ? ' open' : '') + '">' + btnHtml +
      (open ? '<div class="dd-menu">' + menuHtml + '</div>' : '') + '</div>';
  }
  function ddChipBtn(key, icoName, label) {
    return '<button class="bn-chip" type="button" data-dd="' + key + '">' + bIcon(icoName, 'bn-cico') +
      '<span>' + esc(label) + '</span>' + bIcon('chev', 'bn-chev') + '</button>';
  }
  function ddItem(attrs, icoName, label, on, hint) {
    return '<button class="dd-i' + (on ? ' on' : '') + '" type="button" ' + attrs + '>' +
      bIcon(icoName, 'dd-ico') + '<span>' + esc(label) + '</span>' +
      (on ? '<span class="dd-check">✓</span>' : hint ? '<span class="dd-hint">' + esc(hint) + '</span>' : '') +
      '</button>';
  }
  function boardMenu() {
    const groups = [['st', state.st.name], ['art', ctxArt().name], ['team', 'Team boards'], ['any', 'Shared']];
    return groups.map((g) =>
      '<div class="dd-h">' + esc(g[1]) + '</div>' +
      BOARD_LIST.filter((b) => b[3] === g[0]).map((b) =>
        ddItem('data-go-board="' + b[0] + '"', b[1], b[2], mode === 'board' && railActive === b[0])).join('')
    ).join('');
  }
  function pageMenu() {
    const scoped = pagesFor();
    const groups = [];
    scoped.forEach((p) => { if (!groups.includes(p.purpose)) groups.push(p.purpose); });
    return '<div class="dd-h">' + esc(ctxName()) + ' · Pages</div>' +
      groups.map((g) =>
        (groups.length > 1 ? '<div class="dd-h dd-h2">' + esc(g) + '</div>' : '') +
        scoped.filter((p) => p.purpose === g).map((p) =>
          ddItem('data-go-page="' + p.id + '"', 'doc', p.title, mode === 'page' && activePage === p.id, p.updated)).join('')
      ).join('');
  }
  function sessionMenu() {
    return '<div class="dd-h">PI Sessions</div>' +
      state.sessions.map((sn) => ddItem('data-go-session="' + esc(sn.name) + '"', 'folder', sn.name, sn.name === state.piName, sn.updated)).join('') +
      '<div class="dd-sep"></div>' +
      ddItem('data-go-shell="sessions"', 'apps', 'View all sessions', false);
  }
  // The context picker mirrors the team hierarchy: ST → ARTs → user-teams.
  function teamMenu() {
    let h = '<div class="dd-h">Working as</div>' +
      ddItem('data-go-ctx="st:' + state.st.id + '"', 'solplan', state.st.name, ctx.type === 'st', 'Solution Train');
    state.arts.forEach((a) => {
      h += ddItem('data-go-ctx="art:' + a.id + '"', 'artplan', a.name, ctx.type === 'art' && ctx.id === a.id, 'ART');
      h += state.teams.filter((t) => a.teamIds.includes(t.id)).map((t) =>
        '<div class="dd-ind">' + ddItem('data-go-ctx="team:' + t.id + '"', 'teamrail', t.name, ctx.type === 'team' && ctx.id === t.id, 'Team') + '</div>').join('');
    });
    return h;
  }
  function activeArtifactName() {
    if (mode === 'page') { const p = state.pages.find((x) => x.id === activePage); return p ? p.title : 'Page'; }
    return boardName(railActive);
  }
  function renderTopNav() {
    if (chromeV() === 'v3') { bnav.innerHTML = ''; renderDock(); return; }
    dockEl.innerHTML = '';
    const v2 = state.navVersion === 'v2';
    const avatars = [['AR', '#e0746a'], ['MK', '#6a9be0'], ['TS', '#6ad0a8'], ['JD', '#caa15a']]
      .map((a) => avatar(a[0], a[1])).join('');
    const obj = mode === 'board' && railActive === 'objectives';

    let left =
      '<button class="bn-ico bn-home" type="button" data-nav="home" title="Dashboard">' + bIcon('apps') + '</button>';
    if (v2) {
      left +=
        '<button class="bn-ico' + (navOpen ? ' on' : '') + '" type="button" data-nav="tree" title="Navigator">' + bIcon('menu') + '</button>' +
        '<button class="bn-ico" type="button" data-nav="palette" title="Search — jump anywhere (⌘K)">' + bIcon('search') + '</button>';
    } else {
      left +=
        '<button class="bn-ico" type="button" data-nav="palette" title="Search — jump anywhere (⌘K)">' + bIcon('search') + '</button>' +
        ddWrap('boards', '<button class="bn-ico' + (menuOpen === 'boards' ? ' on' : '') + '" type="button" data-dd="boards" title="Boards">' + bIcon('board') + '</button>', boardMenu()) +
        '<button class="bn-ico" type="button" title="History" disabled>' + bIcon('history') + '</button>';
    }
    left +=
      '<span class="bn-seg" title="Work mode">' +
        '<button class="' + (state.workMode === 'planning' ? 'on' : '') + '" type="button" data-mode="planning">Planning</button>' +
        '<button class="' + (state.workMode === 'execution' ? 'on' : '') + '" type="button" data-mode="execution">Execution</button>' +
      '</span>';
    if (obj) {
      left += '<button class="bn-chip" type="button" data-nav="toggle-art">' + bIcon('objectives', 'bn-cico') +
        '<span>' + (objPanelOpen ? 'Hide' : 'Show') + ' ART Objectives</span></button>';
    }

    let center;
    if (v2) {
      // v2: the tree is the navigation; the top bar just says where you are.
      center = '<span class="bn-crumb">' + esc(state.piName) + '<i>/</i>' + esc(ctxName()) +
        '<i>/</i><b>' + esc(activeArtifactName()) + '</b></span>';
    } else {
      const ctxChip = ddWrap('team',
        '<button class="bn-chip" type="button" data-dd="team">' + bIcon('people', 'bn-cico') +
          '<span>' + esc(ctxName()) + '</span><span class="bn-type">' + esc(TYPE_LABEL[ctx.type]) + '</span>' + bIcon('chev', 'bn-chev') + '</button>',
        teamMenu());
      if (mode === 'page') {
        const pg = pagesFor().find((p) => p.id === activePage) || pagesFor()[0];
        center =
          ddWrap('page', ddChipBtn('page', 'doc', pg ? pg.title : 'Pages'), pageMenu()) +
          ddWrap('session', ddChipBtn('session', 'folder', state.piName), sessionMenu()) +
          ctxChip;
      } else {
        center =
          '<button class="bn-ico" type="button" title="Layout" disabled>' + bIcon('view') + '</button>' +
          ddWrap('board', ddChipBtn('board', boardIcon(railActive), boardName(railActive)), boardMenu()) +
          ddWrap('session', ddChipBtn('session', 'folder', state.piName), sessionMenu()) +
          ctxChip;
      }
    }

    bnav.innerHTML =
      '<div class="bn-group bn-left">' + left + '</div>' +
      '<div class="bn-group bn-center">' + center + '</div>' +
      '<div class="bn-group bn-right">' +
        '<div class="bn-avs">' + avatars + '<span class="bn-more">+1</span></div>' +
        '<button class="bn-ico' + (convoOpen ? ' on' : '') + '" type="button" data-nav="convo" title="Conversation">' + bIcon('chat') +
          (state.threads.length ? '<span class="bn-badge">' + state.threads.length + '</span>' : '') + '</button>' +
        '<button class="bn-ico" type="button" title="Snapshot" disabled>' + bIcon('snap') + '</button>' +
        '<button class="bn-ico" type="button" title="Edit" disabled>' + bIcon('edit') + '</button>' +
        (v2 ? '' :
        '<span class="bn-plane">' +
          '<button class="bn-ico bn-toggle' + (mode === 'board' ? ' on' : '') + '" type="button" data-plane="board" title="Boards">' + bIcon('teamboard') + '</button>' +
          '<button class="bn-ico bn-toggle' + (mode === 'page' ? ' on' : '') + '" type="button" data-plane="page" title="Pages">' + bIcon('doc') + '</button>' +
        '</span>') +
        '<span class="bn-me">' + esc(initials(state.user.name)) + '</span>' +
      '</div>';
  }

  // ---------- v2: Navigator tree — the whole workspace in one panel ----------
  let navOpen = true;         // v2 sidebar visibility
  let expanded = null;        // which tree nodes are open (lazy-initialised)
  let recents = [];           // last visited artifacts (runtime only)
  const nodeId = (type, id) => (type === 'st' ? 'st' : type + ':' + id);
  function ensureExpanded() {
    if (expanded) return;
    expanded = {};
    expanded[nodeId(ctx.type, ctx.id)] = true;
    if (ctx.type === 'team') { expanded['art:' + artOf(ctx.id).id] = true; expanded.st = true; }
    if (ctx.type === 'art') expanded.st = true;
  }
  function recordRecent() {
    const id = mode === 'page' ? activePage : railActive;
    if (!id) return;
    const key = mode + ':' + ctx.type + ':' + (ctx.type === 'st' ? '' : ctx.id) + ':' + id;
    const label = mode === 'page' ? ((state.pages.find((p) => p.id === id) || {}).title || 'Page') : boardName(id);
    recents = recents.filter((r) => r.key !== key);
    recents.unshift({ key, mode, id, ctxType: ctx.type, ctxId: ctx.type === 'st' ? '' : ctx.id, ctxName: ctxName(), label,
      icon: mode === 'page' ? 'doc' : boardIcon(id) });
    recents = recents.slice(0, 5);
  }
  function ntItem(attr, ico, label, on, depth, hint) {
    return '<button class="nt-i' + (on ? ' on' : '') + '" type="button" ' + attr + ' style="--nt-depth:' + depth + '">' +
      bIcon(ico, 'nt-ico') + '<span>' + esc(label) + '</span>' +
      (hint ? '<span class="nt-hint">' + esc(hint) + '</span>' : '') + '</button>';
  }
  function ntArtifacts(type, id, depth) {
    const here = ctx.type === type && (type === 'st' || ctx.id === id);
    const boards = boardsFor(type).map((b) =>
      ntItem('data-nt-board="' + type + ':' + id + ':' + b[0] + '"', b[1], b[2], here && mode === 'board' && railActive === b[0], depth)).join('');
    const pages = state.pages.filter((p) => p.owner === type).map((p) =>
      ntItem('data-nt-page="' + type + ':' + id + ':' + p.id + '"', 'doc', p.title, here && mode === 'page' && activePage === p.id, depth)).join('');
    return '<div class="nt-sec" style="--nt-depth:' + depth + '">Boards</div>' + boards +
      '<div class="nt-sec" style="--nt-depth:' + depth + '">Pages</div>' + pages;
  }
  function ntNode(type, id, name, icon, depth) {
    const nid = nodeId(type, id);
    const isCtx = ctx.type === type && (type === 'st' || ctx.id === id);
    return '<button class="nt-node' + (isCtx ? ' ctx' : '') + '" type="button" data-nt-exp="' + nid + '" style="--nt-depth:' + depth + '">' +
      '<span class="nt-chev' + (expanded[nid] ? ' open' : '') + '">▸</span>' + bIcon(icon, 'nt-ico') +
      '<span>' + esc(name) + '</span><span class="nt-type">' + esc(TYPE_LABEL[type]) + '</span></button>';
  }
  function renderNavTree() {
    if (state.navVersion !== 'v2' || boardScreen.hidden || !navOpen) { navEl.innerHTML = ''; return; }
    ensureExpanded();
    let h = '<div class="nt-head">' +
      ddWrap('nt-session',
        '<button class="nt-sess" type="button" data-dd="nt-session">' + bIcon('folder', 'nt-ico') +
          '<span>' + esc(state.piName) + '</span>' + bIcon('chev', 'bn-chev') + '</button>',
        sessionMenu()) + '</div>';
    const prev = recents.slice(1, 5);
    if (prev.length) {
      h += '<div class="nt-sec nt-sec-top">Recent</div>' + prev.map((r) =>
        ntItem('data-nt-' + (r.mode === 'page' ? 'page' : 'board') + '="' + r.ctxType + ':' + r.ctxId + ':' + r.id + '"',
          r.icon, r.label, false, 0, r.ctxName)).join('');
    }
    h += '<div class="nt-sec nt-sec-top">Workspace</div>';
    h += ntNode('st', state.st.id, state.st.name, 'solplan', 0);
    if (expanded.st) {
      h += ntArtifacts('st', state.st.id, 1);
      state.arts.forEach((a) => {
        h += ntNode('art', a.id, a.name, 'artplan', 1);
        if (expanded['art:' + a.id]) {
          h += ntArtifacts('art', a.id, 2);
          state.teams.filter((t) => a.teamIds.includes(t.id)).forEach((t) => {
            h += ntNode('team', t.id, t.name, 'teamrail', 2);
            if (expanded['team:' + t.id]) h += ntArtifacts('team', t.id, 3);
          });
        }
      });
    }
    navEl.innerHTML = h;
  }
  // ---------- v3: floating dock + full-screen Hub ----------
  // The canvas is full-bleed; the dock only says where you are. ALL navigation
  // lives in the Hub — one overview that is browsed spatially or filtered by typing.
  let hubOpen = false, hubQuery = '', hubSel = 0;
  let dockPanel = null; // 'pages' — the team-pages shortcut dropdown
  function renderDock() {
    const obj = mode === 'board' && railActive === 'objectives';
    const pages = pagesFor();
    const peopleCount = state.threads.filter((t) => t.kind === 'team' || t.kind === 'chat').length;
    dockEl.innerHTML =
      '<button class="dk-crumb" type="button" data-nav="hub" title="Open the Hub (⌘K)">' +
        '<span class="dk-sess">' + esc(state.piName) + '</span><i>/</i>' +
        '<span>' + esc(ctxName()) + '</span><i>/</i><b>' + esc(activeArtifactName()) + '</b>' +
        '<span class="dk-k">⌘K</span></button>' +
      '<span class="dk-dd">' +
        '<button class="dk-btn' + (dockPanel === 'pages' ? ' on' : '') + '" type="button" data-dock="pages" title="Pages · ' + esc(ctxName()) + '">' + bIcon('doc') + '</button>' +
        (dockPanel === 'pages'
          ? '<div class="dk-panel"><div class="ub-h">' + esc(ctxName()) + ' · Pages</div>' +
            pages.map((p) => '<button class="dk-page' + (mode === 'page' && activePage === p.id ? ' on' : '') + '" type="button" data-go-dock-page="' + p.id + '">' +
              bIcon('doc', 'dk-pico') + '<span>' + esc(p.title) + '</span><small>' + esc(p.purpose) + '</small></button>').join('') + '</div>'
          : '') +
      '</span>' +
      '<span class="dk-sp"></span>' +
      (obj ? '<button class="dk-btn' + (objPanelOpen ? ' on' : '') + '" type="button" data-nav="toggle-art" title="' +
        (objPanelOpen ? 'Hide' : 'Show') + ' ART Objectives">' + bIcon('objectives') + '</button>' : '') +
      '<span class="dk-seg" title="Work mode">' +
        '<button class="' + (state.workMode === 'planning' ? 'on' : '') + '" type="button" data-mode="planning">Planning</button>' +
        '<button class="' + (state.workMode === 'execution' ? 'on' : '') + '" type="button" data-mode="execution">Execution</button>' +
      '</span>' +
      '<button class="dk-btn' + (convoOpen && panelMode === 'people' ? ' on' : '') + '" type="button" data-nav="people" title="Conversations — team & chats">' + bIcon('chat') +
        (peopleCount ? '<span class="bn-badge">' + peopleCount + '</span>' : '') + '</button>' +
      '<span class="bn-me dk-me">' + esc(initials(state.user.name)) + '</span>';
  }
  dockEl.addEventListener('click', (e) => {
    e.stopPropagation();
    const dp = e.target.closest('[data-dock]');
    if (dp) { dockPanel = dockPanel === dp.dataset.dock ? null : dp.dataset.dock; renderDock(); return; }
    const gp = e.target.closest('[data-go-dock-page]');
    if (gp) { dockPanel = null; gotoPage(gp.dataset.goDockPage); renderBoardView(); updateHash(); return; }
    const md = e.target.closest('[data-mode]');
    if (md) { state.workMode = md.dataset.mode; save(); renderBoardView(); return; }
    const b = e.target.closest('[data-nav]'); if (!b) return;
    const nav = b.dataset.nav;
    if (nav === 'home') { closeHub(); exitBoard(); }
    else if (nav === 'hub') {
      if (hubOpen) { closeHub(); return; }
      try { openHub(); } catch (err) {
        // never let a corrupt hub state kill navigation — reset and retry
        hubQuery = ''; hubSel = 0; recents = [];
        hubNode = { type: 'team', id: (state.teams[0] || {}).id };
        ensureCtxValid();
        openHub();
      }
    }
    else if (nav === 'toggle-art') { objPanelOpen = !objPanelOpen; renderBoardView(); }
    else if (nav === 'people' || nav === 'boardtalk') {
      const m = nav === 'people' ? 'people' : 'board';
      if (convoOpen && panelMode === m) convoOpen = false;
      else { convoOpen = true; panelMode = m; slOpen = false; }
      renderBoardView();
    }
  });
  function hubMatch(label) { return !hubQuery || label.toLowerCase().indexOf(hubQuery) >= 0; }
  function hubTile(attr, ico, label, on) {
    return '<button class="hb-tile hb-act' + (on ? ' on' : '') + '" type="button" ' + attr + '>' +
      bIcon(ico, 'hb-tico') + '<span>' + esc(label) + '</span></button>';
  }
  function hubRow(attr, ico, label, hint, on) {
    return '<button class="hb-row hb-act' + (on ? ' on' : '') + '" type="button" ' + attr + '>' + bIcon(ico, 'hb-tico') +
      '<span class="hb-rlab">' + esc(label) + '</span>' +
      (hint ? '<span class="hb-rhint">' + esc(hint) + '</span>' : '') + '</button>';
  }
  // The hierarchy as a flat list with depths: ST → its ARTs → each ART's teams.
  function hubNodes() {
    const out = [{ type: 'st', id: state.st.id, name: state.st.name, icon: 'solplan', depth: 0 }];
    state.arts.forEach((a) => {
      out.push({ type: 'art', id: a.id, name: a.name, icon: 'artplan', depth: 1 });
      state.teams.filter((t) => a.teamIds.includes(t.id)).forEach((t) =>
        out.push({ type: 'team', id: t.id, name: t.name, icon: 'teamrail', depth: 2 }));
    });
    return out;
  }
  let hubNode = null; // which hierarchy node the detail pane shows
  function hubBrowse() {
    const nav = hubNodes().map((n) => {
      const isSel = hubNode.type === n.type && (n.type === 'st' || hubNode.id === n.id);
      const isCtx = ctx.type === n.type && (n.type === 'st' || ctx.id === n.id);
      return '<button class="hb-node' + (isSel ? ' sel' : '') + '" type="button" data-hub-node="' + n.type + ':' + n.id + '" style="--hb-depth:' + n.depth + '">' +
        bIcon(n.icon, 'hb-tico') + '<span>' + esc(n.name) + '</span>' +
        (isCtx ? '<span class="hb-dot" title="You are here"></span>' : '') + '</button>';
    }).join('');
    const type = hubNode.type, id = hubNode.id;
    const here = ctx.type === type && (type === 'st' || ctx.id === id);
    const name = type === 'st' ? state.st.name : type === 'art' ? artById(id).name : ((team(id) || {}).name || 'Team');
    const boards = boardsFor(type).map((b) =>
      hubTile('data-hub-board="' + type + ':' + id + ':' + b[0] + '"', b[1], b[2], here && mode === 'board' && railActive === b[0])).join('');
    const pages = state.pages.filter((p) => p.owner === type).map((p) =>
      hubRow('data-hub-page="' + type + ':' + id + ':' + p.id + '"', 'doc', p.title, p.purpose + ' · ' + p.updated, here && mode === 'page' && activePage === p.id)).join('');
    return '<div class="hb-cols"><div class="hb-nav">' + nav + '</div>' +
      '<div class="hb-detail">' +
        '<div class="hb-dh">' + esc(name) + '<span class="hb-type">' + esc(TYPE_LABEL[type]) + '</span></div>' +
        '<div class="hb-sec">Boards</div><div class="hb-tiles">' + boards + '</div>' +
        '<div class="hb-sec">Pages</div><div class="hb-rows">' + (pages || '<div class="hb-none">No pages at this level yet.</div>') + '</div>' +
      '</div></div>';
  }
  // Search flattens everything into rows — scales to any number of pages.
  function hubResults() {
    const rows = [];
    hubNodes().forEach((n) => {
      const nameHit = hubMatch(n.name);
      boardsFor(n.type).forEach((b) => {
        if (nameHit || hubMatch(b[2])) rows.push(hubRow('data-hub-board="' + n.type + ':' + n.id + ':' + b[0] + '"', b[1], b[2], n.name, false));
      });
      state.pages.forEach((p) => {
        if (p.owner === n.type && (nameHit || hubMatch(p.title))) rows.push(hubRow('data-hub-page="' + n.type + ':' + n.id + ':' + p.id + '"', 'doc', p.title, n.name, false));
      });
    });
    // Stickies too: search reaches into every board's notes.
    state.cards.filter((c) => hubMatch(c.title)).slice(0, 12).forEach((c) => {
      const t = team(c.teamId); if (!t) return;
      rows.push(hubRow('data-hub-sticky="' + t.id + '"', 'edit', c.title, t.name + ' · ' + (state.sprints[c.sprintIdx] || 'Sticky'), false));
    });
    return '<div class="hb-rows hb-results">' + (rows.slice(0, 60).join('') || '<div class="hb-none">No matches.</div>') + '</div>';
  }
  function hubApplySel() {
    const items = hubEl.querySelectorAll('.hb-act');
    if (!items.length) return;
    hubSel = Math.max(0, Math.min(hubSel, items.length - 1));
    items.forEach((t, i) => t.classList.toggle('sel', i === hubSel));
    items[hubSel].scrollIntoView({ block: 'nearest' });
  }
  function renderHub() {
    if (!hubOpen) { hubEl.hidden = true; hubEl.innerHTML = ''; return; }
    hubEl.hidden = false;
    if (!hubNode) hubNode = { type: ctx.type, id: ctx.id };
    const sessOpts = state.sessions.map((sn) =>
      '<option' + (sn.name === state.piName ? ' selected' : '') + '>' + esc(sn.name) + '</option>').join('');
    const prev = recents.slice(1, 5);
    hubEl.innerHTML = '<div class="hb-panel">' +
      '<div class="hb-top">' + bIcon('search', 'hb-sico') +
        '<input id="hub-input" type="text" placeholder="Search boards, pages, teams…" autocomplete="off" value="' + esc(hubQuery) + '" />' +
        '<select class="hb-sessel" id="hub-sess" title="PI Session">' + sessOpts + '</select>' +
        '<button class="hb-close" type="button" data-hub-close title="Close">esc</button></div>' +
      '<div class="hb-body">' +
        (!hubQuery && prev.length ? '<div class="hb-sec hb-first">Recent</div><div class="hb-recents">' + prev.map((r) =>
          '<button class="hb-recent hb-act" type="button" data-hub-' + (r.mode === 'page' ? 'page' : 'board') + '="' + r.ctxType + ':' + r.ctxId + ':' + r.id + '">' +
          bIcon(r.icon, 'hb-rico') + '<span class="hb-rt">' + esc(r.label) + '</span><span class="hb-rc">' + esc(r.ctxName) + '</span></button>').join('') + '</div>' : '') +
        (hubQuery ? hubResults() : hubBrowse()) +
      '</div>' +
      '<div class="hb-foot"><span><b>↑↓</b> navigate</span><span><b>↵</b> open</span><span><b>esc</b> close</span>' +
        '<span class="hb-links">' +
          '<button class="hb-link" type="button" data-hub-shell="home">Dashboard</button>' +
          '<button class="hb-link" type="button" data-hub-shell="settings">PIE Recipe</button>' +
        '</span></div>';
    hubApplySel();
    const input = document.getElementById('hub-input');
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    input.addEventListener('input', () => { hubQuery = input.value.trim().toLowerCase(); hubSel = 0; renderHub(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); hubSel += 1; hubApplySel(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); hubSel -= 1; hubApplySel(); }
      else if (e.key === 'Enter') { const t = hubEl.querySelector('.hb-act.sel') || hubEl.querySelector('.hb-act'); if (t) t.click(); }
    });
    document.getElementById('hub-sess').addEventListener('change', (e) => {
      state.piName = e.target.value; save();
      if (!boardScreen.hidden) renderTopNav();
    });
  }
  let hubOpenedAt = 0; // guards the backdrop against the 2nd click of a double-click
  function openHub() {
    hubOpen = true; hubQuery = ''; hubSel = 0; hubOpenedAt = Date.now();
    hubNode = { type: ctx.type, id: ctx.id };
    renderHub();
    if (!boardScreen.hidden) renderTopNav();
  }
  function closeHub() { if (!hubOpen) return; hubOpen = false; renderHub(); if (!boardScreen.hidden) renderTopNav(); }
  hubEl.addEventListener('click', (e) => {
    // Backdrop closes the hub — but not right after opening, or a double-click
    // on the breadcrumb (open + backdrop hit) would cancel itself out.
    if (e.target === hubEl) { if (Date.now() - hubOpenedAt > 400) closeHub(); return; }
    if (e.target.closest('[data-hub-close]')) return closeHub();
    const nd = e.target.closest('[data-hub-node]');
    if (nd) { const p = nd.dataset.hubNode.split(':'); hubNode = { type: p[0], id: p[0] === 'st' ? state.st.id : p[1] }; hubSel = 0; renderHub(); return; }
    const sh = e.target.closest('[data-hub-shell]');
    if (sh) { const pg = sh.dataset.hubShell; closeHub(); exitBoard(); navigate(pg); return; }
    const gb = e.target.closest('[data-hub-board]');
    if (gb) { const p = gb.dataset.hubBoard.split(':'); ctx = { type: p[0], id: p[0] === 'st' ? state.st.id : p[1] }; mode = 'board'; railActive = p[2]; closeHub(); renderBoardView(); updateHash(); return; }
    const gp = e.target.closest('[data-hub-page]');
    if (gp) { const p = gp.dataset.hubPage.split(':'); ctx = { type: p[0], id: p[0] === 'st' ? state.st.id : p[1] }; mode = 'page'; activePage = p[2]; closeHub(); renderBoardView(); updateHash(); return; }
    const gk = e.target.closest('[data-hub-sticky]');
    if (gk) { ctx = { type: 'team', id: gk.dataset.hubSticky }; mode = 'board'; railActive = 'team'; closeHub(); renderBoardView(); updateHash(); return; }
    const gs = e.target.closest('[data-go-session]');
    if (gs) { state.piName = gs.dataset.goSession; save(); renderHub(); if (!boardScreen.hidden) renderBoardView(); return; }
  });

  // ---------- v3 utility bar (top right): search, history, metrics, config, facilitation, conversations ----------
  let utilPanel = null; // 'history' | 'metrics' | 'config' | 'facil'
  function boardHistory() {
    const t = state.teams.map((x) => x.name);
    return [
      { who: 'Mara Kim', what: 'moved “SSO integration” to Iteration 3', ago: '2h' },
      { who: 'Ari Ruiz', what: 'added “Login screen” (5 pts)', ago: '4h' },
      { who: 'Tom Sato', what: 'linked a dependency to ' + (t[1] || 'Otter'), ago: '1d' },
      { who: 'Jo Deng', what: 'commented on “Billing API”', ago: '1d' },
      { who: 'You', what: 'set capacity for ' + (t[0] || 'Falcon') + ' to 26', ago: '3d' },
    ];
  }
  function boardMetrics() {
    const ids = ctxTeams().map((t) => t.id);
    const cards = state.cards.filter((c) => ids.includes(c.teamId));
    const load = cards.reduce((a, c) => a + (Number(c.points) || 0), 0);
    const cap = ctxTeams().reduce((a, t) => a + (Number(t.capacity) || 0), 0) * state.sprints.length;
    return [
      ['Stickies', cards.length], ['Load', load + ' pts'], ['Capacity', cap + ' pts'],
      ['Utilisation', cap ? Math.round((load / cap) * 100) + '%' : '—'],
      ['Dependencies', 3], ['Open risks', state.risks.length],
    ];
  }
  function utilPanelHtml() {
    if (utilPanel === 'history') {
      return '<div class="ub-h">History · ' + esc(boardName(railActive)) + '</div>' +
        boardHistory().map((h) => '<div class="ub-row"><b>' + esc(h.who) + '</b><span>' + esc(h.what) + '</span><small>' + esc(h.ago) + '</small></div>').join('');
    }
    if (utilPanel === 'metrics') {
      return '<div class="ub-h">Metrics · ' + esc(boardName(railActive)) + '</div><div class="ub-stats">' +
        boardMetrics().map((m) => '<div class="ub-stat"><span>' + esc(String(m[1])) + '</span><small>' + esc(m[0]) + '</small></div>').join('') + '</div>';
    }
    if (utilPanel === 'config') {
      const row = (k, label, sub) => '<button class="ub-cfg" type="button" data-cfg="' + k + '">' +
        '<span class="ub-cfg-l"><b>' + label + '</b><small>' + sub + '</small></span>' +
        '<span class="ub-sw' + (state.boardCfg[k] ? ' on' : '') + '"></span></button>';
      return '<div class="ub-h">Board configuration</div>' +
        row('dates', 'Iteration dates', 'Show date ranges in panel headers') +
        row('grid', 'Background grid', 'Dotted grid behind the board') +
        row('compact', 'Compact panels', 'Tighter headers, more stickies visible');
    }
    if (utilPanel === 'facil') {
      const item = (f, ico, label, sub) => '<button class="ub-fac" type="button" data-fac="' + f + '">' + bIcon(ico, 'ub-fico') +
        '<span><b>' + label + '</b><small>' + sub + '</small></span></button>';
      return '<div class="ub-h">Facilitation</div>' +
        item('readout', 'present', 'Plan Readout', 'Teams present their drafts in order') +
        item('timer', 'timer', 'Timer', 'Timebox the current activity') +
        item('vote', 'vote', 'Confidence Vote', 'Fist of five on the plan');
    }
    return '';
  }
  // ---------- Floating version switcher: draggable, compares v1/v2/v3 live ----------
  const verfabEl = document.getElementById('verfab');
  function renderVerfab() {
    if (boardScreen.hidden) { verfabEl.hidden = true; return; }
    verfabEl.hidden = false;
    verfabEl.innerHTML =
      '<span class="vf-grip" title="Drag to move"><i></i><i></i><i></i><i></i><i></i><i></i></span>' +
      ['v1', 'v2', 'v3', 'v4'].map((v) =>
        '<button class="vf-btn' + (state.navVersion === v ? ' on' : '') + '" type="button" data-ver="' + v + '">' + v + '</button>').join('');
    try {
      const pos = JSON.parse(localStorage.getItem('pie-vfpos'));
      if (pos) { verfabEl.style.left = pos.x + 'px'; verfabEl.style.top = pos.y + 'px'; verfabEl.style.bottom = 'auto'; }
    } catch (_) {}
  }
  let vfDrag = null;
  verfabEl.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.vf-grip')) return;
    const r = verfabEl.getBoundingClientRect();
    vfDrag = { dx: e.clientX - r.left, dy: e.clientY - r.top, id: e.pointerId };
    try { verfabEl.setPointerCapture(e.pointerId); } catch (_) {}
  });
  verfabEl.addEventListener('pointermove', (e) => {
    if (!vfDrag || e.pointerId !== vfDrag.id) return;
    const x = Math.max(8, Math.min(e.clientX - vfDrag.dx, window.innerWidth - verfabEl.offsetWidth - 8));
    const y = Math.max(8, Math.min(e.clientY - vfDrag.dy, window.innerHeight - verfabEl.offsetHeight - 8));
    verfabEl.style.left = x + 'px'; verfabEl.style.top = y + 'px'; verfabEl.style.bottom = 'auto';
  });
  function vfEndDrag(e) {
    if (!vfDrag || e.pointerId !== vfDrag.id) return;
    vfDrag = null;
    const r = verfabEl.getBoundingClientRect();
    try { localStorage.setItem('pie-vfpos', JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top) })); } catch (_) {}
  }
  verfabEl.addEventListener('pointerup', vfEndDrag);
  verfabEl.addEventListener('pointercancel', vfEndDrag);
  verfabEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ver]'); if (!b) return;
    state.navVersion = b.dataset.ver;
    save();
    renderBoardView();
    if (modalType === 'breakdown') { bdDd = null; renderModal(); } // reflect the new configurator design live
  });

  // ---------- v3 bottom bar: board utilities + board tools combined ----------
  let magnify = false, trailOn = false, noteScale = 100;
  let btPanel = null; // which tool flyout is open: 'scale' | 'zoom'
  function zoomPct() { return Math.round((view.scale / (fitScale() || 1)) * 100) + '%'; }
  function renderBtools() {
    if (chromeV() !== 'v3' || boardScreen.hidden) { btoolsEl.innerHTML = ''; return; }
    const onBoard = mode === 'board';
    const dis = onBoard ? '' : ' disabled';
    const isTeam = onBoard && railActive === 'team';
    const ub = (u, ico, title, on, d) => '<button class="ub-btn' + (on ? ' on' : '') + '" type="button" data-u="' + u + '" title="' + title + '"' + (d || '') + '>' + bIcon(ico) + '</button>';
    const bt = (a, ico, title, on, d) => '<button class="bt-btn' + (on ? ' on' : '') + '" type="button" data-bt="' + a + '" title="' + title + '"' + (d || '') + '>' + bIcon(ico) + '</button>';
    const scalePop = btPanel === 'scale'
      ? '<div class="bt-pop">' + bt('scale-down', 'minus', 'Smaller stickies') +
        '<span class="bt-popval">' + noteScale + '%</span>' + bt('scale-up', 'plus', 'Bigger stickies') + '</div>'
      : '';
    const zoomPop = btPanel === 'zoom'
      ? '<div class="bt-pop">' + bt('zout', 'minus', 'Zoom out') +
        '<span class="bt-popval bt-zoomval">' + zoomPct() + '</span>' + bt('zin', 'plus', 'Zoom in') +
        '<button class="bt-fit" type="button" data-bt="zfit">Fit</button></div>'
      : '';
    btoolsEl.innerHTML =
      (utilPanel ? '<div class="ub-panel">' + utilPanelHtml() + '</div>' : '') +
      '<div class="bt-bar">' +
        '<span class="bt-side">' +
          ub('search', 'search', 'Search — stickies, this board, all boards (⌘K)') +
          ub('history', 'history', 'Board history', utilPanel === 'history', dis) +
          ub('metrics', 'gauge', 'Board metrics', utilPanel === 'metrics', dis) +
          ub('config', 'gear', 'Board configuration', utilPanel === 'config', dis) +
          ub('facil', 'present', 'Facilitation — readout, timer, vote', utilPanel === 'facil', dis) +
          '<span class="ub-brk"></span>' +
          bt('boardtalk', 'teamboard', 'Board conversation (incl. stickies)', convoOpen && panelMode === 'board', dis) +
        '</span>' +
        '<button class="bt-add" type="button" data-bt="add" title="Add a sticky to this board"' + (isTeam ? '' : ' disabled') + '>' + bIcon('plus') + '</button>' +
        '<span class="bt-side">' +
          bt('magnify', 'magnify', 'Sticky magnifier — hover a sticky to enlarge it', magnify, dis) +
          '<span class="bt-wrap">' + bt('scale-pop', 'scale', 'Scale stickies', btPanel === 'scale', dis) + scalePop + '</span>' +
          bt('trail', 'cursor', 'Pointer trail', trailOn, dis) +
          '<span class="ub-brk"></span>' +
          '<span class="bt-wrap">' +
            '<button class="bt-btn bt-zbtn' + (btPanel === 'zoom' ? ' on' : '') + '" type="button" data-bt="zoom-pop" title="Board zoom">' +
              '<span class="bt-zoomval">' + zoomPct() + '</span></button>' + zoomPop +
          '</span>' +
          '<span class="ub-brk"></span>' +
          bt('help', 'help', 'Help') +
        '</span>' +
      '</div>';
  }
  function addSticky() {
    if (mode !== 'board' || railActive !== 'team') return;
    const t = ctxTeams()[0] || state.teams[0];
    const titles = ['Follow-up spike', 'Edge-case fix', 'API contract check', 'Docs pass', 'Perf audit'];
    state.cards.push({ id: uid(), teamId: t.id, sprintIdx: state.cards.length % 2, title: titles[state.cards.length % titles.length], points: 3, kind: 'story' });
    save(); renderCanvas();
  }
  btoolsEl.addEventListener('click', (e) => {
    e.stopPropagation(); // re-render detaches targets; the document outside-click check would misfire
    const cfg = e.target.closest('[data-cfg]');
    if (cfg) { const k = cfg.dataset.cfg; state.boardCfg[k] = !state.boardCfg[k]; save(); renderBoardView(); return; }
    const fac = e.target.closest('[data-fac]');
    if (fac) { utilPanel = null; renderBtools(); openModal(fac.dataset.fac); return; }
    const u = e.target.closest('[data-u]');
    if (u) {
      const k = u.dataset.u;
      if (k === 'search') { utilPanel = null; renderBtools(); openHub(); return; }
      utilPanel = utilPanel === k ? null : k;
      renderBtools(); return;
    }
    const b = e.target.closest('[data-bt]'); if (!b) return;
    const a = b.dataset.bt;
    if (a === 'add') addSticky();
    else if (a === 'boardtalk') {
      if (convoOpen && panelMode === 'board') convoOpen = false;
      else { convoOpen = true; panelMode = 'board'; slOpen = false; }
      renderBoardView();
    }
    else if (a === 'magnify') { magnify = !magnify; boardScreen.classList.toggle('magnify', magnify); renderBtools(); }
    else if (a === 'scale-pop') { btPanel = btPanel === 'scale' ? null : 'scale'; renderBtools(); }
    else if (a === 'zoom-pop') { btPanel = btPanel === 'zoom' ? null : 'zoom'; renderBtools(); }
    else if (a === 'scale-down' || a === 'scale-up') {
      noteScale = Math.max(60, Math.min(180, noteScale + (a === 'scale-up' ? 20 : -20)));
      canvas.style.setProperty('--ns', noteScale / 100);
      renderBtools(); applyView();
    }
    else if (a === 'trail') { trailOn = !trailOn; renderBtools(); }
    else if (a === 'zfit') fitView();
    else if (a === 'zout') zoomBy(1 / 1.4);
    else if (a === 'zin') zoomBy(1.4);
    else if (a === 'help') openModal('help');
  });
  let trailSkip = 0;
  canvasWrap.addEventListener('pointermove', (e) => {
    if (!trailOn || chromeV() !== 'v3') return;
    if ((trailSkip = (trailSkip + 1) % 2)) return;
    const r = canvasWrap.getBoundingClientRect();
    const d = document.createElement('span');
    d.className = 'trail-dot';
    d.style.left = (e.clientX - r.left) + 'px';
    d.style.top = (e.clientY - r.top) + 'px';
    canvasWrap.appendChild(d);
    setTimeout(() => { d.remove(); }, 700);
  });

  // ---------- v3 modals: timer, confidence vote, plan readout, help ----------
  let modalType = null, timerLeft = 300, timerRun = false, timerIv = 0, readoutIdx = 0, myVote = 0;
  function fmtT(s) { return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function openModal(t) {
    modalType = t;
    if (t === 'vote') myVote = 0;
    if (t === 'readout') readoutIdx = 0;
    renderModal();
  }
  function closeModal() {
    modalType = null; timerRun = false; clearInterval(timerIv);
    modalEl.hidden = true; modalEl.innerHTML = '';
    modalEl.classList.remove('pm-wide', 'pm-page');
  }
  function openBreakdown(c) {
    closeStickyBar(); modalCard = c; modalType = 'breakdown';
    bdQuery = ''; bdCollapsed = {}; bdRows = 'team'; bdCols = 'iteration'; bdView = 'grid'; bdCfgOpen = false; bdDd = null;
    modalEl.classList.add('pm-page'); renderModal();
  }
  function openLinksOverlay(c) { modalCard = c; modalType = 'sblinks'; modalEl.classList.add('pm-wide'); renderModal(); }

  // ---------- Breakdown model: sticky connections grouped by configurable Rows × Columns ----------
  let bdCollapsed = {}, bdQuery = '';
  let bdRows = 'team', bdCols = 'iteration', bdView = 'grid', bdCfgOpen = false, bdDd = null;
  const bdCache = {};
  // Each dimension knows its display label, icon, the values it splits into, and
  // how to read that value off an item — so any pair can be Rows × Columns.
  const BD_DIMS = {
    team: { label: 'Team', icon: 'people', vals: (m) => m.teams.map((t) => ({ key: t.id, name: t.name })), of: (it) => it.teamId },
    iteration: { label: 'Iteration', icon: 'bookmark', vals: (m) => m.iters.map((s, i) => ({ key: 'i' + i, name: s })), of: (it) => 'i' + it.iterIdx },
    status: { label: 'Status', icon: 'statusdot', vals: () => STATUSES.map(([k, l]) => ({ key: k, name: l })), of: (it) => it.status },
    objective: { label: 'Objective', icon: 'objectives', vals: (m) => m.objs.map((o, i) => ({ key: 'o' + i, name: o.title })), of: (it) => it.objKey },
  };
  const BD_DIM_ORDER = ['team', 'iteration', 'status', 'objective'];
  const BD_ROLES = ['a fitness enthusiast', 'a student', 'a busy professional', 'a couple who share a bed', 'a shift worker', 'a frequent traveler', 'a new parent'];
  const BD_GOALS = [
    'correlate my sleep quality with my training intensity to optimize recovery.',
    'understand my sleep cycles to better plan my study and rest times for optimal learning.',
    'get insights into my REM and deep sleep stages to improve my sleep hygiene.',
    'track our individual sleep cycles to find the best bedtime routine that suits both of us.',
    'receive a smart alarm that wakes me at the optimal point in my cycle.',
    'export my nightly data so I can share it with my doctor.',
  ];
  const BD_DEPS = [
    'Data pipeline from intelligent sleep detection must be available for analysis modules.',
    'Visualization layer and export capabilities needed for advanced analytics.',
    'Auth service must expose per-user sleep scopes before rollout.',
  ];
  const BD_FEATS = ['Nightly summary report', 'Smart wake window', 'Trend dashboard', 'Partner comparison view', 'Another Feature'];
  const BD_RISKS = [
    'Delay in integration of sleep insight algorithms; complexity in REM/deep sleep staging.',
    'Accuracy of sleep detection may drop for shift workers and travelers with irregular cycles.',
    'User-story dependencies on the visualization layer could delay actionable insights.',
    'Risk of overrun in device logic due to hardware API limitations.',
  ];
  function seededRng(str) { let h = (hashCode(str) >>> 0) || 1; return () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; }; }
  const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
  // Generate a flat list of items, each tagged with team / iteration / status /
  // objective, so any two of those can be the grid's rows and columns.
  function breakdownModel(c) {
    if (bdCache[c.id]) return bdCache[c.id];
    const art = ctxArt();
    const teams = state.teams.filter((t) => art.teamIds.includes(t.id));
    const iters = state.sprints.slice();
    const objs = state.artObjectives.slice(0, 4);
    const items = [];
    let idn = 200;
    teams.forEach((lane) => {
      iters.forEach((_, ci) => {
        const rng = seededRng(c.id + ':' + lane.id + ':' + ci);
        const n = rng() < 0.28 ? 0 : rng() < 0.7 ? 1 : 2;
        for (let k = 0; k < n; k++) {
          const r = rng();
          const type = r > 0.9 ? 'risk' : r > 0.82 ? 'feature' : r > 0.68 ? 'dependency' : 'story';
          const it = {
            type, id: ++idn, links: 1 + Math.floor(rng() * 3), pts: [3, 5, 8, 10, 13][Math.floor(rng() * 5)],
            teamId: lane.id, iterIdx: ci, status: ['todo', 'doing', 'done'][Math.floor(rng() * 3)],
            objKey: objs.length ? 'o' + Math.floor(rng() * objs.length) : '—',
          };
          if (type === 'story') it.text = 'As ' + pick(BD_ROLES, rng) + ', I want to ' + pick(BD_GOALS, rng);
          else if (type === 'feature') it.text = pick(BD_FEATS, rng);
          else if (type === 'risk') it.text = pick(BD_RISKS, rng);
          else {
            const other = teams[Math.floor(rng() * teams.length)];
            it.text = pick(BD_DEPS, rng); it.from = lane.name;
            it.to = other && other.id !== lane.id ? other.name : teams[(teams.indexOf(lane) + 1) % teams.length].name;
          }
          items.push(it);
        }
      });
    });
    const model = { teams, iters, objs, items };
    bdCache[c.id] = model;
    return model;
  }
  function bdCardHtml(it) {
    const lk = '<span class="bd-c-lk">' + bIcon('link', 'bd-lkico') + it.links + '</span>';
    if (it.type === 'risk') {
      return '<div class="bd-card bd-risk"><div class="bd-c-top"><span class="bd-c-type">Risk</span></div>' +
        '<div class="bd-c-body">' + esc(it.text) + '</div>' +
        '<div class="bd-c-foot"><span class="bd-c-av"></span>' + lk + '</div></div>';
    }
    const idb = '<span class="bd-c-id">' + bIcon('alm', 'bd-idico') + 'ID-' + it.id + '</span>';
    if (it.type === 'dependency') {
      return '<div class="bd-card bd-dependency"><div class="bd-c-top"><span class="bd-c-type">Dependency</span></div>' +
        '<div class="bd-c-body">' + esc(it.text) + '</div>' + lk +
        '<div class="bd-c-dep">' + esc(it.from) + ' <span>→</span> ' + esc(it.to) + '</div></div>';
    }
    const label = it.type === 'feature' ? 'Feature' : 'User Story';
    return '<div class="bd-card bd-' + it.type + '"><div class="bd-c-top"><span class="bd-c-type">' + label + '</span>' + idb + '</div>' +
      '<div class="bd-c-body">' + esc(it.text) + '</div>' +
      '<div class="bd-c-foot"><span class="bd-c-av"></span>' + lk + '<span class="bd-c-pts">' + it.pts + '</span></div></div>';
  }
  function bdMatch(it) { return !bdQuery || (it.text || '').toLowerCase().indexOf(bdQuery) >= 0; }
  function breakdownHtml(c) {
    const m = breakdownModel(c);
    const rowDim = BD_DIMS[bdRows], colDim = BD_DIMS[bdCols];
    const rowVals = rowDim.vals(m), colVals = colDim.vals(m);
    const shown = m.items.filter(bdMatch);
    const cellItems = (rk, ck) => shown.filter((it) => rowDim.of(it) === rk && colDim.of(it) === ck);
    const colTotal = (ck) => shown.filter((it) => colDim.of(it) === ck).length;
    const head = colVals.map((cv) =>
      '<div class="bd-col-h">' + bIcon(colDim.icon, 'bd-col-ico') + '<span>' + esc(cv.name) + '</span><b>' + colTotal(cv.key) + '</b></div>').join('');
    let body = '';
    rowVals.forEach((rv) => {
      const open = !bdCollapsed[rv.key];
      const rowTotal = shown.filter((it) => rowDim.of(it) === rv.key).length;
      body += '<button class="bd-lane" type="button" data-bd-lane="' + rv.key + '" style="grid-column:1/-1">' +
        '<span class="bd-lane-cv' + (open ? ' open' : '') + '">▸</span>' + bIcon(rowDim.icon, 'bd-lane-ico') +
        '<span class="bd-lane-name">' + esc(rv.name) + '</span><b class="bd-lane-n">' + rowTotal + '</b></button>';
      if (!open) return;
      colVals.forEach((cv) => {
        const cards = cellItems(rv.key, cv.key);
        body += '<div class="bd-cell">' + cards.map(bdCardHtml).join('') + '</div>';
      });
    });
    return '<div class="bd-scroll"><div class="bd-grid" style="grid-template-columns:repeat(' + colVals.length + ',minmax(232px,1fr))">' +
      head + body + '</div></div>';
  }
  // Four configurator designs, chosen by the version pill (v1–v4).
  function bdCfgPop() {
    const v = state.navVersion;
    if (v === 'v1') return bdCfgChips();
    if (v === 'v3') return bdCfgPresets();
    if (v === 'v4') return bdCfgDropdowns();
    return bdCfgMatrix();
  }
  // v2 · Matrix: rows down the left, columns across the top — click the
  // intersection cell to set both axes at once (diagonal disabled).
  function bdCfgMatrix() {
    const dims = BD_DIM_ORDER;
    let html = '<div class="bd-cfg-pop bd-mtx-pop"><div class="bd-mtx-head"><b>View by</b>' +
      '<span class="bd-mtx-legend"><i>Rows</i> down · <i>Columns</i> across</span></div>';
    html += '<div class="bd-mtx" style="grid-template-columns:104px repeat(' + dims.length + ',1fr)"><span></span>';
    dims.forEach((d) => {
      html += '<div class="bd-mtx-ch' + (bdCols === d ? ' hi' : '') + '">' + bIcon(BD_DIMS[d].icon, 'bd-mtx-cico') + '<span>' + BD_DIMS[d].label + '</span></div>';
    });
    dims.forEach((rd) => {
      html += '<div class="bd-mtx-rh' + (bdRows === rd ? ' hi' : '') + '">' + bIcon(BD_DIMS[rd].icon, 'bd-mtx-rico') + '<span>' + BD_DIMS[rd].label + '</span></div>';
      dims.forEach((cd) => {
        if (rd === cd) { html += '<div class="bd-mtx-cell bd-mtx-x">·</div>'; return; }
        const on = bdRows === rd && bdCols === cd;
        html += '<button class="bd-mtx-cell' + (on ? ' on' : '') + '" type="button" data-bd-cell="' + rd + ':' + cd + '" title="' + BD_DIMS[rd].label + ' × ' + BD_DIMS[cd].label + '">' + (on ? '<i class="bd-mtx-dot"></i>' : '') + '</button>';
      });
    });
    html += '</div></div>';
    return html;
  }
  // v1 · Chip lists: two vertical dimension lists with a swap between them.
  function bdCfgChips() {
    const dimChips = (axis) => {
      const cur = axis === 'rows' ? bdRows : bdCols, other = axis === 'rows' ? bdCols : bdRows;
      return BD_DIM_ORDER.map((d) => {
        const on = cur === d, dis = other === d;
        return '<button class="bd-dim' + (on ? ' on' : '') + '" type="button"' + (dis ? ' disabled' : '') +
          ' data-bd-dim="' + axis + ':' + d + '">' + bIcon(BD_DIMS[d].icon, 'bd-dim-ico') + BD_DIMS[d].label + '</button>';
      }).join('');
    };
    return '<div class="bd-cfg-pop bd-chip-pop">' +
      '<div class="bd-axes">' +
        '<div class="bd-axis"><div class="bd-cfg-h">Rows</div><div class="bd-dims">' + dimChips('rows') + '</div></div>' +
        '<button class="bd-swap" type="button" data-bd-swap title="Swap rows and columns">⇄</button>' +
        '<div class="bd-axis"><div class="bd-cfg-h">Columns</div><div class="bd-dims">' + dimChips('cols') + '</div></div>' +
      '</div></div>';
  }
  // v3 · Preset gallery: visual thumbnails of common layouts.
  const BD_PRESETS = [
    ['team', 'iteration'], ['team', 'status'], ['iteration', 'status'],
    ['objective', 'team'], ['status', 'team'], ['iteration', 'team'],
  ];
  function bdCfgPresets() {
    const thumb = (r, c) => {
      const rn = Math.min(3, BD_DIMS[r].vals(breakdownModel(modalCard)).length || 3);
      const cn = Math.min(4, BD_DIMS[c].vals(breakdownModel(modalCard)).length || 4);
      let g = '';
      for (let i = 0; i < rn * cn; i++) g += '<i></i>';
      return '<div class="bd-thumb-grid" style="grid-template-columns:repeat(' + cn + ',1fr);grid-template-rows:repeat(' + rn + ',1fr)">' + g + '</div>';
    };
    return '<div class="bd-cfg-pop bd-preset-pop"><div class="bd-cfg-h">Layouts</div>' +
      '<div class="bd-presets">' + BD_PRESETS.map(([r, c]) => {
        const on = bdRows === r && bdCols === c;
        return '<button class="bd-preset' + (on ? ' on' : '') + '" type="button" data-bd-cell="' + r + ':' + c + '">' +
          thumb(r, c) + '<span class="bd-preset-lab">' + BD_DIMS[r].label + ' × ' + BD_DIMS[c].label + '</span></button>';
      }).join('') + '</div></div>';
  }
  // v4 · Dropdowns: two compact "group by" menus.
  function bdCfgDropdowns() {
    const menu = (axis) => {
      const cur = axis === 'rows' ? bdRows : bdCols, other = axis === 'rows' ? bdCols : bdRows, open = bdDd === axis;
      return '<div class="bd-dd' + (open ? ' open' : '') + '">' +
        '<button class="bd-dd-btn" type="button" data-bd-dd="' + axis + '">' + bIcon(BD_DIMS[cur].icon, 'bd-dd-ico') + '<span>' + BD_DIMS[cur].label + '</span>' + bIcon('chev', 'bd-dd-chev') + '</button>' +
        (open ? '<div class="bd-dd-menu">' + BD_DIM_ORDER.map((d) =>
          '<button class="bd-dd-i' + (cur === d ? ' on' : '') + '" type="button"' + (other === d ? ' disabled' : '') + ' data-bd-ddpick="' + axis + ':' + d + '">' +
          bIcon(BD_DIMS[d].icon, 'bd-dd-ico') + BD_DIMS[d].label + (cur === d ? '<span class="bd-dd-ck">✓</span>' : '') + '</button>').join('') + '</div>' : '') +
        '</div>';
    };
    return '<div class="bd-cfg-pop bd-dd-pop">' +
      '<div class="bd-dd-row"><label>Group rows by</label>' + menu('rows') + '</div>' +
      '<div class="bd-dd-row"><label>Then columns by</label>' + menu('cols') + '</div></div>';
  }

  // ---------- Breakdown Graph view: the sticky's REAL links as a draggable node graph ----------
  const GNW = 214, GNH = 66;
  const bdGraphPos = {}, bdGraphView = {}, bdGraphFocus = {};
  // Build from real cards: root sticky + its links + their links (2 levels).
  function bdGraphModel(c) {
    const nodes = [], seen = new Set([c.id]);
    let q = [[c.id, 0]];
    while (q.length) {
      const [id, lvl] = q.shift();
      const cd = card(id); if (!cd) continue;
      nodes.push({
        id, root: id === c.id, lvl, type: stypeOf(cd), label: stypeLabel(stypeOf(cd)),
        title: cd.title, team: (team(cd.teamId) || {}).name || '', status: statusOf(cd),
        iter: state.sprints[cd.sprintIdx] || '', bv: Number(cd.points) || 0,
      });
      if (lvl < 2) linkedIdsFor(cd).forEach((nid) => { if (!seen.has(nid)) { seen.add(nid); q.push([nid, lvl + 1]); } });
    }
    const inSet = new Set(nodes.map((n) => n.id)), ekey = new Set(), edges = [];
    nodes.forEach((n) => linkedIdsFor(card(n.id)).forEach((nid) => {
      if (!inSet.has(nid)) return;
      const k = [n.id, nid].sort().join('|');
      if (!ekey.has(k)) { ekey.add(k); edges.push({ a: n.id, b: nid }); }
    }));
    // layered layout by level (centred columns); only used for nodes with no saved position
    const byLvl = {};
    nodes.forEach((n) => { (byLvl[n.lvl] = byLvl[n.lvl] || []).push(n); });
    const maxCount = Math.max(1, ...Object.values(byLvl).map((a) => a.length));
    const midY = 40 + (maxCount * 108) / 2;
    Object.keys(byLvl).forEach((lvl) => {
      const arr = byLvl[lvl], top = midY - (arr.length * 108) / 2;
      arr.forEach((n, i) => { n.dx = 40 + Number(lvl) * 430; n.dy = top + i * 108; });
    });
    return { nodes, edges };
  }
  function ensureGraphPos(c, m) {
    const p = bdGraphPos[c.id] = bdGraphPos[c.id] || {};
    m.nodes.forEach((n) => { if (!p[n.id]) p[n.id] = { x: n.dx, y: n.dy }; });
  }
  function graphEdgePath(x1, y1, x2, y2) {
    const dx = Math.max(50, Math.abs(x2 - x1) / 2);
    return 'M' + x1 + ',' + y1 + ' C' + (x1 + dx) + ',' + y1 + ' ' + (x2 - dx) + ',' + y2 + ' ' + x2 + ',' + y2;
  }
  // orthogonal "dependency" routing (v3): right-angle elbow with rounded corners
  function graphElbowPath(x1, y1, x2, y2) {
    const mid = (x1 + x2) / 2, r = Math.min(10, Math.abs(y2 - y1) / 2, Math.abs(mid - x1));
    if (Math.abs(y2 - y1) < 2 || r < 2) return 'M' + x1 + ',' + y1 + ' H' + x2;
    const s = y2 > y1 ? 1 : -1;
    return 'M' + x1 + ',' + y1 + ' H' + (mid - r) + ' Q' + mid + ',' + y1 + ' ' + mid + ',' + (y1 + s * r) +
      ' V' + (y2 - s * r) + ' Q' + mid + ',' + y2 + ' ' + (mid + r) + ',' + y2 + ' H' + x2;
  }
  // per-team colours used to tint edges in v4
  const GTEAM_COLORS = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#14b8a6', '#f97316'];
  const gTeamColor = (id) => GTEAM_COLORS[Math.max(0, state.teams.findIndex((t) => t.id === id)) % GTEAM_COLORS.length];
  // selecting a node lights its whole lineage: all ancestors (parents) and descendants (children)
  function lineageSet(focusId, m) {
    const lvl = {}, adj = {};
    m.nodes.forEach((n) => { lvl[n.id] = n.lvl; adj[n.id] = []; });
    m.edges.forEach((e) => { if (adj[e.a] && adj[e.b]) { adj[e.a].push(e.b); adj[e.b].push(e.a); } });
    const keep = new Set([focusId]);
    const walk = (dir) => { const st = [focusId]; while (st.length) { const id = st.pop(); (adj[id] || []).forEach((nb) => { if (dir * (lvl[nb] - lvl[id]) > 0 && !keep.has(nb)) { keep.add(nb); st.push(nb); } }); } };
    walk(-1); // ancestors (lower level)
    walk(1);  // descendants (higher level)
    return keep;
  }
  function focusKeep(c, m) { const f = bdGraphFocus[c.id]; return f ? lineageSet(f, m) : null; }
  // Four ways (v1–v4) to distinguish a cross-team dependency from a same-team link.
  function graphEdgesSvg(m, pos, keep) {
    const v = state.navVersion;
    let paths = '', labels = '', grads = '';
    m.edges.forEach((e, idx) => {
      let ida = e.a, idb = e.b, a = pos[ida], b = pos[idb]; if (!a || !b) return;
      if (a.x > b.x) { const t = a; a = b; b = t; const ti = ida; ida = idb; idb = ti; } // draw left → right
      const x1 = a.x + GNW, y1 = a.y + GNH / 2, x2 = b.x, y2 = b.y + GNH / 2;
      const ta = (card(ida) || {}).teamId, tb = (card(idb) || {}).teamId;
      const cross = ta && tb && ta !== tb; // a link across teams is a dependency
      const dim = keep && (!keep.has(ida) || !keep.has(idb));
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      let cls = 'ge ', marker = 'gearrow', d = graphEdgePath(x1, y1, x2, y2), style = '';
      if (!cross && v !== 'v4') {
        cls += 'ge-same';
      } else if (v === 'v1') {                 // v1 · color + weight + team-name pill
        cls += 'ge-cross'; marker = 'gearrowX';
        if (!dim) {
          const lab = ((team(ta) || {}).name || '') + '  →  ' + ((team(tb) || {}).name || '');
          const w = lab.length * 5.6 + 20;
          labels += '<rect class="ge-lab-bg" x="' + (mx - w / 2) + '" y="' + (my - 10) + '" width="' + w + '" height="20" rx="10"/>' +
            '<text class="ge-lab" x="' + mx + '" y="' + (my + 3.5) + '" text-anchor="middle">' + esc(lab) + '</text>';
        }
      } else if (v === 'v2') {                 // v2 · animated flowing dashes = a live cross-boundary flow
        cls += cross ? 'ge-cross ge-flow' : 'ge-same'; marker = cross ? 'gearrowX' : 'gearrow';
      } else if (v === 'v3') {                 // v3 · orthogonal "dependency" routing (shape-coded)
        if (cross) { cls += 'ge-elbow'; marker = 'gearrowI'; d = graphElbowPath(x1, y1, x2, y2); }
        else cls += 'ge-same';
      } else {                                 // v4 · edge tinted by team — two-tone means it crosses teams
        const gid = 'gg' + idx;
        grads += '<linearGradient id="' + gid + '" gradientUnits="userSpaceOnUse" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '">' +
          '<stop offset="0.15" stop-color="' + gTeamColor(ta) + '"/><stop offset="0.85" stop-color="' + gTeamColor(tb) + '"/></linearGradient>';
        cls += 'ge-team' + (cross ? ' ge-team-cross' : ''); style = 'stroke:url(#' + gid + ')';
      }
      if (dim) cls += ' ge-dim';
      paths += '<path class="' + cls + '" d="' + d + '" marker-end="url(#' + marker + ')"' + (style ? ' style="' + style + '"' : '') + '/>';
    });
    return '<defs>' +
      '<marker id="gearrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#9aa1ad"/></marker>' +
      '<marker id="gearrowX" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="#f59e0b"/></marker>' +
      '<marker id="gearrowI" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="#4f46e5"/></marker>' +
      grads + '</defs>' + paths + labels + '<path class="ge ge-temp" id="ge-temp" d=""/>';
  }
  function graphLegend(m) {
    const v = state.navVersion;
    if (v === 'v2') return '<i class="lg-line lg-same"></i>same team<i class="lg-line lg-flow"></i>cross-team dependency';
    if (v === 'v3') return '<i class="lg-line lg-same"></i>same team<i class="lg-elbow"></i>cross-team dependency';
    if (v === 'v4') {
      const seen = [];
      m.nodes.forEach((n) => { const cd = card(n.id); if (cd && cd.teamId && !seen.includes(cd.teamId)) seen.push(cd.teamId); });
      return '<span class="lg-teamkey">' + seen.slice(0, 6).map((id) =>
        '<i class="lg-teamdot" style="background:' + gTeamColor(id) + '"></i>' + esc((team(id) || {}).name || '')).join('') +
        '</span><span class="lg-two">two-tone = crosses teams</span>';
    }
    return '<i class="lg-line lg-same"></i>same team<i class="lg-line lg-cross"></i>cross-team dependency';
  }
  function graphVerSeg() {
    return '<span class="bd-graph-ver">' + ['v1', 'v2', 'v3', 'v4'].map((v) =>
      '<button type="button" class="' + (state.navVersion === v ? 'on' : '') + '" data-bd-ver="' + v + '">' + v + '</button>').join('') + '</span>';
  }
  function graphNodeHtml(n, p) {
    const top = n.root
      ? '<span class="gn-type">' + n.label.toUpperCase() + '</span><span class="gn-team">BV: ' + n.bv + '</span>'
      : '<span class="gn-type">' + n.label.toUpperCase() + '</span><span class="gn-team">' + esc(n.team) + '</span>';
    const meta = '<div class="gn-meta"><i class="gn-dot st-' + n.status + '"></i>' + statusLabel(n.status) + (n.iter ? ' · ' + esc(n.iter) : '') + '</div>';
    return '<div class="gn gn-' + n.type + (n.root ? ' gn-root' : '') + '" data-gnode="' + n.id + '" style="left:' + p.x + 'px;top:' + p.y + 'px">' +
      '<div class="gn-top">' + top + '</div><div class="gn-title">' + esc(n.title) + '</div>' + meta +
      '<span class="gn-port" data-gport title="Drag to link"></span></div>';
  }
  function graphHtml(c) {
    const m = bdGraphModel(c);
    ensureGraphPos(c, m);
    const pos = bdGraphPos[c.id];
    const keep = focusKeep(c, m);
    let maxX = 0, maxY = 0;
    m.nodes.forEach((n) => { maxX = Math.max(maxX, pos[n.id].x); maxY = Math.max(maxY, pos[n.id].y); });
    const W = Math.max(maxX + GNW + 200, 1400), H = Math.max(maxY + GNH + 200, 900);
    const hint = m.nodes.length <= 1 ? '<div class="bd-graph-hint">No links yet — use the sticky’s <b>Links</b> action, then they’ll appear here.</div>' : '';
    return '<div class="bd-graph-wrap" id="bd-graph-wrap"><div class="bd-graph-toolbar">' +
      '<span class="bd-graph-hintline">Scroll to zoom · drag to pan · click a sticky to focus its links</span>' +
      '<span class="bd-graph-tbr"><span class="ge-legend">' + graphLegend(m) + '</span>' + graphVerSeg() + '</span></div>' +
      '<div class="bd-graph-viewport" id="bd-graph-viewport">' +
        '<div class="bd-graph-world" id="bd-graph-world" style="width:' + W + 'px;height:' + H + 'px">' +
          '<svg class="bd-graph-svg" id="bd-graph-svg" width="' + W + '" height="' + H + '">' + graphEdgesSvg(m, pos, keep) + '</svg>' +
          m.nodes.map((n) => graphNodeHtml(n, pos[n.id])).join('') + hint +
        '</div>' +
      '</div>' +
      '<div class="bd-graph-zoom" id="bd-graph-zoom">' +
        '<button type="button" data-gz="out" title="Zoom out">−</button>' +
        '<span id="gz-val">100%</span>' +
        '<button type="button" data-gz="in" title="Zoom in">+</button>' +
        '<button type="button" data-gz="fit" title="Fit">Fit</button></div>' +
      '</div>';
  }
  function wireGraph(c) {
    const vp = document.getElementById('bd-graph-viewport'); if (!vp) return;
    const world = document.getElementById('bd-graph-world');
    let svg = document.getElementById('bd-graph-svg');
    const m = bdGraphModel(c), pos = bdGraphPos[c.id];
    const view = bdGraphView[c.id] = bdGraphView[c.id] || { zoom: 1, x: 24, y: 24 };
    const applyView = () => {
      world.style.transform = 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.zoom + ')';
      const gv = document.getElementById('gz-val'); if (gv) gv.textContent = Math.round(view.zoom * 100) + '%';
    };
    applyView();
    const worldPt = (e) => { const r = vp.getBoundingClientRect(); return { x: (e.clientX - r.left - view.x) / view.zoom, y: (e.clientY - r.top - view.y) / view.zoom }; };
    const redrawEdges = () => { svg.innerHTML = graphEdgesSvg(m, pos, focusKeep(c, m)); };
    function applyFocus() {
      const f = bdGraphFocus[c.id] || null;
      world.classList.toggle('focusing', !!f);
      const keep = f ? lineageSet(f, m) : null;
      world.querySelectorAll('.gn').forEach((el) => {
        const id = el.dataset.gnode, kept = !f || keep.has(id);
        el.classList.toggle('gn-dim', !!f && !kept);
        el.classList.toggle('gn-focus', id === f);
        el.classList.toggle('gn-related', !!f && kept && id !== f);
      });
      redrawEdges();
    }
    applyFocus();

    // zoom
    vp.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = vp.getBoundingClientRect(), cx = e.clientX - r.left, cy = e.clientY - r.top;
      const wx = (cx - view.x) / view.zoom, wy = (cy - view.y) / view.zoom;
      view.zoom = Math.max(0.3, Math.min(2.5, view.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      view.x = cx - wx * view.zoom; view.y = cy - wy * view.zoom;
      applyView();
    }, { passive: false });
    const zoomAround = (factor) => {
      const r = vp.getBoundingClientRect(), cx = r.width / 2, cy = r.height / 2;
      const wx = (cx - view.x) / view.zoom, wy = (cy - view.y) / view.zoom;
      view.zoom = Math.max(0.3, Math.min(2.5, view.zoom * factor));
      view.x = cx - wx * view.zoom; view.y = cy - wy * view.zoom; applyView();
    };
    const zoomCtl = document.getElementById('bd-graph-zoom');
    if (zoomCtl) zoomCtl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-gz]'); if (!b) return;
      if (b.dataset.gz === 'in') zoomAround(1.2);
      else if (b.dataset.gz === 'out') zoomAround(1 / 1.2);
      else { view.zoom = 1; view.x = 24; view.y = 24; applyView(); }
    });

    // drag nodes / pan / link / focus
    let drag = null, link = null, pan = null;
    vp.addEventListener('pointerdown', (e) => {
      const port = e.target.closest('[data-gport]');
      const nd = e.target.closest('[data-gnode]');
      if (port && nd) { link = { from: nd.dataset.gnode }; }
      else if (nd) { drag = { id: nd.dataset.gnode, el: nd, sx: e.clientX, sy: e.clientY, px: pos[nd.dataset.gnode].x, py: pos[nd.dataset.gnode].y, moved: false }; nd.classList.add('gn-drag'); }
      else { pan = { sx: e.clientX, sy: e.clientY, px: view.x, py: view.y, moved: false }; vp.classList.add('panning'); }
      try { vp.setPointerCapture(e.pointerId); } catch (_) {}
    });
    vp.addEventListener('pointermove', (e) => {
      if (drag) {
        if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 4) drag.moved = true;
        pos[drag.id].x = Math.max(0, drag.px + (e.clientX - drag.sx) / view.zoom);
        pos[drag.id].y = Math.max(0, drag.py + (e.clientY - drag.sy) / view.zoom);
        drag.el.style.left = pos[drag.id].x + 'px'; drag.el.style.top = pos[drag.id].y + 'px';
        redrawEdges();
      } else if (link) {
        const a = pos[link.from], pt = worldPt(e);
        const tmp = document.getElementById('ge-temp'); if (tmp) tmp.setAttribute('d', graphEdgePath(a.x + GNW, a.y + GNH / 2, pt.x, pt.y));
      } else if (pan) {
        if (Math.abs(e.clientX - pan.sx) + Math.abs(e.clientY - pan.sy) > 4) pan.moved = true;
        view.x = pan.px + (e.clientX - pan.sx); view.y = pan.py + (e.clientY - pan.sy); applyView();
      }
    });
    const end = (e) => {
      if (drag) {
        drag.el.classList.remove('gn-drag');
        if (!drag.moved) { bdGraphFocus[c.id] = bdGraphFocus[c.id] === drag.id ? null : drag.id; applyFocus(); } // click = focus its links
        drag = null;
      } else if (link) {
        const tgt = document.elementFromPoint(e.clientX, e.clientY);
        const nd = tgt && tgt.closest('[data-gnode]');
        if (nd && nd.dataset.gnode !== link.from) { addLink(card(link.from), card(nd.dataset.gnode)); save(); renderModal(); }
        else redrawEdges();
        link = null;
      } else if (pan) {
        if (!pan.moved && bdGraphFocus[c.id]) { bdGraphFocus[c.id] = null; applyFocus(); } // click empty = clear focus
        pan = null; vp.classList.remove('panning');
      }
      try { vp.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    vp.addEventListener('pointerup', end);
    vp.addEventListener('pointercancel', end);
  }

  function modalBox(title, body) {
    return '<div class="pm-box"><div class="pm-h"><b>' + title + '</b>' +
      '<button class="pm-x" type="button" data-pm="close" title="Close">✕</button></div>' + body + '</div>';
  }
  function renderModal() {
    if (!modalType) return closeModal();
    modalEl.hidden = false;
    if (modalType === 'timer') {
      modalEl.innerHTML = modalBox('Timer',
        '<div class="pm-time" id="pm-time">' + fmtT(timerLeft) + '</div>' +
        '<div class="pm-row">' +
          '<button class="pm-btn" type="button" data-pm="t-1">−1 min</button>' +
          '<button class="pm-btn" type="button" data-pm="t+1">+1 min</button>' +
          '<button class="pm-btn pm-primary" type="button" data-pm="t-toggle">' + (timerRun ? 'Pause' : 'Start') + '</button>' +
          '<button class="pm-btn" type="button" data-pm="t-reset">Reset</button>' +
        '</div>');
    } else if (modalType === 'vote') {
      let body;
      if (!myVote) {
        body = '<p class="pm-p">Fist of five — how confident are we in this plan?</p>' +
          '<div class="pm-votes">' + [1, 2, 3, 4, 5].map((n) =>
            '<button class="pm-vote" type="button" data-pm="v' + n + '">' + n + '</button>').join('') + '</div>';
      } else {
        const all = [3, 4, 2, 4, 5].concat(myVote);
        const avg = (all.reduce((a, b) => a + b, 0) / all.length).toFixed(1);
        body = '<p class="pm-p">Average confidence <b class="pm-avg">' + avg + '</b> · ' + all.length + ' votes</p>' +
          '<div class="pm-bars">' + [1, 2, 3, 4, 5].map((n) => {
            const c = all.filter((v) => v === n).length;
            return '<div class="pm-bar"><i style="height:' + (c * 18 + 4) + 'px"></i><span>' + n + '</span></div>';
          }).join('') + '</div>' +
          '<div class="pm-row"><button class="pm-btn" type="button" data-pm="v-again">Vote again</button></div>';
      }
      modalEl.innerHTML = modalBox('Confidence Vote', body);
    } else if (modalType === 'readout') {
      const a = ctxArt();
      const list = state.teams.filter((t) => a.teamIds.includes(t.id));
      modalEl.innerHTML = modalBox('Plan Readout — ' + esc(a.name),
        '<p class="pm-p">Each team presents its draft plan. Five minutes per team.</p>' +
        '<div class="pm-list">' + list.map((t, i) =>
          '<div class="pm-item' + (i === readoutIdx ? ' now' : i < readoutIdx ? ' done' : '') + '">' +
            '<span class="pm-n">' + (i + 1) + '</span>' + esc(t.name) +
            (i === readoutIdx ? '<span class="pm-now">presenting</span>' : i < readoutIdx ? '<span class="pm-tick">✓</span>' : '') +
          '</div>').join('') + '</div>' +
        '<div class="pm-row">' +
          '<button class="pm-btn" type="button" data-pm="r-prev"' + (readoutIdx <= 0 ? ' disabled' : '') + '>Previous</button>' +
          '<button class="pm-btn pm-primary" type="button" data-pm="r-next"' + (readoutIdx >= list.length - 1 ? ' disabled' : '') + '>Next team</button>' +
        '</div>');
    } else if (modalType === 'help') {
      modalEl.innerHTML = modalBox('Help',
        '<div class="pm-help">' +
          '<div><b>⌘K</b> open the Hub — search stickies, boards and pages</div>' +
          '<div><b>Drag</b> pans the board · <b>scroll</b> zooms</div>' +
          '<div><b>Click a sticky</b> opens its action bar · <b>💬 badge</b> opens comments</div>' +
          '<div><b>Dock</b> switches Planning / Execution mode</div>' +
          '<div><b>esc</b> closes panels and overlays</div>' +
        '</div>');
    } else if (modalType === 'breakdown') {
      const c = modalCard || {};
      const gridBody = bdView === 'grid'
        ? '<div class="bd-toolbar">' +
            '<div class="bd-search-wrap">' + bIcon('search', 'bd-search-ico') +
              '<input id="bd-search" type="text" placeholder="Search items" autocomplete="off" value="' + esc(bdQuery) + '" /></div>' +
            '<div class="bd-cfg-wrap">' +
              '<button class="bd-cfg-trigger' + (bdCfgOpen ? ' on' : '') + '" type="button" data-bd-cfg-toggle>' +
                bIcon('apps', 'bd-cfg-tico') + '<span>' + BD_DIMS[bdRows].label + ' × ' + BD_DIMS[bdCols].label + '</span>' + bIcon('chev', 'bd-cfg-chev') + '</button>' +
              (bdCfgOpen ? bdCfgPop() : '') +
            '</div>' +
          '</div>' +
          '<div class="pm-full-b bd-body">' + breakdownHtml(c) + '</div>'
        : '<div class="pm-full-b bd-body bd-graph-body">' + graphHtml(c) + '</div>';
      modalEl.innerHTML =
        '<div class="pm-full bd-full"><div class="pm-full-h bd-head">' +
          bIcon('breakdown', 'bd-head-ico') + '<span class="bd-head-k">Breakdown</span>' +
          '<span class="bd-head-title"><i class="sb-swatch s-' + stypeOf(c) + '"></i>' + esc(c.title || '') + '</span>' +
          '<span class="bd-seg">' +
            '<button class="bd-seg-b' + (bdView === 'grid' ? ' on' : '') + '" type="button" data-bd-view="grid">' + bIcon('teamboard', 'bd-seg-ico') + 'Grid</button>' +
            '<button class="bd-seg-b' + (bdView === 'graph' ? ' on' : '') + '" type="button" data-bd-view="graph">' + bIcon('collab', 'bd-seg-ico') + 'Graph</button>' +
          '</span>' +
          '<button class="pm-x" type="button" data-pm="close" title="Close">✕</button></div>' +
          gridBody + '</div>';
      const bs = document.getElementById('bd-search');
      if (bs) bs.addEventListener('input', () => {
        bdQuery = bs.value.trim().toLowerCase();
        const scroll = modalEl.querySelector('.bd-scroll');
        if (scroll) scroll.outerHTML = breakdownHtml(modalCard);
      });
      if (bdView === 'graph') wireGraph(c);
    } else if (modalType === 'sblinks') {
      const c = modalCard || {};
      const linked = new Set(linkedIdsFor(c));
      const section = (title, cards) => cards.length ? '<div class="ov-grp">' + esc(title) + '</div><div class="ov-tiles">' +
        cards.map((x) => '<button class="ov-tile' + (linked.has(x.id) ? ' on' : '') + (x.id === c.id ? ' self' : '') + '" type="button" data-link-id="' + x.id + '"' + (x.id === c.id ? ' disabled' : '') + '>' +
          '<i class="sb-swatch s-' + stypeOf(x) + '"></i><span>' + esc(x.title) + '</span>' + (linked.has(x.id) ? '<span class="ov-ck">✓</span>' : '') + '</button>').join('') + '</div>' : '';
      let cols = '';
      state.arts.forEach((a) => {
        let inner = '';
        state.teams.filter((t) => a.teamIds.includes(t.id)).forEach((t) => {
          inner += section(t.name, state.cards.filter((x) => x.teamId === t.id));
        });
        if (inner) cols += '<div class="ov-art"><div class="ov-art-h">' + esc(a.name) + '</div>' + inner + '</div>';
      });
      modalEl.innerHTML =
        '<div class="pm-full"><div class="pm-full-h">' +
          '<div class="pm-full-t"><span class="pm-kicker">Link stickies</span><h2>' + esc(c.title || '') + '</h2>' +
            '<div class="pm-full-meta">' + linked.size + ' linked · pick stickies across ' + esc(state.st.name) + '</div></div>' +
          '<button class="pm-x" type="button" data-pm="close" title="Close">✕</button></div>' +
          '<div class="pm-full-b ov-body">' + (cols || '<div class="sb-empty">No stickies to link.</div>') + '</div></div>';
    } else if (modalType === 'objlinks') {
      const o = modalCard || {};
      const linked = objLinkedCards(o);
      let cols = '';
      state.arts.forEach((a) => {
        let inner = '';
        state.teams.filter((t) => a.teamIds.includes(t.id)).forEach((t) => {
          const cs = linked.filter((x) => x.teamId === t.id);
          if (cs.length) inner += '<div class="ov-grp">' + esc(t.name) + '</div><div class="ov-tiles">' +
            cs.map((x) => '<div class="ov-tile ov-static"><i class="sb-swatch s-' + stypeOf(x) + '"></i><span>' + esc(x.title) + '</span></div>').join('') + '</div>';
        });
        if (inner) cols += '<div class="ov-art"><div class="ov-art-h">' + esc(a.name) + '</div>' + inner + '</div>';
      });
      modalEl.innerHTML =
        '<div class="pm-full"><div class="pm-full-h">' +
          '<div class="pm-full-t"><span class="pm-kicker">Objective links</span><h2>' + esc(o.title || '') + '</h2>' +
            '<div class="pm-full-meta">' + linked.length + ' linked ' + (linked.length === 1 ? 'sticky' : 'stickies') + ' across ' + esc(state.st.name) + '</div></div>' +
          '<button class="pm-x" type="button" data-pm="close" title="Close">✕</button></div>' +
          '<div class="pm-full-b ov-body">' + (cols || '<div class="sb-empty">No links yet.</div>') + '</div></div>';
    } else if (modalType === 'objedit') {
      const o = modalCard || {};
      modalEl.innerHTML =
        '<div class="pm-box pm-oe"><div class="pm-h"><span class="pm-kicker">' + (objEditNew ? 'New objective' : 'Edit objective') + '</span>' +
          '<button class="pm-x" type="button" data-oe="cancel" title="Close">✕</button></div>' +
          '<label class="pm-oe-l" for="oe-title">Title</label>' +
          '<input id="oe-title" class="pm-oe-in" type="text" value="' + esc(o.title) + '" placeholder="Objective title" />' +
          '<label class="pm-oe-l" for="oe-desc">Description</label>' +
          '<textarea id="oe-desc" class="pm-oe-ta" rows="4" placeholder="Describe this objective…">' + esc(o.desc) + '</textarea>' +
          '<div class="pm-oe-row">' +
            '<div class="pm-oe-f"><label class="pm-oe-l" for="oe-bv">Business Value</label>' +
              '<input id="oe-bv" class="pm-oe-bv" type="text" inputmode="numeric" value="' + esc(String(o.bv)) + '" /></div>' +
            '<div class="pm-oe-f"><label class="pm-oe-l">Commitment</label><div class="pm-oe-seg">' +
              '<button type="button" class="' + (o.committed ? 'on' : '') + '" data-oe="commit" data-val="1">Committed</button>' +
              '<button type="button" class="' + (!o.committed ? 'on' : '') + '" data-oe="commit" data-val="0">Uncommitted</button>' +
            '</div></div>' +
          '</div>' +
          '<div class="pm-oe-foot"><button class="pm-btn" type="button" data-oe="cancel">Cancel</button>' +
            '<button class="pm-btn pm-primary" type="button" data-oe="save">Save objective</button></div>' +
        '</div>';
      const ti = document.getElementById('oe-title');
      if (ti) ti.addEventListener('input', () => { if (modalCard) { modalCard.title = ti.value; save(); } });
      const de = document.getElementById('oe-desc');
      if (de) de.addEventListener('input', () => { if (modalCard) { modalCard.desc = de.value; save(); } });
      const bv = document.getElementById('oe-bv');
      if (bv) bv.addEventListener('input', () => { bv.value = bv.value.replace(/[^0-9]/g, '').slice(0, 4); if (modalCard) { modalCard.bv = Number(bv.value) || 0; save(); } });
      if (ti && objEditNew) ti.focus();
    }
  }
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) return modalType === 'objedit' ? closeObjEditModal(false) : closeModal();
    if (modalType === 'objedit') {
      const oe = e.target.closest('[data-oe]');
      if (oe) {
        if (oe.dataset.oe === 'save') return closeObjEditModal(true);
        if (oe.dataset.oe === 'cancel') return closeObjEditModal(false);
        if (oe.dataset.oe === 'commit' && modalCard) { modalCard.committed = oe.dataset.val === '1'; save(); renderModal(); return; }
      }
      return;
    }
    // Breakdown Rows/Columns configurator + Grid/Graph switch
    if (modalType === 'breakdown') {
      const ver = e.target.closest('[data-bd-ver]');
      if (ver) { state.navVersion = ver.dataset.bdVer; save(); renderBoardView(); renderModal(); return; }
      const view = e.target.closest('[data-bd-view]');
      if (view) { bdView = view.dataset.bdView; bdCfgOpen = false; renderModal(); return; }
      const toggle = e.target.closest('[data-bd-cfg-toggle]');
      if (toggle) { bdCfgOpen = !bdCfgOpen; bdDd = null; renderModal(); return; }
      const cell = e.target.closest('[data-bd-cell]');           // matrix / preset
      if (cell) { const p = cell.dataset.bdCell.split(':'); bdRows = p[0]; bdCols = p[1]; bdCfgOpen = false; renderModal(); return; }
      const dim = e.target.closest('[data-bd-dim]');             // chip lists
      if (dim) {
        const [axis, d] = dim.dataset.bdDim.split(':');
        if (axis === 'rows') { if (bdCols === d) bdCols = bdRows; bdRows = d; } else { if (bdRows === d) bdRows = bdCols; bdCols = d; }
        renderModal(); return;
      }
      if (e.target.closest('[data-bd-swap]')) { const t = bdRows; bdRows = bdCols; bdCols = t; renderModal(); return; }
      const dd = e.target.closest('[data-bd-dd]');               // dropdowns
      if (dd) { bdDd = bdDd === dd.dataset.bdDd ? null : dd.dataset.bdDd; renderModal(); return; }
      const ddp = e.target.closest('[data-bd-ddpick]');
      if (ddp) { const [axis, d] = ddp.dataset.bdDdpick.split(':'); if (axis === 'rows') bdRows = d; else bdCols = d; bdDd = null; renderModal(); return; }
      // click elsewhere closes the configurator popover
      if (bdCfgOpen && !e.target.closest('.bd-cfg-pop')) { bdCfgOpen = false; bdDd = null; renderModal(); return; }
    }
    const ln = e.target.closest('[data-bd-lane]');
    if (ln) {
      const id = ln.dataset.bdLane;
      bdCollapsed[id] = !bdCollapsed[id];
      const scroll = modalEl.querySelector('.bd-scroll');
      if (scroll && modalCard) scroll.outerHTML = breakdownHtml(modalCard);
      return;
    }
    const lk = e.target.closest('[data-link-id]');
    if (lk && modalCard) {
      const target = card(lk.dataset.linkId);
      if (target && target.id !== modalCard.id) {
        const linked = linkedIdsFor(modalCard).includes(target.id);
        if (linked) removeLink(modalCard, target.id); else addLink(modalCard, target);
        save(); renderModal();
        if (!boardScreen.hidden) renderCanvas();
      }
      return;
    }
    const b = e.target.closest('[data-pm]'); if (!b) return;
    const a = b.dataset.pm;
    if (a === 'close') return closeModal();
    if (a === 't-1') { timerLeft = Math.max(60, timerLeft - 60); renderModal(); }
    else if (a === 't+1') { timerLeft = Math.min(3600, timerLeft + 60); renderModal(); }
    else if (a === 't-reset') { timerRun = false; clearInterval(timerIv); timerLeft = 300; renderModal(); }
    else if (a === 't-toggle') {
      timerRun = !timerRun; clearInterval(timerIv);
      if (timerRun) {
        timerIv = setInterval(() => {
          if (timerLeft > 0) {
            timerLeft -= 1;
            const tEl = document.getElementById('pm-time');
            if (tEl) tEl.textContent = fmtT(timerLeft);
          } else { clearInterval(timerIv); timerRun = false; renderModal(); }
        }, 1000);
      }
      renderModal();
    }
    else if (a === 'v-again') { myVote = 0; renderModal(); }
    else if (a[0] === 'v') { myVote = Number(a.slice(1)) || 0; renderModal(); }
    else if (a === 'r-prev') { readoutIdx = Math.max(0, readoutIdx - 1); renderModal(); }
    else if (a === 'r-next') { readoutIdx += 1; renderModal(); }
  });

  navEl.addEventListener('click', (e) => {
    const dd = e.target.closest('[data-dd]');
    if (dd) { e.stopPropagation(); menuOpen = menuOpen === dd.dataset.dd ? null : dd.dataset.dd; renderNavTree(); return; }
    const exp = e.target.closest('[data-nt-exp]');
    if (exp) { ensureExpanded(); expanded[exp.dataset.ntExp] = !expanded[exp.dataset.ntExp]; renderNavTree(); return; }
    const gb = e.target.closest('[data-nt-board]');
    if (gb) { const p = gb.dataset.ntBoard.split(':'); ctx = { type: p[0], id: p[0] === 'st' ? state.st.id : p[1] }; mode = 'board'; railActive = p[2]; menuOpen = null; renderBoardView(); updateHash(); return; }
    const gp = e.target.closest('[data-nt-page]');
    if (gp) { const p = gp.dataset.ntPage.split(':'); ctx = { type: p[0], id: p[0] === 'st' ? state.st.id : p[1] }; mode = 'page'; activePage = p[2]; menuOpen = null; renderBoardView(); updateHash(); return; }
    const gs = e.target.closest('[data-go-session]');
    if (gs) { state.piName = gs.dataset.goSession; menuOpen = null; save(); renderBoardView(); return; }
  });

  // ---------- Floating side rail: the active team's boards only ----------
  function renderSideRail() {
    const forceRight = mode === 'board' && railActive === 'objectives' && objPanelOpen;
    srail.classList.toggle('srail--right', forceRight || railRight);
    const mine = boardsFor(ctx.type);
    srail.innerHTML =
      '<button class="sr-btn" type="button" data-rail="shift" title="Move rail to the other side"' + (forceRight ? ' disabled' : '') + '>' + bIcon('shift') + '</button>' +
      '<div class="sr-sep"></div>' +
      mine.map(srBtn).join('');
  }
  function srBtn(b) {
    return '<button class="sr-btn' + (mode === 'board' && railActive === b[0] ? ' on' : '') + '" type="button" data-rail="' + b[0] + '" title="' + esc(b[2]) + '">' + bIcon(b[1]) + '</button>';
  }

  // ---------- Sticky notes ----------
  // ---------- Sticky metadata (type / status / links / activity) ----------
  const STYPES = [['feature', 'Feature'], ['story', 'User story'], ['dependency', 'Dependency'], ['note', 'Note']];
  const STATUSES = [['todo', 'To Do'], ['doing', 'In Progress'], ['done', 'Done']];
  const KIND_TO_STYPE = { feature: 'feature', enabler: 'dependency', milestone: 'note', story: 'story' };
  const stypeOf = (c) => c.stype || KIND_TO_STYPE[c.kind] || 'story';
  const statusOf = (c) => c.status || 'todo';
  const stypeLabel = (k) => (STYPES.find((s) => s[0] === k) || ['', k])[1];
  const statusLabel = (k) => (STATUSES.find((s) => s[0] === k) || ['', k])[1];
  // Links are symmetric: A↔B if either lists the other.
  function linkedIdsFor(c) {
    const set = new Set(c.links || []);
    state.cards.forEach((o) => { if (o.id !== c.id && (o.links || []).includes(c.id)) set.add(o.id); });
    return [...set].filter((id) => card(id));
  }
  function activityOf(c) {
    if (!c.activity) c.activity = [
      { who: 'Mara Kim', what: 'created this sticky', ago: '3d' },
      { who: 'Ari Ruiz', what: 'set points to ' + (c.points || 0), ago: '2d' },
      { who: 'Tom Sato', what: 'moved it to ' + statusLabel(statusOf(c)), ago: '1d' },
    ];
    return c.activity;
  }
  function logActivity(c, what) {
    activityOf(c).unshift({ who: state.user.name, what, ago: 'now' });
    c.activity = c.activity.slice(0, 20);
  }

  const NOTE_COLS = 4, NOTE_W = 96, NOTE_H = 66, NOTE_GX = 12, NOTE_GY = 14;
  function noteHtml(c, i) {
    const h = hashCode(c.id);
    const col = i % NOTE_COLS, row = Math.floor(i / NOTE_COLS);
    const jx = (h % 15) - 5, jy = ((h >> 4) % 13) - 5;
    const x = 6 + col * (NOTE_W + NOTE_GX) + Math.max(-4, jx);
    const y = 4 + row * (NOTE_H + NOTE_GY) + Math.max(-3, jy);
    const prog = 30 + (Math.abs(h) % 60);
    const done = Math.round(prog * 0.6);
    const th = state.threads && state.threads.find((t) => t.kind === 'sticky' && t.sticky === c.title);
    const cvCount = th ? 1 + (th.replies || []).length : 0;
    const st = stypeOf(c), status = statusOf(c);
    let cls = 'note s-' + st + ' st-' + status;
    if (stickyOpen === c.title) cls += ' n-active';
    if (sbCard && sbCard.id === c.id) cls += ' n-open';
    if (pinned) {
      if (pinned === c.id) cls += ' n-pinned';
      else if (linkedIdsFor(card(pinned) || {}).includes(c.id)) cls += ' n-linked';
      else cls += ' n-dim';
    }
    return '<div class="' + cls + '" data-id="' + c.id + '" style="left:' + x + 'px;top:' + y + 'px">' +
      '<span class="n-tab"></span>' +
      '<span class="n-pip" title="' + statusLabel(status) + '"></span>' +
      (cvCount ? '<span class="n-cv" title="' + cvCount + ' comment' + (cvCount > 1 ? 's' : '') + ' — click to read">' + cvCount + '</span>' : '') +
      '<div class="n-text">' + esc(c.title) + '</div>' +
      '<div class="n-bar"><i class="n-done" style="width:' + done + '%"></i><i class="n-doing" style="width:' + (prog - done) + '%"></i></div>' +
    '</div>';
  }

  // ---------- Panels ----------
  function iterPanel(idx, name) {
    const cards = state.cards.filter((c) => c.sprintIdx === idx && inScope(c.teamId));
    const load = cards.reduce((a, c) => a + (Number(c.points) || 0), 0);
    const notes = cards.map((c, i) => noteHtml(c, i)).join('');
    return '<div class="panel-h">' +
        '<div class="ph-row1">' + bIcon('bookmark', 'ph-bm') + '<span class="ph-name">' + esc(name) + '</span>' +
          '<span class="ph-dates">' + esc(state.context.dates) + '</span></div>' +
        '<div class="ph-row2">' +
          '<button class="cap-btn" type="button" disabled>Configure Capacity</button>' +
          '<span class="load-pill">Load: ' + load + '</span>' +
          '<span class="ph-sp"></span>' +
          '<button class="ph-ico2" type="button" title="Columns" disabled>' + bIcon('cols') + '</button>' +
          '<button class="ph-ico2" type="button" title="More" disabled>' + bIcon('dots') + '</button>' +
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
        '<button class="ph-ico2" type="button" title="Expand" disabled>' + bIcon('expand') + '</button></div>' +
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
  function renderCanvas() {
    if (mode === 'page') return renderPageCanvas();
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

  // ART Objectives: team blocks in a balanced masonry (shortest column first).
  // The header is consistent; the version pill switches how the VIEWER'S OWN
  // team (state.myTeamId) is highlighted so it's easy to spot among many:
  //   v1 · "You" badge — accent pill + accent name on my team's header
  //   v2 · tinted block — my team's whole block gets a soft accent wash + rail
  //   v3 · outline ring — an accent ring drawn around my team's block
  //   v4 · corner flag — a "My team" ribbon on my team's block
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
    const v = state.navVersion;
    const n = objs.length;
    const mine = tm.id === state.myTeamId;
    const tail = n ? '<span class="ob-count">' + n + '</span>' : '<span class="ob-none">No objectives yet</span>';
    const star = mine && v === 'v4' ? '<span class="ob-star">' + bIcon('objectives', 'ob-star-ico') + '</span>' : '';
    const you = mine && v === 'v1' ? '<span class="ob-you">You</span>' : '';
    const head = '<div class="ob-head ob-head-base">' + star + '<span class="ob-name">' + esc(tm.name) + '</span>' + you + tail + '</div>';
    const body = n ? objGroup('Commited', com) + objGroup('Uncommitted', unc) : '';
    const ribbon = mine && v === 'v4' ? '<span class="ob-ribbon">My team</span>' : '';
    const cls = 'obj-block' + (n ? '' : ' obj-empty') + (mine ? ' obj-mine' : '');
    return '<section class="' + cls + '">' + ribbon + head + body + '</section>';
  }
  function estBlock(tm) {
    const n = (tm.objectives || []).length;
    return n ? 60 + 2 * 30 + n * 76 : 64;
  }
  function renderObjectivesBoard() {
    const teams = ctxTeams();
    const availW = canvasWrap.clientWidth - 2 * PAD;
    const availH = canvasWrap.clientHeight - 2 * PAD;
    boardW = availW;
    boardH = availH;
    canvas.style.width = availW + 'px';
    canvas.style.height = availH + 'px';
    // Teams and objectives mix in a masonry: several teams stack per column
    // (shortest column first), empty teams as slim "No objectives yet" bars.
    // Then the whole sheet shrinks (fonts included) until it fits at 100%.
    const loaded = teams.filter((t) => (t.objectives || []).length).length;
    const COLS = Math.max(3, Math.min(6, loaded + (teams.length > loaded ? 1 : 0)));
    const cols = [], colH = [];
    for (let i = 0; i < COLS; i++) { cols.push([]); colH.push(0); }
    teams.forEach((tm) => {
      const ci = colH.indexOf(Math.min.apply(null, colH));
      cols[ci].push(tm); colH[ci] += estBlock(tm);
    });
    canvas.innerHTML = '<div class="obj-fit"><div class="obj-sheet obj-d-' + state.navVersion + '" id="obj-sheet" style="height:auto;width:' + availW + 'px">' +
      cols.map((group, ci) => '<div class="obj-col' + (ci === COLS - 1 ? ' last-col' : '') + '">' + group.map(teamBlock).join('') + '</div>').join('') +
      '</div></div>';
    const sheet = document.getElementById('obj-sheet');
    let s = Math.min(1, availH / sheet.scrollHeight);
    for (let i = 0; i < 4 && s < 1; i++) {
      sheet.style.width = Math.round(availW / s) + 'px';
      const ns = Math.min(1, availH / sheet.scrollHeight);
      if (Math.abs(ns - s) < 0.01) { s = ns; break; }
      s = ns;
    }
    s = Math.min(s, availH / sheet.scrollHeight);
    sheet.style.transformOrigin = 'top left';
    sheet.style.transform = s < 1 ? 'scale(' + s + ')' : '';
  }

  function renderPlaceholderBoard() {
    boardW = canvasWrap.clientWidth - 2 * PAD;
    boardH = canvasWrap.clientHeight - 2 * PAD;
    canvas.style.width = boardW + 'px';
    canvas.style.height = boardH + 'px';
    canvas.innerHTML = '<div class="board-sheet wb-soon"><div class="soon-card">' +
      bIcon('apps', 'soon-ic') + '<h3>' + esc(boardName(railActive)) + '</h3>' +
      '<p>This board isn’t wired up yet — coming next.</p></div></div>';
  }

  // ---------- Pages plane: documents assembled live from boards + conversations ----------
  function sampleDeps() {
    const scoped = ctxTeams();
    const n = (scoped.length > 1 ? scoped : state.teams).map((t) => t.name);
    const nm = (i) => n[i % n.length] || 'Team';
    return [
      { from: nm(0), to: nm(1), what: 'SSO integration handshake', iter: 'Iteration 2', st: 'Blocked' },
      { from: nm(2), to: nm(0), what: 'Event pipeline schema', iter: 'Iteration 3', st: 'At risk' },
      { from: nm(3), to: nm(4), what: 'Billing API contract', iter: 'Iteration 2', st: 'On track' },
    ];
  }
  function burndownSvg() {
    const pts = [[30, 26], [90, 34], [150, 52], [210, 58], [270, 84], [330, 92], [390, 118], [450, 126], [510, 138]];
    return '<svg class="bd-svg" viewBox="0 0 560 170" preserveAspectRatio="none">' +
      '<line x1="30" y1="20" x2="530" y2="150" stroke="#c9cfda" stroke-width="1.5" stroke-dasharray="5 5"/>' +
      '<polyline points="' + pts.map((p) => p.join(',')).join(' ') + '" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
      pts.map((p) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3" fill="#f59e0b"/>').join('') +
      '<line x1="30" y1="150" x2="530" y2="150" stroke="#e6e8ee"/>' +
    '</svg>';
  }
  const ST_CLASS = { Blocked: 'st-bad', 'At risk': 'st-warn', 'On track': 'st-ok' };
  function blockHtml(b) {
    const head = b.title
      ? '<div class="pd-bh"><b>' + esc(b.title) + '</b>' + (b.src ? '<span class="pd-src">from ' + esc(b.src) + '</span>' : '') + '</div>'
      : '';
    if (b.type === 'text') return '<div class="pd-block pd-block--text"><p class="pd-text">' + esc(b.text) + '</p></div>';
    if (b.type === 'deps') {
      return '<div class="pd-block">' + head + sampleDeps().map((d) =>
        '<div class="dep-row"><span class="dep-teams">' + esc(d.from) + ' → ' + esc(d.to) + '</span>' +
        '<span class="dep-what">' + esc(d.what) + '</span>' +
        '<span class="dep-iter">' + esc(d.iter) + '</span>' +
        '<span class="dep-st ' + (ST_CLASS[d.st] || 'st-ok') + '">' + esc(d.st) + '</span></div>').join('') + '</div>';
    }
    if (b.type === 'burndown') {
      return '<div class="pd-block">' + head + burndownSvg() +
        '<div class="pd-note">Iteration 2 · day 6 of 10 · slightly behind the ideal line</div></div>';
    }
    if (b.type === 'convo') {
      const decisions = [
        'Falcon owns the SSO token exchange (agreed in huddle).',
        'Billing API story will be split into contract + implementation.',
        'Data-migration window escalated to the vendor — answer due Friday.',
      ];
      return '<div class="pd-block">' + head +
        '<p class="pd-text">' + state.threads.length + ' conversations were active this week, mostly around the SSO hand-off and the billing scope. The tone has shifted from discovery to commitments: owners are being named and two follow-up huddles are already scheduled.</p>' +
        '<div class="pd-decisions">' + decisions.map((d) => '<div class="pd-dec">✓ ' + esc(d) + '</div>').join('') + '</div></div>';
    }
    if (b.type === 'risk') {
      const r = state.risks[0];
      return '<div class="pd-block">' + head +
        '<div class="pd-risk"><b>Iteration 2 is the pinch point.</b> Three cross-team hand-offs land in the same week' +
        (r ? ', and “' + esc(r.text) + '” is still ' + esc((ROAM.find((x) => x.cat === r.cat) || ROAM[0]).label.toLowerCase()) : '') +
        '. If the SSO handshake slips, the login screen, billing and onboarding stories all move right.</div></div>';
    }
    if (b.type === 'okr') {
      const rows = state.artObjectives.slice(0, 4).map((o, i) => {
        const pct = [62, 45, 28, 70][i % 4];
        return '<div class="okr-row"><div class="okr-t"><b>O' + (i + 1) + '</b> ' + esc(o.title) + '</div>' +
          '<div class="okr-bar"><i style="width:' + pct + '%"></i></div><span class="okr-pct">' + pct + '%</span></div>';
      }).join('');
      return '<div class="pd-block">' + head + rows + '</div>';
    }
    if (b.type === 'file') {
      return '<div class="pd-block pd-block--file"><div class="pd-file">' + bIcon('doc', 'pd-fico') +
        '<div><b>' + esc(b.name) + '</b><span>' + esc(b.note || '') + '</span></div>' +
        '<button class="pd-btn" type="button" disabled>Replace</button></div></div>';
    }
    if (b.type === 'stats') {
      const ts = ctxTeams();
      const ids = ts.map((t) => t.id);
      const load = state.cards.filter((c) => ids.includes(c.teamId)).reduce((a, c) => a + (Number(c.points) || 0), 0);
      const cap = ts.reduce((a, t) => a + (Number(t.capacity) || 0), 0) * state.sprints.length;
      const committed = ts.reduce((a, t) => a + ((t.objectives || []).filter((o) => o.committed).length), 0);
      const tiles = [
        ['Load', load, 'points planned'],
        ['Capacity', cap, 'points available'],
        ['Objectives', committed, 'committed'],
        ['Risks', state.risks.length, 'open'],
      ].map((t) => '<div class="pd-stat"><span class="pd-sk">' + t[0] + '</span><span class="pd-sv">' + t[1] + '</span><span class="pd-ss">' + t[2] + '</span></div>').join('');
      return '<div class="pd-block">' + head + '<div class="pd-stats">' + tiles + '</div></div>';
    }
    return '';
  }
  function renderPageCanvas() {
    const scoped = pagesFor();
    const pg = scoped.find((p) => p.id === activePage) || scoped[0] || state.pages[0];
    activePage = pg.id;
    const availW = canvasWrap.clientWidth - 2 * PAD;
    const availH = canvasWrap.clientHeight - 2 * PAD;
    boardW = Math.min(920, availW);
    canvas.style.width = boardW + 'px';
    canvas.style.height = 'auto';
    canvas.innerHTML = '<div class="page-doc">' +
      '<div class="pd-head"><div class="pd-id"><h2>' + esc(pg.title) + '</h2>' +
        '<div class="pd-meta"><span class="pd-tag">' + esc(pg.purpose) + '</span><span>' + esc(ctxName()) + '</span><span>Updated ' + esc(pg.updated) + '</span><span>' + esc(state.piName) + '</span></div></div>' +
        '<div class="pd-actions">' +
          '<button class="pd-btn" type="button" disabled>' + bIcon('present', 'pd-bico') + 'Present</button>' +
          '<button class="pd-btn" type="button" disabled>' + bIcon('doc', 'pd-bico') + 'Turn into document</button>' +
        '</div></div>' +
      pg.blocks.map(blockHtml).join('') + '</div>';
    boardH = Math.max(canvas.firstChild.scrollHeight, availH);
    canvas.style.height = boardH + 'px';
  }

  // ART Objectives side panel (collapsible)
  let objPanelOpen = true;
  let asMenu = null;                 // id of the objective whose "…" menu is open
  let asEditing = null;              // id of the objective being inline-edited (title/desc)
  let asEditMode = null;             // 'form' (v1) | 'quick' (v2) — inline edit style
  let asEditSnap = null;             // pre-edit snapshot for Cancel/Escape revert
  let asNewId = null;                // id of a just-added objective (discarded if left blank)
  const asExpanded = {};             // ids whose description is expanded
  let asDragId = null;               // id of the objective being dragged
  const objById = (id) => state.artObjectives.find((x) => x.id === id);
  // A card's rank is its 1-based position WITHIN its own group (committed vs not).
  function asGroupOf(o) { return state.artObjectives.filter((x) => !!x.committed === !!o.committed); }
  // v3 edits inline always; v1/v2 flip a single card into inline edit via asEditing
  // (v4 edits in a modal, so it never uses asEditing).
  function objEditing(o) { return state.navVersion === 'v3' || (asEditing === o.id && state.navVersion !== 'v4'); }
  function objCard(o, rank) {
    const v = state.navVersion, editing = objEditing(o);
    const open = !!asExpanded[o.id];
    const group = asGroupOf(o), gi = group.indexOf(o);
    const canUp = gi > 0, canDown = gi < group.length - 1;
    const menu = asMenu === o.id
      ? '<div class="as-menu" data-obj-menu="' + o.id + '">' +
          (v !== 'v3' ? '<button class="as-mi" type="button" data-obj-act="edit" data-id="' + o.id + '">' + bIcon('edit', 'as-mico') + 'Edit' + (v === 'v4' ? '…' : '') + '</button>' : '') +
          '<button class="as-mi" type="button" data-obj-act="commit" data-id="' + o.id + '">' + bIcon('statusdot', 'as-mico') +
            (o.committed ? 'Mark as Uncommitted' : 'Mark as Committed') + '</button>' +
          (canUp ? '<button class="as-mi" type="button" data-obj-act="up" data-id="' + o.id + '">' + bIcon('chevup', 'as-mico') + 'Move Up</button>' : '') +
          (canDown ? '<button class="as-mi" type="button" data-obj-act="down" data-id="' + o.id + '">' + bIcon('chev', 'as-mico') + 'Move Down</button>' : '') +
          '<div class="as-msep"></div>' +
          '<button class="as-mi as-danger" type="button" data-obj-act="del" data-id="' + o.id + '">' + bIcon('trash', 'as-mico') + 'Delete</button>' +
        '</div>'
      : '';
    const titleHtml = editing
      ? '<input class="as-title-in" type="text" data-obj-title="' + o.id + '" value="' + esc(o.title) + '" placeholder="Objective title" aria-label="Objective title" />'
      : '<div class="as-title">' + esc(o.title || 'Untitled objective') + '</div>';
    // Titles never truncate (they wrap). Descriptions clamp to two lines with a
    // "See more" — always rendered, then hidden after render for descriptions
    // that actually fit within two lines (measured in renderArtSide).
    const descHtml = editing
      ? '<textarea class="as-desc-in" data-obj-desc="' + o.id + '" rows="2" placeholder="Describe this objective…" aria-label="Description">' + esc(o.desc) + '</textarea>'
      : '<div class="as-desc' + (open ? ' open' : '') + '">' + esc(o.desc) + '</div>' +
        ((o.desc || '').trim() ? '<button class="as-more" type="button" data-obj-toggle="' + o.id + '">' + (open ? 'See less' : 'See more') + '</button>' : '');
    // v2's quick-edit shows a pencil in the (hover-revealed) action row.
    const pencil = (v === 'v2' && !editing)
      ? '<button class="as-ico" type="button" data-obj-act="edit" data-id="' + o.id + '" title="Edit">' + bIcon('edit') + '</button>' : '';
    // v1's roomy form commits explicitly with Save / Cancel.
    const formFoot = (editing && asEditMode === 'form' && asEditing === o.id)
      ? '<div class="as-editrow"><button class="as-eb" type="button" data-obj-act="cancel" data-id="' + o.id + '">Cancel</button>' +
        '<button class="as-eb as-eb-primary" type="button" data-obj-act="save" data-id="' + o.id + '">Save</button></div>' : '';
    // v2 · a one-click commitment checkbox (checked = committed) for fast triage.
    const commitBox = v === 'v2'
      ? '<button class="as-check" type="button" data-obj-act="commit" data-id="' + o.id + '" title="' + (o.committed ? 'Committed' : 'Uncommitted') + '" aria-pressed="' + o.committed + '"></button>' : '';
    // v4 · a visible Edit button (opens the modal editor) for discoverability.
    const editCta = v === 'v4'
      ? '<button class="as-editcta" type="button" data-obj-act="edit" data-id="' + o.id + '">' + bIcon('edit', 'as-ecico') + 'Edit</button>' : '';
    // Execution mode adds Actual Value, a RAG status control and a progress bar.
    const exec = state.workMode === 'execution';
    const bvLabel = exec ? 'BV' : 'Business Value';
    const execMeta = exec
      ? '<label class="as-av"><input class="as-av-box" type="text" inputmode="numeric" data-obj-av="' + o.id + '" value="' + esc(String(o.av || 0)) + '" aria-label="Actual Value" /><span class="as-av-l">AV</span></label>' +
        '<span class="as-div"></span>' +
        '<button class="as-rag rag-' + (o.rag || 'green') + '" type="button" data-obj-rag="' + o.id + '" title="RAG status: ' + ragLabel(o.rag) + ' — click to change" aria-label="RAG status"><i class="as-rag-dot"></i></button>' +
        '<span class="as-div"></span>' : '';
    const progPart = exec ? objProgressHtml(o) : '';
    // "as-editing" is the transient inline-edit chrome (v1/v2). v3 renders fields
    // always but styles itself, so it doesn't take the transient chrome.
    const transient = asEditing === o.id && v !== 'v4';
    const cls = 'as-card as-' + v + (o.committed ? ' as-committed' : ' as-uncommitted') +
      (transient ? ' as-editing as-mode-' + asEditMode : '') +
      (asDragId === o.id ? ' as-dragging' : '');
    return '<div class="' + cls + '" data-obj-card="' + o.id + '">' +
      '<div class="as-top">' + commitBox +
        '<span class="as-grip" data-obj-grip="' + o.id + '" draggable="true" title="Drag to reorder">' +
          '<span class="as-rank">' + rank + '</span>' + bIcon('grip', 'as-gico') + '</span>' +
        titleHtml +
        '<span class="as-flag" aria-hidden="true"></span>' +
        '<div class="as-acts">' + pencil +
          '<button class="as-ico" type="button" data-obj-bd="' + o.id + '" title="Breakdown">' + bIcon('breakdown') + '</button>' +
          '<button class="as-ico' + (asMenu === o.id ? ' on' : '') + '" type="button" data-obj-more="' + o.id + '" title="More options">' + bIcon('dots') + '</button>' +
        '</div>' + menu +
      '</div>' +
      descHtml +
      '<div class="as-foot' + (exec ? ' as-foot-exec' : '') + '">' +
        '<label class="as-bv"><input class="as-bv-box" type="text" inputmode="numeric" data-obj-bv="' + o.id + '" value="' + esc(String(o.bv)) + '" aria-label="Business Value" /><span class="as-bv-l">' + bvLabel + '</span></label>' +
        execMeta +
        '<button class="as-lk" type="button" data-obj-links="' + o.id + '" title="View links">' + bIcon('link', 'as-lkico') + (Array.isArray(o.links) ? o.links.length : o.links) + '</button>' + editCta +
      '</div>' + progPart + formFoot + '</div>';
  }
  function renderArtSide() {
    if (mode !== 'board' || railActive !== 'objectives') { artSide.innerHTML = ''; return; }
    const list = state.artObjectives;
    const com = list.filter((o) => o.committed), unc = list.filter((o) => !o.committed);
    const grp = (label, arr) =>
      '<div class="as-grp"><span>' + label + '</span><span class="as-n">' + arr.length + '</span></div>' +
      (arr.length ? arr.map((o, i) => objCard(o, i + 1)).join('') : '<div class="as-empty">Nothing here yet.</div>');
    artSide.innerHTML =
      '<div class="as-head as-head-' + state.navVersion + '"><span class="as-art">' + esc(ctxArt().name) + '</span>' +
        '<button class="as-add" type="button" title="Add objective" data-obj-add>' + bIcon('plus') + '<span class="as-add-t">Add objective</span></button></div>' +
      '<div class="as-body as-body-' + state.navVersion + '">' + grp('Committed', com) + grp('Uncommitted', unc) + '</div>';
    // "See more" belongs only on descriptions that actually overflow two lines.
    artSide.querySelectorAll('.as-desc').forEach((d) => {
      const more = d.nextElementSibling;
      if (!more || !more.classList.contains('as-more') || d.classList.contains('open')) return;
      if (d.scrollHeight <= d.clientHeight + 1) more.style.display = 'none';
    });
  }
  // Each version edits in its own idiom: v1 roomy inline form (Save/Cancel), v2
  // quick inline (live, click-away saves), v3 always live, v4 a focused modal.
  function startObjEdit(id, isNew) {
    const o = objById(id); if (!o) return;
    const hadMenu = asMenu; asMenu = null;
    const v = state.navVersion;
    if (v === 'v4') { if (hadMenu) renderArtSide(); openObjEditModal(o, !!isNew); return; }
    if (v === 'v3') {                       // already live — just surface & focus it
      asExpanded[id] = true; renderArtSide();
      const inp = artSide.querySelector('[data-obj-title="' + id + '"]');
      if (inp) { inp.focus(); inp.scrollIntoView({ block: 'nearest' }); }
      return;
    }
    asEditing = id;
    asEditMode = v === 'v1' ? 'form' : 'quick';
    asEditSnap = { title: o.title, desc: o.desc, bv: o.bv };
    asNewId = isNew ? id : null;
    asExpanded[id] = true; save(); renderArtSide();
    const inp = artSide.querySelector('[data-obj-title="' + id + '"]');
    if (inp) { inp.focus(); if (inp.select) inp.select(); inp.scrollIntoView({ block: 'nearest' }); }
  }
  // Leave inline edit. commit=false reverts to the snapshot (Cancel / Escape).
  function finishObjEdit(commit) {
    if (!asEditing) return;
    const o = objById(asEditing);
    if (o && !commit && asEditSnap) { o.title = asEditSnap.title; o.desc = asEditSnap.desc; o.bv = asEditSnap.bv; }
    if (o && !(o.title || '').trim()) {
      if (asNewId === o.id && !(o.desc || '').trim()) state.artObjectives = state.artObjectives.filter((x) => x.id !== o.id);
      else o.title = 'Untitled objective';
    }
    asEditing = null; asEditMode = null; asEditSnap = null; asNewId = null;
    save(); renderArtSide();
  }
  // Add a new objective to the end of Committed, then edit it in the active idiom.
  function addObjective() {
    const o = { id: uid(), title: '', desc: '', bv: 0, links: 0, committed: true };
    const arr = state.artObjectives;
    let idx = arr.findIndex((x) => !x.committed); if (idx < 0) idx = arr.length;
    arr.splice(idx, 0, o);
    asMenu = null; save(); renderArtSide();
    startObjEdit(o.id, true);
  }
  // Seeded set of stickies an objective "links" to — used by the links overlay.
  function objLinkedCards(o) {
    const n = Array.isArray(o.links) ? o.links.length : (o.links || 0);
    const pool = state.cards.slice();
    if (!pool.length || !n) return [];
    const rng = seededRng('objlinks-' + o.id);
    const used = new Set(), out = [];
    while (out.length < Math.min(n, pool.length)) {
      const idx = Math.floor(rng() * pool.length);
      if (used.has(idx)) continue;
      used.add(idx); out.push(pool[idx]);
    }
    return out;
  }
  function openObjLinks(o) { modalCard = o; modalType = 'objlinks'; modalEl.classList.add('pm-wide'); renderModal(); }
  // Execution helpers: RAG cycle + progress across the objective's linked stickies.
  const RAG_ORDER = ['red', 'amber', 'green'];
  const ragLabel = (r) => ({ red: 'Red', amber: 'Amber', green: 'Green' })[r] || 'Green';
  const ragNext = (r) => RAG_ORDER[(RAG_ORDER.indexOf(r) + 1) % RAG_ORDER.length];
  function objProgress(o) {
    const cards = objLinkedCards(o), b = { todo: 0, doing: 0, done: 0 };
    cards.forEach((c) => { b[statusOf(c)] = (b[statusOf(c)] || 0) + 1; });
    return { todo: b.todo, doing: b.doing, done: b.done, total: cards.length };
  }
  function objProgressHtml(o) {
    const p = objProgress(o), t = p.total || 1;
    const seg = (n, cls) => (n ? '<span class="pr-seg pr-' + cls + '" style="width:' + (n / t * 100) + '%"></span>' : '');
    const tip = p.done + ' done · ' + p.doing + ' in progress · ' + p.todo + ' to do';
    return '<div class="as-prog" title="' + tip + '"><div class="pr-track">' +
      seg(p.done, 'done') + seg(p.doing, 'doing') + seg(p.todo, 'todo') +
      '</div><span class="pr-cap">' + p.done + '/' + p.total + '</span></div>';
  }
  // v4's editor — a focused modal sheet with explicit Save / Cancel.
  let objEditSnap = null, objEditNew = false;
  function openObjEditModal(o, isNew) {
    modalCard = o; objEditNew = !!isNew;
    objEditSnap = { title: o.title, desc: o.desc, bv: o.bv, committed: o.committed };
    modalType = 'objedit'; renderModal();
  }
  function closeObjEditModal(commit) {
    const o = modalCard;
    if (o && !commit && objEditSnap) { o.title = objEditSnap.title; o.desc = objEditSnap.desc; o.bv = objEditSnap.bv; o.committed = objEditSnap.committed; }
    if (o && !(o.title || '').trim()) {
      if (objEditNew && !(o.desc || '').trim()) state.artObjectives = state.artObjectives.filter((x) => x.id !== o.id);
      else o.title = 'Untitled objective';
    }
    objEditSnap = null; objEditNew = false;
    closeModal(); save(); renderArtSide();
  }
  function moveObj(id, dir) {
    const arr = state.artObjectives, o = arr.find((x) => x.id === id); if (!o) return;
    const group = asGroupOf(o), gi = group.indexOf(o), target = group[gi + dir]; if (!target) return;
    const a = arr.indexOf(o), b = arr.indexOf(target);
    arr[a] = target; arr[b] = o; save(); renderArtSide();
  }
  function reorderObj(dragId, targetId, before) {
    const arr = state.artObjectives;
    const o = arr.find((x) => x.id === dragId), t = arr.find((x) => x.id === targetId);
    if (!o || !t || o === t || !!o.committed !== !!t.committed) return; // reorder within a group
    arr.splice(arr.indexOf(o), 1);
    const ti = arr.indexOf(t);
    arr.splice(before ? ti : ti + 1, 0, o);
    save(); renderArtSide();
  }
  // Card interactions: add / breakdown / more-menu / see-more / editable BV / links / drag-reorder
  artSide.addEventListener('click', (e) => {
    const addb = e.target.closest('[data-obj-add]');
    if (addb) { e.stopPropagation(); addObjective(); return; }
    const bd = e.target.closest('[data-obj-bd]');
    if (bd) { asMenu = null; openBreakdown(objById(bd.dataset.objBd)); return; }
    const more = e.target.closest('[data-obj-more]');
    if (more) { e.stopPropagation(); asMenu = asMenu === more.dataset.objMore ? null : more.dataset.objMore; renderArtSide(); return; }
    const act = e.target.closest('[data-obj-act]');
    if (act) {
      const id = act.dataset.id, o = objById(id), a = act.dataset.objAct; if (!o) return;
      if (a === 'edit') { startObjEdit(id); return; }
      if (a === 'save') { finishObjEdit(true); return; }
      if (a === 'cancel') { finishObjEdit(false); return; }
      asMenu = null;
      if (a === 'commit') { o.committed = !o.committed; save(); renderArtSide(); }
      else if (a === 'up') moveObj(id, -1);
      else if (a === 'down') moveObj(id, 1);
      else if (a === 'del') { if (asEditing === id) { asEditing = null; asEditMode = null; asEditSnap = null; asNewId = null; } state.artObjectives = state.artObjectives.filter((x) => x.id !== id); save(); renderArtSide(); }
      return;
    }
    const rag = e.target.closest('[data-obj-rag]');
    if (rag) { const o = objById(rag.dataset.objRag); if (o) { o.rag = ragNext(o.rag || 'green'); save(); renderArtSide(); } return; }
    const tog = e.target.closest('[data-obj-toggle]');
    if (tog) { const id = tog.dataset.objToggle; asExpanded[id] = !asExpanded[id]; renderArtSide(); return; }
    const lk = e.target.closest('[data-obj-links]');
    if (lk) { asMenu = null; openObjLinks(objById(lk.dataset.objLinks)); return; }
  });
  // Live-edit fields: Business Value (digits only), inline title & description.
  artSide.addEventListener('input', (e) => {
    const bv = e.target.closest('[data-obj-bv]');
    if (bv) { bv.value = bv.value.replace(/[^0-9]/g, '').slice(0, 4); return; }
    const av = e.target.closest('[data-obj-av]');
    if (av) { av.value = av.value.replace(/[^0-9]/g, '').slice(0, 4); return; }
    const ti = e.target.closest('[data-obj-title]');
    if (ti) { const o = objById(ti.dataset.objTitle); if (o) { o.title = ti.value; save(); } return; }
    const de = e.target.closest('[data-obj-desc]');
    if (de) { const o = objById(de.dataset.objDesc); if (o) { o.desc = de.value; save(); } return; }
  });
  const commitBv = (bv) => {
    const o = objById(bv.dataset.objBv); if (!o) return;
    o.bv = Number(bv.value) || 0; bv.value = String(o.bv); save();
  };
  const commitAv = (av) => {
    const o = objById(av.dataset.objAv); if (!o) return;
    o.av = Number(av.value) || 0; av.value = String(o.av); save();
  };
  artSide.addEventListener('blur', (e) => {
    const bv = e.target.closest('[data-obj-bv]'); if (bv) { commitBv(bv); return; }
    const av = e.target.closest('[data-obj-av]'); if (av) commitAv(av);
  }, true);
  artSide.addEventListener('keydown', (e) => {
    const bv = e.target.closest('[data-obj-bv]');
    if (bv) { if (e.key === 'Enter') { e.preventDefault(); bv.blur(); } return; }
    const av = e.target.closest('[data-obj-av]');
    if (av) { if (e.key === 'Enter') { e.preventDefault(); av.blur(); } return; }
    const ti = e.target.closest('[data-obj-title]');
    if (ti) { if (e.key === 'Enter') { e.preventDefault(); asEditing ? finishObjEdit(true) : ti.blur(); } else if (e.key === 'Escape') { e.preventDefault(); asEditing ? finishObjEdit(false) : ti.blur(); } return; }
    const de = e.target.closest('[data-obj-desc]');
    if (de) { if (e.key === 'Escape') { e.preventDefault(); asEditing ? finishObjEdit(false) : de.blur(); } return; }
  });
  // Drag to reorder (grip is the only draggable handle).
  artSide.addEventListener('dragstart', (e) => {
    const grip = e.target.closest('[data-obj-grip]'); if (!grip) return;
    asDragId = grip.dataset.objGrip; asMenu = null;
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', asDragId); } catch (_) {}
    const cardEl = grip.closest('[data-obj-card]'); if (cardEl) requestAnimationFrame(() => cardEl.classList.add('as-dragging'));
  });
  artSide.addEventListener('dragover', (e) => {
    if (!asDragId) return;
    const cardEl = e.target.closest('[data-obj-card]'); if (!cardEl) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    const r = cardEl.getBoundingClientRect(), before = e.clientY < r.top + r.height / 2;
    artSide.querySelectorAll('.as-drop-before,.as-drop-after').forEach((el) => el.classList.remove('as-drop-before', 'as-drop-after'));
    if (cardEl.dataset.objCard !== asDragId) cardEl.classList.add(before ? 'as-drop-before' : 'as-drop-after');
  });
  artSide.addEventListener('drop', (e) => {
    if (!asDragId) return;
    const cardEl = e.target.closest('[data-obj-card]'); if (!cardEl) return;
    e.preventDefault();
    const r = cardEl.getBoundingClientRect(), before = e.clientY < r.top + r.height / 2;
    const drag = asDragId; asDragId = null;
    reorderObj(drag, cardEl.dataset.objCard, before);
  });
  artSide.addEventListener('dragend', () => {
    asDragId = null;
    artSide.querySelectorAll('.as-drop-before,.as-drop-after,.as-dragging').forEach((el) => el.classList.remove('as-drop-before', 'as-drop-after', 'as-dragging'));
  });

  // ---------- Conversation panel (contextual — it follows where you are) ----------
  function convoContext() {
    if (boardScreen.hidden) return 'Dashboard';
    if (mode === 'page') { const p = state.pages.find((x) => x.id === activePage); return p ? p.title : 'Page'; }
    return boardName(railActive);
  }
  function msgHtml(m) {
    return '<div class="cv-msg"><span class="cv-av" style="background:' + (m.color || '#8b93a3') + '">' + esc(m.ini || '·') + '</span>' +
      '<div class="cv-m-b"><div class="cv-m-h"><b>' + esc(m.who) + '</b><span>' + esc(m.ago) + '</span></div>' +
      '<div class="cv-m-t">' + esc(m.text) + '</div></div></div>';
  }
  // Conversations live in three separate surfaces:
  // 1) People panel — Team and Chats as sibling tabs (same category, not the same tab)
  // 2) Board panel — threads about the current board, INCLUDING its sticky threads
  // 3) Sticky panel — a single note's thread, opened on the note itself
  const CV_TABS = [['team', 'Team'], ['chat', 'Chats']];
  function threadHtml(t, opts) {
    opts = opts || {};
    const pageRef = t.pageRef && state.pages.find((p) => p.id === t.pageRef);
    return '<div class="cv-thread">' +
      (opts.noWhere ? '' : '<div class="cv-where">' + esc(t.where) + '</div>') +
      msgHtml(t) +
      (pageRef ? '<button class="cv-page" type="button" data-open-page="' + pageRef.id + '">' + bIcon('doc', 'cv-pico') + esc(pageRef.title) + ' ↗</button>' : '') +
      (opts.stickyLink && t.sticky ? '<button class="cv-page" type="button" data-open-sticky="' + esc(t.sticky) + '">' + bIcon('edit', 'cv-pico') + 'Open on sticky ↗</button>' : '') +
      (t.replies || []).map((r) => '<div class="cv-reply">' + msgHtml(r) + '</div>').join('') +
      '</div>';
  }
  function composerHtml(id, ph) {
    return '<form class="cv-foot" id="' + id + '"><input type="text" placeholder="' + ph + '" aria-label="Comment" />' +
      '<button class="cv-send" type="submit">Send</button></form>';
  }
  function newThread(kind, extra, text) {
    return Object.assign({ id: uid(), kind, who: state.user.name, ini: initials(state.user.name), color: state.accent, ago: 'now', text, replies: [] }, extra);
  }
  function bindComposer(id, make) {
    const form = document.getElementById(id);
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input');
      const text = input.value.trim();
      if (!text) return;
      make(text);
      save(); renderConvo();
    });
  }
  function renderConvo() {
    if (!convoOpen) { convoEl.innerHTML = ''; return; }
    if (panelMode === 'board') return renderBoardConvo();
    const threads = state.threads.filter((t) => t.kind === cvFilter);
    convoEl.innerHTML =
      '<div class="cv-head">' + bIcon('chat', 'cv-hico') + '<b>Conversations</b>' +
        '<button class="cv-x" type="button" data-nav="convo" title="Close">✕</button></div>' +
      '<div class="cv-tabs">' + CV_TABS.map((t) =>
        '<button class="cv-tab' + (cvFilter === t[0] ? ' on' : '') + '" type="button" data-cv-tab="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' +
      '<div class="cv-body">' + (threads.map((t) => threadHtml(t)).join('') || '<div class="cv-empty">Nothing here yet.</div>') + '</div>' +
      composerHtml('cv-form', cvFilter === 'chat' ? 'Message someone…' : 'Comment or @mention…');
    bindComposer('cv-form', (text) => {
      state.threads.unshift(newThread(cvFilter, cvFilter === 'chat'
        ? { where: 'Chat' }
        : { where: convoContext(), board: mode === 'board' ? railActive : undefined }, text));
    });
  }
  function renderBoardConvo() {
    const bn = boardName(railActive);
    const about = state.threads.filter((t) => t.board === railActive && t.kind !== 'sticky' && t.kind !== 'chat');
    const onStickies = state.threads.filter((t) => t.board === railActive && t.kind === 'sticky');
    convoEl.innerHTML =
      '<div class="cv-head">' + bIcon('teamboard', 'cv-hico') + '<b>Board conversation</b>' +
        '<button class="cv-x" type="button" data-nav="convo" title="Close">✕</button></div>' +
      '<div class="cv-sub"><span class="cv-ctx">' + esc(bn) + '</span>' +
        '<button class="cv-sum" type="button" title="Summarise & list decisions" disabled>✨ Summarise</button></div>' +
      '<div class="cv-body">' +
        '<div class="cv-grp">About this board</div>' +
        (about.map((t) => threadHtml(t, { noWhere: true })).join('') || '<div class="cv-empty">No board threads yet.</div>') +
        '<div class="cv-grp">On sticky notes</div>' +
        (onStickies.map((t) => threadHtml(t, { stickyLink: true })).join('') || '<div class="cv-empty">No sticky conversations here.</div>') +
      '</div>' +
      composerHtml('cv-form', 'Comment on ' + esc(bn) + '…');
    bindComposer('cv-form', (text) => { state.threads.unshift(newThread('team', { where: bn, board: railActive }, text)); });
  }
  convoEl.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-cv-tab]');
    if (tab) { cvFilter = tab.dataset.cvTab; renderConvo(); return; }
    const pg = e.target.closest('[data-open-page]');
    if (pg) { gotoPage(pg.dataset.openPage); showBoard(); return; }
    const sk = e.target.closest('[data-open-sticky]');
    if (sk) { openStickyPanel(sk.dataset.openSticky, null); return; }
    const b = e.target.closest('[data-nav="convo"]'); if (!b) return;
    convoOpen = false; renderBoardView();
  });

  // ---------- Sightline: floating AI assistant for the board ----------
  // Boards only — the button never shows on the dashboard shell or on pages.
  // Every answer is computed from the plan held in this browser: no network call,
  // no model, no data leaving the tab. Swap slAnswer() for a real completion later.
  const slEl = document.getElementById('sightline');
  const slFab = document.getElementById('sl-fab');
  let slOpen = false;     // side-panel open?
  let slMsgs = [];        // [{ role: 'you' | 'ai', html }]
  let slThinking = false; // typing indicator showing?
  let slDraft = '';       // composer text, kept across re-renders
  let slSeenCtx = '';     // board context the last greeting was written for
  let slTimer = 0;

  // *emphasis* becomes <b> — safe because everything is escaped first.
  const slInline = (s) => esc(String(s)).replace(/\*([^*]+)\*/g, '<b>$1</b>');
  const slP = (t) => '<p class="sl-p">' + slInline(t) + '</p>';
  const slGrp = (t) => '<div class="sl-grp">' + esc(t) + '</div>';
  const slList = (items) => (items.length
    ? '<ul class="sl-ul">' + items.map((i) => '<li>' + slInline(i) + '</li>').join('') + '</ul>' : '');
  const slStats = (pairs) => '<div class="sl-stats">' + pairs.map((p) =>
    '<div class="sl-stat"><b>' + esc(String(p[1])) + '</b><small>' + esc(p[0]) + '</small></div>').join('') + '</div>';
  function slActs(list) {
    const items = (list || []).filter(Boolean);
    if (!items.length) return '';
    return '<div class="sl-acts">' + items.map((a) => {
      const attr = a.go ? 'data-sl-go="' + esc(a.go) + '"' : 'data-sl-ask="' + esc(a.ask) + '"';
      return '<button class="sl-act" type="button" ' + attr + '>' +
        bIcon(a.ico || 'spark', 'sl-aico') + esc(a.label || a.ask) + '</button>';
    }).join('') + '</div>';
  }

  // ---- What Sightline can see: the plan, narrowed to the current context ----
  const slPts = (cards) => cards.reduce((a, c) => a + (Number(c.points) || 0), 0);
  const slPct = (load, cap) => (cap ? Math.round((load / cap) * 100) : 0);
  const slPlural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');
  function slScope() {
    const teams = ctxTeams();
    const ids = teams.map((t) => t.id);
    return { teams, ids, cards: state.cards.filter((c) => ids.includes(c.teamId)) };
  }
  function slIterRows() {
    const sc = slScope();
    const cap = sc.teams.reduce((a, t) => a + (Number(t.capacity) || 0), 0);
    return state.sprints.map((name, idx) => {
      const cards = sc.cards.filter((c) => c.sprintIdx === idx);
      const load = slPts(cards);
      return { name, idx, cards, load, cap, pct: slPct(load, cap) };
    });
  }
  function slTeamRows() {
    const n = state.sprints.length;
    return slScope().teams.map((t) => {
      const cards = state.cards.filter((c) => c.teamId === t.id);
      const load = slPts(cards), cap = (Number(t.capacity) || 0) * n;
      const objs = t.objectives || [];
      return { team: t, cards, load, cap, pct: slPct(load, cap), objs: objs.length,
        committed: objs.filter((o) => o.committed).length };
    });
  }
  function slCrossLinks() {
    const seen = new Set(), out = [];
    slScope().cards.forEach((c) => {
      linkedIdsFor(c).forEach((id) => {
        const o = card(id);
        if (!o || o.teamId === c.teamId) return;
        const key = [c.id, id].sort().join('|');
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ a: c, b: o });
      });
    });
    return out;
  }
  const slTeamName = (c) => { const t = team(c.teamId); return t ? t.name : 'Unassigned'; };

  // ---- Answers ----
  function slOverview(q) {
    const sc = slScope();
    const rows = slIterRows();
    const load = slPts(sc.cards);
    const cap = rows.reduce((a, r) => a + r.cap, 0);
    const hot = rows.slice().sort((a, b) => b.pct - a.pct)[0];
    const objs = ctx.type === 'team'
      ? sc.teams.reduce((a, t) => a + (t.objectives || []).length, 0)
      : state.artObjectives.length;
    const done = sc.cards.filter((c) => statusOf(c) === 'done').length;
    return (q ? slP('Here is *' + boardName(railActive) + '* for *' + ctxName() + '*, as I read it:') : '') +
      slStats([['Stickies', sc.cards.length], ['Points', load], ['Capacity', cap + ' pts'], ['Utilisation', slPct(load, cap) + '%']]) +
      slList([
        'Teams in scope: ' + (sc.teams.length > 3 ? sc.teams.length : sc.teams.map((t) => t.name).join(', ')) + '.',
        'Heaviest slot: *' + hot.name + '* at ' + hot.load + '/' + hot.cap + ' pts (' + hot.pct + '%).',
        'Objectives: ' + objs + ' · risks: ' + state.risks.length + ' · cross-team links: ' + slCrossLinks().length + '.',
        state.workMode === 'execution' ? 'Delivery: ' + done + ' of ' + sc.cards.length + ' stickies done.' :
          'You are in *Planning* mode — no actuals tracked yet.',
      ]) +
      slActs([{ ask: 'Are we over capacity?', label: 'Capacity check' },
        { ask: 'What are the risks?', ico: 'risk', label: 'Risks' },
        { ask: 'Draft a plan readout', ico: 'present', label: 'Draft readout' }]);
  }
  function slCapacityAnswer() {
    const rows = slIterRows();
    const over = rows.filter((r) => r.load > r.cap);
    const sorted = rows.slice().sort((a, b) => a.pct - b.pct);
    const light = sorted[0], heavy = sorted[sorted.length - 1];
    const load = rows.reduce((a, r) => a + r.load, 0), cap = rows.reduce((a, r) => a + r.cap, 0);
    return slP('*' + ctxName() + '* is carrying *' + load + ' pts* against *' + cap + ' pts* of capacity — ' + slPct(load, cap) + '% utilised.') +
      slList(rows.map((r) => '*' + r.name + '* — ' + r.load + '/' + r.cap + ' pts (' + r.pct + '%)' +
        (r.load > r.cap ? ' ⚠ over by ' + (r.load - r.cap) : ''))) +
      (over.length
        ? slP('*' + over.map((r) => r.name).join(', ') + '* ' + (over.length > 1 ? 'are' : 'is') + ' past capacity. ' +
          '*' + light.name + '* is the lightest slot at ' + light.pct + '% — shifting one large sticky right would even the wall out.')
        : slP('Nothing is over capacity. *' + heavy.name + '* is the tightest at ' + heavy.pct + '%, so that is where a late scope change would hurt first.')) +
      slActs([{ ask: 'What should we split?', label: 'What to split' },
        { ask: 'Show cross-team dependencies', ico: 'collab', label: 'Dependencies' }]);
  }
  function slTeamAnswer(t) {
    const cards = state.cards.filter((c) => c.teamId === t.id);
    const load = slPts(cards), cap = (Number(t.capacity) || 0) * state.sprints.length;
    const per = state.sprints.map((n, i) => ({ n, load: slPts(cards.filter((c) => c.sprintIdx === i)) }));
    const worst = per.slice().sort((a, b) => b.load - a.load)[0] || { n: '—', load: 0 };
    const objs = t.objectives || [];
    const done = cards.filter((c) => statusOf(c) === 'done').length;
    const links = slCrossLinks().filter((l) => l.a.teamId === t.id || l.b.teamId === t.id);
    return slP('*' + t.name + '* — ' + slPlural(cards.length, 'sticky', 'stickies') + ', *' + load + ' pts* against ' + cap + ' pts of capacity (' + slPct(load, cap) + '%).') +
      slStats([['Points', load], ['Capacity', cap + ' pts'], ['Done', done + '/' + cards.length], ['Links out', links.length]]) +
      slList([
        'Heaviest iteration: *' + worst.n + '* at ' + worst.load + ' pts against ' + (t.capacity || 0) + ' per iteration.',
        objs.length ? 'Objectives: ' + objs.length + ' (' + objs.filter((o) => o.committed).length + ' committed).'
          : 'No objectives written yet — that is the gap I would close first.',
        links.length ? 'Depends on other teams in ' + slPlural(links.length, 'place') + '.' : 'No cross-team dependencies recorded.',
      ]) +
      slActs([{ go: 'team:' + t.id, ico: 'teamrail', label: 'Work as ' + t.name },
        { ask: 'Are we over capacity?', label: 'Capacity check' }]);
  }
  function slRiskAnswer() {
    const rs = state.risks || [];
    const label = (c) => (ROAM.find((r) => r.cat === c) || ROAM[0]).label;
    const un = rs.filter((r) => !r.cat || r.cat === 'U');
    if (!rs.length) {
      return slP('No risks captured for *' + ctxName() + '* yet. An empty risk board usually means the board has not been worked — not that the plan is safe.') +
        slActs([{ go: 'board:risk', ico: 'risk', label: 'Open Risk Board' }]);
    }
    return slP('*' + slPlural(rs.length, 'risk') + '* on the board for *' + ctxName() + '*:') +
      slList(rs.map((r) => '*' + label(r.cat) + '* — ' + r.text)) +
      (un.length
        ? slP(slPlural(un.length, 'risk') + ' still ' + (un.length > 1 ? 'sit' : 'sits') + ' outside ROAM. Get an owner named before the confidence vote, or ' + (un.length > 1 ? 'they' : 'it') + ' will resurface mid-PI.')
        : slP('Everything is ROAMed. Worth re-reading the *Owned* ones in the ART Sync — owners drift once execution starts.')) +
      slActs([{ go: 'board:risk', ico: 'risk', label: 'Open Risk Board' },
        { ask: 'Draft a plan readout', ico: 'present', label: 'Draft readout' }]);
  }
  function slObjAnswer() {
    if (ctx.type !== 'team') {
      const os = state.artObjectives || [];
      const committed = os.filter((o) => o.committed);
      const rag = (k) => os.filter((o) => o.rag === k).length;
      const bare = slTeamRows().filter((r) => !r.objs).map((r) => r.team.name);
      const exec = state.workMode === 'execution';
      return slP('*' + ctxArt().name + '* is carrying *' + slPlural(os.length, 'ART objective') + '* — ' + committed.length + ' committed, ' + (os.length - committed.length) + ' stretch.') +
        slList(os.slice(0, 5).map((o) => '*' + o.title + '* — ' + (exec
          ? o.rag.toUpperCase() + ', ' + (o.av || 0) + ' of ' + (o.bv || 0) + ' BV delivered'
          : (o.bv || 0) + ' BV planned') + ', ' + slPlural(o.links || 0, 'linked item'))) +
        (exec ? slP('RAG spread: *' + rag('red') + ' red*, ' + rag('amber') + ' amber, ' + rag('green') + ' green.') : '') +
        (bare.length ? slP('No team objectives yet from *' + bare.join(', ') + '* — chase those before the draft plan review.') : '') +
        slActs([{ go: 'board:objectives', ico: 'objectives', label: 'Open ART Objectives' },
          { ask: 'Are we over capacity?', label: 'Capacity check' }]);
    }
    const rows = slTeamRows();
    const all = rows.reduce((a, r) => a.concat(r.team.objectives || []), []);
    const committed = all.filter((o) => o.committed);
    const bv = all.reduce((a, o) => a + (Number(o.bv) || 0), 0);
    if (!all.length) {
      return slP('*' + ctxName() + '* has no objectives written yet. With ' + slPlural(slScope().cards.length, 'sticky', 'stickies') + ' already on the wall, the plan exists — it just is not stated as outcomes anywhere.') +
        slActs([{ ask: 'Draft a plan readout', ico: 'present', label: 'Draft readout' }]);
    }
    return slP('*' + ctxName() + '* has *' + slPlural(all.length, 'objective') + '* — ' + committed.length + ' committed, ' + (all.length - committed.length) + ' uncommitted, ' + bv + ' BV in total.') +
      slGrp('Committed') +
      slList(committed.slice(0, 4).map((o) => o.text + ' — *' + (o.bv || 0) + ' BV*')) +
      slP('Uncommitted work is where the honesty lives: ' + (all.length - committed.length) + ' of these carry ' +
        (all.filter((o) => !o.committed).reduce((a, o) => a + (Number(o.bv) || 0), 0)) + ' BV that nobody is promising yet.') +
      slActs([{ go: 'board:objectives', ico: 'objectives', label: 'Open ART Objectives' }]);
  }
  function slDepAnswer() {
    const links = slCrossLinks();
    if (!links.length) {
      return slP('No cross-team links inside *' + ctxName() + '*. Either this scope is genuinely self-contained, or the hand-offs live in people’s heads instead of on the board.') +
        slActs([{ go: 'board:artplan', ico: 'artplan', label: 'Open ART Planning Board' }]);
    }
    const byPair = {};
    links.forEach((l) => {
      const k = [slTeamName(l.a), slTeamName(l.b)].sort().join(' ↔ ');
      byPair[k] = (byPair[k] || 0) + 1;
    });
    const pairs = Object.keys(byPair).sort((a, b) => byPair[b] - byPair[a]);
    return slP('*' + slPlural(links.length, 'cross-team link') + '* inside *' + ctxName() + '*, across ' + slPlural(pairs.length, 'team pair') + '.') +
      slGrp('Busiest pairs') +
      slList(pairs.slice(0, 4).map((k) => '*' + k + '* — ' + slPlural(byPair[k], 'hand-off'))) +
      slGrp('Examples') +
      slList(links.slice(0, 3).map((l) => '“' + l.a.title + '” (' + slTeamName(l.a) + ') ↔ “' + l.b.title + '” (' + slTeamName(l.b) + ')')) +
      slP('Each of these needs an agreed iteration on both sides — that is what the ART Planning Board is for.') +
      slActs([{ go: 'board:artplan', ico: 'artplan', label: 'Open ART Planning Board' },
        { ask: 'What are the risks?', ico: 'risk', label: 'Risks' }]);
  }
  function slProgressAnswer() {
    const cards = slScope().cards;
    const by = (k) => cards.filter((c) => statusOf(c) === k);
    const done = by('done'), doing = by('doing'), todo = by('todo');
    const pts = slPts(cards), donePts = slPts(done);
    return slP('*' + ctxName() + '* — ' + slPct(donePts, pts) + '% of the points are done (' + donePts + ' of ' + pts + ').') +
      slStats([['Done', done.length], ['In progress', doing.length], ['To do', todo.length], ['Stickies', cards.length]]) +
      slGrp('Most work left') +
      slList(slIterRows()
        .map((r) => Object.assign({}, r, { left: slPts(r.cards.filter((c) => statusOf(c) !== 'done')) }))
        .filter((r) => r.cards.length)
        .sort((a, b) => b.left - a.left).slice(0, 3)
        .map((r) => '*' + r.name + '* — ' + r.left + ' pts still open of ' + r.load +
          ' (' + r.cards.filter((c) => statusOf(c) === 'done').length + ' of ' + r.cards.length + ' stickies done)')) +
      (state.workMode === 'execution'
        ? slP('Actuals only mean something next to the objectives — check the RAG on *' + ctxArt().name + '*’s objectives too.')
        : slP('You are in *Planning* mode, so these statuses are seeded, not tracked. Switch to *Execution* in the top navigation to work with actuals.')) +
      slActs([{ ask: 'Summarise our objectives', ico: 'objectives', label: 'Objectives' }]);
  }
  function slSplitAnswer() {
    const cards = slScope().cards;
    const big = cards.filter((c) => (Number(c.points) || 0) >= 13).slice(0, 5);
    const none = cards.filter((c) => !Number(c.points));
    const rows = slIterRows().filter((r) => r.load > r.cap);
    return slP(big.length
      ? '*' + slPlural(big.length, 'sticky', 'stickies') + '* at 13 points or more — those are the ones that hide risk:'
      : 'Nothing is bigger than 8 points, so sizing is not what is hurting this plan.') +
      slList(big.map((c) => '“' + c.title + '” — ' + c.points + ' pts, ' + slTeamName(c) + ', ' + (state.sprints[c.sprintIdx] || 'unscheduled'))) +
      (none.length ? slP('*' + slPlural(none.length, 'sticky', 'stickies') + '* carry no estimate at all — they still consume the iteration.') : '') +
      (rows.length
        ? slP('Splitting one of these out of *' + rows[0].name + '* is the cheapest way to get that iteration back under capacity.')
        : slP('Capacity is fine everywhere, so split for flow and feedback rather than to fit the wall.')) +
      slActs([{ ask: 'Are we over capacity?', label: 'Capacity check' }]);
  }
  function slReadoutAnswer() {
    const sc = slScope();
    const rows = slIterRows();
    const load = rows.reduce((a, r) => a + r.load, 0), cap = rows.reduce((a, r) => a + r.cap, 0);
    const over = rows.filter((r) => r.load > r.cap);
    const un = (state.risks || []).filter((r) => !r.cat || r.cat === 'U');
    const objs = ctx.type === 'team'
      ? sc.teams.reduce((a, t) => a + (t.objectives || []).length, 0)
      : (state.artObjectives || []).length;
    return slGrp('Draft readout · ' + state.piName) +
      slP('*' + ctxName() + '* brings ' + slPlural(objs, 'objective') + ' into ' + state.piName + ', planned as ' +
        slPlural(sc.cards.length, 'sticky', 'stickies') + ' worth ' + load + ' points against ' + cap + ' points of capacity (' + slPct(load, cap) + '%).') +
      slP(over.length
        ? 'The plan is not flat: *' + over.map((r) => r.name).join(' and ') + '* ' + (over.length > 1 ? 'run' : 'runs') + ' over capacity, and we are asking for help to move scope right.'
        : 'Load sits inside capacity in every iteration, with the tightest slot at ' + rows.slice().sort((a, b) => b.pct - a.pct)[0].pct + '%.') +
      slP('We carry ' + slPlural(slCrossLinks().length, 'cross-team dependency', 'cross-team dependencies') + ' and ' +
        slPlural((state.risks || []).length, 'risk') + (un.length ? ', of which ' + un.length + ' still ' + (un.length > 1 ? 'need' : 'needs') + ' an owner.' : ', all ROAMed.')) +
      slP('Confidence hinges on the dependencies landing in the iteration both sides agreed to.') +
      slActs([{ ask: 'Show cross-team dependencies', ico: 'collab', label: 'Dependencies' },
        { ask: 'What are the risks?', ico: 'risk', label: 'Risks' }]);
  }
  function slConvoAnswer() {
    const th = state.threads.filter((t) => t.board === railActive);
    const open = th.filter((t) => !(t.replies || []).length);
    if (!th.length) {
      return slP('No conversations attached to *' + boardName(railActive) + '* yet.') +
        slActs([{ go: 'convo', ico: 'chat', label: 'Open board conversation' }]);
    }
    return slP('*' + slPlural(th.length, 'thread') + '* on *' + boardName(railActive) + '*, ' + open.length + ' with no reply yet.') +
      slList(th.slice(0, 4).map((t) => '*' + t.who + '* (' + t.ago + ') — ' + t.text)) +
      (open.length ? slP(slPlural(open.length, 'thread') + ' ' + (open.length > 1 ? 'are' : 'is') + ' still waiting on someone. Unanswered board threads are usually decisions, not chat.') : '') +
      slActs([{ go: 'convo', ico: 'chat', label: 'Open board conversation' }]);
  }
  function slHelpAnswer() {
    return slP('I read this board directly — stickies and their points, team capacity, objectives, risks, cross-team links and the threads attached to them. Things worth asking:') +
      slList([
        '*Capacity* — “are we over capacity?”, “which iteration is heaviest?”',
        '*Scope* — “what should we split?”, “what is unestimated?”',
        '*Objectives* — “summarise our objectives”, “who has none yet?”',
        '*Risk* — “what are the risks?”, “what is still unROAMed?”',
        '*Dependencies* — “show cross-team dependencies”',
        '*Writing* — “draft a plan readout”',
      ]) +
      slP('Everything stays in this browser — I answer from the plan, not from a server.') +
      slActs(slSuggestions().slice(0, 3).map((q) => ({ ask: q, label: q })));
  }
  function slAnswer(q) {
    const s = String(q).toLowerCase();
    const has = (...w) => w.some((x) => s.indexOf(x) >= 0);
    const named = state.teams.filter((t) => s.indexOf(t.name.toLowerCase()) >= 0);
    const t = named.find((x) => inScope(x.id)) || named[0];
    if (has('help', 'what can you', 'who are you', 'what do you')) return slHelpAnswer();
    if (t && has('capacity', 'load', 'over', 'room', 'busy', 'how is', 'how are', 'tell me about')) return slTeamAnswer(t);
    if (has('capacity', 'load', 'overload', 'utilis', 'utiliz', 'balance', 'room', 'iteration', 'sprint')) return slCapacityAnswer();
    if (has('risk', 'roam', 'blocked', 'blocker', 'impedim')) return slRiskAnswer();
    if (has('objective', 'okr', 'business value', ' bv', 'commit')) return slObjAnswer();
    if (has('depend', 'cross-team', 'cross team', 'hand-off', 'handoff', 'link')) return slDepAnswer();
    if (has('split', 'estimate', 'points', 'biggest', 'heavy', 'too big', 'sizing')) return slSplitAnswer();
    if (has('progress', 'done', 'on track', 'burndown', 'execution', 'actual')) return slProgressAnswer();
    if (has('readout', 'summarise', 'summarize', 'draft', 'write', 'report', 'standup', 'stand-up', 'update')) return slReadoutAnswer();
    if (has('conversation', 'comment', 'thread', 'unanswered', 'discuss', 'said', 'saying', 'talk', 'chat')) return slConvoAnswer();
    if (t) return slTeamAnswer(t);
    return slOverview(q);
  }

  // ---- Panel ----
  const SL_SUGG = {
    team: ['Are we over capacity?', 'Which iteration is heaviest?', 'What should we split?'],
    objectives: ['Summarise our objectives', 'Who has no objectives yet?', 'Draft a plan readout'],
    risk: ['What are the risks?', 'What is still unROAMed?', 'Draft a plan readout'],
    artplan: ['Show cross-team dependencies', 'Are we over capacity?', 'Draft a plan readout'],
    solplan: ['Show cross-team dependencies', 'Are we over capacity?', 'Summarise our objectives'],
  };
  function slSuggestions() {
    const base = SL_SUGG[railActive] || ['Show cross-team dependencies', 'Are we over capacity?', 'Summarise our objectives'];
    return base.concat(['What am I looking at?']);
  }
  const slBoardPlane = () => !boardScreen.hidden && mode === 'board';
  function slGreet() {
    const key = railActive + '|' + ctxName() + '|' + state.workMode;
    if (slSeenCtx === key) return;
    const first = !slMsgs.length;
    slSeenCtx = key;
    slMsgs.push({ role: 'ai', html: first
      ? slP('Hi ' + (state.user.name || '').split(' ')[0] + ' — I’m *Sightline*. I can see everything on *' + boardName(railActive) +
          '* for *' + ctxName() + '*: stickies, points, capacity, objectives, risks and the threads attached to them. Ask me anything, or start here:') +
        slActs(slSuggestions().slice(0, 3).map((q) => ({ ask: q, label: q })))
      : slP('You moved to *' + boardName(railActive) + '* — I’m reading that board now (*' + ctxName() + '*, ' +
          (state.workMode === 'execution' ? 'Execution' : 'Planning') + ').') });
  }
  function slMsgHtml(m) {
    if (m.role === 'you') return '<div class="sl-msg you"><div class="sl-bub">' + m.html + '</div></div>';
    return '<div class="sl-msg ai"><span class="sl-av">' + bIcon('spark') + '</span><div class="sl-bub">' + m.html + '</div></div>';
  }
  function renderSightline() {
    if (!slBoardPlane()) {
      slFab.hidden = true; slFab.innerHTML = '';
      slEl.hidden = true; slEl.innerHTML = '';
      return;
    }
    slFab.hidden = slOpen;
    if (!slOpen) {
      slFab.innerHTML = '<span class="sl-fab-mark">' + bIcon('spark') + '</span><span class="sl-fab-l">Sightline</span>';
      slEl.hidden = true; slEl.innerHTML = '';
      return;
    }
    slFab.innerHTML = '';
    slEl.hidden = false;
    slGreet();
    const wasTyping = document.activeElement && document.activeElement.id === 'sl-input';
    slEl.innerHTML =
      '<div class="sl-head">' +
        '<span class="sl-mark">' + bIcon('spark') + '</span>' +
        '<span class="sl-title"><b>Sightline</b><small>AI assistant · reads this board</small></span>' +
        '<button class="sl-ico" type="button" data-sl-reset title="Start a new chat">' + bIcon('restart') + '</button>' +
        '<button class="sl-ico" type="button" data-sl-close title="Close Sightline">✕</button>' +
      '</div>' +
      '<div class="sl-ctx">' +
        '<span class="sl-chip">' + bIcon(boardIcon(railActive)) + esc(boardName(railActive)) + '</span>' +
        '<span class="sl-chip">' + bIcon('teamrail') + esc(ctxName()) + '</span>' +
        '<span class="sl-chip">' + esc(state.workMode === 'execution' ? 'Execution' : 'Planning') + '</span>' +
      '</div>' +
      '<div class="sl-body" id="sl-body">' +
        slMsgs.map(slMsgHtml).join('') +
        (slThinking ? '<div class="sl-msg ai"><span class="sl-av">' + bIcon('spark') +
          '</span><div class="sl-bub"><span class="sl-dots"><i></i><i></i><i></i></span></div></div>' : '') +
      '</div>' +
      // the opening message already offers starters — only repeat them once the chat is going
      (slThinking || !slMsgs.some((m) => m.role === 'you') ? '' : '<div class="sl-sugg">' + slSuggestions().map((q) =>
        '<button class="sl-act" type="button" data-sl-ask="' + esc(q) + '">' + esc(q) + '</button>').join('') + '</div>') +
      '<form class="sl-foot" id="sl-form">' +
        '<div class="sl-in">' +
          '<textarea id="sl-input" rows="1" placeholder="Ask about this board…" aria-label="Ask Sightline"></textarea>' +
          '<button class="sl-send" type="submit" title="Send">' + bIcon('send') + '</button>' +
        '</div>' +
        '<p class="sl-note">Sightline answers from the plan in this browser — nothing is sent anywhere.</p>' +
      '</form>';
    const body = document.getElementById('sl-body');
    if (body) body.scrollTop = body.scrollHeight;
    const ta = document.getElementById('sl-input');
    if (ta) {
      ta.value = slDraft;
      slGrow(ta);
      ta.addEventListener('input', () => { slDraft = ta.value; slGrow(ta); });
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); slSend(ta.value); }
      });
      if (wasTyping) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    }
    const form = document.getElementById('sl-form');
    if (form) form.addEventListener('submit', (e) => { e.preventDefault(); slSend(ta ? ta.value : ''); });
  }
  function slGrow(ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.min(108, ta.scrollHeight) + 'px';
  }
  function slSend(text) {
    text = String(text || '').trim();
    if (!text || slThinking) return;
    slMsgs.push({ role: 'you', html: slP(text) });
    slDraft = '';
    slThinking = true;
    renderSightline();
    const ta = document.getElementById('sl-input');
    if (ta) ta.focus();
    clearTimeout(slTimer);
    slTimer = setTimeout(() => {
      slThinking = false;
      slMsgs.push({ role: 'ai', html: slAnswer(text) });
      renderSightline();
    }, 480 + Math.min(700, text.length * 14));
  }
  function slToggle(on) {
    slOpen = on == null ? !slOpen : !!on;
    if (slOpen) convoOpen = false; // one right-hand panel at a time
    renderBoardView();
    if (slOpen) { const ta = document.getElementById('sl-input'); if (ta) ta.focus(); }
  }
  slFab.addEventListener('click', () => slToggle(true));
  slEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-sl-close]')) { slToggle(false); return; }
    if (e.target.closest('[data-sl-reset]')) {
      slMsgs = []; slSeenCtx = ''; slThinking = false; clearTimeout(slTimer);
      renderSightline(); return;
    }
    const ask = e.target.closest('[data-sl-ask]');
    if (ask) { slSend(ask.dataset.slAsk); return; }
    const go = e.target.closest('[data-sl-go]');
    if (!go) return;
    const p = go.dataset.slGo.split(':');
    if (p[0] === 'board') gotoBoard(p[1]);
    else if (p[0] === 'team') setCtx('team', p[1]);
    else if (p[0] === 'convo') { convoOpen = true; panelMode = 'board'; slOpen = false; }
    renderBoardView();
    updateHash();
  });

  // Sticky conversations open ON the note — a popover anchored to the sticky.
  const stickyEl = document.getElementById('stickypanel');
  let stickyAnchor = null; // screen rect of the note the panel is anchored to
  function stickyThreadFor(title) { return state.threads.find((t) => t.kind === 'sticky' && t.sticky === title); }
  function noteRectFor(title) {
    const notes = canvas.querySelectorAll('.note');
    for (let i = 0; i < notes.length; i++) {
      const t = notes[i].querySelector('.n-text');
      if (t && t.textContent === title) return notes[i].getBoundingClientRect();
    }
    return null;
  }
  function placeStickyPanel() {
    if (!stickyAnchor) { stickyEl.style.left = ''; stickyEl.style.top = ''; stickyEl.style.bottom = ''; return; }
    const vw = window.innerWidth, vh = window.innerHeight, W = 300;
    let left = stickyAnchor.right + 12;
    if (left + W > vw - 8) left = stickyAnchor.left - W - 12;
    left = Math.max(8, Math.min(left, vw - W - 8));
    const top = Math.max(58, Math.min(stickyAnchor.top - 8, vh - 360));
    stickyEl.style.left = left + 'px';
    stickyEl.style.top = top + 'px';
    stickyEl.style.bottom = 'auto';
  }
  function closeStickyPanel() {
    stickyOpen = null; stickyAnchor = null;
    renderStickyPanel();
    if (!boardScreen.hidden && mode === 'board') renderCanvas(); // drop the note highlight
  }
  function openStickyPanel(title, rect) {
    stickyOpen = title;
    stickyAnchor = rect || noteRectFor(title);
    if (!boardScreen.hidden && mode === 'board') renderCanvas(); // highlight the note
    renderStickyPanel();
  }
  function renderStickyPanel() {
    if (!stickyOpen) { stickyEl.hidden = true; stickyEl.innerHTML = ''; return; }
    stickyEl.hidden = false;
    placeStickyPanel();
    const th = stickyThreadFor(stickyOpen);
    stickyEl.innerHTML =
      '<div class="cv-head sp-head">' + bIcon('edit', 'cv-hico') + '<b>Sticky · ' + esc(stickyOpen) + '</b>' +
        '<button class="cv-x" type="button" data-sp-close title="Close">✕</button></div>' +
      '<div class="cv-body sp-body">' + (th ? threadHtml(th, { noWhere: true })
        : '<div class="cv-empty">No conversation on this sticky yet — start one below.</div>') + '</div>' +
      composerHtml('sp-form', 'Comment on this sticky…');
    const form = document.getElementById('sp-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input');
      const text = input.value.trim();
      if (!text) return;
      const existing = stickyThreadFor(stickyOpen);
      if (existing) existing.replies.push({ who: state.user.name, ini: initials(state.user.name), color: state.accent, ago: 'now', text });
      else state.threads.unshift(newThread('sticky', { board: railActive, sticky: stickyOpen, where: 'Sticky · ' + stickyOpen }, text));
      save(); renderStickyPanel();
      if (convoOpen) renderConvo();
      renderCanvas(); // sticky gains its conversation badge
    });
  }
  stickyEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-sp-close]')) closeStickyPanel();
  });
  canvas.addEventListener('click', (e) => {
    const n = e.target.closest('.note'); if (!n) return;
    const c = card(n.dataset.id); if (!c) return;
    // String-linking: second click picks the target.
    if (linkMode && linkMode !== c.id) { addLink(card(linkMode), c); linkMode = null; setLinkHint(''); refreshSticky(); return; }
    // The 💬 badge opens the conversation popover; the note body opens the action bar.
    if (e.target.closest('.n-cv')) {
      closeStickyBar();
      if (stickyOpen === c.title) closeStickyPanel(); else openStickyPanel(c.title, n.getBoundingClientRect());
      return;
    }
    closeStickyPanel();
    if (sbCard && sbCard.id === c.id) { closeStickyBar(); return; }
    openStickyBar(c, n.getBoundingClientRect());
  });

  // ---------- Sticky action bar (opens above the clicked sticky) ----------
  const sbEl = document.getElementById('stickybar');
  const pinbEl = document.getElementById('pinbanner');
  const SB_ITEMS = [
    ['type', 'sqtype', 'Change type'],
    ['alm', 'alm', 'ALM'],
    ['status', 'statusdot', 'Status'],
    ['points', null, 'Points'],
    ['project', 'folder', 'Project (soon)', true],
    ['links', 'link', 'Links'],
    ['delete', 'trash', 'Delete'],
    ['remove', 'removebox', 'Remove (soon)', true],
    ['unplan', 'unplan', 'Unplan (soon)', true],
    ['move', 'move', 'Move (soon)', true],
    ['mirror', 'mirror', 'Mirror (soon)', true],
    ['pin', 'pin', 'Pin — focus & show links'],
    ['duplicate', 'dupe', 'Duplicate'],
    ['share', 'share', 'Share (soon)', true],
    ['breakdown', 'breakdown', 'Breakdown'],
    ['activity', 'activity', 'Activity'],
  ];
  function noteRectById(id) {
    const n = canvas.querySelector('.note[data-id="' + id + '"]');
    return n ? n.getBoundingClientRect() : null;
  }
  function placeStickyBar() {
    if (!sbAnchor) return;
    const vw = window.innerWidth, W = Math.min(sbEl.offsetWidth || 600, vw - 24);
    let left = sbAnchor.left + sbAnchor.width / 2 - W / 2;
    left = Math.max(12, Math.min(left, vw - W - 12));
    let top = sbAnchor.top - (sbEl.offsetHeight || 48) - 10;
    if (top < 58) top = sbAnchor.bottom + 10; // flip below if no room above
    sbEl.style.left = left + 'px';
    sbEl.style.top = top + 'px';
  }
  function openStickyBar(c, rect) {
    sbCard = c; sbSub = null;
    if (!boardScreen.hidden && mode === 'board') renderCanvas(); // highlight the note first
    sbAnchor = noteRectById(c.id) || rect;
    renderStickyBar();
  }
  function closeStickyBar() {
    if (!sbCard) return;
    sbCard = null; sbAnchor = null; sbSub = null;
    sbEl.hidden = true; sbEl.innerHTML = '';
    if (!boardScreen.hidden && mode === 'board') renderCanvas();
  }
  function refreshSticky() {
    // re-render board + keep the bar anchored to the same note
    if (!boardScreen.hidden && mode === 'board') renderCanvas();
    if (sbCard) { sbAnchor = noteRectById(sbCard.id); renderStickyBar(); }
    save();
  }
  function sbBtn(it) {
    const [key, ico, title, soon] = it;
    const on = sbSub === key || (key === 'pin' && pinned === (sbCard || {}).id);
    const inner = key === 'points'
      ? '<span class="sb-pts">' + (Number((sbCard || {}).points) || 0) + '</span>'
      : bIcon(ico, 'sb-ico sb-' + key);
    return '<button class="sb-btn' + (on ? ' on' : '') + (soon ? ' soon' : '') + '" type="button" data-sb="' + key + '"' +
      (soon ? ' disabled' : '') + ' title="' + esc(title) + '">' + inner + '</button>';
  }
  function sbSubHtml() {
    const c = sbCard; if (!c || !sbSub) return '';
    let body = '';
    if (sbSub === 'type') {
      body = '<div class="sb-menu-h">Sticky type</div>' + STYPES.map(([k, label]) =>
        '<button class="sb-mi' + (stypeOf(c) === k ? ' on' : '') + '" type="button" data-stype="' + k + '">' +
        '<i class="sb-swatch s-' + k + '"></i>' + label + (stypeOf(c) === k ? '<span class="sb-ck">✓</span>' : '') + '</button>').join('');
    } else if (sbSub === 'status') {
      body = '<div class="sb-menu-h">Status</div>' + STATUSES.map(([k, label]) =>
        '<button class="sb-mi' + (statusOf(c) === k ? ' on' : '') + '" type="button" data-status="' + k + '">' +
        '<i class="sb-pip st-' + k + '"></i>' + label + (statusOf(c) === k ? '<span class="sb-ck">✓</span>' : '') + '</button>').join('');
    } else if (sbSub === 'points') {
      body = '<div class="sb-menu-h">Story points</div>' +
        '<form class="sb-pform" id="sb-pform"><input type="number" min="0" step="1" value="' + (Number(c.points) || 0) + '" aria-label="Points" />' +
        '<button class="sb-save" type="submit">Set</button></form>' +
        '<div class="sb-pchips">' + [1, 2, 3, 5, 8, 13].map((p) => '<button class="sb-pchip" type="button" data-pts="' + p + '">' + p + '</button>').join('') + '</div>';
    } else if (sbSub === 'alm') {
      const conn = state.connections[0] || { name: 'platform-jira', type: 'Jira' };
      body = '<div class="sb-menu-h">ALM</div>' +
        '<div class="sb-alminfo"><div class="sb-alm-r"><span>Source</span><b>' + esc(conn.type) + '</b></div>' +
        '<div class="sb-alm-r"><span>Board</span><b>' + esc(conn.name) + '</b></div>' +
        '<div class="sb-alm-r"><span>External ID</span><b>' + esc(conn.type.slice(0, 3).toUpperCase()) + '-' + (100 + (Math.abs(hashCode(c.id)) % 900)) + '</b></div>' +
        '<div class="sb-alm-r"><span>Status</span><b>' + statusLabel(statusOf(c)) + '</b></div>' +
        '<div class="sb-alm-r"><span>Last sync</span><b>2h ago</b></div></div>';
    } else if (sbSub === 'links') {
      const linked = linkedIdsFor(c);
      body = '<div class="sb-menu-h">Links · ' + linked.length + '</div>' +
        '<button class="sb-mi" type="button" data-link-string>' + bIcon('cursor', 'sb-mico') + 'Link with string' + (linkMode === c.id ? '<span class="sb-ck">…</span>' : '') + '</button>' +
        '<button class="sb-mi" type="button" data-link-browse>' + bIcon('solplan', 'sb-mico') + 'Browse organization…</button>' +
        (linked.length ? '<div class="sb-links">' + linked.map((id) => {
          const lc = card(id), t = team(lc.teamId);
          return '<div class="sb-linkrow"><span>' + esc(lc.title) + '<small>' + esc((t || {}).name || '') + '</small></span>' +
            '<button class="sb-unlink" type="button" data-unlink="' + id + '" title="Unlink">✕</button></div>';
        }).join('') + '</div>' : '<div class="sb-empty">No links yet.</div>');
    } else if (sbSub === 'activity') {
      body = '<div class="sb-menu-h">Activity</div>' +
        '<div class="sb-acts">' + activityOf(c).map((a) =>
          '<div class="sb-act"><b>' + esc(a.who) + '</b> ' + esc(a.what) + '<small>' + esc(a.ago) + '</small></div>').join('') + '</div>';
    }
    return '<div class="sb-sub">' + body + '</div>';
  }
  function renderStickyBar() {
    if (!sbCard) { sbEl.hidden = true; sbEl.innerHTML = ''; return; }
    sbEl.hidden = false;
    sbEl.innerHTML = '<div class="sb-bar">' + SB_ITEMS.map(sbBtn).join('') + '</div>' + sbSubHtml();
    const pf = document.getElementById('sb-pform');
    if (pf) pf.addEventListener('submit', (e) => {
      e.preventDefault();
      setPoints(sbCard, Number(pf.querySelector('input').value) || 0);
    });
    placeStickyBar(); // synchronous: offsetWidth is valid now that it's rendered
  }
  function setType(c, k) { c.stype = k; logActivity(c, 'changed type to ' + stypeLabel(k)); sbSub = null; refreshSticky(); }
  function setStatus(c, k) { c.status = k; logActivity(c, 'moved to ' + statusLabel(k)); sbSub = null; refreshSticky(); }
  function setPoints(c, p) { c.points = Math.max(0, p); logActivity(c, 'set points to ' + c.points); sbSub = null; refreshSticky(); if (!boardScreen.hidden) renderCanvas(); }
  function addLink(a, b) {
    if (!a || !b) return;
    a.links = a.links || [];
    if (!a.links.includes(b.id) && !(b.links || []).includes(a.id)) { a.links.push(b.id); logActivity(a, 'linked to “' + b.title + '”'); }
  }
  function removeLink(a, bId) {
    if (a.links) a.links = a.links.filter((id) => id !== bId);
    const b = card(bId); if (b && b.links) b.links = b.links.filter((id) => id !== a.id);
    logActivity(a, 'removed a link');
  }
  function deleteCard(c) {
    if (!confirm('Delete “' + c.title + '”?')) return;
    state.cards = state.cards.filter((x) => x.id !== c.id);
    state.cards.forEach((x) => { if (x.links) x.links = x.links.filter((id) => id !== c.id); });
    if (pinned === c.id) togglePin(c);
    closeStickyBar(); save(); if (!boardScreen.hidden) renderCanvas();
  }
  function duplicateCard(c) {
    const copy = Object.assign({}, c, { id: uid(), title: c.title + ' (copy)', links: [], activity: null });
    state.cards.push(copy);
    closeStickyBar(); save(); if (!boardScreen.hidden) renderCanvas();
  }
  function togglePin(c) {
    pinned = pinned === c.id ? null : c.id;
    boardScreen.classList.toggle('pin-focus', !!pinned);
    closeStickyBar();
    renderPinBanner();
    if (!boardScreen.hidden) renderCanvas();
  }
  function renderPinBanner() {
    if (!pinned) { pinbEl.hidden = true; pinbEl.innerHTML = ''; return; }
    const c = card(pinned); if (!c) { pinbEl.hidden = true; return; }
    const n = linkedIdsFor(c).length;
    pinbEl.hidden = false;
    pinbEl.innerHTML = bIcon('pin', 'pb-ico') + '<b>' + esc(c.title) + '</b>' +
      '<span>' + n + ' linked stick' + (n === 1 ? 'y' : 'ies') + '</span>' +
      '<button class="pb-exit" type="button" data-pin-exit>Exit focus</button>';
  }
  pinbEl.addEventListener('click', (e) => { if (e.target.closest('[data-pin-exit]')) togglePin(card(pinned) || {}); });
  function setLinkHint(text) {
    if (!text) { pinbEl.hidden = !!pinned ? false : true; if (pinned) renderPinBanner(); else { pinbEl.hidden = true; pinbEl.innerHTML = ''; } return; }
    pinbEl.hidden = false;
    pinbEl.innerHTML = bIcon('cursor', 'pb-ico') + '<b>Linking</b><span>' + esc(text) + '</span>' +
      '<button class="pb-exit" type="button" data-link-cancel>Cancel</button>';
  }
  pinbEl.addEventListener('click', (e) => { if (e.target.closest('[data-link-cancel]')) { linkMode = null; setLinkHint(''); } });

  sbEl.addEventListener('click', (e) => {
    e.stopPropagation(); // re-render detaches targets; the document outside-click check would misfire
    const c = sbCard; if (!c) return;
    const mi = e.target.closest('[data-stype],[data-status],[data-pts],[data-unlink],[data-link-string],[data-link-browse]');
    if (mi) {
      if (mi.dataset.stype != null) return setType(c, mi.dataset.stype);
      if (mi.dataset.status != null) return setStatus(c, mi.dataset.status);
      if (mi.dataset.pts != null) return setPoints(c, Number(mi.dataset.pts));
      if (mi.dataset.unlink != null) { removeLink(c, mi.dataset.unlink); return refreshSticky(); }
      if (mi.hasAttribute('data-link-string')) { linkMode = c.id; setLinkHint('Click another sticky to link it to “' + c.title + '”'); closeStickyBar(); return; }
      if (mi.hasAttribute('data-link-browse')) { openLinksOverlay(c); return; }
    }
    const b = e.target.closest('[data-sb]'); if (!b) return;
    const a = b.dataset.sb;
    if (['type', 'alm', 'status', 'points', 'links', 'activity'].includes(a)) { sbSub = sbSub === a ? null : a; renderStickyBar(); requestAnimationFrame(placeStickyBar); return; }
    if (a === 'delete') return deleteCard(c);
    if (a === 'duplicate') return duplicateCard(c);
    if (a === 'pin') return togglePin(c);
    if (a === 'breakdown') return openBreakdown(c);
  });

  function renderCanvasIfVisible() { if (!boardScreen.hidden) { renderCanvas(); fitView(); } }

  // ---------- Zoom control ----------
  function renderZoomCtl() {
    zoomctl.innerHTML =
      '<button class="z-btn" type="button" data-z="fit" title="Fit board (100%)">' + bIcon('fit') + '</button>' +
      '<button class="z-btn" type="button" data-z="out" title="Zoom out">' + bIcon('minus') + '</button>' +
      '<span class="z-val">100%</span>' +
      '<button class="z-btn" type="button" data-z="in" title="Zoom in">' + bIcon('plus') + '</button>' +
      '<button class="z-btn z-help" type="button" title="Help" disabled>' + bIcon('help') + '</button>';
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
    const pct = Math.round((view.scale / (fitScale() || 1)) * 100) + '%';
    const z = zoomctl.querySelector('.z-val');
    if (z) z.textContent = pct;
    document.querySelectorAll('.bt-zoomval').forEach((el) => { el.textContent = pct; });
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
    setScale(view.scale * (1 - e.deltaY * 0.0025), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  canvasWrap.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, input, a, [contenteditable="true"]')) return;
    // Don't capture yet — capturing here redirects the click event away from
    // the sticky, breaking its action bar. We only capture once a real drag begins.
    pan = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, id: e.pointerId, dragging: false };
  });
  canvasWrap.addEventListener('pointermove', (e) => {
    if (!pan || e.pointerId !== pan.id) return;
    if (!pan.dragging) {
      if (Math.abs(e.clientX - pan.x) + Math.abs(e.clientY - pan.y) <= 4) return; // still a click
      pan.dragging = true;
      canvasWrap.classList.add('grabbing');
      try { canvasWrap.setPointerCapture(e.pointerId); } catch (_) {}
      if (sbCard) closeStickyBar();      // a real pan detaches the popovers
      if (stickyOpen) closeStickyPanel();
    }
    view.x = pan.vx + (e.clientX - pan.x);
    view.y = pan.vy + (e.clientY - pan.y);
    clampView(); applyView();
  });
  function endPan(e) {
    if (pan && e.pointerId === pan.id) {
      try { canvasWrap.releasePointerCapture(e.pointerId); } catch (_) {}
      pan = null; canvasWrap.classList.remove('grabbing');
    }
  }
  canvasWrap.addEventListener('pointerup', endPan);
  canvasWrap.addEventListener('pointercancel', endPan);
  window.addEventListener('resize', () => {
    if (!boardScreen.hidden) renderBoardView();
  });

  // ---------- Chrome interactions ----------
  srail.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rail]'); if (!b) return;
    const v = b.dataset.rail;
    if (v === 'shift') {
      if (railActive === 'objectives' && objPanelOpen) return; // locked to the right here
      railRight = !railRight;
      srail.classList.toggle('srail--right', railRight);
      requestAnimationFrame(fitView);
      return;
    }
    if (v === railActive && mode === 'board') return;
    gotoBoard(v); renderBoardView(); updateHash();
  });
  bnav.addEventListener('click', (e) => {
    const dd = e.target.closest('[data-dd]');
    if (dd) { e.stopPropagation(); menuOpen = menuOpen === dd.dataset.dd ? null : dd.dataset.dd; renderTopNav(); return; }
    const md = e.target.closest('[data-mode]');
    if (md) { state.workMode = md.dataset.mode; save(); renderBoardView(); return; }
    const b = e.target.closest('[data-nav],[data-plane],[data-go-board],[data-go-page],[data-go-session],[data-go-ctx],[data-go-shell]');
    if (!b) return;
    menuOpen = null;
    const d = b.dataset;
    if (d.nav === 'home') { exitBoard(); return; }
    if (d.nav === 'toggle-art') { objPanelOpen = !objPanelOpen; renderBoardView(); return; }
    if (d.nav === 'palette') { openPalette(); renderTopNav(); return; }
    if (d.nav === 'tree') { navOpen = !navOpen; renderBoardView(); return; }
    if (d.nav === 'convo') { convoOpen = !convoOpen; if (convoOpen) slOpen = false; renderBoardView(); return; }
    if (d.plane) {
      if (d.plane === 'page') { const ps = pagesFor(); if (!ps.some((p) => p.id === activePage)) activePage = ps[0] ? ps[0].id : null; if (!activePage) return; }
      mode = d.plane; renderBoardView(); updateHash(); return;
    }
    if (d.goBoard != null) { gotoBoard(d.goBoard); renderBoardView(); updateHash(); return; }
    if (d.goPage != null) { gotoPage(d.goPage); renderBoardView(); updateHash(); return; }
    if (d.goSession != null) { state.piName = d.goSession; save(); renderBoardView(); return; }
    if (d.goCtx != null) { const p = d.goCtx.split(':'); setCtx(p[0], p[1]); renderBoardView(); updateHash(); return; }
    if (d.goShell != null) { exitBoard(); navigate(d.goShell); return; }
    renderTopNav();
  });
  zoomctl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-z]'); if (!b) return;
    const z = b.dataset.z;
    if (z === 'in') zoomBy(1.4);
    else if (z === 'out') zoomBy(1 / 1.4);
    else if (z === 'fit') fitView();
  });

  function renderBoardView() {
    const obj = mode === 'board' && railActive === 'objectives';
    const v2 = state.navVersion === 'v2';
    boardScreen.classList.toggle('obj-mode', obj);
    boardScreen.classList.toggle('obj-open', obj && objPanelOpen);
    boardScreen.classList.toggle('page-mode', mode === 'page');
    boardScreen.classList.toggle('convo-open', convoOpen);
    boardScreen.classList.toggle('sl-open', slOpen && mode === 'board');
    boardScreen.classList.toggle('nav-v2', v2);
    boardScreen.classList.toggle('nav-open', v2 && navOpen);
    boardScreen.classList.toggle('nav-v3', chromeV() === 'v3');
    boardScreen.classList.toggle('mode-exec', state.workMode === 'execution');
    boardScreen.classList.toggle('magnify', magnify);
    boardScreen.classList.toggle('cfg-nodates', !state.boardCfg.dates);
    boardScreen.classList.toggle('cfg-nogrid', !state.boardCfg.grid);
    boardScreen.classList.toggle('cfg-compact', state.boardCfg.compact);
    canvas.style.setProperty('--ns', noteScale / 100);
    recordRecent();
    renderTopNav();
    renderNavTree();
    renderSideRail();
    renderArtSide();
    renderConvo();
    renderSightline();
    renderBtools();
    renderStickyPanel();
    renderStickyBar();
    renderPinBanner();
    renderVerfab();
    renderZoomCtl();
    renderCanvas();
    fitView();
    if (sbCard) { sbAnchor = noteRectById(sbCard.id) || sbAnchor; placeStickyBar(); }
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
  function closeNavMenus() {
    menuOpen = null;
    if (!boardScreen.hidden) { renderTopNav(); renderNavTree(); }
  }
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-chip-wrap')) closeUserMenu();
    if (menuOpen && !e.target.closest('.bn-dd')) closeNavMenus();
    if ((utilPanel || btPanel) && !e.target.closest('.btools')) { utilPanel = null; btPanel = null; if (!boardScreen.hidden) renderBtools(); }
    if (dockPanel && !e.target.closest('.dock')) { dockPanel = null; if (!boardScreen.hidden) renderDock(); }
    if (asMenu && !e.target.closest('.as-menu') && !e.target.closest('[data-obj-more]')) { asMenu = null; renderArtSide(); }
    if (asEditing && !e.target.closest('[data-obj-card="' + asEditing + '"]')) finishObjEdit(true);
    // click away from the sticky action bar (but not onto a note — that reopens it)
    if (sbCard && !e.target.closest('.stickybar') && !e.target.closest('.note')) closeStickyBar();
  });

  function navigate(page) { currentPage = page; renderSide(); renderPage(page); mainEl.scrollTop = 0; updateHash(); }
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
        '<button class="p-kebab" type="button" aria-label="More" disabled>⋮</button>' +
      '</div>').join('');
  }
  function connectionRows() {
    return state.connections.map((c) =>
      '<div class="p-row" data-act="goto" data-page="connections">' +
        '<span class="' + (c.ok ? 'dot-ok' : 'dot-err') + '"></span>' +
        '<span class="p-name">' + esc(c.name) + '</span>' +
        '<span class="p-tag">' + esc(c.type) + '</span>' +
        '<button class="p-kebab" type="button" aria-label="More" disabled>⋮</button>' +
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
    updateHash();
  }
  function exitBoard() {
    boardScreen.hidden = true; shell.hidden = false;
    verfabEl.hidden = true;
    closeStickyBar(); linkMode = null; setLinkHint('');
    if (pinned) { pinned = null; boardScreen.classList.remove('pin-focus'); renderPinBanner(); }
    navigate(currentPage);
  }

  // ---------- Command palette (⌘K): jump to any board, page, team or session ----------
  let paletteOpen = false, palSel = 0, palMatches = [];
  function showBoard() { if (boardScreen.hidden) enterBoard(); else { renderBoardView(); updateHash(); } }
  function paletteData() {
    const items = [];
    const OWNER_HINT = { st: state.st.name, art: 'ART', team: 'Team', any: 'Shared' };
    BOARD_LIST.forEach((b) => items.push({ g: 'Boards', ico: b[1], label: b[2], hint: OWNER_HINT[b[3]], go: () => { gotoBoard(b[0]); showBoard(); } }));
    state.pages.forEach((p) => items.push({ g: 'Pages', ico: 'doc', label: p.title, hint: TYPE_LABEL[p.owner], go: () => { gotoPage(p.id); showBoard(); } }));
    items.push({ g: 'Working as', ico: 'solplan', label: state.st.name, hint: 'Solution Train', go: () => { setCtx('st', state.st.id); showBoard(); } });
    state.arts.forEach((a) => items.push({ g: 'Working as', ico: 'artplan', label: a.name, hint: 'ART', go: () => { setCtx('art', a.id); showBoard(); } }));
    state.teams.forEach((t) => items.push({ g: 'Working as', ico: 'teamrail', label: t.name, hint: 'Team', go: () => { setCtx('team', t.id); showBoard(); } }));
    state.sessions.forEach((sn) => items.push({ g: 'PI Sessions', ico: 'folder', label: sn.name, hint: sn.updated, go: () => enterBoard(sn.name) }));
    [['home', 'Home dashboard'], ['sessions', 'PI Sessions'], ['connections', 'ALM Connections'], ['settings', 'PIE Recipe']].forEach((pgd) =>
      items.push({ g: 'App', ico: 'apps', label: pgd[1], go: () => { exitBoard(); navigate(pgd[0]); } }));
    items.push({ g: 'Actions', ico: 'chat', label: 'Toggle conversation panel', go: () => { convoOpen = !convoOpen; if (convoOpen) slOpen = false; if (!boardScreen.hidden) renderBoardView(); } });
    items.push({ g: 'Actions', ico: 'spark', label: 'Ask Sightline about this board', go: () => {
      if (boardScreen.hidden) enterBoard();
      if (mode !== 'board') mode = 'board';
      slToggle(true);
      updateHash();
    } });
    return items;
  }
  function renderPalList(q) {
    const list = document.getElementById('pal-list');
    q = q.trim().toLowerCase();
    palMatches = paletteData().filter((it) => !q || (it.label + ' ' + it.g).toLowerCase().includes(q));
    if (palSel >= palMatches.length) palSel = 0;
    if (!palMatches.length) { list.innerHTML = '<div class="pal-empty">No matches — try a board, page or team name.</div>'; return; }
    let html = '', lastG = '';
    palMatches.forEach((it, i) => {
      if (it.g !== lastG) { html += '<div class="pal-g">' + esc(it.g) + '</div>'; lastG = it.g; }
      html += '<button class="pal-i' + (i === palSel ? ' sel' : '') + '" type="button" data-pal="' + i + '">' +
        bIcon(it.ico, 'pal-ico') + '<span>' + esc(it.label) + '</span>' +
        (it.hint ? '<span class="pal-k">' + esc(it.hint) + '</span>' : '') + '</button>';
    });
    list.innerHTML = html;
    const sel = list.querySelector('.pal-i.sel');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }
  function openPalette() {
    paletteOpen = true; palSel = 0;
    paletteEl.hidden = false;
    paletteEl.innerHTML =
      '<div class="pal-box"><div class="pal-in">' + bIcon('search', 'pal-sico') +
        '<input id="pal-input" type="text" placeholder="Jump to a board, page, team or session…" autocomplete="off" />' +
        '<span class="pal-esc">esc</span></div>' +
      '<div class="pal-list" id="pal-list"></div>' +
      '<div class="pal-foot"><span><b>↑↓</b> navigate</span><span><b>↵</b> open</span><span><b>⌘K</b> toggle</span></div></div>';
    renderPalList('');
    const input = document.getElementById('pal-input');
    input.focus();
    input.addEventListener('input', () => { palSel = 0; renderPalList(input.value); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); palSel = Math.min(palMatches.length - 1, palSel + 1); renderPalList(input.value); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); palSel = Math.max(0, palSel - 1); renderPalList(input.value); }
      else if (e.key === 'Enter') { e.preventDefault(); palGo(palSel); }
    });
  }
  function closePalette() { paletteOpen = false; paletteEl.hidden = true; paletteEl.innerHTML = ''; }
  function palGo(i) { const it = palMatches[i]; if (!it) return; closePalette(); it.go(); }
  paletteEl.addEventListener('click', (e) => {
    if (e.target === paletteEl) return closePalette();
    const b = e.target.closest('[data-pal]');
    if (b) palGo(Number(b.dataset.pal));
  });

  // ---------- Deep links (#b/<board>, #p/<page>, #s/<shell page>) ----------
  // The hash is only ever *replaced* (never pushed) so the arcade shell's
  // popstate-driven close keeps working when Pie runs inside its iframe.
  function updateHash() {
    let h = '';
    if (!boardScreen.hidden) h = mode === 'page' ? 'p/' + activePage : 'b/' + railActive;
    else if (currentPage !== 'home') h = 's/' + currentPage;
    try { history.replaceState(null, '', h ? '#' + h : location.pathname + location.search); } catch (_) {}
  }
  function applyHash() {
    const m = /^#(b|p|s)\/([\w-]+)$/.exec(location.hash || '');
    if (!m) return;
    if (m[1] === 's') { navigate(m[2]); return; }
    if (m[1] === 'b' && BOARD_LIST.some((b) => b[0] === m[2])) { gotoBoard(m[2]); enterBoard(); }
    else if (m[1] === 'p' && state.pages.some((p) => p.id === m[2])) { gotoPage(m[2]); enterBoard(); }
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

    // Navigation
    const segBtn = (v, label) => el('button', {
      type: 'button', class: state.navVersion === v ? 'on' : '', text: label,
      onclick: () => { state.navVersion = v; save(); renderSettings(); },
    });
    const NAV_DESC = {
      v1: 'v1 · switcher chips in the top bar + floating board rail',
      v2: 'v2 · navigator tree: the whole workspace in one sidebar',
      v3: 'v3 · hub + dock: full-bleed canvas, one overview behind ⌘K',
      v4: 'v4 · v3 navigation with an alternate ART Objectives design',
    };
    body.appendChild(rCard('Navigation', 'Design versions — also switchable from the floating pill on any board.', [
      rRow('Version', NAV_DESC[state.navVersion],
        [el('div', { class: 'seg' }, [segBtn('v1', 'v1'), segBtn('v2', 'v2'), segBtn('v3', 'v3'), segBtn('v4', 'v4')])]),
    ]));

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
    if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k') {
      e.preventDefault();
      if (chromeV() === 'v3' && !boardScreen.hidden) { if (hubOpen) closeHub(); else openHub(); return; }
      if (paletteOpen) closePalette(); else openPalette();
      return;
    }
    if (e.key === 'Escape') {
      if (modalType === 'objedit') { closeObjEditModal(false); return; }
      if (modalType) { closeModal(); return; }
      if (hubOpen) { closeHub(); return; }
      if (paletteOpen) { closePalette(); return; }
      if (linkMode) { linkMode = null; setLinkHint(''); return; }
      if (sbSub) { sbSub = null; renderStickyBar(); requestAnimationFrame(placeStickyBar); return; }
      if (sbCard) { closeStickyBar(); return; }
      if (slOpen && !boardScreen.hidden) { slToggle(false); return; }
      if (pinned) { togglePin(card(pinned) || {}); return; }
      if (stickyOpen) { closeStickyPanel(); return; }
      if (dockPanel) { dockPanel = null; if (!boardScreen.hidden) renderDock(); return; }
      if (utilPanel || btPanel) { utilPanel = null; btPanel = null; if (!boardScreen.hidden) renderBtools(); return; }
      if (menuOpen) { closeNavMenus(); return; }
      closeUserMenu();
    }
  });

  function fullRender() {
    applyTheme();
    ensureCtxValid();
    renderSide();
    renderPage(currentPage);
    if (!boardScreen.hidden) renderBoardView();
  }

  // ---------- Boot ----------
  fullRender();
  shell.hidden = false;
  boardScreen.hidden = true;
  applyHash();

  const startTime = Date.now();
  function reveal() {
    const delay = Math.max(0, 3000 - (Date.now() - startTime));
    setTimeout(() => { loading.classList.add('hidden'); }, delay);
  }
  if (document.readyState === 'complete') reveal();
  else window.addEventListener('load', reveal);
})();
