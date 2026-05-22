(function () {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const scaleInput = document.getElementById('scale');
  const loading = document.getElementById('app-loading');

  let currentPal = 'terrain';

  // Gradient stops: [t, r, g, b] — t in [0, 1]
  const PALETTES = {
    terrain: [
      [0.00,  10,  28,  78],
      [0.38,  22,  88, 158],
      [0.46, 198, 176, 106],
      [0.54,  72, 130,  52],
      [0.70,  48,  88,  34],
      [0.82, 128, 118, 108],
      [1.00, 255, 255, 255],
    ],
    heat: [
      [0.00,   0,   0,   0],
      [0.28, 110,   0,   0],
      [0.55, 210,  46,   0],
      [0.76, 255, 158,   0],
      [1.00, 255, 252, 180],
    ],
    ocean: [
      [0.00,   3,   8,  30],
      [0.35,  10,  42, 100],
      [0.62,  18, 110, 188],
      [0.82,  56, 188, 210],
      [1.00, 218, 244, 252],
    ],
    void: [
      [0.00,   8,   0,  16],
      [0.34,  28,   0,  78],
      [0.62,  88,   0, 168],
      [0.82, 152,  78, 218],
      [1.00, 232, 212, 255],
    ],
  };

  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(t) { return t * t * (3 - 2 * t); }

  function palColor(palName, v) {
    const stops = PALETTES[palName];
    if (v <= stops[0][0]) return [stops[0][1], stops[0][2], stops[0][3]];
    const last = stops[stops.length - 1];
    if (v >= last[0]) return [last[1], last[2], last[3]];
    for (let i = 1; i < stops.length; i++) {
      if (v <= stops[i][0]) {
        const a = stops[i - 1];
        const b = stops[i];
        const t = (v - a[0]) / (b[0] - a[0]);
        return [
          Math.round(lerp(a[1], b[1], t)),
          Math.round(lerp(a[2], b[2], t)),
          Math.round(lerp(a[3], b[3], t)),
        ];
      }
    }
  }

  function generate() {
    const w = canvas.width;
    const h = canvas.height;
    const gridSize = parseInt(scaleInput.value, 10);
    const cols = Math.ceil(w / gridSize) + 2;
    const rows = Math.ceil(h / gridSize) + 2;

    const grid = new Float32Array(cols * rows);
    for (let i = 0; i < grid.length; i++) grid[i] = Math.random();

    const imageData = ctx.createImageData(w, h);
    const data = imageData.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const gx = x / gridSize;
        const gy = y / gridSize;
        const ix = Math.floor(gx);
        const iy = Math.floor(gy);
        const fx = smoothstep(gx - ix);
        const fy = smoothstep(gy - iy);

        const v00 = grid[iy * cols + ix];
        const v10 = grid[iy * cols + (ix + 1)];
        const v01 = grid[(iy + 1) * cols + ix];
        const v11 = grid[(iy + 1) * cols + (ix + 1)];

        const v = v00 * (1 - fx) * (1 - fy)
                + v10 * fx       * (1 - fy)
                + v01 * (1 - fx) * fy
                + v11 * fx       * fy;

        const [r, g, b] = palColor(currentPal, v);
        const idx = (y * w + x) * 4;
        data[idx]     = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.round(rect.width  * dpr);
    canvas.height = Math.round(rect.height * dpr);
    generate();
  }

  document.getElementById('palettes').addEventListener('click', e => {
    const btn = e.target.closest('.pal');
    if (!btn) return;
    document.querySelectorAll('.pal').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPal = btn.dataset.pal;
    generate();
  });

  scaleInput.addEventListener('input', generate);

  document.getElementById('regen-btn').addEventListener('click', generate);

  canvas.addEventListener('click', generate);

  document.getElementById('save-btn').addEventListener('click', () => {
    const a = document.createElement('a');
    a.download = `noise-${currentPal}-${Date.now()}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  });

  document.getElementById('quit-btn').addEventListener('click', () => {
    if (window.self !== window.top) {
      window.parent.postMessage({ type: 'close-game' }, '*');
    } else {
      location.href = '../../';
    }
  });

  window.addEventListener('resize', resize);

  const startTime = Date.now();
  requestAnimationFrame(() => {
    resize();
    const delay = Math.max(0, 3000 - (Date.now() - startTime));
    setTimeout(() => loading.classList.add('hidden'), delay);
  });
})();
