(function () {
  'use strict';

  const LOADED_AT = Date.now();
  const MIN_SPLASH_MS = 3000;
  const STORE_KEY = 'parking-meter-v1';
  const SPOT_COUNT = 6;
  const HISTORY_MAX = 12;
  const LOW_MS = 5 * 60 * 1000;
  const DIAL_CIRC = 2 * Math.PI * 52; // matches r=52 in index.html

  const ZONES = [
    { id: 'downtown', label: 'Downtown', rate: 200, maxMin: 120 },
    { id: 'mainst', label: 'Main Street', rate: 150, maxMin: 240 },
    { id: 'riverside', label: 'Riverside', rate: 100, maxMin: 600 },
  ];
  const COINS = [25, 100, 200];

  // ---------- State ----------

  let state = {
    spots: new Array(SPOT_COUNT).fill(null),
    history: [],
    revenueCents: 0,
    selected: 0,
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.spots)) return;
      state.spots = new Array(SPOT_COUNT).fill(null)
        .map((_, i) => (data.spots[i] && typeof data.spots[i].expiresAt === 'number' ? data.spots[i] : null));
      state.history = Array.isArray(data.history) ? data.history.slice(0, HISTORY_MAX) : [];
      state.revenueCents = typeof data.revenueCents === 'number' ? data.revenueCents : 0;
      state.selected = Number.isInteger(data.selected) && data.selected >= 0 && data.selected < SPOT_COUNT
        ? data.selected : 0;
    } catch (_) { /* corrupted storage — start fresh */ }
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function zoneById(id) {
    return ZONES.find((z) => z.id === id) || ZONES[0];
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

  function fmtClock(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function fmtShort(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    if (total >= 3600) {
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      return h + 'h ' + String(m).padStart(2, '0') + 'm';
    }
    return fmtClock(ms);
  }

  function fmtMins(min) {
    if (min >= 60) {
      const h = Math.floor(min / 60);
      const m = Math.round(min % 60);
      return m > 0 ? h + 'h ' + m + 'm' : h + 'h';
    }
    return Math.round(min) + ' min';
  }

  function coinMinutes(cents, zone) {
    return (cents / zone.rate) * 60;
  }

  // ---------- Session lifecycle ----------

  function spotStatus(session, now) {
    if (!session) return 'vacant';
    if (session.expiresAt <= now) return 'expired';
    if (session.expiresAt - now <= LOW_MS) return 'low';
    return 'active';
  }

  function insertCoin(i, cents) {
    const now = Date.now();
    const session = state.spots[i];
    const zoneSel = document.getElementById('zone-select');
    const plateInput = document.getElementById('plate-input');

    if (!session) {
      const zone = zoneById(zoneSel ? zoneSel.value : ZONES[0].id);
      const plate = plateInput && plateInput.value.trim()
        ? plateInput.value.trim().toUpperCase().slice(0, 10) : 'GUEST';
      const mins = Math.min(coinMinutes(cents, zone), zone.maxMin);
      state.spots[i] = {
        plate,
        zone: zone.id,
        startedAt: now,
        expiresAt: now + mins * 60000,
        purchasedMin: mins,
        paidCents: cents,
      };
    } else {
      const zone = zoneById(session.zone);
      const capLeft = zone.maxMin - session.purchasedMin;
      if (capLeft <= 0) return;
      const mins = Math.min(coinMinutes(cents, zone), capLeft);
      const base = Math.max(session.expiresAt, now);
      session.expiresAt = base + mins * 60000;
      session.purchasedMin += mins;
      session.paidCents += cents;
    }

    state.revenueCents += cents;
    save();
    renderControls();
    updateAll();
  }

  function endSession(i, reason) {
    const session = state.spots[i];
    if (!session) return;
    state.history.unshift({
      plate: session.plate,
      zone: session.zone,
      paidCents: session.paidCents,
      startedAt: session.startedAt,
      endedAt: Date.now(),
      reason,
    });
    state.history = state.history.slice(0, HISTORY_MAX);
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
  const meterStatusEl = document.getElementById('meter-status');
  const meterPlateEl = document.getElementById('meter-plate');
  const meterZoneEl = document.getElementById('meter-zone');
  const dialFill = document.getElementById('dial-fill');
  const controlsEl = document.getElementById('meter-controls');
  const spotsGrid = document.getElementById('spots-grid');
  const historyList = document.getElementById('history-list');
  const statActive = document.getElementById('stat-active');
  const statRevenue = document.getElementById('stat-revenue');

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
      const plate = document.createElement('span');
      plate.className = 'spot-plate';
      btn.append(num, time, plate);
      btn.addEventListener('click', () => {
        state.selected = i;
        save();
        renderControls();
        updateAll();
      });
      spotsGrid.appendChild(btn);
      spotEls.push({ btn, time, plate });
    }
  }

  function updateSpots(now) {
    for (let i = 0; i < SPOT_COUNT; i++) {
      const session = state.spots[i];
      const status = spotStatus(session, now);
      const el = spotEls[i];
      el.btn.className = 'spot ' + status + (state.selected === i ? ' selected' : '');
      if (!session) {
        el.time.textContent = 'Vacant';
        el.plate.textContent = 'Tap to set up';
      } else if (status === 'expired') {
        el.time.textContent = 'EXPIRED';
        el.plate.textContent = session.plate;
      } else {
        el.time.textContent = fmtShort(session.expiresAt - now);
        el.plate.textContent = session.plate;
      }
    }
  }

  // ---------- Meter head ----------

  function updateMeter(now) {
    const i = state.selected;
    const session = state.spots[i];
    const status = spotStatus(session, now);

    meterSpotEl.textContent = 'SPOT ' + (i + 1);
    meterHead.className = 'meter-head is-' + (status === 'low' ? 'active is-low' : status);

    if (!session) {
      meterTimeEl.textContent = '--:--';
      meterStatusEl.textContent = 'VACANT';
      meterPlateEl.textContent = 'No vehicle';
      meterZoneEl.textContent = '—';
      dialFill.style.strokeDashoffset = DIAL_CIRC;
      return;
    }

    const zone = zoneById(session.zone);
    const remaining = session.expiresAt - now;

    meterTimeEl.textContent = status === 'expired' ? 'EXPIRED' : fmtClock(remaining);
    meterStatusEl.textContent = status === 'expired' ? 'VIOLATION'
      : status === 'low' ? 'TIME LOW' : 'TIME REMAINING';
    meterPlateEl.textContent = session.plate;
    meterZoneEl.textContent = zone.label + ' · ' + money(zone.rate) + '/hr · paid ' + money(session.paidCents);

    const totalMs = session.purchasedMin * 60000;
    const frac = totalMs > 0 ? Math.min(1, Math.max(0, remaining / totalMs)) : 0;
    dialFill.style.strokeDashoffset = DIAL_CIRC * (1 - frac);
  }

  // ---------- Controls (re-rendered on state changes only) ----------

  function coinButtonsHtml(zone, capLeftMin) {
    return '<div class="coins">' + COINS.map((c) => {
      const mins = Math.min(coinMinutes(c, zone), capLeftMin);
      const disabled = capLeftMin <= 0 ? ' disabled' : '';
      return `<button type="button" class="coin" data-coin="${c}"${disabled}>
        <span class="coin-value">${money(c)}</span>
        <span class="coin-mins">+${fmtMins(mins)}</span>
      </button>`;
    }).join('') + '</div>';
  }

  function renderControls() {
    const i = state.selected;
    const session = state.spots[i];
    const now = Date.now();
    const status = spotStatus(session, now);

    if (!session) {
      const zone = zoneById(document.getElementById('zone-select')
        ? document.getElementById('zone-select').value : ZONES[0].id);
      controlsEl.innerHTML = `
        <div class="control-row">
          <div class="field">
            <label class="field-label" for="plate-input">License plate</label>
            <input id="plate-input" type="text" maxlength="10" placeholder="ABC-1234"
              autocomplete="off" spellcheck="false" />
          </div>
          <div class="field">
            <label class="field-label" for="zone-select">Zone</label>
            <select id="zone-select">
              ${ZONES.map((z) => `<option value="${z.id}"${z.id === zone.id ? ' selected' : ''}>
                ${esc(z.label)} · ${money(z.rate)}/hr</option>`).join('')}
            </select>
          </div>
        </div>
        <p class="zone-note" id="zone-note"></p>
        ${coinButtonsHtml(zone, zone.maxMin)}
        <p class="control-hint">Insert a coin to start the meter. Time is priced at the zone's hourly rate.</p>
      `;
      updateZoneNote();
      return;
    }

    const zone = zoneById(session.zone);
    const capLeft = Math.max(0, zone.maxMin - session.purchasedMin);
    const maxed = capLeft <= 0;

    controlsEl.innerHTML = `
      ${coinButtonsHtml(zone, capLeft)}
      <p class="control-hint${maxed ? ' maxed' : ''}">${maxed
        ? 'Zone limit reached — this meter can’t be fed past ' + fmtMins(zone.maxMin) + '.'
        : 'Top up any time. ' + esc(zone.label) + ' allows up to ' + fmtMins(zone.maxMin)
          + ' per stay (' + fmtMins(capLeft) + ' left to buy).'}</p>
      <div class="actions">
        <button type="button" class="btn" data-action="depart">🚙 Car departs</button>
        ${status === 'expired'
          ? '<button type="button" class="btn danger" data-action="ticket">🎫 Issue ticket &amp; clear</button>'
          : ''}
      </div>
    `;
  }

  function updateZoneNote() {
    const sel = document.getElementById('zone-select');
    const note = document.getElementById('zone-note');
    if (!sel || !note) return;
    const zone = zoneById(sel.value);
    note.textContent = zone.label + ' — ' + money(zone.rate) + ' per hour, '
      + fmtMins(zone.maxMin) + ' maximum stay.';
    document.querySelectorAll('.coin .coin-mins').forEach((el, idx) => {
      const mins = Math.min(coinMinutes(COINS[idx], zone), zone.maxMin);
      el.textContent = '+' + fmtMins(mins);
    });
  }

  controlsEl.addEventListener('click', (e) => {
    const coin = e.target.closest('.coin');
    if (coin && !coin.disabled) {
      insertCoin(state.selected, Number(coin.dataset.coin));
      return;
    }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'depart') endSession(state.selected, 'departed');
    if (btn.dataset.action === 'ticket') endSession(state.selected, 'expired');
  });

  controlsEl.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'zone-select') updateZoneNote();
  });

  // ---------- History ----------

  function renderHistory() {
    if (!state.history.length) {
      historyList.innerHTML = '<li class="history-empty">No sessions yet — feed a meter to get started.</li>';
      return;
    }
    historyList.innerHTML = state.history.map((h) => {
      const zone = zoneById(h.zone);
      const when = new Date(h.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const tag = h.reason === 'expired'
        ? '<span class="history-tag expired">Ticketed</span>'
        : '<span class="history-tag departed">Departed</span>';
      return `<li class="history-item">
        <div class="history-main">
          <span class="history-plate">${esc(h.plate)}</span>
          <span class="history-sub">${esc(zone.label)} · ${money(h.paidCents)} · ${when}</span>
        </div>
        ${tag}
      </li>`;
    }).join('');
  }

  // ---------- Stats + tick ----------

  function updateStats(now) {
    const active = state.spots.filter((s) => s && spotStatus(s, now) !== 'expired').length;
    statActive.textContent = String(active);
    statRevenue.textContent = money(state.revenueCents);
  }

  let lastStatuses = new Array(SPOT_COUNT).fill('vacant');

  function updateAll() {
    const now = Date.now();

    // Re-render controls when the selected spot crosses into/out of expiry,
    // so the ticket button appears without a click.
    const selStatus = spotStatus(state.spots[state.selected], now);
    if (selStatus !== lastStatuses[state.selected]
      && (selStatus === 'expired' || lastStatuses[state.selected] === 'expired')) {
      renderControls();
    }
    for (let i = 0; i < SPOT_COUNT; i++) lastStatuses[i] = spotStatus(state.spots[i], now);

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
