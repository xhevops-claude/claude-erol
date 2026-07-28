(function () {
  'use strict';

  // ---------- Constants ----------
  const KEY = 'school-mgmt-state';
  const SUBJECTS = ['Math', 'English', 'Science', 'History', 'Art'];
  const TABS = [
    ['dashboard', 'Dashboard'],
    ['students', 'Students'],
    ['teachers', 'Teachers'],
    ['classes', 'Classes'],
    ['attendance', 'Attendance'],
    ['gradebook', 'Gradebook'],
  ];
  const ATT_LABEL = { p: 'Present', l: 'Late', a: 'Absent' };
  const ATT_NEXT = { p: 'l', l: 'a', a: 'p' };

  // ---------- Sample data ----------
  // Deterministic PRNG so the seeded sample is identical for everyone.
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-'
      + String(d.getMonth() + 1).padStart(2, '0') + '-'
      + String(d.getDate()).padStart(2, '0');
  }

  function pastSchoolDays(n) {
    const days = [];
    const d = new Date();
    while (days.length < n) {
      d.setDate(d.getDate() - 1);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      days.push(d.getFullYear() + '-'
        + String(d.getMonth() + 1).padStart(2, '0') + '-'
        + String(d.getDate()).padStart(2, '0'));
    }
    return days;
  }

  function sampleState() {
    const rand = rng(20260728);
    const teachers = [
      ['Maya Okafor', 'Math'], ['Daniel Reyes', 'English'],
      ['Priya Natarajan', 'Science'], ['Tomás Ferreira', 'History'],
      ['Hana Kobayashi', 'Art'], ['Leo Andersson', 'Math'],
      ['Grace Mburu', 'English'], ['Omar Haddad', 'Science'],
    ].map(function (t, i) {
      return {
        id: 't' + (i + 1),
        name: t[0],
        subject: t[1],
        email: t[0].toLowerCase().replace(/[^a-z ]/g, '').replace(/ /g, '.') + '@northgate.edu',
      };
    });

    const classes = [
      { id: 'c1', name: '6A', room: '101', teacherId: 't1' },
      { id: 'c2', name: '6B', room: '102', teacherId: 't2' },
      { id: 'c3', name: '7A', room: '201', teacherId: 't3' },
      { id: 'c4', name: '8A', room: '202', teacherId: 't4' },
    ];

    const firsts = ['Ava', 'Noah', 'Mia', 'Liam', 'Zoe', 'Ethan', 'Lily', 'Kai',
      'Nora', 'Owen', 'Isla', 'Felix', 'Ruby', 'Jonas', 'Elif', 'Marco',
      'Sana', 'Tariq', 'Ines', 'Viktor', 'Amara', 'Hugo', 'Freya', 'Dmitri',
      'Leila', 'Oscar', 'Wren', 'Mateo', 'Aisha', 'Callum', 'Yuki', 'Petra'];
    const lasts = ['Bennett', 'Silva', 'Khan', 'Larsen', 'Moreau', 'Adeyemi',
      'Novak', 'Tanaka', 'Costa', 'Weber', 'Ali', 'Berg', 'Fontaine', 'Diallo',
      'Horak', 'Sato', 'Rossi', 'Nilsen', 'Marsh', 'Petrov', 'Owusu', 'Blanc',
      'Lund', 'Ivanov', 'Nasser', 'Reid', 'Doyle', 'Vega', 'Rahman', 'Boyd',
      'Mori', 'Kovac'];

    const students = firsts.map(function (first, i) {
      const last = lasts[i];
      return {
        id: 's' + (i + 1),
        name: first + ' ' + last,
        classId: classes[i % classes.length].id,
        guardian: 'G. ' + last,
        email: (first + '.' + last).toLowerCase() + '@example.edu',
      };
    });

    const attendance = {};
    pastSchoolDays(5).forEach(function (day) {
      attendance[day] = {};
      students.forEach(function (s) {
        const r = rand();
        attendance[day][s.id] = r < 0.06 ? 'a' : r < 0.14 ? 'l' : 'p';
      });
    });

    const gradebook = {};
    classes.forEach(function (c, ci) {
      const assessments = [
        { id: 'a' + (ci * 3 + 1), title: 'Math quiz', max: 20 },
        { id: 'a' + (ci * 3 + 2), title: 'English essay', max: 100 },
        { id: 'a' + (ci * 3 + 3), title: 'Science lab', max: 50 },
      ];
      const scores = {};
      assessments.forEach(function (a) {
        scores[a.id] = {};
        students.forEach(function (s) {
          if (s.classId !== c.id) return;
          scores[a.id][s.id] = Math.round(a.max * (0.55 + 0.45 * rand()));
        });
      });
      gradebook[c.id] = { assessments: assessments, scores: scores };
    });

    return {
      seq: 100,
      students: students,
      teachers: teachers,
      classes: classes,
      attendance: attendance,
      gradebook: gradebook,
    };
  }

  function normalize(s) {
    if (!s || typeof s !== 'object') return sampleState();
    if (!Array.isArray(s.students) || !Array.isArray(s.classes)) return sampleState();
    s.seq = typeof s.seq === 'number' ? s.seq : 100;
    s.teachers = Array.isArray(s.teachers) ? s.teachers : [];
    s.attendance = s.attendance && typeof s.attendance === 'object' ? s.attendance : {};
    s.gradebook = s.gradebook && typeof s.gradebook === 'object' ? s.gradebook : {};
    s.classes.forEach(function (c) {
      if (!s.gradebook[c.id]) s.gradebook[c.id] = { assessments: [], scores: {} };
    });
    return s;
  }

  // ---------- State ----------
  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (_) { /* fall through to sample */ }
    return sampleState();
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
    }, 150);
  }

  function uid(prefix) {
    state.seq += 1;
    return prefix + state.seq;
  }

  // Runtime-only UI state — intentionally not persisted.
  const ui = {
    tab: 'dashboard',
    studentQuery: '',
    studentClass: 'all',
    attDate: todayStr(),
    attClass: state.classes.length ? state.classes[0].id : '',
    gbClass: state.classes.length ? state.classes[0].id : '',
  };

  // ---------- Helpers ----------
  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function classById(id) {
    return state.classes.find(function (c) { return c.id === id; }) || null;
  }
  function teacherById(id) {
    return state.teachers.find(function (t) { return t.id === id; }) || null;
  }
  function studentById(id) {
    return state.students.find(function (s) { return s.id === id; }) || null;
  }
  function studentsOf(classId) {
    return state.students.filter(function (s) { return s.classId === classId; });
  }
  function className(id) {
    const c = classById(id);
    return c ? c.name : '—';
  }

  function attendanceRate(studentId) {
    let marked = 0;
    let there = 0;
    Object.keys(state.attendance).forEach(function (day) {
      const st = state.attendance[day][studentId];
      if (!st) return;
      marked += 1;
      if (st === 'p' || st === 'l') there += 1;
    });
    return marked ? Math.round((there / marked) * 100) : null;
  }

  function studentAverage(student) {
    const gb = state.gradebook[student.classId];
    if (!gb) return null;
    let sum = 0;
    let n = 0;
    gb.assessments.forEach(function (a) {
      const v = gb.scores[a.id] ? gb.scores[a.id][student.id] : undefined;
      if (typeof v === 'number') { sum += v / a.max; n += 1; }
    });
    return n ? Math.round((sum / n) * 100) : null;
  }

  function classOptions(selected) {
    return state.classes.map(function (c) {
      return '<option value="' + esc(c.id) + '"'
        + (c.id === selected ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');
  }

  function teacherOptions(selected) {
    return '<option value=""' + (!selected ? ' selected' : '') + '>Unassigned</option>'
      + state.teachers.map(function (t) {
        return '<option value="' + esc(t.id) + '"'
          + (t.id === selected ? ' selected' : '') + '>' + esc(t.name) + '</option>';
      }).join('');
  }

  function subjectOptions(selected) {
    return SUBJECTS.map(function (s) {
      return '<option value="' + esc(s) + '"'
        + (s === selected ? ' selected' : '') + '>' + esc(s) + '</option>';
    }).join('');
  }

  // ---------- DOM ----------
  const loading = document.getElementById('app-loading');
  const appEl = document.getElementById('app');
  const tabsEl = document.getElementById('tabs');
  const viewEl = document.getElementById('view');
  const modalEl = document.getElementById('modal');
  const quitBtn = document.getElementById('quit-btn');

  // ---------- Views ----------
  function renderTabs() {
    tabsEl.innerHTML = TABS.map(function (t) {
      return '<button type="button" class="tab' + (ui.tab === t[0] ? ' active' : '')
        + '" data-tab="' + t[0] + '">' + t[1] + '</button>';
    }).join('');
  }

  function statTile(label, value, sub) {
    return '<div class="stat">'
      + '<p class="stat-label">' + esc(label) + '</p>'
      + '<p class="stat-value">' + esc(value) + '</p>'
      + (sub ? '<p class="stat-sub">' + esc(sub) + '</p>' : '')
      + '</div>';
  }

  function viewDashboard() {
    const today = state.attendance[todayStr()] || {};
    let p = 0, l = 0, a = 0;
    state.students.forEach(function (s) {
      const st = today[s.id];
      if (st === 'p') p += 1;
      else if (st === 'l') l += 1;
      else if (st === 'a') a += 1;
    });
    const marked = p + l + a;
    const unmarked = state.students.length - marked;
    const attToday = marked ? Math.round(((p + l) / marked) * 100) + '%' : '—';

    const counts = state.classes.map(function (c) {
      return { c: c, n: studentsOf(c.id).length };
    });
    const maxN = Math.max(1, Math.max.apply(null, counts.map(function (x) { return x.n; }).concat([0])));
    const bars = counts.map(function (x) {
      const t = teacherById(x.c.teacherId);
      return '<div class="bar-row">'
        + '<span class="bar-label">' + esc(x.c.name) + '</span>'
        + '<span class="bar-track"><span class="bar-fill" style="width:' + Math.round((x.n / maxN) * 100) + '%"></span></span>'
        + '<span class="bar-value">' + x.n + '</span>'
        + '<span class="bar-note">' + esc(t ? t.name : 'Unassigned') + '</span>'
        + '</div>';
    }).join('');

    return '<div class="stats-row">'
      + statTile('Students', String(state.students.length), 'enrolled')
      + statTile('Teachers', String(state.teachers.length), 'on staff')
      + statTile('Classes', String(state.classes.length), 'homerooms')
      + statTile('Attendance today', attToday, marked ? marked + ' of ' + state.students.length + ' marked' : 'not yet taken')
      + '</div>'

      + '<div class="panel-row">'
      + '<section class="panel">'
      + '<h2 class="panel-title">Enrolment by class</h2>'
      + '<div class="bars">' + (bars || '<p class="empty">No classes yet.</p>') + '</div>'
      + '</section>'

      + '<section class="panel">'
      + '<h2 class="panel-title">Today at a glance</h2>'
      + '<ul class="status-list">'
      + '<li><span class="dot st-p"></span>Present<b>' + p + '</b></li>'
      + '<li><span class="dot st-l"></span>Late<b>' + l + '</b></li>'
      + '<li><span class="dot st-a"></span>Absent<b>' + a + '</b></li>'
      + '<li><span class="dot st-u"></span>Unmarked<b>' + unmarked + '</b></li>'
      + '</ul>'
      + '<button class="btn" type="button" data-action="go-attendance">Take attendance</button>'
      + '</section>'
      + '</div>'

      + '<p class="foot-note">Sample data lives in your browser only. '
      + '<button class="link-btn" type="button" data-action="reset-data">Reset to sample data</button></p>';
  }

  function viewStudents() {
    const q = ui.studentQuery.trim().toLowerCase();
    const rows = state.students.filter(function (s) {
      if (ui.studentClass !== 'all' && s.classId !== ui.studentClass) return false;
      if (q && s.name.toLowerCase().indexOf(q) === -1
        && s.guardian.toLowerCase().indexOf(q) === -1
        && s.email.toLowerCase().indexOf(q) === -1) return false;
      return true;
    }).map(function (s) {
      const rate = attendanceRate(s.id);
      const avg = studentAverage(s);
      return '<tr>'
        + '<td class="cell-name">' + esc(s.name) + '</td>'
        + '<td>' + esc(className(s.classId)) + '</td>'
        + '<td>' + esc(s.guardian) + '</td>'
        + '<td class="cell-dim">' + esc(s.email) + '</td>'
        + '<td class="cell-num">' + (rate === null ? '—' : rate + '%') + '</td>'
        + '<td class="cell-num">' + (avg === null ? '—' : avg + '%') + '</td>'
        + '<td class="cell-actions">'
        + '<button class="btn small" type="button" data-action="edit-student" data-id="' + esc(s.id) + '">Edit</button>'
        + '<button class="btn small danger" type="button" data-action="del-student" data-id="' + esc(s.id) + '">Delete</button>'
        + '</td></tr>';
    }).join('');

    return '<div class="toolbar">'
      + '<input class="input" id="student-search" type="search" placeholder="Search students…" value="' + esc(ui.studentQuery) + '" data-ui="studentQuery" />'
      + '<select class="input" data-ui="studentClass">'
      + '<option value="all"' + (ui.studentClass === 'all' ? ' selected' : '') + '>All classes</option>'
      + classOptions(ui.studentClass)
      + '</select>'
      + '<span class="toolbar-spring"></span>'
      + '<button class="btn primary" type="button" data-action="add-student">Add student</button>'
      + '</div>'
      + '<div class="panel table-wrap"><table class="table">'
      + '<thead><tr><th>Name</th><th>Class</th><th>Guardian</th><th>Email</th>'
      + '<th class="cell-num">Attendance</th><th class="cell-num">Average</th><th></th></tr></thead>'
      + '<tbody>' + (rows || '<tr><td colspan="7" class="empty">No students match.</td></tr>') + '</tbody>'
      + '</table></div>';
  }

  function viewTeachers() {
    const rows = state.teachers.map(function (t) {
      const homerooms = state.classes.filter(function (c) { return c.teacherId === t.id; })
        .map(function (c) { return c.name; }).join(', ');
      return '<tr>'
        + '<td class="cell-name">' + esc(t.name) + '</td>'
        + '<td>' + esc(t.subject) + '</td>'
        + '<td class="cell-dim">' + esc(t.email) + '</td>'
        + '<td>' + esc(homerooms || '—') + '</td>'
        + '<td class="cell-actions">'
        + '<button class="btn small" type="button" data-action="edit-teacher" data-id="' + esc(t.id) + '">Edit</button>'
        + '<button class="btn small danger" type="button" data-action="del-teacher" data-id="' + esc(t.id) + '">Delete</button>'
        + '</td></tr>';
    }).join('');

    return '<div class="toolbar">'
      + '<span class="toolbar-spring"></span>'
      + '<button class="btn primary" type="button" data-action="add-teacher">Add teacher</button>'
      + '</div>'
      + '<div class="panel table-wrap"><table class="table">'
      + '<thead><tr><th>Name</th><th>Subject</th><th>Email</th><th>Homeroom</th><th></th></tr></thead>'
      + '<tbody>' + (rows || '<tr><td colspan="5" class="empty">No teachers yet.</td></tr>') + '</tbody>'
      + '</table></div>';
  }

  function viewClasses() {
    const cards = state.classes.map(function (c) {
      const t = teacherById(c.teacherId);
      const n = studentsOf(c.id).length;
      return '<article class="class-card">'
        + '<header class="class-head">'
        + '<h2 class="class-name">' + esc(c.name) + '</h2>'
        + '<span class="class-room">Room ' + esc(c.room) + '</span>'
        + '</header>'
        + '<p class="class-line">' + esc(t ? t.name : 'Unassigned') + '</p>'
        + '<p class="class-line dim">' + n + ' ' + (n === 1 ? 'student' : 'students') + '</p>'
        + '<footer class="class-foot">'
        + '<button class="btn small" type="button" data-action="view-class-students" data-id="' + esc(c.id) + '">Students</button>'
        + '<button class="btn small" type="button" data-action="edit-class" data-id="' + esc(c.id) + '">Edit</button>'
        + '<button class="btn small danger" type="button" data-action="del-class" data-id="' + esc(c.id) + '">Delete</button>'
        + '</footer>'
        + '</article>';
    }).join('');

    return '<div class="toolbar">'
      + '<span class="toolbar-spring"></span>'
      + '<button class="btn primary" type="button" data-action="add-class">Add class</button>'
      + '</div>'
      + '<div class="class-grid">' + (cards || '<p class="empty">No classes yet.</p>') + '</div>';
  }

  function viewAttendance() {
    if (!state.classes.length) return '<p class="empty">Add a class first.</p>';
    if (!classById(ui.attClass)) ui.attClass = state.classes[0].id;
    const day = state.attendance[ui.attDate] || {};
    const kids = studentsOf(ui.attClass);
    let p = 0, l = 0, a = 0;

    const rows = kids.map(function (s) {
      const st = day[s.id];
      if (st === 'p') p += 1;
      else if (st === 'l') l += 1;
      else if (st === 'a') a += 1;
      return '<li class="att-row">'
        + '<span class="att-name">' + esc(s.name) + '</span>'
        + '<button class="att-btn st-' + (st || 'u') + '" type="button" data-action="att-cycle" data-id="' + esc(s.id) + '">'
        + (st ? ATT_LABEL[st] : 'Mark') + '</button>'
        + '</li>';
    }).join('');

    return '<div class="toolbar">'
      + '<input class="input" type="date" value="' + esc(ui.attDate) + '" max="' + todayStr() + '" data-ui="attDate" />'
      + '<select class="input" data-ui="attClass">' + classOptions(ui.attClass) + '</select>'
      + '<span class="toolbar-spring"></span>'
      + '<button class="btn" type="button" data-action="att-all-present">Mark all present</button>'
      + '</div>'
      + '<div class="panel">'
      + '<p class="att-summary">'
      + '<span><span class="dot st-p"></span>Present <b>' + p + '</b></span>'
      + '<span><span class="dot st-l"></span>Late <b>' + l + '</b></span>'
      + '<span><span class="dot st-a"></span>Absent <b>' + a + '</b></span>'
      + '<span><span class="dot st-u"></span>Unmarked <b>' + (kids.length - p - l - a) + '</b></span>'
      + '</p>'
      + '<ul class="att-list">' + (rows || '<li class="empty">No students in this class.</li>') + '</ul>'
      + '</div>';
  }

  function viewGradebook() {
    if (!state.classes.length) return '<p class="empty">Add a class first.</p>';
    if (!classById(ui.gbClass)) ui.gbClass = state.classes[0].id;
    const gb = state.gradebook[ui.gbClass];
    const kids = studentsOf(ui.gbClass);

    const head = gb.assessments.map(function (as) {
      return '<th class="cell-num"><span class="gb-head">' + esc(as.title)
        + '<button class="link-btn" type="button" data-action="gb-del-assess" data-id="' + esc(as.id) + '">remove</button>'
        + '</span><span class="gb-max">/ ' + as.max + '</span></th>';
    }).join('');

    const rows = kids.map(function (s) {
      const cells = gb.assessments.map(function (as) {
        const v = gb.scores[as.id] ? gb.scores[as.id][s.id] : undefined;
        return '<td class="cell-num"><input class="score" type="number" min="0" max="' + as.max + '"'
          + ' value="' + (typeof v === 'number' ? v : '') + '"'
          + ' data-score="1" data-assess="' + esc(as.id) + '" data-student="' + esc(s.id) + '" /></td>';
      }).join('');
      const avg = studentAverage(s);
      return '<tr><td class="cell-name">' + esc(s.name) + '</td>' + cells
        + '<td class="cell-num cell-avg">' + (avg === null ? '—' : avg + '%') + '</td></tr>';
    }).join('');

    const avgCells = gb.assessments.map(function (as) {
      let sum = 0, n = 0;
      kids.forEach(function (s) {
        const v = gb.scores[as.id] ? gb.scores[as.id][s.id] : undefined;
        if (typeof v === 'number') { sum += v / as.max; n += 1; }
      });
      return '<td class="cell-num cell-avg">' + (n ? Math.round((sum / n) * 100) + '%' : '—') + '</td>';
    }).join('');

    return '<div class="toolbar">'
      + '<select class="input" data-ui="gbClass">' + classOptions(ui.gbClass) + '</select>'
      + '<span class="toolbar-spring"></span>'
      + '<button class="btn primary" type="button" data-action="gb-add-assess">Add assessment</button>'
      + '</div>'
      + '<div class="panel table-wrap"><table class="table gb-table">'
      + '<thead><tr><th>Student</th>' + head + '<th class="cell-num">Average</th></tr></thead>'
      + '<tbody>' + (rows || '<tr><td colspan="' + (gb.assessments.length + 2) + '" class="empty">No students in this class.</td></tr>') + '</tbody>'
      + (rows ? '<tfoot><tr><td class="cell-name">Class average</td>' + avgCells + '<td></td></tr></tfoot>' : '')
      + '</table></div>';
  }

  function renderView() {
    renderTabs();
    if (ui.tab === 'dashboard') viewEl.innerHTML = viewDashboard();
    else if (ui.tab === 'students') viewEl.innerHTML = viewStudents();
    else if (ui.tab === 'teachers') viewEl.innerHTML = viewTeachers();
    else if (ui.tab === 'classes') viewEl.innerHTML = viewClasses();
    else if (ui.tab === 'attendance') viewEl.innerHTML = viewAttendance();
    else viewEl.innerHTML = viewGradebook();
  }

  // ---------- Modal ----------
  function field(label, inner) {
    return '<label class="field"><span class="field-label">' + esc(label) + '</span>' + inner + '</label>';
  }

  function openModal(title, bodyHtml, onSubmit) {
    modalEl.innerHTML = '<div class="modal-back" data-close="1"></div>'
      + '<form class="modal-card" id="modal-form">'
      + '<h2 class="modal-title">' + esc(title) + '</h2>'
      + bodyHtml
      + '<div class="modal-actions">'
      + '<button class="btn" type="button" data-close="1">Cancel</button>'
      + '<button class="btn primary" type="submit">Save</button>'
      + '</div></form>';
    modalEl.hidden = false;
    const form = document.getElementById('modal-form');
    // Bound inside the render that created it — the node is fresh every open.
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      onSubmit(new FormData(form));
    });
    const first = form.querySelector('input, select');
    if (first) first.focus();
  }

  function closeModal() {
    modalEl.hidden = true;
    modalEl.innerHTML = '';
  }

  // ---------- Actions ----------
  function studentForm(s) {
    openModal(s ? 'Edit student' : 'Add student',
      field('Full name', '<input class="input" name="name" required value="' + esc(s ? s.name : '') + '" />')
      + field('Class', '<select class="input" name="classId">' + classOptions(s ? s.classId : ui.studentClass) + '</select>')
      + field('Guardian', '<input class="input" name="guardian" value="' + esc(s ? s.guardian : '') + '" />')
      + field('Email', '<input class="input" name="email" type="email" value="' + esc(s ? s.email : '') + '" />'),
      function (fd) {
        const rec = s || { id: uid('s') };
        rec.name = String(fd.get('name') || '').trim();
        rec.classId = String(fd.get('classId') || '');
        rec.guardian = String(fd.get('guardian') || '').trim();
        rec.email = String(fd.get('email') || '').trim();
        if (!rec.name) return;
        if (!s) state.students.push(rec);
        save(); closeModal(); renderView();
      });
  }

  function teacherForm(t) {
    openModal(t ? 'Edit teacher' : 'Add teacher',
      field('Full name', '<input class="input" name="name" required value="' + esc(t ? t.name : '') + '" />')
      + field('Subject', '<select class="input" name="subject">' + subjectOptions(t ? t.subject : SUBJECTS[0]) + '</select>')
      + field('Email', '<input class="input" name="email" type="email" value="' + esc(t ? t.email : '') + '" />'),
      function (fd) {
        const rec = t || { id: uid('t') };
        rec.name = String(fd.get('name') || '').trim();
        rec.subject = String(fd.get('subject') || '');
        rec.email = String(fd.get('email') || '').trim();
        if (!rec.name) return;
        if (!t) state.teachers.push(rec);
        save(); closeModal(); renderView();
      });
  }

  function classForm(c) {
    openModal(c ? 'Edit class' : 'Add class',
      field('Name', '<input class="input" name="name" required value="' + esc(c ? c.name : '') + '" />')
      + field('Room', '<input class="input" name="room" value="' + esc(c ? c.room : '') + '" />')
      + field('Homeroom teacher', '<select class="input" name="teacherId">' + teacherOptions(c ? c.teacherId : '') + '</select>'),
      function (fd) {
        const rec = c || { id: uid('c') };
        rec.name = String(fd.get('name') || '').trim();
        rec.room = String(fd.get('room') || '').trim();
        rec.teacherId = String(fd.get('teacherId') || '') || null;
        if (!rec.name) return;
        if (!c) {
          state.classes.push(rec);
          state.gradebook[rec.id] = { assessments: [], scores: {} };
        }
        save(); closeModal(); renderView();
      });
  }

  function assessmentForm() {
    openModal('Add assessment',
      field('Title', '<input class="input" name="title" required placeholder="e.g. History test" />')
      + field('Max score', '<input class="input" name="max" type="number" min="1" max="1000" value="100" required />'),
      function (fd) {
        const title = String(fd.get('title') || '').trim();
        const max = Math.max(1, parseInt(fd.get('max'), 10) || 100);
        if (!title) return;
        const gb = state.gradebook[ui.gbClass];
        const as = { id: uid('a'), title: title, max: max };
        gb.assessments.push(as);
        gb.scores[as.id] = {};
        save(); closeModal(); renderView();
      });
  }

  function deleteStudent(id) {
    const s = studentById(id);
    if (!s || !confirm('Delete ' + s.name + '? Their attendance and grades go too.')) return;
    state.students = state.students.filter(function (x) { return x.id !== id; });
    Object.keys(state.attendance).forEach(function (day) { delete state.attendance[day][id]; });
    Object.keys(state.gradebook).forEach(function (cid) {
      const scores = state.gradebook[cid].scores;
      Object.keys(scores).forEach(function (aid) { delete scores[aid][id]; });
    });
    save(); renderView();
  }

  function deleteTeacher(id) {
    const t = teacherById(id);
    if (!t || !confirm('Delete ' + t.name + '? Their homerooms become unassigned.')) return;
    state.teachers = state.teachers.filter(function (x) { return x.id !== id; });
    state.classes.forEach(function (c) { if (c.teacherId === id) c.teacherId = null; });
    save(); renderView();
  }

  function deleteClass(id) {
    const c = classById(id);
    if (!c) return;
    if (studentsOf(id).length) {
      alert('Move its students to another class first.');
      return;
    }
    if (!confirm('Delete class ' + c.name + '?')) return;
    state.classes = state.classes.filter(function (x) { return x.id !== id; });
    delete state.gradebook[id];
    save(); renderView();
  }

  function cycleAttendance(studentId) {
    if (!state.attendance[ui.attDate]) state.attendance[ui.attDate] = {};
    const day = state.attendance[ui.attDate];
    day[studentId] = day[studentId] ? ATT_NEXT[day[studentId]] : 'p';
    save(); renderView();
  }

  function markAllPresent() {
    if (!state.attendance[ui.attDate]) state.attendance[ui.attDate] = {};
    const day = state.attendance[ui.attDate];
    studentsOf(ui.attClass).forEach(function (s) { day[s.id] = 'p'; });
    save(); renderView();
  }

  function setScore(assessId, studentId, raw) {
    const gb = state.gradebook[ui.gbClass];
    const as = gb.assessments.find(function (x) { return x.id === assessId; });
    if (!as) return;
    if (!gb.scores[assessId]) gb.scores[assessId] = {};
    if (raw === '') {
      delete gb.scores[assessId][studentId];
    } else {
      let v = parseInt(raw, 10);
      if (isNaN(v)) return;
      v = Math.min(as.max, Math.max(0, v));
      gb.scores[assessId][studentId] = v;
    }
    save(); renderView();
  }

  // ---------- Events (delegated to stable containers) ----------
  tabsEl.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    ui.tab = btn.dataset.tab;
    renderView();
  });

  viewEl.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const act = btn.dataset.action;
    const id = btn.dataset.id;
    if (act === 'add-student') studentForm(null);
    else if (act === 'edit-student') studentForm(studentById(id));
    else if (act === 'del-student') deleteStudent(id);
    else if (act === 'add-teacher') teacherForm(null);
    else if (act === 'edit-teacher') teacherForm(teacherById(id));
    else if (act === 'del-teacher') deleteTeacher(id);
    else if (act === 'add-class') classForm(null);
    else if (act === 'edit-class') classForm(classById(id));
    else if (act === 'del-class') deleteClass(id);
    else if (act === 'view-class-students') { ui.tab = 'students'; ui.studentClass = id; ui.studentQuery = ''; renderView(); }
    else if (act === 'go-attendance') { ui.tab = 'attendance'; renderView(); }
    else if (act === 'att-cycle') cycleAttendance(id);
    else if (act === 'att-all-present') markAllPresent();
    else if (act === 'gb-add-assess') assessmentForm();
    else if (act === 'gb-del-assess') {
      const gb = state.gradebook[ui.gbClass];
      const as = gb.assessments.find(function (x) { return x.id === id; });
      if (as && confirm('Remove "' + as.title + '" and its scores?')) {
        gb.assessments = gb.assessments.filter(function (x) { return x.id !== id; });
        delete gb.scores[id];
        save(); renderView();
      }
    } else if (act === 'reset-data') {
      if (confirm('Reset everything to the sample data? This clears your changes.')) {
        state = sampleState(); save(); renderView();
      }
    }
  });

  viewEl.addEventListener('change', function (e) {
    const t = e.target;
    if (t.dataset.ui) {
      ui[t.dataset.ui] = t.value;
      renderView();
      return;
    }
    if (t.dataset.score) setScore(t.dataset.assess, t.dataset.student, t.value.trim());
  });

  viewEl.addEventListener('input', function (e) {
    const t = e.target;
    if (t.dataset.ui !== 'studentQuery') return;
    ui.studentQuery = t.value;
    renderView();
    const search = document.getElementById('student-search');
    if (search) {
      search.focus();
      const n = search.value.length;
      search.setSelectionRange(n, n);
    }
  });

  modalEl.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) closeModal();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modalEl.hidden) closeModal();
  });

  quitBtn.addEventListener('click', function () {
    if (window.self !== window.top) window.parent.postMessage({ type: 'close-game' }, '*');
    else location.href = '../../';
  });

  // ---------- Boot ----------
  renderView();
  appEl.hidden = false;

  const startTime = Date.now();
  function reveal() {
    const delay = Math.max(0, 3000 - (Date.now() - startTime));
    setTimeout(function () { loading.classList.add('hidden'); }, delay);
  }
  if (document.readyState === 'complete') reveal();
  else window.addEventListener('load', reveal);
})();
