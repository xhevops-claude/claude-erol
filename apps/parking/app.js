(function () {
  'use strict';

  const LOADED_AT = Date.now();
  const MIN_SPLASH_MS = 3000;
  const STORE_KEY = 'parking-meter-v2';
  const SPOT_COUNT = 6;
  const HISTORY_MAX = 12;
  const HOUR_MS = 3600000;
  const DIAL_CIRC = 2 * Math.PI * 52; // matches r=52 in index.html

  const RATE_PRESETS = [100, 150, 200, 300]; // cents per hour

  // ---------- State ----------
  // Each spot is either null (vacant) or a stay I started:
  //   { startedAt (ms), rateCents (per hour), note }

  let state = {
    spots: new Array(SPOT_COUNT).fill(null),
    history: [],
    paidCents: 0,
    selected: 0,
    lastRate: 200,
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.spots)) return;
      state.spots = new Array(SPOT_COUNT).fill(null)
        .map((_, i) => {
          const s = data.spots[i];
          return s && typeof s.startedAt === 'number' && typeof s.rateCents === 'number' ? s : null;
        });
      state.history = Array.isArray(data.history) ? data.history.slice(0, HISTORY_MAX) : [];
      state.paidCents = typeof data.paidCents === 'number' ? data.paidCents : 0;
      state.selected = Number.isInteger(data.selected) && data.selected >= 0 && data.selected < SPOT_COUNT
        ? data.selected : 0;
      state.lastRate = typeof data.lastRate === 'number' && data.lastRate > 0 ? data.lastRate : 200;
    } catch (_) { /* corrupted storage — start fresh */ }
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  // ---------- Formatting ----------

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function money(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  function elapsedMs(stay, now) {
    return Math.max(0, now - stay.startedAt);
  }

  function costCents(stay, now) {
    return (elapsedMs(stay, now) / HOUR_MS) * stay.rateCents;
  }

  function fmtClock(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function fmtShort(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    if (total >= 3600) {
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      return h + 'h ' + String(m).padStart(2, '0') + 'm';
    }
    return fmtClock(ms);
  }

  function fmtTime(ms) {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function fmtWhen(ms) {
    const d = new Date(ms);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    return sameDay ? fmtTime(ms)
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + fmtTime(ms);
  }

  // datetime-local wants local "YYYY-MM-DDTHH:MM"
  function toLocalInput(ms) {
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
      + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function fromLocalInput(value) {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  // ---------- Stay lifecycle ----------

  function startStay(i, startedAt, rateCents, note) {
    state.spots[i] = { startedAt, rateCents, note: note || '' };
    state.lastRate = rateCents;
    save();
    renderControls();
    updateAll();
  }

  function endStay(i, paid) {
    const stay = state.spots[i];
    if (!stay) return;
    const now = Date.now();
    if (paid) {
      const total = Math.round(costCents(stay, now));
      state.history.unshift({
        spot: i,
        note: stay.note,
        rateCents: stay.rateCents,
        startedAt: stay.startedAt,
        endedAt: now,
        totalCents: total,
      });
      state.history = state.history.slice(0, HISTORY_MAX);
      state.paidCents += total;
    }
    state.spots[i] = null;
    save();
    renderControls();
    renderHistory();
    updateAll();
  }

  // ---------- DOM refs ----------

  const meterHead = document.getElementById('meter-head');
  const meterSpotEl = document.getElementById('meter-spot');
  const meterTimeEl = document.getElementById('meter-time');
  const meterCostEl = document.getElementById('meter-cost');
  const meterStatusEl = document.getElementById('meter-status');
  const meterSinceEl = document.getElementById('meter-since');
  const meterRateEl = document.getElementById('meter-rate');
  const dialFill = document.getElementById('dial-fill');
  const controlsEl = document.getElementById('meter-controls');
  const spotsGrid = document.getElementById('spots-grid');
  const historyList = document.getElementById('history-list');
  const statActive = document.getElementById('stat-active');
  const statDue = document.getElementById('stat-due');
  const statPaid = document.getElementById('stat-paid');

  const spotEls = [];

  // ---------- Spots grid (built once, updated in place) ----------

  function buildSpots() {
    spotsGrid.innerHTML = '';
    for (let i = 0; i < SPOT_COUNT; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'spot';
      const num = document.createElement('span');
      num.className = 'spot-num';
      num.textContent = 'SPOT ' + (i + 1);
      const time = document.createElement('span');
      time.className = 'spot-time';
      const sub = document.createElement('span');
      sub.className = 'spot-plate';
      btn.append(num, time, sub);
      btn.addEventListener('click', () => {
        state.selected = i;
        save();
        renderControls();
        updateAll();
      });
      spotsGrid.appendChild(btn);
      spotEls.push({ btn, time, sub });
    }
  }

  function updateSpots(now) {
    for (let i = 0; i < SPOT_COUNT; i++) {
      const stay = state.spots[i];
      const el = spotEls[i];
      el.btn.className = 'spot ' + (stay ? 'active' : 'vacant')
        + (state.selected === i ? ' selected' : '');
      if (!stay) {
        el.time.textContent = 'Vacant';
        el.sub.textContent = 'Tap to park here';
      } else {
        el.time.textContent = fmtShort(elapsedMs(stay, now));
        el.sub.textContent = money(Math.round(costCents(stay, now)))
          + (stay.note ? ' · ' + stay.note : '');
      }
    }
  }

  // ---------- Meter head ----------

  function updateMeter(now) {
    const i = state.selected;
    const stay = state.spots[i];

    meterSpotEl.textContent = 'SPOT ' + (i + 1);
    meterHead.className = 'meter-head ' + (stay ? 'is-active' : 'is-vacant');

    if (!stay) {
      meterTimeEl.textContent = '--:--';
      meterCostEl.textContent = '';
      meterStatusEl.textContent = 'VACANT';
      meterSinceEl.textContent = 'Not parked';
      meterRateEl.textContent = '—';
      dialFill.style.strokeDashoffset = DIAL_CIRC;
      return;
    }

    const elapsed = elapsedMs(stay, now);
    meterTimeEl.textContent = fmtClock(elapsed);
    meterCostEl.textContent = money(Math.round(costCents(stay, now))) + ' due';
    meterStatusEl.textContent = 'PARKED';
    meterSinceEl.textContent = 'Since ' + fmtWhen(stay.startedAt)
      + (stay.note ? ' · ' + stay.note : '');
    meterRateEl.textContent = money(stay.rateCents) + '/hr';

    // Dial shows progress through the current hour of the stay.
    const frac = (elapsed % HOUR_MS) / HOUR_MS;
    dialFill.style.strokeDashoffset = DIAL_CIRC * (1 - frac);
  }

  // ---------- Controls (re-rendered on state changes only) ----------

  function ratePresetsHtml(selectedCents) {
    return '<div class="presets">' + RATE_PRESETS.map((r) =>
      `<button type="button" class="chip${r === selectedCents ? ' on' : ''}" data-rate="${r}">${money(r)}/hr</button>`
    ).join('') + '</div>';
  }

  function renderControls() {
    const i = state.selected;
    const stay = state.spots[i];

    if (!stay) {
      controlsEl.innerHTML = `
        <div class="control-row">
          <div class="field">
            <label class="field-label" for="start-input">Parked at</label>
            <input id="start-input" type="datetime-local" value="${toLocalInput(Date.now())}" />
          </div>
          <div class="field">
            <label class="field-label" for="rate-input">Rate ($ per hour)</label>
            <input id="rate-input" type="number" min="0" step="0.25"
              value="${(state.lastRate / 100).toFixed(2)}" inputmode="decimal" />
          </div>
        </div>
        ${ratePresetsHtml(state.lastRate)}
        <div class="control-row">
          <div class="field">
            <label class="field-label" for="note-input">Note (optional)</label>
            <input id="note-input" type="text" maxlength="24" placeholder="e.g. blue Corolla, level 2"
              autocomplete="off" />
          </div>
        </div>
        <div class="actions">
          <button type="button" class="btn primary" data-action="start">🅿️ Start parking here</button>
        </div>
        <p class="control-hint">Set when you actually parked (backdating is fine) and the meter counts
          up from there — elapsed time and amount due update live.</p>
      `;
      return;
    }

    controlsEl.innerHTML = `
      <div class="control-row">
        <div class="field">
          <label class="field-label" for="start-edit">Parked at (adjust if needed)</label>
          <input id="start-edit" type="datetime-local" value="${toLocalInput(stay.startedAt)}" />
        </div>
        <div class="field">
          <label class="field-label" for="rate-edit">Rate ($ per hour)</label>
          <input id="rate-edit" type="number" min="0" step="0.25"
            value="${(stay.rateCents / 100).toFixed(2)}" inputmode="decimal" />
        </div>
      </div>
      <div class="actions">
        <button type="button" class="btn primary" data-action="pay">💸 I paid — end stay</button>
        <button type="button" class="btn danger" data-action="discard">Discard without paying</button>
      </div>
      <p class="control-hint">Changes to the start time or rate apply immediately, so the amount due
        always reflects the real stay.</p>
    `;
  }

  controlsEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) {
      const rateInput = document.getElementById('rate-input') || document.getElementById('rate-edit');
      if (rateInput) {
        rateInput.value = (Number(chip.dataset.rate) / 100).toFixed(2);
        rateInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      controlsEl.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === chip));
      return;
    }

    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const i = state.selected;

    if (btn.dataset.action === 'start') {
      const startedAt = fromLocalInput(document.getElementById('start-input').value) || Date.now();
      const rate = Math.round(Number(document.getElementById('rate-input').value) * 100);
      const note = document.getElementById('note-input').value.trim().slice(0, 24);
      if (!(rate > 0)) return;
      startStay(i, Math.min(startedAt, Date.now()), rate, note);
    }
    if (btn.dataset.action === 'pay') endStay(i, true);
    if (btn.dataset.action === 'discard') endStay(i, false);
  });

  controlsEl.addEventListener('change', (e) => {
    const stay = state.spots[state.selected];
    if (!stay) return;
    if (e.target.id === 'start-edit') {
      const ms = fromLocalInput(e.target.value);
      if (ms !== null) {
        stay.startedAt = Math.min(ms, Date.now());
        save();
        updateAll();
      }
    }
    if (e.target.id === 'rate-edit') {
      const rate = Math.round(Number(e.target.value) * 100);
      if (rate > 0) {
        stay.rateCents = rate;
        state.lastRate = rate;
        save();
        updateAll();
      }
    }
  });

  // ---------- History ----------

  function renderHistory() {
    if (!state.history.length) {
      historyList.innerHTML = '<li class="history-empty">No past stays yet — park somewhere and it shows up here.</li>';
      return;
    }
    historyList.innerHTML = state.history.map((h) => {
      const dur = fmtShort(h.endedAt - h.startedAt);
      return `<li class="history-item">
        <div class="history-main">
          <span class="history-plate">Spot ${h.spot + 1}${h.note ? ' · ' + esc(h.note) : ''}</span>
          <span class="history-sub">${dur} at ${money(h.rateCents)}/hr · ${fmtWhen(h.startedAt)}–${fmtTime(h.endedAt)}</span>
        </div>
        <span class="history-tag departed">${money(h.totalCents)}</span>
      </li>`;
    }).join('');
  }

  // ---------- Stats + tick ----------

  function updateStats(now) {
    const active = state.spots.filter(Boolean);
    const due = active.reduce((sum, s) => sum + costCents(s, now), 0);
    statActive.textContent = String(active.length);
    statDue.textContent = money(Math.round(due));
    statPaid.textContent = money(state.paidCents);
  }

  function updateAll() {
    const now = Date.now();
    updateSpots(now);
    updateMeter(now);
    updateStats(now);
  }

  // ---------- Boot ----------

  function boot() {
    load();
    buildSpots();
    renderControls();
    renderHistory();
    updateAll();
    setInterval(updateAll, 500);

    document.getElementById('app').hidden = false;
    const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - LOADED_AT));
    setTimeout(() => {
      const splash = document.getElementById('app-loading');
      if (!splash) return;
      splash.classList.add('hidden');
      setTimeout(() => splash.remove(), 450);
    }, wait);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
