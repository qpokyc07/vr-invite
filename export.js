'use strict';
/* ============================================================================
   VR INVITE ENGINE — экспорт: PNG / GIF / ВИДЕО, шаринг, заставка
   ========================================================================== */

/* ------------------------- подготовка холста ---------------------------- */
const CQ_PROPS = ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'font-size', 'line-height', 'letter-spacing', 'word-spacing', 'text-indent',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'top', 'right', 'bottom', 'left', 'border-top-width', 'border-right-width',
  'border-bottom-width', 'border-left-width', 'border-radius',
  'gap', 'row-gap', 'column-gap'];

function flattenCq(root) {
  const undo = [];
  [root].concat(Array.from(root.querySelectorAll('*'))).forEach(el => {
    if (!(el instanceof HTMLElement) && !(el instanceof HTMLCanvasElement)) return;
    const before = el.style.cssText;
    const cs = getComputedStyle(el);
    let touched = false;
    for (const p of CQ_PROPS) {
      const v = cs.getPropertyValue(p);
      if (!v || v === 'auto' || v === 'none') continue;
      el.style.setProperty(p, v);
      touched = true;
    }
    if (touched) undo.push([el, before]);
  });
  return () => { for (const [el, before] of undo) el.style.cssText = before; };
}

function copyCanvases(doc) {
  ['bg', 'ringcv', 'nameCv'].forEach(id => {
    const src = document.getElementById(id);
    const dst = doc.getElementById(id);
    if (!src || !dst || !src.width) return;
    dst.width = src.width;
    dst.height = src.height;
    try {
      const g = dst.getContext('2d');
      g.clearRect(0, 0, dst.width, dst.height);
      g.drawImage(src, 0, 0);
    } catch (e) { }
  });
}

async function withCapture(w, h, fn) {
  const prev = {
    width: card.style.width, height: card.style.height, aspect: card.style.aspectRatio,
    position: card.style.position, left: card.style.left, top: card.style.top, zIndex: card.style.zIndex
  };
  captureMode = true;
  document.body.classList.add('capturing');
  card.style.position = 'fixed';
  card.style.left = '0';
  card.style.top = '0';
  card.style.zIndex = '1';
  card.style.width = w + 'px';
  card.style.height = h + 'px';
  card.style.aspectRatio = 'auto';
  card.style.setProperty('--gps', 'paused');
  try { await document.fonts.ready; } catch (e) { }
  resizeScene();
  sizeQr();
  const undo = flattenCq(card);
  try {
    return await fn(w, h);
  } finally {
    undo();
    card.style.width = prev.width; card.style.height = prev.height;
    card.style.aspectRatio = prev.aspect; card.style.position = prev.position;
    card.style.left = prev.left; card.style.top = prev.top; card.style.zIndex = prev.zIndex;
    card.style.removeProperty('--gps');
    card.style.removeProperty('--gd');
    document.body.classList.remove('capturing');
    captureMode = false;
    resizeScene();
    render();
  }
}

async function captureFrame(w, h, t) {
  card.style.setProperty('--gd', (-t).toFixed(3) + 's');
  drawScene(t);
  drawName(t);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  return await html2canvas(card, {
    backgroundColor: null,
    width: w, height: h,
    scale: 1,
    useCORS: true,
    logging: false,
    onclone: copyCanvases
  });
}

const toBlob = (cv, type, q) => new Promise(res => cv.toBlob(res, type, q === undefined ? .92 : q));
const toBitmap = async blob => { try { return await createImageBitmap(blob); } catch (e) { return null; } };

function downloadBlob(blob, name) {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

/* ------------------------------ прогресс -------------------------------- */
let pgCancel = false;
function pgOpen(title, note) {
  pgCancel = false;
  $('progress').classList.add('on');
  $('pgTitle').textContent = title;
  $('pgSub').textContent = 'подготовка…';
  $('pgNote').textContent = note || 'Рендер идёт локально: браузер рисует карточку в 1080p. Ничего не отправляется в сеть.';
  $('pgBar').style.width = '0%';
  $('pgPct').textContent = '0%';
}
function pgSet(p, sub) {
  const v = Math.max(0, Math.min(100, Math.round(p)));
  $('pgBar').style.width = v + '%';
  $('pgPct').textContent = v + '%';
  if (sub) $('pgSub').textContent = sub;
}
function pgClose() {
  $('progress').classList.remove('on');
}
$('pgCancel').addEventListener('click', () => { pgCancel = true; });

/* -------------------------------- PNG ----------------------------------- */
async function exportPng() {
  const w = FORMATS[state.fmt][0], h = FORMATS[state.fmt][1];
  pgOpen('PNG ' + w + '×' + h);
  try {
    pgSet(10, 'рендер кадра');
    const cv = await withCapture(w, h, () => captureFrame(w, h, 2.4));
    pgSet(85, 'кодирование');
    const blob = await toBlob(cv, 'image/png', 1);
    downloadBlob(blob, 'vr-invite-' + slug(state.name) + '-' + state.fmt.replace(':', 'x') + '.png');
    pgSet(100, 'готово');
    toast('PNG ' + w + '×' + h + ' сохранён в «Загрузки»');
  } catch (e) {
    if (!pgCancel) toast('Не удалось создать PNG: ' + (e && e.message || e), true);
  } finally { pgClose(); }
}

/* -------------------------------- GIF ----------------------------------- */
function medianCut(samples, maxColors) {
  const n = samples.length / 3;
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  const bounds = (lo, hi) => {
    let rmin = 255, rmax = 0, gmin = 255, gmax = 0, bmin = 255, bmax = 0;
    for (let i = lo; i < hi; i++) {
      const p = order[i] * 3, r = samples[p], g = samples[p + 1], b = samples[p + 2];
      if (r < rmin) rmin = r; if (r > rmax) rmax = r;
      if (g < gmin) gmin = g; if (g > gmax) gmax = g;
      if (b < bmin) bmin = b; if (b > bmax) bmax = b;
    }
    return { lo, hi, rmin, rmax, gmin, gmax, bmin, bmax };
  };
  const boxes = [bounds(0, n)];
  const mk = (lo, hi) => bounds(lo, hi);
  while (boxes.length < maxColors) {
    let bi = -1, best = -1;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (b.hi - b.lo < 2) continue;
      const r = Math.max(b.rmax - b.rmin, b.gmax - b.gmin, b.bmax - b.bmin);
      if (r > best) { best = r; bi = i; }
    }
    if (bi < 0) break;
    const b = boxes[bi];
    const rg = [b.rmax - b.rmin, b.gmax - b.gmin, b.bmax - b.bmin];
    const ch = rg[0] >= rg[1] ? (rg[0] >= rg[2] ? 0 : 2) : (rg[1] >= rg[2] ? 1 : 2);
    const sub = Array.prototype.slice.call(order, b.lo, b.hi);
    sub.sort((x, y) => samples[x * 3 + ch] - samples[y * 3 + ch]);
    order.set(sub, b.lo);
    const mid = (b.lo + b.hi) >> 1;
    boxes.splice(bi, 1, mk(b.lo, mid), mk(mid, b.hi));
  }
  const pal = new Uint8Array(768);
  boxes.forEach((b, i) => {
    let r = 0, g = 0, bl = 0;
    const c = b.hi - b.lo || 1;
    for (let k = b.lo; k < b.hi; k++) {
      const p = order[k] * 3;
      r += samples[p]; g += samples[p + 1]; bl += samples[p + 2];
    }
    pal[i * 3] = Math.round(r / c);
    pal[i * 3 + 1] = Math.round(g / c);
    pal[i * 3 + 2] = Math.round(bl / c);
  });
  return { pal, count: boxes.length };
}

/* 15-битный LUT «цвет → индекс палитры» */
function buildLut(pal, count) {
  const lut = new Uint8Array(32768);
  for (let k = 0; k < 32768; k++) {
    const r = ((k >> 10) & 31) * 8 + 4, g = ((k >> 5) & 31) * 8 + 4, b = (k & 31) * 8 + 4;
    let best = 0, bd = 1e9;
    for (let i = 0; i < count; i++) {
      const p = i * 3;
      const dr = r - pal[p], dg = g - pal[p + 1], db = b - pal[p + 2];
      const d = dr * dr * .3 + dg * dg * .59 + db * db * .11;
      if (d < bd) { bd = d; best = i; }
    }
    lut[k] = best;
  }
  return lut;
}

/* квантование с дизерингом Флойда–Стейнберга */
function quantizeFrame(rgba, w, h, pal, count, lut) {
  const out = new Uint8Array(w * h);
  const cur = new Float32Array((w + 2) * 3);
  const nxt = new Float32Array((w + 2) * 3);
  const add = (buf, x, r, g, b) => {
    const i = (x + 1) * 3;
    buf[i] += r; buf[i + 1] += g; buf[i + 2] += b;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      const ei = (x + 1) * 3;
      let r = rgba[si] + cur[ei], g = rgba[si + 1] + cur[ei + 1], b = rgba[si + 2] + cur[ei + 2];
      r = r < 0 ? 0 : r > 255 ? 255 : r;
      g = g < 0 ? 0 : g > 255 ? 255 : g;
      b = b < 0 ? 0 : b > 255 ? 255 : b;
      const idx = lut[(((r | 0) >> 3) << 10) | (((g | 0) >> 3) << 5) | ((b | 0) >> 3)];
      out[y * w + x] = idx;
      const pi = idx * 3;
      const er = (r - pal[pi]) * .72, eg = (g - pal[pi + 1]) * .72, eb = (b - pal[pi + 2]) * .72;
      add(cur, x + 1, er * 7 / 16, eg * 7 / 16, eb * 7 / 16);
      add(nxt, x - 1, er * 3 / 16, eg * 3 / 16, eb * 3 / 16);
      add(nxt, x, er * 5 / 16, eg * 5 / 16, eb * 5 / 16);
      add(nxt, x + 1, er * 1 / 16, eg * 1 / 16, eb * 1 / 16);
    }
    cur.set(nxt);
    nxt.fill(0);
  }
  return out;
}

const _lzGen = new Int32Array(131072), _lzVal = new Int32Array(131072);
let _lzStamp = 0;
function gifLzw(idx) {
  const out = [];
  let cur = 0, bits = 0;
  const put = c => {
    cur |= c << bits; bits += 9;
    while (bits >= 8) { out.push(cur & 255); cur >>= 8; bits -= 8; }
  };
  let gen = ++_lzStamp, next = 258;
  put(256);
  let prefix = idx[0];
  for (let i = 1; i < idx.length; i++) {
    const k = idx[i], key = (prefix << 8) | k;
    if (_lzGen[key] === gen) { prefix = _lzVal[key]; continue; }
    put(prefix);
    _lzGen[key] = gen; _lzVal[key] = next; next++;
    if (next >= 511) { put(256); gen = ++_lzStamp; next = 258; }
    prefix = k;
  }
  put(prefix); put(257);
  if (bits > 0) out.push(cur & 255);
  return out;
}

/* GIF с локальными палитрами для каждого кадра — заметно меньше «ступенек» */
function gifBuild(frames, palettes, w, h, delay) {
  const chunks = [];
  const head = new Uint8Array(13 + 768);
  head.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, w & 255, (w >> 8) & 255, h & 255, (h >> 8) & 255, 0xF7, 0, 0]);
  head.set(palettes[0], 13);
  chunks.push(head);
  chunks.push(new Uint8Array([0x21, 0xFF, 0x0B, 0x4E, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45,
    0x32, 0x2E, 0x30, 0x03, 0x01, 0x00, 0x00, 0x00]));
  frames.forEach((idx, i) => {
    const d = Math.max(2, delay[i] || 6);
    chunks.push(new Uint8Array([0x21, 0xF9, 0x04, 0x04, d & 255, (d >> 8) & 255, 0x00, 0x00]));
    chunks.push(new Uint8Array([0x2C, 0, 0, 0, 0, w & 255, (w >> 8) & 255, h & 255, (h >> 8) & 255, 0x87]));
    chunks.push(palettes[i] || palettes[0]);
    chunks.push(new Uint8Array([0x08]));
    const data = Uint8Array.from(gifLzw(idx));
    for (let p = 0; p < data.length;) {
      const n = Math.min(255, data.length - p);
      const b = new Uint8Array(n + 1);
      b[0] = n;
      b.set(data.subarray(p, p + n), 1);
      chunks.push(b); p += n;
    }
    chunks.push(new Uint8Array([0x00]));
  });
  chunks.push(new Uint8Array([0x3B]));
  let total = 0;
  chunks.forEach(c => total += c.length);
  const out = new Uint8Array(total);
  let o = 0;
  chunks.forEach(c => { out.set(c, o); o += c.length; });
  return out;
}

function framePalette(cv, W, H) {
  const d = cv.getContext('2d').getImageData(0, 0, W, H).data;
  const samples = [];
  const step = Math.max(1, Math.round((W * H) / 22000));
  for (let k = 0; k < W * H; k += step) samples.push(d[k * 4], d[k * 4 + 1], d[k * 4 + 2]);
  const { pal, count } = medianCut(new Uint8Array(samples), 256);
  return { pal, count };
}

async function exportGif() {
  const ratio = FORMATS[state.fmt][1] / FORMATS[state.fmt][0];
  const W = 600;
  const H = Math.round(W * ratio / 2) * 2;
  const N = 48, FPS = 16.67;
  pgOpen('GIF ' + W + '×' + H, '48 кадров, у каждого своя палитра 256 цветов + дизеринг — градиенты гладкие.');
  const canvases = [];
  try {
    await withCapture(W, H, async () => {
      for (let i = 0; i < N; i++) {
        if (pgCancel) throw new Error('cancelled');
        const cv = await captureFrame(W, H, i / FPS);
        canvases.push(cv);
        pgSet((i + 1) / N * 55, 'кадр ' + (i + 1) + '/' + N);
      }
    });
    if (pgCancel) throw new Error('cancelled');

    const frames = [];
    const palettes = [];
    for (let i = 0; i < canvases.length; i++) {
      if (pgCancel) throw new Error('cancelled');
      const { pal, count } = framePalette(canvases[i], W, H);
      const lut = buildLut(pal, count);
      const d = canvases[i].getContext('2d').getImageData(0, 0, W, H).data;
      frames.push(quantizeFrame(d, W, H, pal, count, lut));
      palettes.push(pal);
      canvases[i] = null;
      pgSet(56 + (i / N) * 38, 'сжатие ' + (i + 1) + '/' + N);
      if (i % 3 === 0) await sleep(0);
    }
    pgSet(95, 'сборка файла');
    await sleep(16);
    const delay = new Array(frames.length).fill(6);
    const bytes = gifBuild(frames, palettes, W, H, delay);
    downloadBlob(new Blob([bytes], { type: 'image/gif' }),
      'vr-invite-' + slug(state.name) + '-' + state.fmt.replace(':', 'x') + '.gif');
    pgSet(100, 'готово · ' + (bytes.length / 1048576).toFixed(1) + ' МБ');
    toast('GIF сохранён (' + (bytes.length / 1048576).toFixed(1) + ' МБ)');
  } catch (e) {
    if (!pgCancel) toast('Не удалось создать GIF: ' + (e && e.message || e), true);
  } finally { pgClose(); }
}

/* ------------------------------- ВИДЕО ---------------------------------- */
function pickVideoMime() {
  const list = [
    'video/mp4;codecs=avc1.4d002a',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ];
  for (const m of list) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) { }
  }
  return '';
}

async function exportVideo() {
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
    toast('Этот браузер не умеет записывать видео', true);
    return;
  }
  const w = FORMATS[state.fmt][0], h = FORMATS[state.fmt][1];
  const fps = 25, sec = 5, N = fps * sec;
  pgOpen('ВИДЕО ' + w + '×' + h, 'Кадры рендерятся в полном разрешении и затем записываются в реальном времени. Это честные 1080p, а не растянутая картинка.');
  const shots = [];
  try {
    captureVeil = t => Math.max(0, 1 - t / .8) + Math.max(0, (t - (sec - .55)) / .55);
    await withCapture(w, h, async () => {
      for (let i = 0; i < N; i++) {
        if (pgCancel) throw new Error('cancelled');
        const cv = await captureFrame(w, h, i / fps);
        shots.push(await toBlob(cv, 'image/jpeg', .94));
        pgSet((i + 1) / N * 72, 'рендер кадра ' + (i + 1) + '/' + N);
      }
    });
    if (pgCancel) throw new Error('cancelled');

    const mime = pickVideoMime();
    if (!mime) throw new Error('кодек MP4/WebM недоступен');
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { alpha: false });
    const stream = cv.captureStream(0);
    const track = stream.getVideoTracks()[0];
    const bitrate = Math.round(w * h * fps * .18);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise(res => rec.onstop = res);

    const bitmaps = new Array(N).fill(null);
    async function warm(from) {
      for (let k = from; k < Math.min(from + 6, N); k++) {
        if (!bitmaps[k] && !pgCancel) bitmaps[k] = await toBitmap(shots[k]);
      }
    }
    await warm(0);
    rec.start();
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      if (pgCancel) break;
      const bmp = bitmaps[i] || await toBitmap(shots[i]);
      const due = t0 + i * 1000 / fps;
      const wait = due - performance.now();
      if (wait > 0) await sleep(wait);
      ctx.drawImage(bmp, 0, 0, w, h);
      if (bmp && bmp.close) bmp.close();
      bitmaps[i] = null;
      track.requestFrame();
      warm(i + 6);
      pgSet(72 + (i / N) * 26, 'запись ' + (i + 1) + '/' + N);
    }
    await sleep(200);
    rec.stop();
    await stopped;
    const type = mime.split(';')[0];
    const blob = new Blob(chunks, { type });
    if (blob.size < 2048) throw new Error('пустая запись');
    const ext = type.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
    downloadBlob(blob, 'vr-invite-' + slug(state.name) + '-' + state.fmt.replace(':', 'x') + '.' + ext);
    pgSet(100, 'готово · ' + (blob.size / 1048576).toFixed(1) + ' МБ');
    toast('Видео ' + w + '×' + h + ' сохранено (' + (blob.size / 1048576).toFixed(1) + ' МБ)');
  } catch (e) {
    if (!pgCancel) toast('Не удалось записать видео: ' + (e && e.message || e), true);
  } finally { captureVeil = null; pgClose(); }
}

/* ------------------------------ шаринг ---------------------------------- */
function shareText() {
  return 'VR-ПРИГЛАШЕНИЕ • КЕМЕРОВО\n' +
    'Игрок ' + state.name + ' приглашает тебя на день рождения!\n' +
    'Уровень: ' + state.age + '\n' +
    'Когда: ' + fmtDate(state.date) + ' в ' + state.time + '\n' +
    'Где: ' + state.cname + '\n' + state.caddr + '\n' +
    'Подтверди вход до старта портала 🚀';
}

async function copyText(txt) {
  try { await navigator.clipboard.writeText(txt); return true; } catch (e) { }
  try {
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (e) { return false; }
}

function shareUrl() {
  return location.href.split('#')[0] + '#i=' + encodeURIComponent(JSON.stringify(
    Object.assign({}, state, { view: 1, photo: undefined, bg: undefined })
  ));
}

/* Короткие ссылки: Cloudflare Worker + KV. Если сервис недоступен — полная ссылка. */
const SHORT_API = 'https://vr-invite-links.qpokyc07.workers.dev';

async function shortUrl() {
  try {
    const s = JSON.stringify(Object.assign({}, state, { view: 1, photo: undefined, bg: undefined }));
    const r = await fetch(SHORT_API + '/api/short', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ s }),
    });
    if (r.ok) {
      const j = await r.json();
      if (j && j.url) return { url: j.url, short: true };
    }
  } catch (e) { }
  return { url: shareUrl(), short: false };
}

async function doShare() {
  const { url, short } = await shortUrl();
  if (navigator.share) {
    try { await navigator.share({ title: 'VR-приглашение', text: shareText(), url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const ok = await copyText(url);
  toast(ok
    ? (short ? 'Короткая ссылка скопирована — можно отправлять' : 'Ссылка скопирована')
    : 'Скопируйте ссылку из адресной строки', !ok);
}

function bindExportUI() {
  $('btnPng').addEventListener('click', exportPng);
  $('btnGif').addEventListener('click', exportGif);
  $('btnVideo').addEventListener('click', exportVideo);
  $('btnPrint').addEventListener('click', () => window.print());
  $('btnTxt').addEventListener('click', async () => {
    const ok = await copyText(shareText());
    toast(ok ? 'Текст для чата скопирован' : 'Не удалось скопировать', !ok);
  });
  $('btnLink').addEventListener('click', doShare);
  $('btnShare').addEventListener('click', doShare);
  $('btnTg').addEventListener('click', async () => {
    const { url } = await shortUrl();
    window.open('https://t.me/share/url?url=' + encodeURIComponent(url) +
      '&text=' + encodeURIComponent(shareText()), '_blank', 'noopener');
  });
  $('btnWa').addEventListener('click', async () => {
    const { url } = await shortUrl();
    window.open('https://wa.me/?text=' + encodeURIComponent(shareText() + '\n' + url),
      '_blank', 'noopener');
  });
  $('vShare').addEventListener('click', doShare);
  const vEdit = $('vEdit');
  if (vEdit) vEdit.addEventListener('click', () => {
    const url = buildHash(false);
    location.href = url;
    location.reload();
  });

  window.addEventListener('keydown', e => {
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    if (e.key === 'Escape') { pgCancel = true; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      exportPng();
    }
  });
}

/* --------------------------- вспомогательная графика -------------------- */
function paintFlag() {
  const cv = document.createElement('canvas');
  cv.width = 40; cv.height = 28;
  const g = cv.getContext('2d');
  for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) {
    g.fillStyle = (x + y) % 2 ? '#f4f7ff' : '#0b0d14';
    g.fillRect(x * 6.7, y * 7, 6.7, 7);
  }
  const url = cv.toDataURL('image/png');
  document.querySelectorAll('.brand .flag').forEach(el => {
    el.style.background = '#fff url(' + url + ') center/100% 100% no-repeat';
    el.style.boxShadow = '0 0 12px rgba(255,255,255,.35)';
  });
}

function insertRingCanvas() {
  ringCv.id = 'ringcv';
  ringCv.className = 'ringcv';
  portalEl.insertBefore(ringCv, portalEl.firstChild);
}

/* --------------------------- Telegram Mini App --------------------------- */
function isTelegramClient(tg) {
  return !!(tg && (tg.initData || (tg.platform && tg.platform !== 'unknown')));
}

function applyTelegram(tg) {
  try {
    tg.ready();
    tg.expand();
    if (tg.setHeaderColor) tg.setHeaderColor('#04050b');
    if (tg.setBackgroundColor) tg.setBackgroundColor('#04050b');
    if (tg.disableVerticalSwipes) { try { tg.disableVerticalSwipes(); } catch (e) { } }
    document.body.classList.add('tg');
    const hint = $('tgHint');
    if (hint) hint.hidden = false;
    const open = $('tgOpen');
    if (open) open.addEventListener('click', () => {
      try { tg.openLink(location.href); } catch (e) { window.open(location.href, '_blank'); }
    });
    if (document.body.classList.contains('view') && tg.BackButton) {
      try {
        tg.BackButton.show();
        tg.BackButton.onClick(() => { try { tg.close(); } catch (e) { } });
      } catch (e) { }
    }
  } catch (e) { }
}

function initTelegram() {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg && isTelegramClient(tg)) applyTelegram(tg);
}

/* -------------------------------- старт --------------------------------- */
insertRingCanvas();
paintFlag();
bindExportUI();
init();
initTelegram();

