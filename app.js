'use strict';
/* ============================================================================
   VR INVITE ENGINE — ядро приложения
   ========================================================================== */
window.__lastErr = '';
if (new URLSearchParams(location.search).has('nosplash')) document.documentElement.classList.add('nosplash');
window.addEventListener('error', e => {
  window.__lastErr = (e.message || '') + ' @ ' + (e.filename || '').split('/').pop() + ':' + (e.lineno || '');
});

/* ------------------------------ данные ---------------------------------- */
const $ = id => document.getElementById(id);

const CLUBS = [
  { label: 'ТРЦ «ЛетоСити»', name: 'VR-клуб TopRacer', addr: 'Кемерово, ТРЦ «ЛетоСити»' },
  { label: 'ТРЦ «Радуга»',   name: 'VR-клуб TopRacer', addr: 'Кемерово, ТРЦ «Радуга»' },
  { label: 'ТЦ «Проспект»',  name: 'VR-клуб TopRacer', addr: 'Кемерово, ТЦ «Проспект»' }
];

const PALETTES = {
  neon:   { n: 'Неон',      c1: '#00eaff', c2: '#ff2bd6', c3: '#7a5cff', bg: '#05060d' },
  matrix: { n: 'Матрица',   c1: '#00ff9d', c2: '#c8ff5a', c3: '#00b36b', bg: '#020704' },
  solar:  { n: 'Солар',     c1: '#ffb020', c2: '#ff2d6f', c3: '#b026ff', bg: '#0b0509' },
  ice:    { n: 'Лёд',       c1: '#62b8ff', c2: '#a6f4ff', c3: '#3f6dff', bg: '#040814' },
  violet: { n: 'Фиолет',    c1: '#b14bff', c2: '#ff4bd8', c3: '#6a5bff', bg: '#0a0414' },
  toxic:  { n: 'Токсик',    c1: '#c6ff00', c2: '#00ffc3', c3: '#ffe600', bg: '#050900' },
  blood:  { n: 'Кровь',     c1: '#ff2a44', c2: '#ff8a2a', c3: '#ff5f9e', bg: '#0b0204' },
  candy:  { n: 'Конфета',   c1: '#ff7ad9', c2: '#7af9ff', c3: '#ffd166', bg: '#14040f' },
  ocean:  { n: 'Океан',     c1: '#00e5ff', c2: '#00ffa8', c3: '#2b6bff', bg: '#01070f' },
  gold:   { n: 'Золото',    c1: '#ffd24a', c2: '#ff8a00', c3: '#fff0a8', bg: '#0c0803' },
  aurora: { n: 'Аврора',    c1: '#3dffb0', c2: '#7a5cff', c3: '#ff4bd8', bg: '#04080a' },
  sunset: { n: 'Закат',     c1: '#ff6a3d', c2: '#ffd166', c3: '#ff2e88', bg: '#0d0508' },
  cyber:  { n: 'Кибер',     c1: '#ffe600', c2: '#00e5ff', c3: '#ff2bd6', bg: '#06060c' },
  mint:   { n: 'Мята',      c1: '#4dffd2', c2: '#b6ff6a', c3: '#00a3ff', bg: '#020a08' },
  lava:   { n: 'Лава',      c1: '#ff3b1f', c2: '#ff9d00', c3: '#b3005e', bg: '#0b0303' },
  royal:  { n: 'Роял',      c1: '#4d7cff', c2: '#ffd24a', c3: '#b14bff', bg: '#05071a' }
};

const STYLE_PALETTE = { cyber: 'neon', cinema: 'gold', post: 'ice' };

const FORMATS = {
  '9:16': [1080, 1920],
  '4:5':  [1080, 1350],
  '1:1':  [1080, 1080],
  '16:9': [1920, 1080]
};

const MODES = {
  matrix:    'Матрица',
  snow:      'Снег',
  sparks:    'Искры',
  bokeh:     'Боке',
  confetti:  'Конфетти',
  fireworks: 'Фейерверк',
  stars:     'Звёзды',
  none:      'Без частиц'
};

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WD = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

/* --------------------------- состояние ---------------------------------- */
const SKEY = 'vr-invite:draft:v2';
const PKEY = 'vr-invite:photo:v2';
const BKEY = 'vr-invite:bg:v2';

function defaultDate() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function defaultState() {
  return {
    name: 'Артём', age: 14,
    date: defaultDate(), time: '17:00',
    club: 0, cname: CLUBS[0].name, caddr: CLUBS[0].addr,
    theme: 'neon', custom: null, fmt: '9:16', style: 'cyber',
    av: 'init', genitive: true, photo: '',
    preset: 'aurora', bg: '', glass: 55,
    fx: { mode: 'matrix', aurora: 1, grid: 1, scan: 1, vignette: 1, glitch: 1, portal: 1, boot: 1, sound: 0 }
  };
}

let state = defaultState();

/* --------------------------- утилиты ------------------------------------ */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HEX = /^#[0-9a-fA-F]{6}$/;

function hexToRgb(h) {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function rgba(h, a) {
  const [r, g, b] = hexToRgb(h);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}
function mixHex(a, b, k) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * k));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
function shade(h, k) {
  const [r, g, b] = hexToRgb(h);
  const f = v => Math.round(clamp(v * k, 0, 255));
  return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
}
function mod(a, n) { return ((a % n) + n) % n; }
function rnd(seed) {
  let x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
function plural(n, one, few, many) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}
function slug(s) {
  return String(s).replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').trim() || 'invite';
}

function toast(msg, err) {
  const box = $('toasts');
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => {
    t.style.transition = '.35s';
    t.style.opacity = '0';
    t.style.transform = 'translateY(8px)';
    setTimeout(() => t.remove(), 380);
  }, 2600);
}

function palette() {
  if (state.custom && HEX.test(state.custom.c1) && HEX.test(state.custom.c2)) {
    const c1 = state.custom.c1, c2 = state.custom.c2;
    return { c1, c2, c3: mixHex(c1, c2, .55), bg: mixHex('#05060d', c1, .06), n: 'Свой' };
  }
  return PALETTES[state.theme] || PALETTES.neon;
}

/* --------------------------- хеш / сохранение --------------------------- */
function normalize(raw) {
  const d = defaultState();
  const s = Object.assign({}, d, raw || {});
  s.name = String(s.name || '').slice(0, 18) || d.name;
  s.age = clamp(parseInt(s.age, 10) || d.age, 1, 99);
  s.date = /^\d{4}-\d{2}-\d{2}$/.test(s.date) ? s.date : d.date;
  s.time = /^\d{2}:\d{2}$/.test(s.time) ? s.time : d.time;
  s.club = clamp(parseInt(s.club, 10) || 0, 0, CLUBS.length - 1);
  s.cname = String(s.cname || CLUBS[s.club].name).slice(0, 28);
  s.caddr = String(s.caddr || CLUBS[s.club].addr).slice(0, 48);
  s.theme = Object.prototype.hasOwnProperty.call(PALETTES, s.theme) ? s.theme : 'neon';
  s.fmt = Object.prototype.hasOwnProperty.call(FORMATS, s.fmt) ? s.fmt : '9:16';
  s.style = ['cyber', 'cinema', 'post'].includes(s.style) ? s.style : 'cyber';
  s.av = s.av === 'snow' ? 'snow' : 'init';
  s.genitive = s.genitive !== false;
  s.preset = ['aurora', 'cosmos', 'sunset', 'photo'].includes(s.preset) ? s.preset : 'aurora';
  s.bg = typeof s.bg === 'string' && s.bg.startsWith('data:image/') ? s.bg : '';
  s.glass = clamp(parseInt(s.glass, 10), 0, 100);
  if (isNaN(s.glass)) s.glass = 55;
  s.photo = typeof s.photo === 'string' && s.photo.startsWith('data:image/') ? s.photo : '';
  const fx = Object.assign({}, d.fx, raw && raw.fx || {});
  s.fx = {
    mode: Object.prototype.hasOwnProperty.call(MODES, fx.mode) ? fx.mode : 'matrix',
    aurora: fx.aurora ? 1 : 0,
    grid: fx.grid ? 1 : 0,
    scan: fx.scan ? 1 : 0,
    vignette: fx.vignette ? 1 : 0,
    glitch: fx.glitch ? 1 : 0,
    portal: fx.portal ? 1 : 0,
    boot: fx.boot ? 1 : 0,
    sound: fx.sound ? 1 : 0
  };
  if (raw && raw.custom && HEX.test(raw.custom.c1) && HEX.test(raw.custom.c2)) {
    s.custom = { c1: raw.custom.c1, c2: raw.custom.c2 };
  } else s.custom = null;
  delete s.view;
  return s;
}

function loadSaved() {
  try {
    const txt = localStorage.getItem(SKEY);
    if (!txt) return null;
    const o = JSON.parse(txt);
    return normalize(o);
  } catch (e) { return null; }
}
function save() {
  try {
    const o = Object.assign({}, state);
    delete o.photo;
    delete o.bg;
    localStorage.setItem(SKEY, JSON.stringify(o));
    if (state.photo) localStorage.setItem(PKEY, state.photo);
    else localStorage.removeItem(PKEY);
    if (state.bg) localStorage.setItem(BKEY, state.bg);
    else localStorage.removeItem(BKEY);
  } catch (e) { /* quota */ }
}

function readHash() {
  if (!location.hash.startsWith('#i=')) return null;
  try {
    const o = JSON.parse(decodeURIComponent(location.hash.slice(3)));
    if (o && typeof o === 'object') return o;
  } catch (e) { }
  return null;
}
function buildHash(view) {
  const s = Object.assign({}, state, { view: view ? 1 : undefined });
  delete s.photo;
  delete s.bg;
  return location.href.split('#')[0] + '#i=' + encodeURIComponent(JSON.stringify(s));
}

/* --------------------------- DOM ---------------------------------------- */
const card = $('card');
const bg = $('bg');
const bx = bg.getContext('2d');
const ringCv = document.createElement('canvas');
const portalEl = $('portal');
const nameCv = $('nameCv');
const nx = nameCv.getContext('2d');
const avImg = $('avatar');
const avPh = $('avatarPh');

/* --------------------------- сцена -------------------------------------- */
let SW = 0, SH = 0, SD = 1;
let sceneT = 0, nameT = -1;
let captureMode = false;
let captureVeil = null;
let parts = null, noiseTile = null, scanPattern = null, scanTile = null;
let bgImage = null, bgPrep = null, bgPrepKey = '';

function resizeScene() {
  const r = card.getBoundingClientRect();
  SW = Math.max(1, Math.round(r.width));
  SH = Math.max(1, Math.round(r.height));
  SD = captureMode ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  bg.width = Math.round(SW * SD); bg.height = Math.round(SH * SD);
  bx.setTransform(SD, 0, 0, SD, 0, 0);
  const pr = portalEl.getBoundingClientRect();
  const pw = Math.max(1, Math.round(pr.width)), phh = Math.max(1, Math.round(pr.height));
  ringCv.width = Math.round(pw * SD); ringCv.height = Math.round(phh * SD);
  ringCv.style.width = '100%'; ringCv.style.height = '100%';
  buildParticles();
  buildTiles();
  sizeNameCanvas();
  rebuildBgPrep();
  drawScene(sceneT);
  drawName(sceneT);
}

function sizeNameCanvas() {
  const w = nameCv.clientWidth || nameCv.parentNode.clientWidth;
  const h = nameCv.clientHeight || nameCv.parentNode.clientHeight;
  if (!w || !h) return;
  nameCv.width = Math.round(w * SD);
  nameCv.height = Math.round(h * SD);
  nx.setTransform(SD, 0, 0, SD, 0, 0);
}

function buildTiles() {
  noiseTile = document.createElement('canvas');
  noiseTile.width = 160; noiseTile.height = 160;
  const nc = noiseTile.getContext('2d');
  const id = nc.createImageData(160, 160);
  for (let i = 0; i < id.data.length; i += 4) {
    const v = 140 + Math.random() * 115;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
    id.data[i + 3] = 26;
  }
  nc.putImageData(id, 0, 0);
  scanTile = document.createElement('canvas');
  scanTile.width = 4; scanTile.height = 4;
  const sc = scanTile.getContext('2d');
  sc.fillStyle = 'rgba(0,0,0,.34)';
  sc.fillRect(0, 0, 4, 1);
  scanPattern = bx.createPattern(scanTile, 'repeat');
}

function buildParticles() {
  const area = SW * SH;
  const k = Math.max(.35, area / (500 * 900));
  const c = Math.round;
  parts = {
    stars: Array.from({ length: c(60 * k) }, () => ({
      x: Math.random() * SW, y: Math.random() * SH, r: Math.random() * 1.9 + .5,
      sp: Math.random() * .18 + .03, ph: Math.random() * 6.28, a: Math.random() * .6 + .25
    })),
    rain: Array.from({ length: c(26 * k) }, () => ({
      x: Math.random() * SW, y: Math.random() * SH, len: Math.random() * 120 + 50,
      sp: Math.random() * 90 + 40, ph: Math.random() * 6.28
    })),
    snow: Array.from({ length: c(70 * k) }, () => ({
      x: Math.random() * SW, y: Math.random() * SH, r: Math.random() * 2.6 + .8,
      sp: Math.random() * 22 + 8, ph: Math.random() * 6.28
    })),
    sparks: Array.from({ length: c(40 * k) }, () => ({
      x: Math.random() * SW, y: Math.random() * SH, r: Math.random() * 1.8 + .5,
      sp: Math.random() * 34 + 12, ph: Math.random() * 6.28
    })),
    bokeh: Array.from({ length: c(20 * k) }, () => ({
      x: Math.random() * SW, y: Math.random() * SH, r: Math.random() * 26 + 10,
      sp: Math.random() * 12 + 3, ph: Math.random() * 6.28
    })),
    confetti: Array.from({ length: c(50 * k) }, () => ({
      x: Math.random() * SW, y: Math.random() * SH, w: Math.random() * 7 + 4,
      h: Math.random() * 4 + 2, sp: Math.random() * 40 + 18, ph: Math.random() * 6.28,
      rot: Math.random() * 6.28, vr: Math.random() * 2 - 1
    }))
  };
}

function drawScene(t) {
  if (!SW || !SH || !parts) return;
  const P = palette();
  const W = SW, H = SH;
  const style = state.style;
  bx.clearRect(0, 0, W, H);
  bx.globalAlpha = 1;
  bx.globalCompositeOperation = 'source-over';

  const preset = state.preset;
  if (preset === 'photo' && bgPrep) {
    bx.drawImage(bgPrep, 0, 0, W, H);
    drawGlass(t, P);
  } else if (preset === 'cosmos') {
    drawCosmos(t, P);
    if (state.glass > 0) drawGlass(t, P);
  } else if (preset === 'sunset') {
    drawSunset(t, P);
    if (state.glass > 0) drawGlass(t, P);
  } else {
    /* базовый фон */
    const g0 = bx.createLinearGradient(0, 0, W * .35, H);
    g0.addColorStop(0, shade(P.bg, 1.55));
    g0.addColorStop(.45, P.bg);
    g0.addColorStop(1, shade(P.bg, .55));
    bx.fillStyle = g0;
    bx.fillRect(0, 0, W, H);
    if (state.fx.aurora) drawAurora(t, P);
    if (style === 'cinema') drawBeams(t, P);
    if (state.fx.grid && style !== 'post') drawGrid(t, P);
    if (state.glass > 0) drawGlass(t, P);
  }

  drawParticles(t, P);
  if (state.fx.scan) drawScan(t);
  drawSweep(t, P);
  if (state.fx.vignette) drawVignette(style);
  drawBorder(t, P);
  drawNoise(t);
  drawRings(t, P);
  if (captureVeil) {
    const a = Math.min(1, Math.max(0, captureVeil(t)));
    if (a > 0) {
      bx.fillStyle = 'rgba(0,0,0,' + a.toFixed(3) + ')';
      bx.fillRect(0, 0, SW, SH);
    }
  }
}

/* ---------------------- фоны: космос, закат, стекло ---------------------- */
function drawCosmos(t, P) {
  const W = SW, H = SH;
  const g = bx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#01020a'); g.addColorStop(.55, '#060819'); g.addColorStop(1, '#02030a');
  bx.fillStyle = g; bx.fillRect(0, 0, W, H);

  bx.save();
  bx.globalCompositeOperation = 'lighter';
  const blobs = [
    [.24, .24, .58, P.c1, .20], [.78, .34, .52, P.c2, .17],
    [.54, .74, .62, P.c3, .15], [.14, .82, .42, P.c1, .10]
  ];
  blobs.forEach((b, i) => {
    const cx = (b[0] + Math.sin(t * .09 + i) * .025) * W;
    const cy = (b[1] + Math.cos(t * .11 + i) * .02) * H;
    const r = b[2] * Math.min(W, H);
    const rg = bx.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, rgba(b[3], b[4]));
    rg.addColorStop(.55, rgba(b[3], b[4] * .45));
    rg.addColorStop(1, rgba(b[3], 0));
    bx.fillStyle = rg;
    bx.beginPath(); bx.arc(cx, cy, r, 0, 6.2832); bx.fill();
  });
  bx.restore();

  bx.save();
  bx.fillStyle = '#ffffff';
  const n = Math.round(150 * (W * H) / (480 * 853));
  for (let i = 0; i < n; i++) {
    const x = rnd(i * 3.1) * W, y = rnd(i * 7.7) * H;
    const r = rnd(i * 5.3) * 1.5 + .3;
    bx.globalAlpha = .2 + .6 * Math.abs(Math.sin(t * .5 + i * .7));
    bx.beginPath(); bx.arc(x, y, r, 0, 6.2832); bx.fill();
  }
  bx.restore();

  const hg = bx.createLinearGradient(0, H * .7, 0, H);
  hg.addColorStop(0, rgba(P.c1, 0));
  hg.addColorStop(1, rgba(P.c1, .10));
  bx.fillStyle = hg; bx.fillRect(0, H * .7, W, H * .3);
}

function drawSunset(t, P) {
  const W = SW, H = SH;
  const sky = bx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#05030d');
  sky.addColorStop(.30, '#100722');
  sky.addColorStop(.55, '#22102e');
  sky.addColorStop(.70, '#451a35');
  sky.addColorStop(.80, '#7a2a33');
  sky.addColorStop(.88, '#3a1420');
  sky.addColorStop(1, '#0a040c');
  bx.fillStyle = sky; bx.fillRect(0, 0, W, H);

  const cx = W * .5, cy = H * .80, r = Math.min(W, H) * .30;
  bx.save();
  bx.globalCompositeOperation = 'lighter';
  const sg = bx.createRadialGradient(cx, cy, r * .05, cx, cy, r);
  sg.addColorStop(0, 'rgba(255,190,120,.55)');
  sg.addColorStop(.45, 'rgba(255,110,60,.20)');
  sg.addColorStop(1, 'rgba(255,80,40,0)');
  bx.fillStyle = sg;
  bx.beginPath(); bx.arc(cx, cy, r, 0, 6.2832); bx.fill();
  bx.fillStyle = 'rgba(255,205,150,.38)';
  bx.beginPath(); bx.arc(cx, cy, r * .20, 0, 6.2832); bx.fill();
  bx.restore();

  const bottom = bx.createLinearGradient(0, H * .55, 0, H);
  bottom.addColorStop(0, 'rgba(4,3,10,0)');
  bottom.addColorStop(.55, 'rgba(4,3,10,.45)');
  bottom.addColorStop(1, 'rgba(4,3,10,.80)');
  bx.fillStyle = bottom; bx.fillRect(0, H * .55, W, H * .45);

  for (let i = 0; i < 5; i++) {
    const y = H * (.58 + i * .05);
    bx.fillStyle = 'rgba(10,4,16,' + (.10 - i * .015).toFixed(3) + ')';
    bx.fillRect(0, y, W, H * .012);
  }
}

function drawGlass(t, P) {
  const W = SW, H = SH;
  const k = clamp(state.glass, 0, 100) / 100;
  if (k <= 0) return;

  bx.save();
  const g = bx.createLinearGradient(0, 0, W * .75, H * .65);
  g.addColorStop(0, 'rgba(255,255,255,' + (.11 * k).toFixed(3) + ')');
  g.addColorStop(.35, 'rgba(255,255,255,' + (.035 * k).toFixed(3) + ')');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  bx.fillStyle = g;
  bx.fillRect(0, 0, W, H);
  bx.restore();

  bx.save();
  bx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 2; i++) {
    const x = mod(t * 9 + i * W * .62, W * 1.9) - W * .45;
    bx.save();
    bx.translate(x, 0);
    bx.rotate(-.22);
    const gg = bx.createLinearGradient(0, 0, W * .11, 0);
    gg.addColorStop(0, 'rgba(255,255,255,0)');
    gg.addColorStop(.5, 'rgba(255,255,255,' + (.06 * k).toFixed(3) + ')');
    gg.addColorStop(1, 'rgba(255,255,255,0)');
    bx.fillStyle = gg;
    bx.fillRect(-W * .06, -H * .2, W * .15, H * 1.5);
    bx.restore();
  }
  bx.restore();

  bx.save();
  bx.strokeStyle = 'rgba(255,255,255,' + (.12 * k).toFixed(3) + ')';
  bx.lineWidth = Math.max(1, W * .0022);
  bx.beginPath();
  bx.roundRect(W * .014, H * .014, W * .972, H * .972, Math.min(W, H) * .043);
  bx.stroke();
  bx.restore();
}

function rebuildBgPrep() {
  if (!bgImage || !SW || !SH) { bgPrep = null; bgPrepKey = ''; return; }
  const key = [SW, SH, state.glass, state.bg.length, state.theme].join('|');
  if (key === bgPrepKey && bgPrep) return;
  bgPrepKey = key;
  const W = SW, H = SH;
  bgPrep = document.createElement('canvas');
  bgPrep.width = Math.round(W * SD);
  bgPrep.height = Math.round(H * SD);
  const g = bgPrep.getContext('2d');
  g.setTransform(SD, 0, 0, SD, 0, 0);

  const blur = state.glass <= 0 ? 0 : (5 + state.glass * .38) * Math.max(.6, W / 520);
  g.save();
  g.filter = 'blur(' + blur.toFixed(1) + 'px) saturate(1.05) brightness(.88)';
  const ir = bgImage.width / bgImage.height, cr = W / H;
  let dw, dh;
  if (ir > cr) { dh = H * 1.16; dw = dh * ir; } else { dw = W * 1.16; dh = dw / ir; }
  g.drawImage(bgImage, (W - dw) / 2, (H - dh) / 2, dw, dh);
  g.restore();

  const tg = g.createLinearGradient(0, 0, 0, H);
  tg.addColorStop(0, 'rgba(4,6,16,.60)');
  tg.addColorStop(.45, 'rgba(4,6,16,.44)');
  tg.addColorStop(1, 'rgba(4,6,16,.70)');
  g.fillStyle = tg;
  g.fillRect(0, 0, W, H);

  const P = palette();
  g.globalCompositeOperation = 'overlay';
  g.fillStyle = rgba(P.c1, .10);
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
}

function setBgImage(dataUrl) {
  bgImage = null; bgPrep = null; bgPrepKey = '';
  if (!dataUrl) { drawScene(sceneT); return; }
  const im = new Image();
  im.onload = () => {
    bgImage = im;
    rebuildBgPrep();
    drawScene(sceneT);
  };
  im.onerror = () => { bgImage = null; bgPrep = null; drawScene(sceneT); };
  im.src = dataUrl;
}

/* аврора: большие цветные пятна */
function drawAurora(t, P) {
  const W = SW, H = SH;
  bx.save();
  bx.globalCompositeOperation = 'lighter';
  const blobs = [
    { x: .28, y: .18, r: .62, c: P.c1, a: .30, sx: .07, sy: .05, sp: .21, ph: 0 },
    { x: .76, y: .34, r: .58, c: P.c2, a: .26, sx: .06, sy: .08, sp: .17, ph: 2.1 },
    { x: .50, y: .62, r: .70, c: P.c3, a: .20, sx: .09, sy: .06, sp: .13, ph: 4.3 },
    { x: .22, y: .82, r: .48, c: P.c2, a: .16, sx: .05, sy: .07, sp: .23, ph: 1.2 },
    { x: .88, y: .78, r: .44, c: P.c1, a: .15, sx: .04, sy: .05, sp: .19, ph: 3.4 }
  ];
  blobs.forEach((b, i) => {
    const cx = (b.x + Math.sin(t * b.sp + b.ph) * b.sx) * W;
    const cy = (b.y + Math.cos(t * b.sp * .8 + b.ph) * b.sy) * H;
    const r = b.r * Math.min(W, H);
    const g = bx.createRadialGradient(cx, cy, r * .04, cx, cy, r);
    g.addColorStop(0, rgba(b.c, b.a));
    g.addColorStop(.55, rgba(b.c, b.a * .45));
    g.addColorStop(1, rgba(b.c, 0));
    bx.fillStyle = g;
    bx.beginPath(); bx.arc(cx, cy, r, 0, 6.2832); bx.fill();
  });
  bx.restore();
}

/* сетка-горизонт */
function drawGrid(t, P) {
  const W = SW, H = SH;
  const horizon = H * .60;
  const lw = Math.max(1, W / 900);
  bx.save();
  bx.globalCompositeOperation = 'lighter';
  bx.strokeStyle = rgba(P.c1, .13);
  bx.lineWidth = lw;
  for (let i = -14; i <= 14; i++) {
    const xb = W / 2 + i * (W / 7);
    bx.beginPath(); bx.moveTo(W / 2 + i * (W / 60), horizon); bx.lineTo(xb, H); bx.stroke();
  }
  for (let i = 0; i < 16; i++) {
    const p = mod(i / 16 + t * .035, 1);
    const y = horizon + Math.pow(p, 2.3) * (H - horizon);
    bx.globalAlpha = (1 - p) * .55;
    bx.beginPath(); bx.moveTo(0, y); bx.lineTo(W, y); bx.stroke();
  }
  bx.globalAlpha = 1;
  const g = bx.createLinearGradient(0, horizon - H * .12, 0, horizon + H * .05);
  g.addColorStop(0, rgba(P.c1, 0));
  g.addColorStop(.7, rgba(P.c1, .16));
  g.addColorStop(1, rgba(P.c1, 0));
  bx.fillStyle = g;
  bx.fillRect(0, horizon - H * .12, W, H * .18);
  bx.restore();
}

/* прожекторы кинозала */
function drawBeams(t, P) {
  const W = SW, H = SH;
  bx.save();
  bx.globalCompositeOperation = 'lighter';
  const beams = [
    { x: .18, w: .16, a: .16, sp: .22, ph: 0 },
    { x: .5, w: .13, a: .13, sp: .16, ph: 2 },
    { x: .82, w: .18, a: .15, sp: .19, ph: 4 }
  ];
  beams.forEach(b => {
    const cx = (b.x + Math.sin(t * b.sp + b.ph) * .05) * W;
    const g = bx.createLinearGradient(cx, 0, cx, H * .95);
    g.addColorStop(0, rgba(P.c1, b.a));
    g.addColorStop(.55, rgba(P.c1, b.a * .45));
    g.addColorStop(1, rgba(P.c2, 0));
    bx.fillStyle = g;
    bx.beginPath();
    bx.moveTo(cx - W * .01, -10);
    bx.lineTo(cx + W * .01, -10);
    bx.lineTo(cx + W * b.w, H * .95);
    bx.lineTo(cx - W * b.w, H * .95);
    bx.closePath(); bx.fill();
  });
  bx.restore();
}

/* частицы */
function drawParticles(t, P) {
  const W = SW, H = SH, mode = state.fx.mode;
  if (mode === 'none') return;

  /* звёзды есть всегда (кроме режима «без частиц») */
  bx.save();
  bx.globalCompositeOperation = 'lighter';
  for (const s of parts.stars) {
    const y = mod(s.y - t * s.sp * 8, H + 8) - 4;
    const a = s.a * (.55 + .45 * Math.sin(t * 1.7 + s.ph));
    if (a <= .02) continue;
    bx.globalAlpha = a;
    bx.fillStyle = rgba(P.c1, 1);
    bx.beginPath(); bx.arc(s.x, y, s.r, 0, 6.2832); bx.fill();
  }
  bx.restore();

  if (mode === 'matrix') drawMatrix(t, P);
  else if (mode === 'snow') drawSnow(t, P);
  else if (mode === 'sparks') drawSparks(t, P);
  else if (mode === 'bokeh') drawBokeh(t, P);
  else if (mode === 'confetti') drawConfetti(t, P);
  else if (mode === 'fireworks') drawFireworks(t, P);
}

function drawMatrix(t, P) {
  const W = SW, H = SH;
  const chars = '01АВГДЕИКМНОПРСТУФХЦЧШЭЮЯ';
  bx.save();
  bx.font = Math.max(9, W * .012) + 'px "JetBrains Mono", monospace';
  bx.globalCompositeOperation = 'lighter';
  for (const r of parts.rain) {
    const y = mod(r.y + t * r.sp, H + r.len) - r.len;
    const g = bx.createLinearGradient(0, y - r.len, 0, y);
    g.addColorStop(0, rgba(P.c2, 0));
    g.addColorStop(1, rgba(P.c2, .55));
    bx.globalAlpha = .5;
    bx.fillStyle = g;
    bx.fillRect(r.x, y - r.len, Math.max(1, W * .0016), r.len);
    bx.globalAlpha = .85;
    bx.fillStyle = rgba(P.c1, 1);
    const ch = chars[Math.floor(mod(r.ph * 7 + y * .02, chars.length))];
    bx.fillText(ch, r.x - bx.measureText(ch).width / 2, y);
  }
  bx.restore();
}

function drawSnow(t, P) {
  const W = SW;
  bx.save();
  bx.fillStyle = '#ffffff';
  for (const s of parts.snow) {
    const y = mod(s.y + t * s.sp, SH + 12) - 6;
    const x = s.x + Math.sin(t * .7 + s.ph) * W * .03;
    bx.globalAlpha = .25 + .45 * (.5 + .5 * Math.sin(t * 1.1 + s.ph));
    bx.beginPath(); bx.arc(x, y, s.r, 0, 6.2832); bx.fill();
  }
  bx.restore();
}

function drawSparks(t, P) {
  bx.save();
  bx.globalCompositeOperation = 'lighter';
  for (const s of parts.sparks) {
    const y = mod(s.y - t * s.sp, SH + 20) - 10;
    const x = s.x + Math.sin(t * 1.4 + s.ph) * 8;
    const a = .35 + .5 * Math.abs(Math.sin(t * 3 + s.ph));
    bx.globalAlpha = a;
    bx.fillStyle = rgba(Math.sin(s.ph) > 0 ? P.c1 : P.c2, 1);
    bx.beginPath(); bx.arc(x, y, s.r, 0, 6.2832); bx.fill();
  }
  bx.restore();
}

function drawBokeh(t, P) {
  bx.save();
  bx.globalCompositeOperation = 'lighter';
  for (const b of parts.bokeh) {
    const y = mod(b.y - t * b.sp, SH + b.r * 2) - b.r;
    const x = b.x + Math.sin(t * .35 + b.ph) * 16;
    const g = bx.createRadialGradient(x, y, 0, x, y, b.r);
    g.addColorStop(0, rgba(P.c1, .10));
    g.addColorStop(.7, rgba(P.c1, .05));
    g.addColorStop(1, rgba(P.c1, 0));
    bx.fillStyle = g;
    bx.beginPath(); bx.arc(x, y, b.r, 0, 6.2832); bx.fill();
  }
  bx.restore();
}

function drawConfetti(t, P) {
  const cols = [P.c1, P.c2, P.c3, '#ffffff'];
  bx.save();
  for (const c of parts.confetti) {
    const y = mod(c.y + t * c.sp, SH + 30) - 15;
    const x = c.x + Math.sin(t * 1.2 + c.ph) * 22;
    const rot = c.rot + t * c.vr;
    bx.save();
    bx.translate(x, y); bx.rotate(rot);
    bx.globalAlpha = .85;
    bx.fillStyle = rgba(cols[Math.floor(mod(c.ph * 10, cols.length))], 1);
    bx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    bx.restore();
  }
  bx.restore();
}

function drawFireworks(t, P) {
  const W = SW, H = SH;
  const cycle = 3.6;
  bx.save();
  bx.globalCompositeOperation = 'lighter';
  const launches = [
    { x: .28, y: .34, t0: .0, c: P.c1 },
    { x: .72, y: .28, t0: 1.2, c: P.c2 },
    { x: .52, y: .46, t0: 2.4, c: P.c3 }
  ];
  launches.forEach((L, li) => {
    const local = mod(t - L.t0, cycle);
    if (local > 1.5) return;
    const cx = L.x * W, cy = L.y * H;
    for (let i = 0; i < 26; i++) {
      const a = rnd(li * 31 + i) * 6.2832;
      const sp = (rnd(li * 57 + i + 9) * .7 + .3) * Math.min(W, H) * .22;
      const x = cx + Math.cos(a) * sp * local;
      const y = cy + Math.sin(a) * sp * local + 60 * local * local;
      const al = Math.max(0, 1 - local / 1.5);
      bx.globalAlpha = al * .9;
      bx.fillStyle = rgba(i % 3 === 0 ? '#ffffff' : L.c, 1);
      bx.beginPath(); bx.arc(x, y, 1.6 + al * 1.6, 0, 6.2832); bx.fill();
    }
  });
  bx.restore();
}

/* линии развёртки */
function drawScan(t) {
  if (!scanPattern) return;
  bx.save();
  bx.translate(0, mod(t * 26, 4));
  bx.fillStyle = scanPattern;
  bx.fillRect(0, -4, SW, SH + 8);
  bx.restore();
}

/* бегущая полоса */
function drawSweep(t, P) {
  const y = mod(t * .055, 1) * (SH + SH * .2) - SH * .1;
  const g = bx.createLinearGradient(0, y - SH * .06, 0, y + SH * .06);
  g.addColorStop(0, rgba(P.c1, 0));
  g.addColorStop(.5, rgba(P.c1, .12));
  g.addColorStop(1, rgba(P.c1, 0));
  bx.save();
  bx.globalCompositeOperation = 'lighter';
  bx.fillStyle = g;
  bx.fillRect(0, y - SH * .06, SW, SH * .12);
  bx.restore();
}

function drawVignette(style) {
  const W = SW, H = SH;
  const g = bx.createRadialGradient(W / 2, H * .46, Math.min(W, H) * .18, W / 2, H * .5, Math.max(W, H) * .78);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(.62, 'rgba(0,0,0,.12)');
  g.addColorStop(1, style === 'cinema' ? 'rgba(0,0,0,.86)' : 'rgba(0,0,0,.62)');
  bx.save();
  bx.fillStyle = g;
  bx.fillRect(0, 0, W, H);
  bx.restore();
}

function drawNoise(t) {
  if (!noiseTile || SW < 620) return;   /* в GIF/превью зерно не читается, только шумит */
  if (!noiseTile._pat) noiseTile._pat = bx.createPattern(noiseTile, 'repeat');
  const pat = noiseTile._pat;
  if (!pat) return;
  const slot = Math.floor(t * 20);
  bx.save();
  bx.globalAlpha = .3;
  bx.translate(-Math.floor(rnd(slot) * 160), -Math.floor(rnd(slot + 5) * 160));
  bx.fillStyle = pat;
  bx.fillRect(0, 0, SW + 160, SH + 160);
  bx.restore();
}

function drawBorder(t, P) {
  const W = SW, H = SH;
  const rad = Math.min(W, H) * .046;
  bx.save();
  const cg = bx.createConicGradient(mod(t * .25, 6.2832), W / 2, H / 2);
  cg.addColorStop(0, rgba(P.c1, .9));
  cg.addColorStop(.18, rgba(P.c1, .1));
  cg.addColorStop(.38, rgba(P.c2, .9));
  cg.addColorStop(.58, rgba(P.c2, .08));
  cg.addColorStop(.78, rgba(P.c3, .85));
  cg.addColorStop(1, rgba(P.c1, .9));
  bx.strokeStyle = cg;
  bx.lineWidth = Math.max(1.2, W * .0034);
  bx.beginPath();
  bx.roundRect(bx.lineWidth / 2, bx.lineWidth / 2, W - bx.lineWidth, H - bx.lineWidth, rad);
  bx.stroke();
  bx.restore();
}

/* портал: кольца на отдельном canvas */
function drawRings(t, P) {
  if (!state.fx.portal) {
    const rc = ringCv.getContext('2d');
    rc.clearRect(0, 0, ringCv.width, ringCv.height);
    return;
  }
  const rc = ringCv.getContext('2d');
  const W = ringCv.width / SD, H = ringCv.height / SD;
  rc.setTransform(SD, 0, 0, SD, 0, 0);
  rc.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2, R = W / 2;
  const coreR = R * .66;

  rc.save();
  rc.globalCompositeOperation = 'lighter';

  /* свечение ядра */
  const glow = rc.createRadialGradient(cx, cy, coreR * .2, cx, cy, R * .98);
  glow.addColorStop(0, rgba(P.c1, .55));
  glow.addColorStop(.45, rgba(P.c1, .22));
  glow.addColorStop(.75, rgba(P.c2, .10));
  glow.addColorStop(1, rgba(P.c2, 0));
  rc.fillStyle = glow;
  rc.beginPath(); rc.arc(cx, cy, R * .98, 0, 6.2832); rc.fill();

  /* внешнее кольцо */
  const g1 = rc.createConicGradient(mod(t * .9, 6.28), cx, cy);
  g1.addColorStop(0, rgba(P.c1, 0));
  g1.addColorStop(.10, rgba(P.c1, 1));
  g1.addColorStop(.25, rgba(P.c1, .05));
  g1.addColorStop(.45, rgba(P.c2, 1));
  g1.addColorStop(.62, rgba(P.c2, .05));
  g1.addColorStop(.82, rgba(P.c3, .95));
  g1.addColorStop(1, rgba(P.c1, 0));
  rc.strokeStyle = g1;
  rc.lineWidth = R * .045;
  rc.shadowColor = P.c1;
  rc.shadowBlur = R * .16;
  rc.beginPath(); rc.arc(cx, cy, R * .93, 0, 6.2832); rc.stroke();

  /* пунктирное кольцо */
  rc.shadowBlur = R * .1;
  rc.shadowColor = P.c2;
  rc.strokeStyle = rgba(P.c2, .85);
  rc.lineWidth = R * .016;
  rc.setLineDash([R * .03, R * .075]);
  rc.lineDashOffset = -t * R * .22;
  rc.beginPath(); rc.arc(cx, cy, R * .80, 0, 6.2832); rc.stroke();
  rc.setLineDash([]);

  /* орбитальные точки */
  for (let i = 0; i < 4; i++) {
    const a = t * (.5 + i * .11) + i * 1.7;
    const rr = R * (i % 2 ? .70 : .86);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    rc.fillStyle = i % 2 ? P.c1 : '#ffffff';
    rc.shadowBlur = R * .12;
    rc.shadowColor = i % 2 ? P.c1 : P.c2;
    rc.beginPath(); rc.arc(x, y, R * .022, 0, 6.2832); rc.fill();
  }
  rc.restore();
}

/* --------------------------- имя ---------------------------------------- */
function fontForName() {
  return (state.style === 'cinema' || state.style === 'post') ? '"Playfair Display", serif' : '"Unbounded", sans-serif';
}

function drawName(t) {
  if (!nameCv.width) return;
  const W = nameCv.width / SD, H = nameCv.height / SD;
  const P = palette();
  nx.setTransform(SD, 0, 0, SD, 0, 0);
  nx.clearRect(0, 0, W, H);
  const text = (displayName() || '').toUpperCase();
  if (!text) return;

  const serif = state.style === 'cinema' || state.style === 'post';
  let size = H * (serif ? .88 : .92);
  const font = (w) => (serif ? '900 ' : '800 ') + w.toFixed(1) + 'px ' + fontForName();
  nx.textAlign = 'center';
  nx.textBaseline = 'middle';
  nx.letterSpacing = '0px';
  let guard = 0;
  nx.font = font(size);
  let m = nx.measureText(text).width;
  const maxW = W * .99;
  while (m > maxW && guard++ < 12) {
    size *= Math.max(.55, (maxW / m) * .985);
    nx.font = font(size);
    m = nx.measureText(text).width;
  }
  if (!serif) nx.letterSpacing = (-size * .01).toFixed(1) + 'px';
  else nx.letterSpacing = (size * .01).toFixed(1) + 'px';
  nx.font = font(size);
  m = nx.measureText(text).width;

  const grad = nx.createLinearGradient(0, H * .1, 0, H * .98);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(.46, P.c1);
  grad.addColorStop(1, P.c2);

  const y = H * .54;
  nx.save();
  nx.shadowColor = rgba(P.c1, .95);
  nx.shadowBlur = size * .38;
  nx.fillStyle = grad;
  nx.fillText(text, W / 2, y);
  nx.shadowColor = rgba(P.c2, .8);
  nx.shadowBlur = size * .18;
  nx.fillText(text, W / 2, y);
  nx.restore();

  /* глитч: детерминированные срезы */
  if (state.fx.glitch && t > 0) {
    const slot = Math.floor(t / .42);
    const on = rnd(slot * 3.7) > .62;
    if (on) {
      const slices = 2;
      for (let i = 0; i < slices; i++) {
        const sy = H * (.18 + rnd(slot + i * 13.3) * .62);
        const sh = H * (.04 + rnd(slot + i * 7.7) * .07);
        const dx = (rnd(slot + i * 3.1) - .5) * size * .13;
        nx.save();
        nx.beginPath(); nx.rect(0, sy, W, sh); nx.clip();
        nx.shadowBlur = 0;
        nx.fillStyle = i % 2 ? rgba(P.c2, .5) : rgba(P.c1, .5);
        nx.globalCompositeOperation = 'screen';
        nx.fillText(text, W / 2 + dx, y);
        nx.restore();
      }
    }
  }
}

/* --------------------------- даты, QR, счётчик --------------------------- */
function fmtDate(s) {
  if (!s) return 'дата скоро';
  const p = s.split('-').map(Number);
  if (!p[0] || !p[1] || !p[2]) return 'дата скоро';
  return p[2] + ' ' + MONTHS[p[1] - 1] + ' ' + p[0];
}
function eventTime() {
  if (!state.date) return null;
  const d = new Date(state.date + 'T' + (state.time || '00:00'));
  return isNaN(d.getTime()) ? null : d;
}

function qrDataUrl(text) {
  if (typeof qrcode === 'undefined') return null;
  try {
    if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) {
      qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    }
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount(), quiet = 2, scale = 8;
    const cv = document.createElement('canvas');
    cv.width = cv.height = (n + quiet * 2) * scale;
    const g = cv.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#05060d';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) g.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
    }
    return cv.toDataURL('image/png');
  } catch (e) { return null; }
}

function qrText() {
  let dateLine = 'дата уточняется';
  if (state.date) {
    const p = state.date.split('-').map(Number);
    if (p.length === 3 && p[0] && p[1] >= 1 && p[1] <= 12) {
      const dt = new Date(p[0], p[1] - 1, p[2]);
      dateLine = p[2] + ' ' + MONTHS[p[1] - 1] + ', ' + WD[dt.getDay()];
    }
  }
  return 'ПРИГЛАШЕНИЕ НА ДЕНЬ РОЖДЕНИЯ ' + displayName().toUpperCase() + '\n' +
    'Возраст: ' + state.age + '\n' +
    dateLine + ' в ' + state.time + '\n' + state.cname + '\n' + state.caddr;
}

function sizeQr() {
  const inner = card.querySelector('.card-inner');
  if (!inner) return;
  const cs = getComputedStyle(inner);
  const content = inner.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  const cw = card.getBoundingClientRect().width;
  if (!cw || !content) return;
  let px = Math.round(Math.min(cw * .19, Math.max(content * .42, 54)));
  if (card.dataset.f === '16:9') px = Math.round(Math.min(cw * .10, Math.max(content * .24, 42)));
  else if (card.dataset.f === '1:1' || card.dataset.f === '4:5') {
    px = Math.round(Math.min(cw * .17, Math.max(content * .34, 48)));
  }
  card.style.setProperty('--qr', px + 'px');
}

function tick() {
  const el = $('oCount');
  if (!el) return;
  const target = eventTime();
  if (!target) { el.textContent = 'СКОРО'; el.classList.remove('urgent'); return; }
  const diff = target - new Date();
  if (diff <= 0) { el.textContent = 'ПОРТАЛ ОТКРЫТ'; el.classList.add('urgent'); return; }
  el.classList.remove('urgent');
  const d = Math.max(1, Math.ceil(diff / 864e5));
  el.textContent = d + ' ' + plural(d, 'день', 'дня', 'дней');
  if (diff < 36e5) el.classList.add('urgent');
}

/* --------------------------- рендер ------------------------------------- */
function titleText() {
  const wide = state.fmt === '16:9';
  if (state.style === 'cinema') return wide ? 'ПРЕМЬЕРА' : 'ПРИГЛАШЕНИЕ НА ПРЕМЬЕРУ';
  if (state.style === 'post') return wide ? 'СНОВИДЕНИЕ' : 'ПРИГЛАШЕНИЕ НА ДЕНЬ РОЖДЕНИЯ';
  return wide ? 'ДЕНЬ РОЖДЕНИЯ' : 'ПРИГЛАШЕНИЕ НА ДЕНЬ РОЖДЕНИЯ';
}

function render() {
  const P = palette();
  document.documentElement.style.setProperty('--c1', P.c1);
  document.documentElement.style.setProperty('--c2', P.c2);
  document.documentElement.style.setProperty('--c3', P.c3);
  document.documentElement.style.setProperty('--bg', P.bg);

  card.dataset.s = state.style;
  card.dataset.f = state.fmt;

  $('oTitle').textContent = titleText();
  $('k1').textContent = state.style === 'cinema' ? 'ДАТА' : 'КОГДА';
  $('k2').textContent = state.style === 'cinema' ? 'СЕАНС' : 'ВРЕМЯ';
  $('k3').textContent = state.style === 'cinema' ? 'ТЕАТР' : 'ГДЕ';
  $('oCountLbl').textContent = state.style === 'cinema' ? 'ДО НАЧАЛА ПОКАЗА' : 'ДО ПРАЗДНИКА';
  $('oFootKey').textContent = state.style === 'cinema' ? 'ПОКАЖИ БИЛЕТ НА ВХОДЕ'
    : state.style === 'post' ? 'СКАНИРУЙ, ЧТОБЫ ЗАПИСАТЬСЯ'
      : state.fmt === '16:9' ? 'ВХОД ПО QR' : 'СКАНИРУЙ ДЛЯ ВХОДА';
  $('oFootSub').textContent = 'подтверди присутствие до старта';
  $('oRec').textContent = state.style === 'cinema' ? '★ PREMIERE'
    : state.style === 'post' ? '❄ SNOW PARTY' : '● REC';
  $('oBrandSub').textContent = 'VR CLUB • KEMEROVO';
  $('oDate').textContent = state.fmt === '16:9'
    ? fmtDate(state.date) + ' • ' + state.time
    : fmtDate(state.date);
  $('oTime').textContent = state.time;
  $('oAddr').textContent = state.caddr;
  const gh = $('genHint');
  if (gh) gh.textContent = state.genitive
    ? 'В заголовке: «' + displayName() + '»'
    : 'Имя без склонения';

  const club = $('oClub');
  club.textContent = state.cname;
  const small = document.createElement('small');
  small.textContent = state.caddr;
  club.appendChild(small);

  const lvl = $('oLevel');
  lvl.textContent = state.style === 'cinema'
    ? ((state.fmt === '16:9' || state.fmt === '1:1') ? 'РЕЙТИНГ ' : 'ВОЗРАСТНОЙ РЕЙТИНГ ')
    : state.style === 'post' ? 'ИСПОЛНЯЕТСЯ ' : 'УРОВЕНЬ ';
  const b = document.createElement('b');
  b.textContent = state.style === 'cinema' ? state.age + '+' : String(state.age);
  lvl.appendChild(b);

  const ph = avPh;
  if (state.av === 'snow') {
    ph.textContent = '❆';
    ph.classList.add('snow');
  } else {
    ph.textContent = initials(state.name);
    ph.classList.remove('snow');
  }

  const src = state.photo;
  if (src) {
    if (avImg.getAttribute('src') !== src) avImg.setAttribute('src', src);
    avImg.classList.add('on');
  } else {
    avImg.classList.remove('on');
    avImg.removeAttribute('src');
  }

  portalEl.style.display = state.fx.portal ? '' : 'none';
  const bootEl = $('boot');
  bootEl.style.display = state.fx.boot ? '' : 'none';

  const qrImg = $('qrImg');
  const local = qrDataUrl(qrText());
  if (local && qrImg.getAttribute('src') !== local) {
    qrImg.setAttribute('src', local);
    qrImg.style.display = '';
    $('qrPh').style.display = 'none';
  }

  sizeQr();
  tick();
  rebuildBgPrep();
  drawName(sceneT);
  drawScene(sceneT);
  syncControls();
  writeHashNow();
  scheduleSave();
}

function initials(name) {
  const p = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return 'VR';
  if (p.length === 1) {
    const w = p[0];
    return (w[0] + (w[1] || '')).toUpperCase();
  }
  return (p[0][0] + p[1][0]).toUpperCase();
}

/* --------------------- родительный падеж имени --------------------------- */
const GEN_EXC = {
  'павел': 'павла', 'лев': 'льва', 'пётр': 'петра', 'петр': 'петра',
  'любовь': 'любови', 'нинель': 'нинели', 'адель': 'адели', 'рахиль': 'рахили',
  'эсфирь': 'эсфири', 'руфь': 'руфи', 'юдифь': 'юдифи', 'мишель': 'мишели',
  'никита': 'никиты', 'илья': 'ильи', 'кузьма': 'кузьмы', 'фома': 'фомы',
  'данила': 'данилы', 'лука': 'луки', 'савва': 'саввы'
};
function keepCase(orig, lower) {
  if (!orig) return lower;
  return orig[0] === orig[0].toUpperCase() ? lower[0].toUpperCase() + lower.slice(1) : lower;
}
function declineWord(w) {
  if (!w) return w;
  const low = w.toLowerCase();
  if (GEN_EXC[low]) return keepCase(w, GEN_EXC[low]);
  if (/[ьй]$/i.test(w)) return w.slice(0, -1) + 'я';       /* Арсений → Арсения, Игорь → Игоря */
  if (/[ая]$/i.test(w)) {
    if (/ия$/i.test(w)) return w.slice(0, -1) + 'и';       /* Мария → Марии */
    if (/[гкхжшчщ]а$/i.test(w)) return w.slice(0, -1) + 'и'; /* Ольга → Ольги, Саша → Саши */
    if (/а$/i.test(w)) return w.slice(0, -1) + 'ы';        /* Анна → Анны */
    return w.slice(0, -1) + 'и';                            /* Аня → Ани, Юля → Юли */
  }
  if (/[бвгджзклмнпрстфхцчшщ]$/i.test(w)) return w + 'а';  /* Артём → Артёма */
  return w;                                                 /* Лео, Николь, -о/-е/-и/-у */
}
function genitive(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean).map(part =>
    part.split('-').map(declineWord).join('-')
  ).join(' ');
}
function displayName() {
  return state.genitive ? genitive(state.name) : state.name;
}

let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 350);
}
let hashTimer = null;
function writeHashNow() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    try { history.replaceState(null, '', buildHash(false)); } catch (e) { }
  }, 300);
}

/* --------------------------- UI ----------------------------------------- */
function buildControls() {
  const clubs = $('clubs');
  clubs.innerHTML = '';
  CLUBS.forEach((c, i) => {
    const l = document.createElement('label');
    l.className = 'club';
    const inp = document.createElement('input');
    inp.type = 'radio'; inp.name = 'club'; inp.value = String(i);
    if (i === state.club) inp.checked = true;
    const dot = document.createElement('span'); dot.className = 'dot';
    const txt = document.createElement('span'); txt.className = 'txt';
    txt.textContent = c.label;
    const sm = document.createElement('small'); sm.textContent = 'Кемерово';
    txt.appendChild(sm);
    l.append(inp, dot, txt);
    inp.addEventListener('change', () => {
      state.club = i;
      $('inClubName').value = CLUBS[i].name;
      $('inClubAddr').value = CLUBS[i].addr;
      collect();
      render();
    });
    clubs.appendChild(l);
  });

  const th = $('themes');
  th.innerHTML = '';
  Object.keys(PALETTES).forEach(key => {
    const p = PALETTES[key];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'th';
    b.dataset.th = key;
    b.title = p.n;
    b.setAttribute('aria-label', 'Палитра ' + p.n);
    b.setAttribute('aria-pressed', state.custom ? 'false' : String(state.theme === key));
    b.style.background = 'linear-gradient(92deg,' + p.c1 + ',' + p.c2 + ' 55%,' + p.c3 + ')';
    if (state.custom) b.classList.add('dim');
    b.addEventListener('click', () => {
      state.theme = key;
      state.custom = null;
      $('inC1').value = p.c1;
      $('inC2').value = p.c2;
      collect();
      render();
    });
    th.appendChild(b);
  });

  const mode = $('inMode');
  mode.innerHTML = '';
  Object.keys(MODES).forEach(k => {
    const o = document.createElement('option');
    o.value = k; o.textContent = MODES[k];
    mode.appendChild(o);
  });

  $('inC1').addEventListener('input', onCustomColor);
  $('inC2').addEventListener('input', onCustomColor);
  $('btnColorsAuto').addEventListener('click', () => {
    state.custom = null;
    const p = PALETTES[state.theme] || PALETTES.neon;
    $('inC1').value = p.c1;
    $('inC2').value = p.c2;
    collect(); render();
  });
}

function onCustomColor() {
  const c1 = $('inC1').value, c2 = $('inC2').value;
  if (!HEX.test(c1) || !HEX.test(c2)) return;
  state.custom = { c1, c2 };
  collect(); render();
}

function setRadio(name, value) {
  const el = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
  if (el) el.checked = true;
}

function syncControls() {
  setRadio('club', String(state.club));
  setRadio('st', state.style);
  setRadio('fm', state.fmt);
  setRadio('av', state.av);
  setRadio('bgp', state.preset);
  $('inMode').value = state.fx.mode;
  $('swAurora').checked = !!state.fx.aurora;
  $('swGrid').checked = !!state.fx.grid;
  $('swScan').checked = !!state.fx.scan;
  $('swVignette').checked = !!state.fx.vignette;
  $('swGlitch').checked = !!state.fx.glitch;
  $('swPortal').checked = !!state.fx.portal;
  $('swBoot').checked = !!state.fx.boot;
  $('swSound').checked = !!state.fx.sound;
  $('swGen').checked = !!state.genitive;
  $('swGlass').checked = state.glass > 0;
  $('inGlass').value = String(state.glass);
  $('bgFileWrap').classList.toggle('off', state.preset !== 'photo' && !state.bg);
  document.querySelectorAll('.th').forEach(b => {
    b.setAttribute('aria-pressed', String(!state.custom && b.dataset.th === state.theme));
    b.classList.toggle('dim', !!state.custom);
  });
  if (!state.custom) {
    const p = PALETTES[state.theme] || PALETTES.neon;
    if (document.activeElement !== $('inC1')) $('inC1').value = p.c1;
    if (document.activeElement !== $('inC2')) $('inC2').value = p.c2;
  }
}

function syncUI() {
  syncControls();
  $('inName').value = state.name;
  $('inAge').value = state.age;
  $('inDate').value = state.date;
  $('inTime').value = state.time;
  $('inClubName').value = state.cname;
  $('inClubAddr').value = state.caddr;
}

function collect() {
  state.name = ($('inName').value || '').trim().slice(0, 18) || 'ИГРОК';
  state.age = clamp(parseInt($('inAge').value, 10) || 1, 1, 99);
  state.date = $('inDate').value || state.date;
  state.time = $('inTime').value || '17:00';
  const club = document.querySelector('input[name="club"]:checked');
  if (club) state.club = +club.value;
  state.cname = ($('inClubName').value || '').trim() || CLUBS[state.club].name;
  state.caddr = ($('inClubAddr').value || '').trim() || CLUBS[state.club].addr;
  const st = document.querySelector('input[name="st"]:checked');
  if (st) state.style = st.value;
  const fm = document.querySelector('input[name="fm"]:checked');
  if (fm) state.fmt = fm.value;
  const av = document.querySelector('input[name="av"]:checked');
  if (av) state.av = av.value;
  const bgp = document.querySelector('input[name="bgp"]:checked');
  if (bgp) state.preset = bgp.value;
  state.genitive = $('swGen').checked;
  state.glass = $('swGlass').checked ? clamp(parseInt($('inGlass').value, 10) || 55, 5, 100) : 0;
  state.fx.mode = $('inMode').value;
  state.fx.aurora = $('swAurora').checked ? 1 : 0;
  state.fx.grid = $('swGrid').checked ? 1 : 0;
  state.fx.scan = $('swScan').checked ? 1 : 0;
  state.fx.vignette = $('swVignette').checked ? 1 : 0;
  state.fx.glitch = $('swGlitch').checked ? 1 : 0;
  state.fx.portal = $('swPortal').checked ? 1 : 0;
  state.fx.boot = $('swBoot').checked ? 1 : 0;
  state.fx.sound = $('swSound').checked ? 1 : 0;
}

/* --------------------------- терминал ----------------------------------- */
let bootTimer = null;
function bootSequence() {
  clearInterval(bootTimer);
  const box = $('bootTxt');
  if (!box) return;
  if (!state.fx.boot) { box.textContent = ''; return; }
  const cin = state.style === 'cinema', post = state.style === 'post';
  const lines = cin ? [
    '> PROJECTION SYSTEM...',
    '> GUEST: ' + state.name.toUpperCase(),
    '> RATING: ' + state.age + '+',
    '> THEATRE: ' + CLUBS[state.club].label,
    '> SEAT RESERVED ✓'
  ] : post ? [
    '> SNOW SYSTEM...',
    '> GUEST: ' + state.name.toUpperCase(),
    '> AGE: ' + state.age,
    '> WEATHER: SNOW ✓',
    '> INVITE READY ✓'
  ] : [
    '> SYSTEM BOOT...',
    '> PLAYER: ' + state.name.toUpperCase(),
    '> LEVEL: ' + state.age,
    '> LOCATION: ' + CLUBS[state.club].label,
    '> PORTAL READY: OK'
  ];
  let li = 0, ci = 0;
  box.textContent = '';
  bootTimer = setInterval(() => {
    if (li >= lines.length) {
      clearInterval(bootTimer);
      box.textContent = lines.join('\n');
      return;
    }
    const line = lines[li];
    if (ci <= line.length) {
      const done = lines.slice(0, li).join('\n');
      box.textContent = (done ? done + '\n' : '') + line.slice(0, ci);
      ci++;
    } else { li++; ci = 0; }
  }, 22);
}

/* --------------------------- звук --------------------------------------- */
function beep() {
  if (!state.fx.sound) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ac = new AC();
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      const at = ac.currentTime + i * .09;
      g.gain.setValueAtTime(.0001, at);
      g.gain.exponentialRampToValueAtTime(.2, at + .02);
      g.gain.exponentialRampToValueAtTime(.0001, at + .3);
      o.connect(g); g.connect(ac.destination);
      o.start(at); o.stop(at + .32);
    });
    setTimeout(() => ac.close(), 1400);
  } catch (e) { }
}

/* --------------------------- фото --------------------------------------- */
function handlePhoto(file) {
  if (!file) { state.photo = ''; render(); return; }
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 900;
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(img.width * k));
      cv.height = Math.max(1, Math.round(img.height * k));
      const g = cv.getContext('2d');
      g.drawImage(img, 0, 0, cv.width, cv.height);
      try { state.photo = cv.toDataURL('image/jpeg', .9); } catch (e) { state.photo = ''; }
      render();
    };
    img.onerror = () => { state.photo = ''; render(); toast('Не удалось прочитать фото', true); };
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
}

/* --------------------------- инициализация ------------------------------ */
function init() {
  const hashState = readHash();
  const saved = loadSaved();
  if (hashState) state = normalize(hashState);
  else if (saved) state = saved;
  else state = defaultState();

  if (!state.date) state.date = defaultDate();
  if (saved && saved.photo && !state.photo) state.photo = saved.photo;
  try {
    const ph = localStorage.getItem(PKEY);
    if (ph && !state.photo) state.photo = ph;
    const b = localStorage.getItem(BKEY);
    if (b && b.startsWith('data:image/')) state.bg = b;
  } catch (e) { }

  /* отладочные/сервисные параметры в адресной строке */
  const qp = new URLSearchParams(location.search);
  if (qp.has('fmt') && FORMATS[qp.get('fmt')]) state.fmt = qp.get('fmt');
  if (qp.has('style') && ['cyber', 'cinema', 'post'].includes(qp.get('style'))) state.style = qp.get('style');
  if (qp.has('theme') && PALETTES[qp.get('theme')]) { state.theme = qp.get('theme'); state.custom = null; }
  if (qp.has('mode') && MODES[qp.get('mode')]) state.fx.mode = qp.get('mode');
  if (qp.has('preset') && ['aurora', 'cosmos', 'sunset', 'photo'].includes(qp.get('preset'))) state.preset = qp.get('preset');
  if (qp.has('name')) state.name = qp.get('name').slice(0, 18);
  if (qp.has('photo')) state.photo = qp.get('photo');

  const isView = !!(hashState && hashState.view);
  if (isView) document.body.classList.add('view');

  buildControls();
  syncUI();
  render();
  resizeScene();
  if (state.bg) setBgImage(state.bg);
  bootSequence();
  bindUI();

  const starts = [
    document.fonts.load('800 40px Unbounded'),
    document.fonts.load('900 40px "Playfair Display"'),
    document.fonts.load('400 16px "JetBrains Mono"'),
    document.fonts.load('400 16px "Exo 2"')
  ];
  Promise.allSettled(starts).then(() => {
    resizeScene();
    render();
  });

  requestAnimationFrame(loop);
  setInterval(tick, 1000);  window.addEventListener('resize', () => { resizeScene(); sizeQr(); });
  if (window.ResizeObserver) {
    new ResizeObserver(() => {
      if (captureMode) return;
      resizeScene(); sizeQr();
    }).observe(card);
  }

  /* заставка */
  const splash = $('splash');
  if (new URLSearchParams(location.search).has('nosplash')) {
    splash.remove();
  } else {
    const hideSplash = () => splash.classList.add('off');
    splash.addEventListener('click', hideSplash);
    setTimeout(hideSplash, 1500);
  }
}

let lastQi = -1, lastT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  if (captureMode) return;
  if (document.hidden) return;
  const t = (now - (loop.t0 || (loop.t0 = now))) / 1000;
  sceneT = t;
  const qi = Math.floor(t * 8);
  if (qi !== lastQi) { lastQi = qi; drawName(t); }
  drawScene(t);
}

/* --------------------------- привязка UI -------------------------------- */
function bindUI() {
  const onInput = () => { collect(); render(); };
  ['inName', 'inAge', 'inDate', 'inTime', 'inClubName', 'inClubAddr'].forEach(id => {
    $(id).addEventListener('input', onInput);
    $(id).addEventListener('change', onInput);
  });
  document.querySelectorAll('input[name="st"]').forEach(r => r.addEventListener('change', () => {
    const st = document.querySelector('input[name="st"]:checked');
    if (!st) return;
    state.style = st.value;
    if (!state.custom) {
      state.theme = STYLE_PALETTE[state.style] || 'neon';
      const p = PALETTES[state.theme];
      $('inC1').value = p.c1; $('inC2').value = p.c2;
    }
    state.fx.mode = state.style === 'cinema' ? 'sparks' : state.style === 'post' ? 'snow' : 'matrix';
    $('inMode').value = state.fx.mode;
    collect(); render(); bootSequence();
  }));
  document.querySelectorAll('input[name="fm"]').forEach(r => r.addEventListener('change', () => {
    collect(); render();
    setTimeout(() => { resizeScene(); sizeQr(); }, 60);
  }));
  document.querySelectorAll('input[name="av"]').forEach(r => r.addEventListener('change', () => {
    collect(); render();
  }));
  document.querySelectorAll('input[name="bgp"]').forEach(r => r.addEventListener('change', () => {
    collect();
    if (state.preset === 'photo' && !state.bg) toast('Нажмите «Своя картинка» и выберите фото');
    render();
  }));
  ['inMode', 'swAurora', 'swGrid', 'swScan', 'swVignette', 'swGlitch', 'swPortal', 'swBoot', 'swSound', 'swGen']
    .forEach(id => $(id).addEventListener('change', () => {
      collect(); render();
      if (id === 'swBoot') bootSequence();
    }));
  $('inGlass').addEventListener('input', () => { collect(); render(); });
  $('swGlass').addEventListener('change', () => { collect(); render(); });
  $('inBg').addEventListener('change', e => handleBg(e.target.files && e.target.files[0]));
  $('btnBgClear').addEventListener('click', () => {
    state.bg = '';
    state.preset = 'aurora';
    setBgImage('');
    $('inBg').value = '';
    collect(); render();
    toast('Фон убран');
  });
  $('inPhoto').addEventListener('change', e => handlePhoto(e.target.files && e.target.files[0]));
  $('inPhoto').addEventListener('dragstart', e => e.preventDefault());
  $('btnReset').addEventListener('click', () => {
    state = defaultState();
    $('inC1').value = PALETTES.neon.c1; $('inC2').value = PALETTES.neon.c2;
    setBgImage('');
    syncUI(); render(); bootSequence(); resizeScene();
    toast('Настройки сброшены');
  });
}

/* --------------------------- фоновое фото -------------------------------- */
function handleBg(file) {
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 1600;
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(img.width * k));
      cv.height = Math.max(1, Math.round(img.height * k));
      const g = cv.getContext('2d');
      g.drawImage(img, 0, 0, cv.width, cv.height);
      try { state.bg = cv.toDataURL('image/jpeg', .86); } catch (e) { state.bg = ''; }
      state.preset = 'photo';
      setBgImage(state.bg);
      render();
      toast('Фон установлен — эффект стекла включён');
    };
    img.onerror = () => toast('Не удалось прочитать картинку', true);
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
}
