// Every figure is a pure function of time, render(t). One Player per figure drives it from requestAnimationFrame,
// the scrubber, or a direct seek. Figures rest on their last frame, then replay once when scrolled into view.
(() => {
  const Q = (s, r = document) => r.querySelector(s), QA = (s, r = document) => [...r.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const eo = t => 1 - Math.pow(1 - t, 3), eio = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CSSK = new Set(['fill', 'stroke', 'opacity', 'stop-color']);
  const PAL = { none: '#8A8A8A', p1: '#B4DD59', p2: '#8CCB00', p3: '#56C71D', p4: '#1FC23A', p5: '#10AB42', p6: '#00934A', p7: '#036737', p8: '#053B24',
    o1: '#A6D35C', o2: '#2FAE5C', o3: '#0B6B3A', accent: '#1E9E4A', 'accent-ink': '#0B6B3A', 'pro-fill': '#DDF5E5', react: '#8C7B66', 'react-fill': '#E5DCCD', gen: '#B49C82',
    rule: '#DDDDDD', grid: '#E6E6E6', axis: '#9A9A9A', fg: '#111111', fg2: '#444444', fg3: '#6E6D66', fg4: '#9A9A9A', bg: '#FFFFFF', warn: '#E0603A', rag: '#E6550D', rlm: '#7B2D8E', idle: '#E8E8E8', mark: '#1A1A1A' };
  const pc = v => typeof v === 'string' ? v.replace(/var\(--([\w-]+)\)/g, (m, k) => PAL[k] || m) : v;
  function E(p, tag, a = {}, txt) {
    const e = document.createElementNS(NS, tag); let st = '';
    for (const k in a) { const v = pc(a[k]); if (v == null || k === 'style') continue; if (CSSK.has(k)) st += `${k}:${v};`; else e.setAttribute(k, v); }
    if (st) e.setAttribute('style', st);
    if (a.style) e.setAttribute('style', (e.getAttribute('style') || '') + pc(a.style));
    if (txt != null) e.textContent = txt; if (p) p.appendChild(e); return e;
  }
  const kfmt = v => v >= 1024 ? (v / 1024) + 'k' : String(v);
  const pct = v => (100 * v).toFixed(0) + '%', p100 = v => (100 * v).toFixed(0);
  let uid = 0;
  const RAMP = { 0: 'var(--none)', 64: 'var(--p1)', 256: 'var(--p2)', 1024: 'var(--p3)', 4096: 'var(--p4)', 16384: 'var(--p5)', 32768: 'var(--p6)', 65536: 'var(--p7)', 131072: 'var(--p8)' };
  const ARM = { blocking: ['Reactive', 'var(--none)', '5 4'], free1_p1k: ['1k', 'var(--o1)', null], free1_p4k: ['4k', 'var(--o2)', null], free1_p16k: ['16k', 'var(--o3)', null] };
  const BED = { aime: 'AIME 2024', aime25: 'AIME 2025', aime26: 'AIME 2026', hmmt: 'HMMT', arc: 'ARC-AGI-1', mir: 'MIR-Bench', studybench: 'StudyBench', sweqa_pro: 'SWE-QA-Pro', harvey: 'Harvey LAB' };
  const MODEL = { dsv4: 'DeepSeek-V4-Flash', qwen: 'Qwen3.8-27B', luna: 'gpt-5.6-luna', spark: 'Muse Spark Open' };
  const arrowHead = (p, x, y, ang, c) => E(p, 'path', { d: 'M-7,-4 L0,0 L-7,4', transform: `translate(${x} ${y}) rotate(${ang})`, fill: 'none', stroke: c, 'stroke-width': 1.6, 'stroke-linecap': 'round' });

  // ── chart: axes, clip-revealed series, riding heads ──────────────────────────────────────────────────────────────
  function chart(svg, o) {
    const g = E(svg, 'g', { transform: `translate(${o.x} ${o.y})` });
    const lx = v => Math.log(v), [x0, x1] = o.xd, [y0, y1] = o.yd;
    const X = o.xs === 'log' ? v => (lx(v) - lx(x0)) / (lx(x1) - lx(x0)) * o.w : v => (v - x0) / (x1 - x0) * o.w;
    const Y = o.ys === 'log' ? v => o.h - (lx(v) - lx(y0)) / (lx(y1) - lx(y0)) * o.h : v => o.h - (v - y0) / (y1 - y0) * o.h;
    (o.yt || []).forEach(([v, l]) => { E(g, 'line', { x1: 0, x2: o.w, y1: Y(v), y2: Y(v), class: 'grid' }); E(g, 'text', { x: -8, y: Y(v) + 4, 'text-anchor': 'end', class: 't-ax' }, l); });
    (o.xt || []).forEach(([v, l]) => { if (!o.noxgrid) E(g, 'line', { x1: X(v), x2: X(v), y1: 0, y2: o.h, class: 'grid' }); E(g, 'text', { x: X(v), y: o.h + 17, 'text-anchor': 'middle', class: 't-ax' }, l); });
    E(g, 'path', { d: `M0,-4 V${o.h} H${o.w}`, fill: 'none', class: 'axis' });
    if (o.sub) E(g, 'text', { x: 0, y: o.title ? -32 : -12, class: 't-sub' }, o.sub);
    if (o.title) E(g, 'text', { x: 0, y: -12, class: 't-title' }, o.title);
    if (o.note) E(g, 'text', { x: o.w, y: -12, 'text-anchor': 'end', class: 't-note' }, o.note);
    if (o.xl) E(g, 'text', { x: o.w / 2, y: o.h + 36, 'text-anchor': 'middle', class: 't-lab' }, o.xl);
    if (o.yl) E(g, 'text', { x: -o.yo || -38, y: o.h / 2, 'text-anchor': 'middle', class: 't-lab', transform: `rotate(-90 ${-o.yo || -38} ${o.h / 2})` }, o.yl);
    const id = 'c' + (++uid), cp = E(E(g, 'defs'), 'clipPath', { id }), cr = E(cp, 'rect', { x: -10, y: -30, width: 0, height: o.h + 60 });
    const layer = E(g, 'g', { 'clip-path': `url(#${id})` }), top = E(g, 'g');
    const S = [];
    const C = {
      g, X, Y, layer, top, w: o.w, h: o.h,
      add(pts, st) {
        const sp = pts.filter(q => q[1] != null).map(([x, y]) => [X(x), Y(y)]), none = st.c === 'var(--none)';
        if (none) { st.dash = st.dash ? '2 6' : st.dash; st.hollow = true; }
        if (st.band) E(layer, 'path', { d: 'M' + st.band.map(([x, y]) => `${X(x)},${Y(y)}`).join(' L') + ' Z', fill: st.c, opacity: .12 });
        E(layer, 'path', { d: 'M' + sp.map(q => q.join(',')).join(' L'), fill: 'none', stroke: st.c, 'stroke-width': st.w || 2.4, 'stroke-dasharray': st.dash, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
        if (st.dots) sp.forEach(([x, y]) => st.shape ? E(layer, 'path', { d: st.shape(x, y, (st.r || 3.8) * 1.25), fill: st.c, stroke: 'var(--mark)', 'stroke-width': 1 }) : E(layer, 'circle', { cx: x, cy: y, r: st.r || 3.8, fill: st.hollow ? '#FFFFFF' : st.c, stroke: st.hollow ? '#8A8A8A' : 'var(--mark)', 'stroke-width': 1 }));
        const head = st.head === false ? null : E(top, 'circle', { r: st.hr || 4.6, fill: st.hollow ? '#FFFFFF' : st.c, stroke: st.hollow ? '#8A8A8A' : 'var(--mark)', 'stroke-width': 1.2 });
        const s = { sp, head, st }; S.push(s); return s;
      },
      reveal(p) {
        const edge = p * o.w; cr.setAttribute('width', Math.max(0, edge + 10));
        S.forEach(s => {
          if (!s.head) return; const at = yAt(s.sp, edge);
          s.head.style.opacity = at && p > 0 && p < 1 ? 1 : 0;
          if (at) { s.head.setAttribute('cx', at[0]); s.head.setAttribute('cy', at[1]); }
        });
      },
    };
    return C;
  }
  function yAt(pts, x) {
    if (!pts.length || x < pts[0][0]) return null;
    if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1];
    let i = 0; while (pts[i + 1][0] <= x) i++;
    const [a, b] = [pts[i], pts[i + 1]], f = (x - a[0]) / (b[0] - a[0] || 1);
    return [x, a[1] + f * (b[1] - a[1])];
  }
  const fadeIn = (els, k) => els.forEach(e => { e.style.opacity = k; });
  function legend(svg, x, y, items, gap = 18, title, center) {
    const g = E(svg, 'g'), box = E(g, 'rect', { rx: 9, fill: '#F7F7F7', stroke: '#ECECEC', 'stroke-width': 1.2 }); let cx = x;
    if (title) { const t = E(g, 'text', { x: cx, y: y + 4, class: 't-legt' }, title); cx += (t.getComputedTextLength() || title.length * 6.4) + 14; }
    items.forEach(([lab, c, dash, mk = true, shape]) => {
      const none = c === 'var(--none)';
      E(g, 'line', { x1: cx, x2: cx + 24, y1: y, y2: y, stroke: c, 'stroke-width': 2.6, 'stroke-dasharray': none ? '2 5' : dash, 'stroke-linecap': 'round' });
      if (mk && shape) E(g, 'path', { d: shape(cx + 12, y, 4.4), fill: c, stroke: 'var(--mark)', 'stroke-width': 1 });
      else if (mk) E(g, 'circle', { cx: cx + 12, cy: y, r: 3.6, fill: none ? '#FFFFFF' : c, stroke: none ? '#8A8A8A' : 'var(--mark)', 'stroke-width': 1 });
      const t = E(g, 'text', { x: cx + 31, y: y + 4, class: 't-leg' }, lab); cx += 31 + (t.getComputedTextLength() || lab.length * 6.6) + gap;
    });
    box.setAttribute('x', x - 14); box.setAttribute('y', y - 14); box.setAttribute('height', 28); box.setAttribute('width', cx - gap - x + 28);
    if (center != null) g.setAttribute('transform', `translate(${center - (cx - gap + x) / 2} 0)`);
    return g;
  }
  function spread(labels, minGap) {   // labels: [{y}] sorted top→bottom after this, nudged apart
    labels.sort((a, b) => a.y - b.y);
    for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < minGap) labels[i].y = labels[i - 1].y + minGap;
    return labels;
  }

  // ── player and controls ──────────────────────────────────────────────────────────────────────────────────────────
  const ANIMATED = new Set(['timeline', 'offline', 'study', 'online', 'sessions']);
  class Player {
    constructor(fig) { this.fig = fig; this.t = fig.dur; this.playing = false; fig.player = this; }
    play(from) {
      if (this.fig.still) return this.seek(this.fig.dur);
      this.fig.paused = false; if (from != null) this.t = from; if (this.t >= this.fig.dur) this.t = 0;
      if (this.playing) return; this.playing = true; this.sync();
      let last = performance.now();
      const tick = now => {
        if (!this.playing) return;
        this.t = Math.min(this.fig.dur, this.t + (now - last)); last = now; this.seek(this.t);
        if (this.t >= this.fig.dur) return this.stop();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    seek(t) { this.t = t; this.fig.render(t); if (this.fig.scrub) { this.fig.scrub.value = Math.round(t / this.fig.dur * 1000); this.fig.scrub.style.setProperty('--v', (100 * t / this.fig.dur).toFixed(2) + '%'); } }
    stop() { this.playing = false; this.sync(); }
    sync() { if (this.fig.scrub) this.fig.scrub.classList.toggle('paused', !!this.fig.paused); if (this.fig.btn) { this.fig.btn.textContent = this.playing ? '❚❚' : '▶'; this.fig.btn.setAttribute('aria-label', this.playing ? 'Pause' : 'Play'); } }
  }
  function controls(el, fig, { scrub = true, extra } = {}) {
    // pickers sit above the figure; the player (play, replay, scrubber) sits below it, like a video
    const bar = document.createElement('div'); bar.className = 'ctl'; if (extra) { el.prepend(bar); extra(bar); }
    fig.still = !ANIMATED.has(el.dataset.fig); if (fig.still) return bar;
    const pl = document.createElement('div'); pl.className = 'ctl player'; Q('.stage', el).after(pl);
    // a scrubber; touching it pauses on that frame and puts a pause mark on the thumb, and clicking the thumb again resumes
    if (scrub) {
      const s = document.createElement('input'); s.type = 'range'; s.min = 0; s.max = 1000; s.value = 1000; s.setAttribute('aria-label', 'Animation time'); pl.appendChild(s); fig.scrub = s;
      let was = false, v0 = 0;
      s.addEventListener('pointerdown', () => { was = fig.paused; v0 = s.value; fig.paused = true; fig.player.stop(); });
      s.addEventListener('input', () => { fig.paused = true; fig.player.stop(); fig.player.seek(s.value / 1000 * fig.dur); });
      s.addEventListener('pointerup', () => { if (was && s.value === v0) fig.player.play(); });
      s.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); fig.paused ? fig.player.play() : (fig.paused = true, fig.player.stop()); } });
    }
    const ro = document.createElement('span'); ro.className = 'ro'; pl.appendChild(ro); fig.ro = ro;
    return bar;
  }
  const seg = (bar, label, opts, cur, on) => {
    const w = document.createElement('span'); w.className = 'seg'; w.setAttribute('role', 'group'); w.setAttribute('aria-label', label); bar.appendChild(w);
    opts.forEach(([v, t]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.classList.toggle('on', v === cur);
      b.addEventListener('click', () => { QA('button', w).forEach(x => x.classList.toggle('on', x === b)); on(v); }); w.appendChild(b); });
  };
  function fresh(el, vb) { const old = Q('svg', el); if (old) old.remove(); const svg = E(null, 'svg', { viewBox: vb, role: 'img', 'aria-label': el.dataset.alt || '' }); Q('.stage', el).appendChild(svg); return svg; }

  // ── E(P): log2-weighted trapezoid area of accuracy over T ────────────────────────────────────────────────────────
  const Eff = (T, a) => { let s = 0, w = 0; for (let k = 0; k < T.length - 1; k++) { if (a[k] == null || a[k + 1] == null) continue; const wk = Math.log2(T[k + 1] / T[k]); s += wk * (a[k] + a[k + 1]) / 2; w += wk; } return s / w; };
  const nT = (m, b) => m === 'luna' ? 5 : 7;   // paper fig2/fig49: Harvey uses all 7 T; luna was run to 16k

  const FIGS = {};
  // 1. teaser ───────────────────────────────────────────────────────────────────────────────────────────────────────
  FIGS.teaser = (el, D) => {
    const model = 'dsv4';   // headline figure: DeepSeek-V4-Flash only
    const fig = { dur: 1, render: () => {} };
    const band = (C, lo, hi, xs, c) => E(C.g, 'path', { d: 'M' + xs.map((x, i) => `${C.X(x)},${C.Y(hi[i])}`).join(' L') + ' L' + xs.map((x, i) => `${C.X(x)},${C.Y(lo[i])}`).reverse().join(' L') + ' Z', fill: c, 'fill-opacity': .16, stroke: 'none' });
    function build() {
      const nar = el.clientWidth < 600, svg = fresh(el, nar ? '0 0 480 880' : '0 0 960 420'), H = D.head[model], n = nT(model, 'sweqa_pro'), T = D.T.slice(0, n);
      const off = [['0', 'No Study', 'var(--none)', '5 4'], ['4096', '4k', 'var(--p3)'], ['16384', '16k', 'var(--p6)'], ['131072', '128k', 'var(--p8)']];
      const all = off.flatMap(([p]) => H.off[p].slice(0, n)).concat(H.band ? Object.values(H.band).flat(2) : []);
      const ylo = Math.max(0, Math.floor(Math.min(...all) * 10 - .5) / 10), yhi = Math.min(1, Math.ceil(Math.max(...all) * 10 + .3) / 10);
      const L = chart(svg, { x: nar ? 64 : 70, y: 46, w: nar ? 390 : 360, h: 260, xs: 'log', xd: [64, T[n - 1]], yd: [ylo, yhi], xt: T.map(t => [t, kfmt(t)]), yt: Array.from({ length: Math.round((yhi - ylo) * 10) + 1 }, (_, i) => ylo + i / 10).map(v => [v, p100(v)]), title: 'Studying Before the Task Arrives', sub: `SWE-QA-Pro, ${MODEL[model]}`, xl: 'Test Budget T', yl: 'Accuracy (%)', yo: 40 });
      const R = chart(svg, { x: nar ? 64 : 570, y: nar ? 506 : 46, w: nar ? 390 : 360, h: 260, xd: [0, 120], yd: [0, 100], xt: [0, 30, 60, 90, 120].map(t => [t, String(t)]), yt: [0, 25, 50, 75, 100].map(v => [v, String(v)]), title: 'Preparing While Waiting for Tools', sub: H.on ? `8 MLE-Bench Tasks, ${MODEL[model]}` : 'Not in the online run', xl: 'Session Time (min)', yl: 'Runs Above Median Human (%)', yo: 40 });
      if (H.band) off.forEach(([p, , c]) => band(L, H.band[p].map(v => v[0]), H.band[p].map(v => v[1]), T, pc(c)));
      off.forEach(([p, , c, d]) => L.add(T.map((t, i) => [t, H.off[p][i]]), { c, dash: d, dots: true, hollow: p === '0', w: p === '131072' ? 2.8 : 2.2, head: false }));
      L.reveal(1);
      legend(svg, 84, nar ? 400 : 406, off.map(([, l, c, d]) => [l, c, d]), 12, nar ? null : 'Proactive Budget P:', nar ? 240 : 250);
      const v0 = H.off['0'][0], v1 = H.off['131072'][0], xa = L.X(64) + 16, g = E(L.top, 'g');
      E(g, 'line', { x1: xa, x2: xa, y1: L.Y(v0) - 4, y2: L.Y(v1) + 6, stroke: '#555555', 'stroke-width': 1.4 }); arrowHead(g, xa, L.Y(v1) + 5, -90, '#555555');
      const ym = L.Y(Math.max(ylo + .08, v0 - .02));
      E(g, 'text', { x: xa + 10, y: ym - 16, class: 't-strong t-halo', style: 'fill:#053B24' }, `${pct(v1)} at T = 64`); E(g, 'text', { x: xa + 10, y: ym, class: 't-lab t-halo' }, `vs ${pct(v0)}, no study`);
      const best = i => Math.max(...['4096', '16384', '131072'].map(p => H.off[p][i])), full = T.find((t, i) => H.off['0'][i] >= best(i));
      if (full) E(g, 'text', { x: L.w - 4, y: L.Y(ylo + (yhi - ylo) * .4), 'text-anchor': 'end', class: 't-note' }, `No study needs ${kfmt(full)} tokens to catch up`);
      if (H.band) E(g, 'text', { x: L.w - 4, y: L.h - 8, 'text-anchor': 'end', class: 't-note' }, 'Bands: 95% CI over contexts');
      if (!H.on) return;
      const ARMS = ['blocking', 'free1_p1k', 'free1_p4k', 'free1_p16k'], G = H.on.blocking.m.map((_, i) => i);
      ARMS.forEach(a => band(R, H.on[a].lo, H.on[a].hi, G, pc(ARM[a][1])));
      ARMS.forEach(a => R.add(G.map(i => [i, H.on[a].m[i]]), { c: ARM[a][1], dash: ARM[a][2], w: a === 'free1_p16k' ? 2.8 : 2.2, head: false }));
      R.reveal(1);
      legend(svg, 584, nar ? 860 : 406, ARMS.map(a => [ARM[a][0], ARM[a][1], ARM[a][2]]), 10, nar ? null : 'Proactive Budget P:', nar ? 240 : 736);
      const ta = H.on.free1_p16k.t50, tb = H.on.blocking.t50, r = E(R.top, 'g'), yA = R.Y(14);
      [ta, tb].forEach(t => { E(r, 'line', { x1: R.X(t), x2: R.X(t), y1: R.Y(50) + 6, y2: yA, stroke: '#777777', 'stroke-dasharray': '3 3' }); E(r, 'circle', { cx: R.X(t), cy: R.Y(50), r: 5, fill: t === ta ? '#053B24' : '#FFFFFF', stroke: t === ta ? '#1A1A1A' : '#777777', 'stroke-width': 1.4 }); });
      E(r, 'line', { x1: R.X(tb), x2: R.X(ta) + 6, y1: yA, y2: yA, stroke: '#555555', 'stroke-width': 1.4 }); arrowHead(r, R.X(ta) + 5, yA, 180, '#555555');
      E(r, 'text', { x: (R.X(ta) + R.X(tb)) / 2, y: yA + 18, 'text-anchor': 'middle', class: 't-strong t-halo', style: 'fill:#053B24' }, `${(tb / ta).toFixed(1)}× faster`);
      E(r, 'text', { x: R.X(4), y: R.Y(95), class: 't-lab' }, 'Half of seeds beat median human:');
      E(r, 'text', { x: R.X(4), y: R.Y(87), class: 't-strong', style: 'fill:#053B24' }, `16k tokens: ${ta} min`); E(r, 'text', { x: R.X(4), y: R.Y(79), class: 't-strong', style: 'fill:#777777' }, `Reactive: ${tb} min`);
      E(r, 'text', { x: R.w - 4, y: R.h - 8, 'text-anchor': 'end', class: 't-note' }, 'Bands: 95% CI over seeds');
    }
    build();
    return fig;
  };

  FIGS.timeline = el => {
    // the paper's method figure (Fig. 2, Oct 27): environment and agent lanes for a proactive and a reactive agent; a playhead draws it left to right
    const nar = el.clientWidth < 600, F = nar ? 1.35 : 1, svg = fresh(el, nar ? '120 0 1490 800' : '0 0 1610 790');
    const RF = '#E6DDD0', RS = '#7A6650', PF = '#DDF3E3', PS = '#2E9E4A', GI = '#1E8A47', ink = '#222222';
    const defs = E(svg, 'defs'), pat = E(defs, 'pattern', { id: 'hatch2', width: 10, height: 10, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    E(pat, 'rect', { width: 10, height: 10, fill: '#F2F2F0' }); E(pat, 'line', { x1: 0, y1: 0, x2: 0, y2: 10, stroke: '#A8A8A4', 'stroke-width': 2.2 });   // idle: grey hatch on a light-grey ground
    const T = (g, x, y, t, st = '', a = 'start') => E(g, 'text', { x, y, 'text-anchor': a, style: `font-size:${24 * F}px;fill:${ink};${st}` }, t);
    const items = [], boxes = [];
    const item = (x0, g) => { items.push({ x0, g }); g.style.opacity = 0; return g; };
    const box = (x, y, w, h, kind, label, lst) => { const fill = kind === 'r' ? RF : kind === 'p' ? PF : kind === 'e' ? '#FFFFFF' : 'url(#hatch2)', st = kind === 'r' ? RS : kind === 'p' ? PS : kind === 'e' ? '#BBBBBB' : '#7E7E7A';
      const r = E(svg, 'rect', { x, y, width: 0, height: h, rx: 5, fill, stroke: st, 'stroke-width': 1.8, 'stroke-dasharray': kind === 'i' ? '7 4' : null });
      const t = label ? (Array.isArray(label) ? label : [label]).map((l, k, a) => T(svg, x + w / 2, y + h / 2 + 8 * F + (k - (a.length - 1) / 2) * 26 * F, l, lst || `font-weight:${kind === 'p' ? 800 : 400};fill:${kind === 'p' ? GI : ink}`, 'middle')) : [];
      t.forEach(e => e.style.opacity = 0); boxes.push({ r, x, w, t }); };
    const curve = (g, x1, y1, x2, y2, c = '#555555') => { E(g, 'path', { d: `M${x1},${y1} C${x1 + 18},${y1} ${x2 - 18},${y1} ${x2 - 14},${(y1 + y2) / 2} S${x2 - 18},${y2} ${x2},${y2}`, fill: 'none', stroke: c, 'stroke-width': 2.4 });
      const d = y2 > y1 ? 1 : -1; E(g, 'path', { d: `M${x2 + 2},${y2} l-12,-6 v12Z`.replace('l-12,-6 v12Z', `l-11,${-6} v12Z`), fill: c }); };
    const up = (g, x1, y1, x2, y2) => { E(g, 'path', { d: `M${x1},${y1} C${x1 + 26},${y1} ${x2 - 6},${y1} ${x2 - 6},${(y1 + y2) / 2} S${x2},${y2} ${x2 + 12},${y2}`, fill: 'none', stroke: '#222222', 'stroke-width': 2.4 }); E(g, 'path', { d: `M${x2 + 20},${y2} l-11,-6 v12Z`, fill: '#222222' }); };
    const docs = (g, x, y) => { [[8, -8], [4, -4], [0, 0]].forEach(([dx, dy]) => { E(g, 'rect', { x: x - 18 + dx, y: y - 24 + dy, width: 30, height: 38, rx: 3, fill: '#FFFFFF', stroke: '#333333', 'stroke-width': 2 }); }); [0, 1, 2, 3].forEach(k => E(g, 'line', { x1: x - 12, x2: x + 6, y1: y - 14 + k * 7, y2: y - 14 + k * 7, stroke: '#333333', 'stroke-width': 1.8 })); };
    const person = (g, x, y) => { E(g, 'circle', { cx: x - 12, cy: y - 2, r: 8, fill: '#FFFFFF', stroke: '#333333', 'stroke-width': 2.2 }); E(g, 'path', { d: `M${x - 26},${y + 24} q14,-24 28,0`, fill: 'none', stroke: '#333333', 'stroke-width': 2.2 });
      E(g, 'rect', { x: x + 2, y: y - 32, width: 30, height: 24, rx: 6, fill: '#FFFFFF', stroke: '#333333', 'stroke-width': 2 }); E(g, 'text', { x: x + 17, y: y - 13, 'text-anchor': 'middle', style: 'font-size:18px;font-weight:800;fill:#333333' }, '?'); };
    const call = (g, x, y, n, label) => { E(g, 'circle', { cx: x, cy: y, r: 22, fill: GI }); E(g, 'text', { x, y: y + 9, 'text-anchor': 'middle', style: 'font-size:24px;font-weight:800;fill:#FFFFFF' }, n);
      const t = E(g, 'text', { x: x + 40, y: y + 9, style: `font-size:${24 * F}px;font-weight:800;font-style:italic;fill:#13633A` }, label); E(g, 'rect', { x: x + 30, y: y + 14, width: label.length * 11.2 * F + 20, height: 4, rx: 2, fill: '#BFE5C8' }); };
    // legend and phase titles
    const lg = E(svg, 'g'); [[RF, RS, 'Reactive compute', 420], [PF, PS, 'Proactive compute', 750], ['url(#hatch2)', '#7E7E7A', 'Idle time', 1090]].forEach(([f, s2, l, x]) => { E(lg, 'rect', { x, y: 4, width: 36, height: 24, rx: 4, fill: f, stroke: s2, 'stroke-width': 1.6 }); T(lg, x + 50, 25, l); });
    T(svg, 412, 88, 'Offline', 'font-size:' + 30 * F + 'px;font-style:italic', 'middle'); T(svg, 1128, 88, 'Online', 'font-size:' + 30 * F + 'px;font-style:italic', 'middle');
    E(svg, 'line', { x1: 580, x2: 580, y1: 110, y2: 715, stroke: '#9A9A9A', 'stroke-width': 1.6, 'stroke-dasharray': '6 5' });
    // two lanes: [label, colour, env y, agent y, boxes, env boxes, arrow labels, end x]
    const LANES = [
      ['Proactive agent', GI, 178, 313, [[305, 260, 'p', ['Study S', 'P']], [607, 109, 'r'], [768, 152, 'p', 'Prepare'], [973, 107, 'r'], [1132, 152, 'p', 'Prepare'], [1337, 106, 'r']], [[768, 150], [1131, 150]], [[597, 'tool call a₁'], [955, 'result o₁'], [1115, 'a₂'], [1318, 'o₂']], 1480],
      ['Reactive agent', '#7A5A3A', 505, 640, [[305, 260, 'i'], [607, 184, 'r'], [843, 145, 'i'], [1040, 169, 'r'], [1258, 146, 'i'], [1456, 107, 'r']], [[843, 142], [1258, 144]], [[672, 'tool call a₁'], [1022, 'result o₁'], [1197, 'a₂'], [1438, 'o₂']], 1588]];
    LANES.forEach(([name, col, ey, ay, bx, ex, labs, endx]) => {
      if (nar) T(svg, 240, ey - 52, name, `font-size:${28 * F}px;font-weight:800;fill:${col}`);   // phone: the lane name sits above its block, the label column is cropped
      else { T(svg, 222, ey + 9, 'Environment', 'font-size:28px;font-weight:800', 'end'); T(svg, 222, ay + 9, name, `font-size:28px;font-weight:800;fill:${col}`, 'end'); }
      E(svg, 'line', { x1: 232, x2: 1595, y1: ey, y2: ey, stroke: '#D0D0D0', 'stroke-width': 2 }); E(svg, 'line', { x1: 232, x2: 1595, y1: ay, y2: ay, stroke: '#D0D0D0', 'stroke-width': 2 });
      const g0 = item(240, E(svg, 'g')); docs(g0, 278, ey); T(g0, 258, ey + 70, 'context C', 'font-style:italic;fill:#666666', 'end'); curve(g0, 280, ey + 22, 303, ay);
      const g1 = item(570, E(svg, 'g')); person(g1, 580, ey); T(g1, 562, ey + 70, 'task q', 'font-style:italic;fill:#666666', 'end'); curve(g1, 582, ey + 26, 605, ay);
      bx.forEach(([x, w, k, l]) => box(x, ay - 40, w, 80, k, k === 'i' ? 'Idle' : k === 'p' && Array.isArray(l) ? null : l, k === 'i' ? 'font-weight:800;font-style:italic;fill:#55554F;paint-order:stroke;stroke:#F2F2F0;stroke-width:6px' : undefined));
      if (name === 'Proactive agent') { const g = item(320, E(svg, 'g')); const st = E(g, 'text', { x: 435, y: ay + 9, 'text-anchor': 'middle', style: `font-size:${26 * F}px;font-weight:800;fill:${GI}` }, 'Study S'); E(st, 'tspan', { dy: 8, style: `font-size:${17 * F}px` }, 'P'); }
      ex.forEach(([x, w]) => box(x, ey - 38, w, 76, 'e', ['Environment', 'processing'], 'font-weight:400;font-size:22px'));
      labs.forEach(([x, l]) => { const g = item(x, E(svg, 'g')); T(g, x, ey + 70, l, 'font-style:italic;fill:#555555'); });
      const rs = bx.filter(b => b[2] === 'r');
      rs.forEach((b, k) => { const g = item(b[0] + b[1], E(svg, 'g')); const xe = b[0] + b[1];
        if (k < ex.length) { up(g, xe, ay, ex[k][0] - 20, ey); E(g, 'path', { d: `M${ex[k][0] + ex[k][1]},${ey} C${ex[k][0] + ex[k][1] + 24},${ey} ${ex[k][0] + ex[k][1] + 4},${ey} ${ex[k][0] + ex[k][1] + 4},${(ey + ay) / 2} S${rs[k + 1][0] - 24},${ay} ${rs[k + 1][0] - 10},${ay}`, fill: 'none', stroke: '#555555', 'stroke-width': 2.4 }); E(g, 'path', { d: `M${rs[k + 1][0] - 2},${ay} l-11,-6 v12Z`, fill: '#555555' }); }
        else { up(g, xe, ay, endx - 6, ey); E(g, 'circle', { cx: endx, cy: ey, r: 6, fill: '#111111' }); } });
    });
    // the three takeaways appear one by one once the playhead has crossed the figure
    const c1 = E(svg, 'g'); c1.style.opacity = 0; call(c1, 628, 387, '1', 'Better utilizes idle time');
    const fin = E(svg, 'g'); fin.style.opacity = 0;
    E(fin, 'line', { x1: 1480, x2: 1480, y1: 190, y2: 765, stroke: GI, 'stroke-width': 2, 'stroke-dasharray': '7 5' }); E(fin, 'line', { x1: 1588, x2: 1588, y1: 517, y2: 765, stroke: '#555555', 'stroke-width': 2, 'stroke-dasharray': '7 5' });
    E(fin, 'line', { x1: 1580, x2: 1496, y1: 760, y2: 760, stroke: GI, 'stroke-width': 2.4 }); E(fin, 'path', { d: 'M1486,760 l12,-6 v12Z', fill: GI });
    call(fin, 1052, 736, '2', 'Earlier task-completion');
    const c3 = E(svg, 'g'); c3.style.opacity = 0; call(c3, 1282, 82, '3', 'Better performance');
    const head = E(svg, 'line', { y1: 110, y2: 715, stroke: '#111111', 'stroke-width': 1.5, opacity: .3 });
    const fig = { dur: 9600, render: t => {
      const hx = 240 + 1360 * eio(clamp(t / 6800)); head.setAttribute('x1', hx); head.setAttribute('x2', hx); head.style.opacity = hx > 241 && hx < 1599 ? .3 : 0;
      boxes.forEach(({ r, x, w, t: tx }) => { r.setAttribute('width', Math.max(0, Math.min(w, hx - x))); tx.forEach(e => e.style.opacity = clamp((hx - x - w / 2) / 40)); });
      items.forEach(({ x0, g }) => g.style.opacity = clamp((hx - x0) / 40));
      [c1, fin, c3].forEach((g, k) => { g.style.opacity = eo(clamp((t - 7000 - 800 * k) / 600)); });
    } };
    return fig;
  };

  // 3. one real study, then three questions ────────────────────────────────────────────────────────────────────────
  FIGS.study = (el, D) => {
    const nar = el.clientWidth < 600, S = D.study, ev = S.ev, N = ev.length;
    const svg = fresh(el, nar ? '0 0 480 1160' : '0 0 960 610');
    const RC = { 1024: 'var(--p2)', 4096: 'var(--p4)', 16384: 'var(--p6)', 32768: 'var(--p7)', 131072: 'var(--p8)' };
    // layout: sprite + thought bubbles | live token stream | discovery tree; the three questions below
    const L = nar ? { sx: 14, sy: 92, sw: 150, tx: 20, ty: 340, tw: 440, th: 380, cx: 240, cy: 925, sc: 205, sv: 160, ly: 1120, qy: 370 }
                  : { sx: 6, sy: 168, sw: 176, tx: 200, ty: 46, tw: 340, th: 340, cx: 752, cy: 216, sc: 192, sv: 166, ly: 408, qy: 452 };
    E(svg, 'text', { x: 20, y: 24, class: 't-title' }, nar ? 'A Proactive Study, Live' : 'A Proactive Study of the cekit Repository, Live');
    // the robot, bobbing, with bubbles holding what the study reads right now
    const sp = E(svg, 'g');
    const img = E(sp, 'image', { href: 'robot_study_hair.png', x: L.sx, y: L.sy, width: L.sw, height: L.sw * 444 / 340 });
        // speech bubbles: one while studying, one once the study ends
    // the bubble sits just above the robot's head (head top is ~21% down the sprite)
    const BY = Math.round(L.sy + 0.206 * L.sw * 444 / 340 - 29);
    const bubble = lines => { const g = E(svg, 'g', { opacity: 0 }), h = 18 + 17 * lines.length, y0 = BY - h;
      E(g, 'rect', { x: 6, y: y0, width: 186, height: h, rx: 12, fill: '#FFFFFF', stroke: '#6FBF73', 'stroke-width': 1.6 });
      E(g, 'path', { d: `M86,${BY} l8,14 l8,-14`, fill: '#FFFFFF', stroke: '#6FBF73', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }); E(g, 'line', { x1: 87, x2: 101, y1: BY, y2: BY, stroke: '#FFFFFF', 'stroke-width': 2.4 });
      lines.forEach((l, j) => E(g, 'text', { x: 99, y: y0 + 21 + j * 17, 'text-anchor': 'middle', class: 't-strong', style: 'font-size:12.5px;fill:#0B6B3A' }, l)); return g; };
    const busy = bubble(['I\u2019m studying your repository', 'to prepare for the task\u2026']), done = bubble(['I looked forward in time.', 'I saw 14,000,605 tasks', 'you could give me. I\u2019m', 'ready for all of them.']);
    // live token stream (real trace text, typed out)
    const fo = E(svg, 'foreignObject', { x: L.tx, y: L.ty, width: L.tw, height: L.th });
    const term = document.createElement('div');
    term.setAttribute('style', `width:${L.tw}px;height:${L.th}px;box-sizing:border-box;background:#1C1D1A;border-radius:8px;padding:30px 12px 10px;font:12px/1.45 'JetBrains Mono',ui-monospace,Menlo,monospace;color:#C9CBC2;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;position:relative`);
    const head = document.createElement('div');
    head.setAttribute('style', 'position:absolute;top:0;left:0;right:0;height:24px;padding:5px 10px;font-size:10.5px;color:#8FD49A;background:#26282A;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;white-space:nowrap');
    const hl = document.createElement('span'), hr = document.createElement('span'); hl.textContent = '● studying'; head.append(hl, hr);
    const body = document.createElement('div'); term.append(head, body); fo.appendChild(term);
    // discovery tree
    const PX = x => L.cx + x * L.sc, PY = y => L.cy + y * L.sv;
    const key = (x, y) => x.toFixed(3) + ',' + y.toFixed(3);
    const at = {}; S.tree.files.forEach(f => at[key(...f.xy)] = f.ev);
    S.tree.dirs.forEach(d => { const fs = S.tree.files.filter(f => f.n.startsWith(d.name)); at[key(...d.xy)] = fs.length ? Math.min(...fs.map(f => f.ev)) : 0; });
    const edges = S.tree.edges.map(([a, b]) => ({ e: E(svg, 'line', { x1: PX(a[0]), y1: PY(a[1]), x2: PX(b[0]), y2: PY(b[1]), stroke: '#CFCFCF', 'stroke-width': 1 }), ev: at[key(...b)] ?? 0 }));
    E(svg, 'circle', { cx: PX(0), cy: PY(0), r: 5, fill: '#444444' });
    const nodes = S.tree.files.map(f => ({ c: E(svg, 'circle', { cx: PX(f.xy[0]), cy: PY(f.xy[1]), r: 0, fill: RC[f.rung] || 'var(--p5)', stroke: 'var(--mark)', 'stroke-width': .8 }), ev: f.ev ?? Math.max(0, ev.findIndex(e => e[0] >= f.rung * .75)) }));   // 3 files have no logged read event: place them inside their rung
    S.tree.dirs.filter(d => ['cekit/', 'tests/', 'docs/'].includes(d.name)).forEach(d => E(svg, 'text', { x: PX(d.xy[0]) + 6, y: PY(d.xy[1]) - 6, class: 't-mono', style: 'font-size:10.5px;fill:#777777' }, d.name));
    const filT = E(svg, 'text', { x: nar ? 20 : L.cx - 190, y: nar ? L.cy - 178 : 46, class: 't-mono', style: 'font-size:12px;fill:#555555' });
    // rung legend, centred under the tree: title line, then the five dots
    E(svg, 'text', { x: L.cx, y: L.ly, 'text-anchor': 'middle', class: 't-lab', style: 'font-size:11px' }, 'Study budget P when each file is first read');
    let lx = L.cx - 130; [['≤1k', 1024], ['4k', 4096], ['16k', 16384], ['32k', 32768], ['128k', 131072]].forEach(([l, r]) => { E(svg, 'circle', { cx: lx + 4, cy: L.ly + 16, r: 4, fill: RC[r] }); E(svg, 'text', { x: lx + 12, y: L.ly + 20, class: 't-lab', style: 'font-size:11px' }, l); lx += 52; });
    // the three questions
    const wait = E(svg, 'text', { x: 480, y: L.qy + 60, 'text-anchor': 'middle', class: 't-sub' }, nar ? '' : 'The questions arrive after the study …');
    const qg = E(svg, 'g'), rows = [], short = ['Where are dependency checks centralized?', 'Where are test tags transformed?', 'Why does behave need explicit tags?'];
    E(qg, 'text', { x: 20, y: L.qy, class: 't-title' }, 'Then Three Questions Arrive (T = 1k)');
    const W = (nar ? 300 : 200) / 13;
    S.qs.forEach((q, i) => {
      const x = nar ? 20 : 20 + i * 313, y = nar ? L.qy + 44 + i * 104 : L.qy + 36;
      E(qg, 'text', { x, y, class: 't-strong', style: 'font-size:12.5px' }, short[i] || q.q.slice(0, 48));
      const b0 = E(qg, 'rect', { x, y: y + 12, height: 18, width: 0, rx: 3, fill: '#D4D4D4', stroke: '#8A8A8A', 'stroke-width': 1 }), b1 = E(qg, 'rect', { x, y: y + 38, height: 18, width: 0, rx: 3, fill: 'var(--p6)', stroke: 'var(--mark)', 'stroke-width': 1 });
      const t0 = E(qg, 'text', { x, y: y + 25, class: 't-lab' }), t1 = E(qg, 'text', { x, y: y + 51, class: 't-lab' });
      rows.push({ q, x, b0, b1, t0, t1, t: 12600 + i * 500 });
    });
    {   // visual key for the bars, in the same box style as legend()
      const ly = nar ? L.qy + 350 : L.qy + 134, kg = E(qg, 'g'), box = E(kg, 'rect', { y: ly - 14, height: 28, rx: 9, fill: '#F7F7F7', stroke: '#ECECEC', 'stroke-width': 1.2 }); let cx = 0;
      [['No Study', '#D4D4D4', '#8A8A8A'], ['With the 128k Study', 'var(--p6)', 'var(--mark)']].forEach(([l, f, st]) => {
        E(kg, 'rect', { x: cx, y: ly - 7, width: 26, height: 14, rx: 3, fill: f, stroke: st, 'stroke-width': 1 });
        const t = E(kg, 'text', { x: cx + 33, y: ly + 4, class: 't-leg' }, l); cx += 33 + (t.getComputedTextLength() || l.length * 6.6) + 22; });
      const t = E(kg, 'text', { x: cx, y: ly + 4, class: 't-leg' }, '13 calls · 0.41'), tw = t.getComputedTextLength() || 90;
      const t2 = E(kg, 'text', { x: cx + tw + 8, y: ly + 4, class: 't-lab', style: 'font-size:11.5px' }, '= tool calls · judge score'); cx += tw + 8 + (t2.getComputedTextLength() || 130) + 14;
      box.setAttribute('x', -14); box.setAttribute('width', cx + 14);
      kg.setAttribute('transform', `translate(${480 - cx / 2} 0)`);
    }
    const STUDY = 12000;
    const line = (e, n) => { const d = document.createElement('div'); d.style.margin = '0 0 6px'; const txt = n == null ? e[2] : e[2].slice(0, n);
      if (e[1] === 'c') { d.style.color = '#8FD49A'; d.textContent = '$ ' + txt; } else d.textContent = txt; return d; };
    const fig = { dur: 15000, render: t => {
      const p = clamp(t / STUDY), x = N * Math.pow(p, 2.2), i = Math.min(N - 1, Math.floor(x)), tok = p <= 0 ? 0 : ev[i][0];
      // stream: the last few events, the current one typed in proportion
      body.replaceChildren(...ev.slice(Math.max(0, i - 9), i).map(e => line(e)), ...(p > 0 ? [line(ev[i], p >= 1 ? null : Math.ceil(ev[i][2].length * (x - i)))] : []));
      hr.textContent = `${tok.toLocaleString('en-US')} / 131,072`;
      hl.textContent = p >= 1 ? '● study done' : '● studying, no question yet';
      img.setAttribute('href', p >= 1 ? 'robot_done_hair.png' : 'robot_study_hair.png'); done.style.opacity = eo(clamp((t - STUDY) / 400)); busy.style.opacity = p > 0 ? 1 - done.style.opacity : 0;
      img.setAttribute('transform', `translate(0 ${(Math.sin(t / 380) * 3).toFixed(2)})`);
      nodes.forEach(n => n.c.setAttribute('r', n.ev <= i && p > 0 ? 3.8 : 0));
      edges.forEach(e => { e.e.style.opacity = e.ev <= i && p > 0 ? 1 : 0; });
      filT.textContent = `files read ${nodes.filter(n => n.ev <= i && p > 0).length}`;
      rows.forEach(r => {
        const k = eo(clamp((t - r.t) / 700));
        r.b0.setAttribute('width', Math.max(2, r.q.none.calls * W) * k); r.b1.setAttribute('width', Math.max(2, r.q.with.calls * W) * k);
        r.t0.setAttribute('x', r.x + Math.max(2, r.q.none.calls * W) * k + 8); r.t1.setAttribute('x', r.x + Math.max(2, r.q.with.calls * W) * k + 8);
        r.t0.textContent = k > .05 ? `${r.q.none.calls} calls · ${r.q.none.score.toFixed(2)}` : ''; r.t1.textContent = k > .05 ? `${r.q.with.calls} calls · ${r.q.with.score.toFixed(2)}` : '';
        fadeIn([r.t0, r.t1], k);
      });
      qg.style.opacity = eo(clamp((t - STUDY - 300) / 500)); wait.style.opacity = 1 - eo(clamp((t - STUDY) / 400)); if (nar) fo.style.opacity = 1 - eo(clamp((t - STUDY - 300) / 500));
    } };
    return fig;
  };

  // one real context and task per benchmark (frozen sets in sleeprun/benchmarks/*/v1 and the Harvey LAB upstream tasks)
  const EX = {
      arc: ['Three solved grid puzzles that share one hidden rule (ARC task f0afb749).', 'Apply the rule to a new 3 × 3 test grid.'],
      harvey: ['The document system of a fictitious law firm: 266 matters, 9,288 documents, about 134M tokens.', '\u201cPull every one of our antitrust matters where we drew an HSR second request, with the documents showing each request.\u201d'],
      sweqa_pro: ['The cekit repository (177 files).', '\u201cWhere are the test tag identifiers processed and transformed during behave test execution?\u201d'],
      studybench: ['The dspy repository (470 files).', '\u201cI\u2019m debugging a tiny GEPA run [\u2026] I want to see, for the reflection step specifically: the exact request the reflection model received [\u2026]\u201d'],
      mir: ['512 input \u2192 output examples of one hidden function, e.g. {\'s\': \'wszC,l\'} \u2192 [\'wszC\', \'l\'].', 'Give the output for a new input: {\'s\': \'vw,aif tB tVBOz OL,GnWxGKZC \u2026\'}.'] };
  // the example context C and task q per benchmark; shown in a fixed-size box under the offline figure and
  // driven by that figure's benchmark list, so the page doesn't jump when the benchmark changes
  const exampleHTML = (D, b) => {
    const X = D.examples || {}, esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const ARC = ['#000000', '#0074D9', '#FF4136', '#2ECC40', '#FFDC00', '#AAAAAA', '#F012BE', '#FF851B', '#7FDBFF', '#870C25'];
    const g = m => `<span class="ag" style="grid-template-columns:repeat(${m[0].length},auto)">${m.flat().map(v => `<i style="background:${ARC[v]}"></i>`).join('')}</span>`;
    const ctx = () => { const x = X[b];
      if (!x) return EX[b][0];
      if (x.kind === 'grids') return `Solved input → output pairs that share one hidden rule (ARC task ${x.id}):<div class="ex-row">${x.pairs.map(([a, o]) => `${g(a)}<span class="ar">→</span>${g(o)}`).join('<span class="ar">&nbsp;</span>')}${x.more ? `<span class="mut">… ${x.more} more</span>` : ''}</div>`;
      if (x.kind === 'pairs') return `${x.n} input → output examples of one hidden function:<pre>${x.pairs.map(([a, o]) => { const l = a + '  →  ' + o; return esc(l.length > 96 ? l.slice(0, 95) + ' …' : l); }).join('\n')}\n<span class="mut">… ${x.n - x.pairs.length} more</span></pre>`;
      return `${EX[b][0]}<pre>${esc(x.tree)}</pre>`; };
    const task = () => { const x = X[b];
      if (x && x.kind === 'grids') return `<span class="ex-task">Apply the rule to a new grid: ${g(x.test)}<span class="ar">→</span><b>?</b></span>`;
      if (x && x.kind === 'pairs') return `Give the output for a new input: <code>${esc(x.test.length > 70 ? x.test.slice(0, 70) + ' …' : x.test)}</code>`;
      return EX[b][1]; };
    return `<div class="ex-in"><div class="ex-head">Example from ${BED[b]}</div><div class="ex-c"><b>Context <i>C</i>.</b> ${ctx()}</div><div class="ex-q"><b>Task <i>q</i>.</b> ${task()}</div></div>`;
  };

  FIGS.offline = (el, D) => {
    // left: accuracy vs T, one study budget at a time, drawn left to right; each finished curve then collapses into
    // its E point on the right panel (E vs P). Benchmarks are a clickable list inside the SVG so the figure scales as one image.
    const OB = ['sweqa_pro', 'arc', 'harvey', 'studybench', 'mir'];
    let model = 'dsv4', bed = 'sweqa_pro';   // SWE-QA-Pro first: the text above the figure quotes its numbers
    const fig = { dur: 13000, render: () => {} };
    controls(el, fig, { extra: bar => seg(bar, 'Model', Object.entries(MODEL), model, v => { model = v; build(); fig.player.play(0); }) });
    const PL = D.P, NS_ = PL.length;   // 9 levels: 0, 64 … 128k
    const nice = (lo, hi) => { const st = hi - lo > .45 ? .2 : hi - lo > .2 ? .1 : .05, a = Math.floor(lo / st) * st, b = Math.ceil(hi / st) * st, t = []; for (let v = a; v <= b + 1e-9; v += st) t.push(+v.toFixed(2)); return t; };
    function build() {
      { let ex = Q('.exbox', el); if (!ex) { ex = document.createElement('div'); ex.className = 'exbox'; Q('.stage', el).parentNode.insertBefore(ex, Q('figcaption', el)); } ex.innerHTML = exampleHTML(D, bed); }
      const nar = el.clientWidth < 600, G = nar ? { vb: '0 0 480 700', cx: 58, cy: 50, cw: 400, ch: 250, rx: 58, ry: 420, rw: 200, rh: 230, bx: 300, by: 406 } : { vb: '0 0 960 400', cx: 66, cy: 56, cw: 400, ch: 270, rx: 546, ry: 56, rw: 230, rh: 270, bx: 804, by: 56 };
      const exH = 0, vb0 = G.vb.split(' ').map(Number), svg = fresh(el, `0 0 ${vb0[2]} ${vb0[3] + exH}`), n = nT(model, bed), T = D.T.slice(0, n), A = D.off[model][bed];
      const curve = p => A[String(p)].slice(0, n), all = PL.flatMap(p => curve(p)).filter(v => v != null);
      const yt = nice(Math.min(...all) - .02, Math.max(...all) + .02);
      const C = chart(svg, { x: G.cx, y: G.cy, w: G.cw, h: G.ch, xs: 'log', xd: [T[0], T[n - 1]], yd: [yt[0], yt[yt.length - 1]], xt: T.map(t => [t, kfmt(t)]), yt: yt.map(v => [v, p100(v)]), title: 'Accuracy vs Test Budget', xl: 'Test Budget T', yl: 'Accuracy (%)', yo: 40 });
      const Es = PL.map(p => Eff(T, curve(p))), et = nice(Math.min(...Es) - .02, Math.max(...Es) + .02);
      const R = chart(svg, { x: G.rx, y: G.ry, w: G.rw, h: G.rh, xd: [0, NS_ - 1], yd: [et[0], et[et.length - 1]], xt: [[0, '0'], [2, '256'], [4, '4k'], [6, '32k'], [8, '128k']], yt: et.map(v => [v, p100(v)]), title: 'Test-Time Efficiency E', xl: 'Proactive Budget P', yl: 'E (%)', yo: 40 });
      C.reveal(1); R.reveal(1);
      const ax = (Cc, x, y) => [Cc.X(x) + (Cc === C ? G.cx : G.rx), Cc.Y(y) + (Cc === C ? G.cy : G.ry)];   // absolute coords for the morph layer
      // benchmark list
      const bx = G.bx, b0 = G.by; E(svg, 'text', { x: bx + 8, y: b0 + 12, class: 't-lab' }, 'Benchmark');
      OB.forEach((b, i) => {
        const y = b0 + 26 + i * 34, on = b === bed, g = E(svg, 'g', { style: 'cursor:pointer', role: 'button', tabindex: 0, 'aria-label': BED[b], 'aria-pressed': on });
        E(g, 'rect', { x: bx, y, width: 148, height: 28, rx: 7, fill: on ? 'var(--pro-fill)' : '#FFFFFF', stroke: on ? 'var(--accent)' : '#DDDDDD', 'stroke-width': on ? 1.6 : 1 });
        E(g, 'text', { x: bx + 12, y: y + 19, class: on ? 't-strong' : 't-lab', style: `font-size:13px;fill:${on ? '#0B6B3A' : '#444444'}` }, BED[b]);
        const go = () => { if (b !== bed) { bed = b; build(); fig.player.play(0); } };
        g.addEventListener('click', go); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      });
      E(svg, 'text', { x: bx + 8, y: b0 + 206, class: 't-lab', style: 'font-size:11.5px' }, MODEL[model]); E(svg, 'text', { x: bx + 8, y: b0 + 221, class: 't-lab', style: 'font-size:11.5px' }, '3 seeds');
      const gainT = E(svg, 'text', { x: bx + 8, y: b0 + 244, class: 't-strong', style: 'font-size:24px;fill:#1E9E4A' }), gainL = E(svg, 'text', { x: bx + 8, y: b0 + 262, class: 't-lab', style: 'font-size:11.5px' });
      // left panel: none curve, ghosts, live curve and shaded gain
      const a0 = curve(0), path = c => 'M' + T.map((t, i) => `${C.X(t)},${C.Y(c[i])}`).join(' L');
      const ghosts = PL.map(p => E(C.g, 'path', { d: path(curve(p)), fill: 'none', stroke: RAMP[p], 'stroke-width': 1.2, opacity: 0 }));
      const area = E(C.g, 'path', { fill: 'var(--accent)', opacity: .16 });
      E(C.g, 'path', { d: path(a0), fill: 'none', stroke: 'var(--none)', 'stroke-width': 2.6, 'stroke-dasharray': '2 6', 'stroke-linecap': 'round' });
      T.forEach((t, i) => E(C.g, 'circle', { cx: C.X(t), cy: C.Y(a0[i]), r: 3.8, fill: '#FFFFFF', stroke: 'var(--none)', 'stroke-width': 1 }));
      const line = E(C.g, 'path', { fill: 'none', 'stroke-width': 2.8, 'stroke-linejoin': 'round' });
      const dots = T.map(() => E(C.g, 'circle', { r: 4.2, stroke: 'var(--mark)', 'stroke-width': 1 }));
      // right panel: connecting line and one point per level; morph layer on top of both
      const eLine = E(R.g, 'path', { fill: 'none', stroke: '#10AB42', 'stroke-width': 2.4 });
      E(R.g, 'line', { x1: 0, x2: R.w, y1: R.Y(Es[0]), y2: R.Y(Es[0]), stroke: 'var(--none)', 'stroke-dasharray': '4 4' });
      const ePts = PL.map((p, k) => E(R.g, 'circle', { cx: R.X(k), cy: R.Y(Es[k]), r: 4.6, fill: k ? RAMP[p] : '#FFFFFF', stroke: k ? 'var(--mark)' : '#8A8A8A', 'stroke-width': 1.1 }));
      const morph = E(svg, 'path', { fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
      const SL = fig.dur - 600, slot = SL / NS_;   // slot 0 collapses the no-study curve; slots 1-8 draw then collapse
      fig.render = t => {
        const s = clamp(t / SL) * NS_, k = Math.min(NS_ - 1, Math.floor(s)), f = t >= SL ? 1 : s - k;
        const draw = k ? clamp(f / .62) : 1, mo = f >= 1 ? 1 : k ? clamp((f - .66) / .34) : clamp(f / .8);
        const cur = curve(PL[k]), allp = T.map((t2, j) => [C.X(t2), C.Y(cur[j])]), base = T.map((t2, j) => [C.X(t2), C.Y(a0[j])]);
        const sp = draw * (n - 1), m = Math.floor(sp), fr = sp - m, lerp = (a, b) => [a[0] + (b[0] - a[0]) * fr, a[1] + (b[1] - a[1]) * fr];
        const pts = allp.slice(0, m + 1), bs = base.slice(0, m + 1);
        if (m < n - 1 && fr > 0) { pts.push(lerp(allp[m], allp[m + 1])); bs.push(lerp(base[m], base[m + 1])); }
        line.setAttribute('d', k ? 'M' + pts.map(q => q.join(',')).join(' L') : ''); line.style.stroke = pc(RAMP[PL[k]]);
        dots.forEach((d, j) => { d.setAttribute('cx', allp[j][0]); d.setAttribute('cy', allp[j][1]); d.style.fill = pc(RAMP[PL[k]]); d.style.opacity = k && j <= m ? 1 : 0; });
        area.setAttribute('d', k ? 'M' + pts.map(q => q.join(',')).join(' L') + ' L' + bs.reverse().map(q => q.join(',')).join(' L') + ' Z' : '');
        ghosts.forEach((g, gi) => { g.style.opacity = gi && gi < k ? .35 : 0; });
        // morph: the finished curve shrinks onto its E point
        const tgt = ax(R, k, Es[k]), e = eio(mo);
        morph.setAttribute('d', mo > 0 && mo < 1 ? 'M' + T.map((t2, j) => { const [x, y] = ax(C, t2, cur[j]); return `${x + (tgt[0] - x) * e},${y + (tgt[1] - y) * e}`; }).join(' L') : '');
        morph.style.stroke = pc(RAMP[PL[k]]); morph.style.strokeWidth = 2.8 * (1 - .6 * e);
        const shown = PL.map((p, j) => j < k || (j === k && mo >= 1));
        ePts.forEach((c, j) => { c.style.opacity = shown[j] ? 1 : 0; });
        const last = shown.lastIndexOf(true);
        eLine.setAttribute('d', last > 0 ? 'M' + Es.slice(0, last + 1).map((v, j) => `${R.X(j)},${R.Y(v)}`).join(' L') : '');
        const kk = Math.max(last, 0), g = Es[kk] - Es[0];
        gainT.textContent = last > 0 ? `${g >= 0 ? '+' : '−'}${Math.abs(100 * g).toFixed(0)} pts` : ''; gainL.textContent = last > 0 ? `gain in E at P = ${kfmt(PL[kk])}` : '';
      };
      fig.player?.seek(fig.dur);
    }
    build();
    return fig;
  };

  // 6. online: eight tasks, one clock ─────────────────────────────────────────────────────────────────────────────
  FIGS.online = (el, D) => {
    // one session clock drives both rows: eight tasks (top), generating share and the session split (bottom)
    const svg = fresh(el, '0 0 960 800'), O = D.online, G = O.grid, ARMS = ['blocking', 'free1_p1k', 'free1_p4k', 'free1_p16k'];
    const charts = O.tasks.map((tk, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const C = chart(svg, { x: 40 + col * 232, y: 84 + row * 205, w: 190, h: 130, xd: [0, 120], yd: [0, 100], xt: [0, 60, 120].map(t => [t, String(t)]), yt: [0, 50, 100].map(v => [v, String(v)]), title: tk.name });
      ARMS.forEach(a => { const m = tk.arms[a].m; C.add(m.map((r, j) => [G[j], r[0]]), { c: ARM[a][1], dash: ARM[a][2], w: a === 'free1_p16k' ? 2.4 : 1.7, hr: 3.2, band: m.map((r, j) => [G[j], r[2]]).concat(m.map((r, j) => [G[j], r[1]]).reverse()) }); });
      return C;
    });
    legend(svg, 0, 22, ARMS.map(a => [ARM[a][0], ARM[a][1], ARM[a][2], false]), 14, 'Tokens per Wait:', 480);
    E(svg, 'text', { x: 40, y: 54, class: 't-sub' }, 'Seeds Beating the Median Human (%)');
    E(svg, 'text', { x: 480, y: 472, 'text-anchor': 'middle', class: 't-lab' }, 'Session Time (min)');
    const clk = E(svg, 'text', { x: 920, y: 54, 'text-anchor': 'end', class: 't-strong', style: 'font-size:15px' });
    // bottom row: generating share over time (log clock) and the mean split of the session
    const I = D.idle, M = I.models.deepseek;
    const C = chart(svg, { x: 70, y: 548, w: 380, h: 190, xs: 'log', xd: [1, 120], yd: [0, 1], xt: [1, 5, 10, 30, 60, 120].map(t => [t, String(t)]), yt: [0, .25, .5, .75, 1].map(v => [v, pct(v)]), title: 'Share of Session Spent Generating', xl: 'Session Time (min, log)', yo: 40 });
    ARMS.forEach(a => C.add(I.t.map((t, i) => [t, M.pooled[a][i]]), { c: ARM[a][1], dash: ARM[a][2], w: a === 'free1_p16k' ? 2.6 : 2 }));
    const BX = 600, BW = 320, BY = 520, bars = [];
    E(svg, 'text', { x: BX, y: BY + 16, class: 't-title' }, 'Split of the Session So Far');
    const ST = I.split_t;   // running split at each minute, mean over 8 tasks
    ARMS.forEach((a, i) => {
      const y = BY + 40 + i * 44;
      E(svg, 'text', { x: BX - 10, y: y + 17, 'text-anchor': 'end', class: 't-strong', style: `fill:${a === 'blocking' ? '#666666' : pc(ARM[a][1])}` }, a === 'blocking' ? 'Reactive' : ARM[a][0]);
      const segs = ['var(--gen)', 'var(--pro-fill)', 'var(--warn)', 'var(--idle)'].map((c, j) => E(svg, 'rect', { y, height: 24, fill: c, stroke: j === 1 ? '#2E9E4A' : null, 'stroke-width': 1.5 }));
      const fs = 'font-size:12px', ty = y + 17;
      const tr = E(svg, 'text', { x: BX + 4, y: ty, class: 't-strong', style: `${fs};fill:#3A2A1A` }), tf = E(svg, 'text', { y: ty, class: 't-strong', style: `${fs};fill:#1E7A3E` }), ti = E(svg, 'text', { y: ty, 'text-anchor': 'middle', class: 't-lab', style: `${fs};fill:#555555` });
      bars.push({ a, segs, tr, tf, ti });
    });
    const AY = BY + 40 + 4 * 44 - 6; E(svg, 'line', { x1: BX, x2: BX + BW, y1: AY, y2: AY, stroke: '#9A9A9A' });
    [0, .25, .5, .75, 1].forEach(v => E(svg, 'text', { x: BX + BW * v, y: AY + 16, 'text-anchor': 'middle', class: 't-ax' }, pct(v)));
    legend(svg, 0, 784, [['Reactive Generation', 'var(--gen)', null, false], ['Proactive Fill', '#2E9E4A', null, false], ['Idle', '#C8C8C8', null, false]], 14, null, 760);
    const CLK = 8400, fig = { dur: 8800, render: t => {
      const m = 120 * clamp(t / CLK);
      charts.forEach(c => c.reveal(m / 120));
      C.reveal(m <= 1 ? 0 : Math.log(m) / Math.log(120));
      clk.textContent = `t = ${Math.round(m)} min`; if (fig.ro) fig.ro.textContent = '';
      // the split covers the session so far, so it is recomputed every minute of the clock
      const mi = Math.max(0, Math.min(ST.t.length - 1, Math.round(m) - 1)), on = t > 0;
      bars.forEach(bb => { const v = ST.split[bb.a][mi]; let x0 = 0;
        bb.segs.forEach((e, j) => { e.setAttribute('x', BX + BW * x0); e.setAttribute('width', on ? BW * v[j] : 0); x0 += v[j]; });
        const [r, f, , id] = v; bb.tr.textContent = on ? pct(r) : ''; bb.tf.textContent = on && f > .005 ? `fill ${pct(f)}` : ''; bb.tf.setAttribute('x', BX + BW * (r + f) + 5);
        bb.ti.textContent = on ? pct(id) : ''; bb.ti.setAttribute('x', BX + BW * (1 - id / 2) + (f > .005 ? 28 : 0)); });
    } };
    controls(el, fig);
    return fig;
  };

  FIGS.harvey = (el, D) => {
    // one method at a time: the picked method draws in colour over grey ghosts of the rest; its description sits on the right
    const H = D.harvey, HS = '#2B6CB0';
    const pent = (x, y, r) => 'M' + Array.from({ length: 5 }, (_, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return [x + r * Math.cos(a), y + r * Math.sin(a)].map(v => v.toFixed(1)).join(','); }).join(' L') + 'Z';
    const star = (x, y, r) => 'M' + Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * .45 : r; return [x + q * Math.cos(a), y + q * Math.sin(a)].map(v => v.toFixed(1)).join(','); }).join(' L') + 'Z';
    const dot = (x, y) => `M${x - 6},${y} a6,6 0 1,0 12,0 a6,6 0 1,0 -12,0Z`;
    const M = {
      plain: { name: 'Plain Study', c: '#8C8C8C', mk: (x, y) => `M${x},${y - 5.5} L${x + 5},${y + 3.5} L${x - 5},${y + 3.5}Z`, pts: H.series.plain.map(r => [r[1], r[2]]),
        txt: 'One agent explores the filesystem with tools for P tokens, with the same study prompt we use on every benchmark. The solver gets the whole trace. E stays near 0.40 from 16k to 262k tokens.', stat: 'Solver tool calls per task: 17.8 (no study: 27.9)' },
      wiki: { name: 'Wiki Study', c: '#8CCB00', mk: (x, y) => `M${x},${y - 5.5} L${x + 5.5},${y} L${x},${y + 5.5} L${x - 5.5},${y}Z`, pts: H.series.wiki.map(r => [r[1], r[2]]),
        txt: 'The same single agent, told to explore as if it were building a wiki of the matters, then to write that wiki out. It beats the plain study at every budget (E ≈ 0.47 against 0.40), but more tokens add little.', stat: 'Solver tool calls per task: 11.5 (no study: 27.9)' },
      par: { name: 'Parallel, N Agents', c: '#00934A', mk: (x, y) => `M${x - 4.6},${y} a4.6,4.6 0 1,0 9.2,0 a4.6,4.6 0 1,0 -9.2,0Z`, pts: H.series.par.map(r => [r[1], r[2]]), labs: H.series.par.map(r => r[0]),
        txt: 'N agents, each with its own context window and 131k tokens, study separate shares of the matters. Each trace becomes a short note, and the solver reads all the notes. Eight agents reach E = 0.585 for $1.36 and read about 1,300 documents.', stat: 'Solver tool calls per task, 8 agents: 19.9 (no study: 27.9)' },
      ser: { name: 'Serial, N Agents', c: '#8B5A2B', dash: '6 4', mk: (x, y) => `M${x - 4.2},${y - 4.2} h8.4 v8.4 h-8.4Z`, pts: H.series.ser.map(r => [r[1], r[2]]), labs: H.series.ser.map(r => r[0]),
        txt: 'Each agent first reads the notes of the agents before it, then studies and writes its own note, like compaction. Eight serial agents read about 380 documents, against about 1,300 in parallel, and reach E = 0.547 for $1.03.', stat: 'Solver tool calls per task, 8 agents: 20.3 (no study: 27.9)' },
      hier: { name: 'Hierarchical Summary', c: HS, mk: (x, y) => star(x, y, 7.5), pts: H.schema,
        txt: 'No exploration. With reasoning off, the model reads the opening words of each matter’s documents and writes an index line and a short page per matter. The three stars are three reading depths; the deepest costs $0.41 and matches eight parallel agents (E = 0.589).', stat: 'Solver tool calls per task: 21.0 (no study: 27.9)' },
      rag: { name: 'RAG', c: '#E6550D', mk: dot, pts: [H.pts.rag_tool_opt],
        txt: 'Every document is cut into 600-token chunks and embedded. The solver’s prompt gets the chunks closest to the task, up to 16k tokens. The index costs $2.68; E = 0.458.', stat: 'Baseline (Lewis et al., 2020)' },
      rlm: { name: 'RLM', c: '#7B2D8E', mk: (x, y) => pent(x, y, 7), pts: [H.pts.rlm],
        txt: 'A recursive language model, with the whole filesystem in its REPL, writes a briefing before it sees any task. $0.83; E = 0.515.', stat: 'Baseline (Zhang et al., 2025)' },
    };
    const ORDER = ['plain', 'wiki', 'ser', 'par', 'hier', 'rag', 'rlm'];
    let pick = 'par';
    const fig = { dur: 1, render: () => {} };
    controls(el, fig, { extra: bar => { seg(bar, 'Method', ORDER.map(k => [k, M[k].name]), pick, v => { pick = v; build(); fig.player.seek(fig.dur); });
      QA('.seg button', bar).forEach((b, i) => b.style.setProperty('--mc', M[ORDER[i]].c)); } });
    const wrap = (p, x, y, s, n, st) => { const words = s.split(' '); let line = '', yy = y; words.forEach(w => { if ((line + ' ' + w).trim().length > n) { E(p, 'text', { x, y: yy, class: 't-lab', style: st }, line.trim()); line = w; yy += 19; } else line += ' ' + w; }); E(p, 'text', { x, y: yy, class: 't-lab', style: st }, line.trim()); return yy; };
    function build() {
      const svg = fresh(el, '0 0 960 400');
      const C = chart(svg, { x: 70, y: 46, w: 500, h: 290, title: 'Test-Time Efficiency vs Study Cost', xs: 'log', xd: [0.007, 4], yd: [0.36, 0.6], xt: [[0.01, '$0.01'], [0.1, '$0.10'], [1, '$1']], yt: [.4, .45, .5, .55, .6].map(v => [v, v.toFixed(2)]), xl: 'Study Cost (USD)', yl: 'Test-Time Efficiency E', yo: 44 });
      C.reveal(1);
      E(C.g, 'text', { x: C.w - 4, y: C.h - 8, 'text-anchor': 'end', class: 't-ax' }, `No study: E = ${H.none.toFixed(2)}`);   // below the zoomed range
      // every method in colour; the picked one gets a soft halo, a thicker line and its N labels
      ORDER.forEach(k => { const m = M[k], on = k === pick, g = E(C.g, 'g', { opacity: on ? 1 : .7 }), pts = m.pts.map(([x, y]) => [C.X(x), C.Y(y)]), d = 'M' + pts.map(q => q.join(',')).join(' L');
        if (on) { if (pts.length > 1) E(g, 'path', { d, fill: 'none', stroke: m.c, 'stroke-width': 11, opacity: .18, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
          pts.forEach(([x, y]) => E(g, 'circle', { cx: x, cy: y, r: 11, fill: m.c, opacity: .18 })); }
        if (pts.length > 1) E(g, 'path', { d, fill: 'none', stroke: m.c, 'stroke-width': on ? 3 : 1.8, 'stroke-dasharray': m.dash });
        pts.forEach(([x, y]) => E(g, 'path', { d: m.mk(x, y), fill: m.c, stroke: 'var(--mark)', 'stroke-width': on ? 1.1 : .8 }));
        if (on) (m.labs || []).forEach((l, j) => E(g, 'text', { x: pts[j][0], y: pts[j][1] - 14, 'text-anchor': 'middle', class: 't-strong', style: `font-size:12px;fill:${m.c}` }, l)); });
      const m = M[pick];
      // description panel
      const R = E(svg, 'g'), RX = 620;
      E(R, 'text', { x: RX, y: 52, class: 't-title', style: `fill:${m.c}` }, m.name);
      const yEnd = wrap(R, RX, 84, m.txt, 44, 'font-size:13.5px;fill:#444444');
      E(R, 'text', { x: RX, y: yEnd + 30, class: 't-strong', style: 'font-size:12.5px;fill:#6E6D66' }, m.stat);
      if (m.labs) E(R, 'text', { x: RX, y: yEnd + 50, class: 't-lab', style: 'font-size:12px;fill:#8A8A8A' }, 'Numbers next to points give the number of agents N.');
      fig.render = () => {};
      fig.player?.seek(fig.dur);
    }
    build();
    return fig;
  };

  // 9. tool calls fall with a study ───────────────────────────────────────────────────────────────────────────────
  FIGS.tools = (el, D) => {
    const nar = el.clientWidth < 600, svg = fresh(el, nar ? '0 0 480 1150' : '0 0 960 600'), PS = [0, 256, 4096, 32768, 131072], beds = ['studybench', 'sweqa_pro', 'harvey'], anns = [];
    const RP = { 0: 'var(--none)', 256: '#8CCB00', 4096: '#1FC23A', 32768: '#00934A', 131072: '#053B24' };
    const down = (C, y0, y1, lab) => { const g = E(C.top, 'g'), x = C.w + 14;   // arrow from no study down to the largest study
      E(g, 'line', { x1: x, x2: x, y1: y0, y2: y1 - 2, stroke: 'var(--accent)', 'stroke-width': 2.2 }); arrowHead(g, x, y1, 90, 'var(--accent)');
      E(g, 'text', { x: x + 8, y: (y0 + y1) / 2 - 2, class: 't-strong', style: 'fill:var(--accent-ink)' }, lab[0]); E(g, 'text', { x: x + 8, y: (y0 + y1) / 2 + 13, class: 't-lab', style: 'font-size:11.5px;fill:var(--accent-ink)' }, lab[1]); return g; };
    const SH = { 4096: (x, y, r) => `M${x},${y - r} L${x + r},${y + r * .75} L${x - r},${y + r * .75}Z`, 32768: (x, y, r) => `M${x - r * .8},${y - r * .8} h${r * 1.6} v${r * 1.6} h${-r * 1.6}Z`, 131072: (x, y, r) => `M${x},${y - r} L${x + r},${y} L${x},${y + r} L${x - r},${y}Z` };   // paper Fig. 9 markers
    beds.forEach((b, i) => {
      const A = D.calls[b], n = 7, T = D.T.slice(0, n), mx = Math.max(...PS.flatMap(p => A[String(p)].slice(0, n)));
      const top = Math.ceil(mx / 20) * 20;
      const C = chart(svg, { x: nar ? 56 + (i % 2) * 222 : 64 + i * 305, y: nar ? 44 + Math.floor(i / 2) * 236 : 40, w: nar ? 136 : 225, yl: (nar ? i % 2 : i) ? null : 'Tool Calls', yo: 40, h: nar ? 150 : 190, xs: 'log', xd: [64, T[n - 1]], yd: [0, top], xt: T.filter((t, j) => nar ? j % 3 === 0 : j % 2 === 0 || j === n - 1).map(t => [t, kfmt(t)]), yt: [0, top / 2, top].map(v => [v, String(v)]), title: BED[b], xl: !nar && i === 1 ? 'Test Budget T' : null });
      PS.forEach(p => C.add(T.map((t, j) => [t, A[String(p)][j]]), { c: RP[p], dash: p ? null : '5 4', dots: true, hollow: !p, shape: SH[p], r: 2.6, w: p === 131072 ? 2.6 : 1.8, head: false }));
      const a0 = A['0'][n - 1], a1 = A['131072'][n - 1], g = E(C.top, 'g');
      g.remove(); anns.push(down(C, C.Y(a0), C.Y(a1), [`${(a0 / a1).toFixed(a0 / a1 >= 3 ? 0 : 1)}×`, 'fewer']));
      C.reveal(1);
    });
    ['studybench', 'sweqa_pro', 'harvey'].forEach((b, i) => {
      const N = D.nat[b], Ps = [64, 256, 1024, 4096, 16384, 32768, 65536], top = Math.ceil(Math.max(...Object.values(N).flat()) / 4000) * 4000;
      const C = chart(svg, { x: nar ? 56 + (i % 2) * 222 : 64 + i * 305, y: nar ? 576 + Math.floor(i / 2) * 236 : 320, w: nar ? 136 : 225, h: nar ? 150 : 170, xs: 'log', xd: [16, 65536], yd: [0, top], xt: nar ? [[16, '0'], [1024, '1k'], [65536, '64k']] : [[16, '0'], [64, '64'], [1024, '1k'], [65536, '64k']], yt: [0, top / 2, top].map(v => [v, v ? v / 1000 + 'k' : '0']), title: BED[b], yl: (nar ? i % 2 : i) ? null : 'Thinking Tokens', yo: nar ? 42 : 50, xl: !nar && i === 1 ? 'Proactive Budget P (Uncapped Solver)' : null });
      E(C.g, 'line', { x1: C.X(16), x2: C.w, y1: C.Y(N['0'][0]), y2: C.Y(N['0'][0]), stroke: '#8A8A8A', 'stroke-dasharray': '2 4', 'stroke-width': 1.6 });
      E(C.g, 'path', { d: 'M' + Ps.map(p => `${C.X(p)},${C.Y(N[p][2])}`).join(' L') + ' L' + Ps.map(p => `${C.X(p)},${C.Y(N[p][1])}`).reverse().join(' L') + ' Z', fill: '#053B24', 'fill-opacity': .14 });
      C.add([[16, N['0'][0]]], { c: 'var(--none)', dots: true, hollow: true, head: false });
      C.add(Ps.map(p => [p, N[p][0]]), { c: '#053B24', dots: true, r: 3, w: 2.4, head: false });
      down(C, C.Y(N['0'][0]), C.Y(N[65536][0]), [`${(N['0'][0] / N[65536][0]).toFixed(1)}×`, 'fewer']);
      E(C.g, 'text', { x: C.X(32), y: C.h + 18, 'text-anchor': 'middle', class: 't-ax' }, '//');
      C.reveal(1);
    });
    const LP = PS.map(p => [p ? kfmt(p) : 'No Study', RP[p], p ? null : '5 4', true, SH[p]]);
    if (nar) { E(svg, 'text', { x: 240, y: 508, 'text-anchor': 'middle', class: 't-lab' }, 'Test Budget T'); E(svg, 'text', { x: 240, y: 1040, 'text-anchor': 'middle', class: 't-lab' }, 'Proactive Budget P (Uncapped Solver)'); legend(svg, 0, 1076, LP.slice(0, 3), 14, null, 240); legend(svg, 0, 1108, LP.slice(3), 14, null, 240); }
    else legend(svg, 0, 586, LP.concat([['Bottom, Uncapped Solver', '#053B24', '6 3']]), 14, 'Top, Proactive Budget P:', 480);
    return { dur: 1, render: () => {} };
  };

  // 9b. amortisation: tokens saved against tasks sharing one context ─────────────────────────────────────────────────
  FIGS.amort = (el, D) => {
    const nar = el.clientWidth < 600, svg = fresh(el, nar ? '0 0 480 680' : '0 0 960 360'), PC = { 4096: '#B4DD59', 32768: '#2E9E4F', 65536: '#053B24' };
    const fk = v => Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)}k` : String(Math.round(v));
    [['sweqa_pro', 'SWE-QA-Pro'], ['studybench', 'StudyBench'], ['harvey', 'Harvey LAB']].forEach(([b, name], i) => {
      const A = D.amort[b], arms = Object.entries(A.arms), N = 1024, ns = Array.from({ length: 101 }, (_, k) => 2 ** (k / 10));
      const lo = -Math.max(...arms.map(([, [pg]]) => pg)), hi = Math.max(0, ...arms.map(([, [pg, sv]]) => N * sv - pg));
      const step = [25e3, 50e3, 100e3, 200e3, 250e3, 500e3, 1e6, 2e6].find(v => (hi - lo) / v <= 6) || 5e6;
      const ylo = Math.floor(lo / step) * step, yhi = Math.ceil(hi / step) * step, yt = []; for (let v = ylo; v <= yhi + 1; v += step) yt.push([v, fk(v)]);
      const C = chart(svg, { x: nar ? 70 + (i % 2) * 226 : 80 + i * 300, y: nar ? 60 + Math.floor(i / 2) * 300 : 46, w: nar ? 128 : 200, h: nar ? 190 : 220, xs: 'log', xd: [1, 1024], yd: [ylo, yhi], xt: (nar ? [1, 32, 1024] : [1, 4, 16, 64, 256, 1024]).map(v => [v, v === 1024 ? '1k' : String(v)]), yt, title: name, sub: `Target Accuracy ${Math.round(100 * A.target)}%`, xl: nar || i === 1 ? 'Tasks Sharing One Context' : null, yl: (nar ? i % 2 : i) ? null : 'Tokens Saved vs No Study', yo: 52 });
      E(C.g, 'line', { x1: 0, x2: C.w, y1: C.Y(0), y2: C.Y(0), stroke: '#8A8A8A', 'stroke-dasharray': '6 5', 'stroke-width': 1.4 });
      const ends = [], bes = [];
      arms.forEach(([P, [pg, sv]]) => {
        C.add(ns.map(n => [n, n * sv - pg]), { c: PC[P], w: 2.4, head: false });
        const be = pg / sv; if (sv > 0 && be >= 1 && be <= N) bes.push(be); if (sv > 0 && be >= 1 && be <= N) E(C.top, 'circle', { cx: C.X(be), cy: C.Y(0), r: 4.6, fill: PC[P], stroke: '#1A1A1A', 'stroke-width': 1 });
        ends.push({ y: C.Y(N * sv - pg), t: `+${fk(N * sv - pg)}`, c: P === '4096' ? '#5E8A12' : PC[P] });
      });
      if (i === 0 && bes.length) { const lx = C.X(Math.sqrt(bes[0] * bes[bes.length - 1])), ly = C.Y(0) - 52; E(C.top, 'text', { x: lx, y: ly - 6, 'text-anchor': 'middle', class: 't-lab' }, 'Break-Even'); bes.forEach(b => E(C.top, 'line', { x1: lx, y1: ly, x2: C.X(b), y2: C.Y(0) - 7, stroke: '#888888', 'stroke-width': 1 })); }
      spread(ends, 15).forEach(e => E(C.top, 'text', { x: C.w + 6, y: e.y + 4, class: 't-strong', style: `font-size:11.5px;fill:${e.c}` }, e.t));
      C.reveal(1);
    });
    legend(svg, 0, nar ? 662 : 344, [4096, 32768, 65536].map(P => [kfmt(P), PC[P]]), 16, 'Proactive Budget P =', nar ? 240 : 480);
    return { dur: 1, render: () => {} };
  };

  // 9c. sessions: explore once while idle, and every session after is fast (schematic, ported from the Oct 18 site) ──
  FIGS.sessions = el => {
    const nar = el.clientWidth < 600, F = nar ? 1.4 : 1, svg = fresh(el, nar ? '0 0 800 1780' : '0 0 1600 900');
    const NS = 'http://www.w3.org/2000/svg', CSSK = new Set(['font-size', 'font-weight', 'font-style', 'font-family', 'fill', 'opacity']);   // as inline style, so the page's svg text rules do not override them
    const mk = (p, tag, a, txt) => { const e = document.createElementNS(NS, tag); for (const k in a) if (CSSK.has(k) && tag !== 'path' && tag !== 'rect' && tag !== 'circle' && tag !== 'ellipse') e.style.setProperty(k, k === 'font-size' ? a[k] + 'px' : a[k]); else e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; p.appendChild(e); return e; };
    const EX = '#C98A1A', SO = '#0B6B3A', CL = '#D97757', Y0 = 120, RH = nar ? 150 : 138, BH = 46, MONO = 'var(--mono)';
    const SIDES = nar ? [{ x: 20, oy: 0, title: 'Without proactive study' }, { x: 20, oy: 880, title: 'With proactive study' }] : [{ x: 30, oy: 0, title: 'Without proactive study' }, { x: 820, oy: 0, title: 'With proactive study' }];
    const BX = nar ? 150 : 172, BW = nar ? 610 : 575;
    const PROMPTS = ['Where are dependency checks centralized?', 'Where are test tags transformed?', 'Why does behave need explicit tags?', 'How do descriptor overrides get merged?'];
    const READS = ['cekit/cli.py', 'cekit/tools.py', 'cekit/descriptor/image.py', 'cekit/generator/base.py', 'cekit/builder.py', 'cekit/test/behave_tester.py', 'cekit/test/behave_runner.py', 'cekit/test/collector.py', 'cekit/descriptor/base.py', 'cekit/config.py', 'cekit/builders/docker_builder.py', 'cekit/descriptor/packages.py'].map(f => nar ? f.split('/').pop() : f);
    const SPIN = ['✻', '✶', '✳', '✢', '·', '✢', '✳', '✶'], Ez = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
    const EXL = [0.58, 0.62, 0.56, 0.60], SOL = [0.17, 0.14, 0.19, 0.16], EXSR = [0.10, 0.19, 0.07, 0.15];
    const UNIT = 4.6, TY = 0.9, STUDY0 = 0.6, STUDY = UNIT * 0.97, START = STUDY0 + STUDY + 0.5;
    const sched = side => { let t = START; return EXL.map((e, i) => { const ex = (side ? EXSR[i] : e) * UNIT, so = SOL[i] * UNIT, r = { a: t, ty: t + TY, ex: t + TY + ex, so: t + TY + ex + so, e: side ? EXSR[i] : e, s: SOL[i] }; t = r.so + 0.35; return r; }); };
    const S = [sched(0), sched(1)], END = Math.max(S[0][3].so, S[1][3].so), TOTAL = END + 3;
    const lerp = (a, b, u) => a.map((v, i) => Math.round(v + (b[i] - v) * u)), hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
    const GR = [92, 196, 107], YE = [247, 201, 72], RE = [229, 83, 61];
    const fcol = m => hex(m >= 0 ? lerp(YE, GR, m) : lerp(YE, RE, -m)), fedge = m => hex(lerp(m >= 0 ? lerp(YE, GR, m) : lerp(YE, RE, -m), [60, 40, 20], 0.45));
    const face = (p, x, y, mood, r) => {
      const g = mk(p, 'g', {}); mk(g, 'circle', { cx: x, cy: y, r, fill: fcol(mood), stroke: fedge(mood), 'stroke-width': 2 });
      const ey = y - r * 0.18, ex = r * 0.36, br = -mood;
      for (const s of [-1, 1]) {
        mk(g, 'ellipse', { cx: x + s * ex, cy: ey, rx: r * 0.09, ry: r * (0.14 - 0.04 * Math.max(0, -mood)), fill: '#2A1F10' });
        if (mood < 0.2) { const xi = x + s * (ex - r * 0.17), xo = x + s * (ex + r * 0.17), yb = ey - r * 0.3; mk(g, 'path', { d: `M${xi},${yb - br * r * 0.13} L${xo},${yb + br * r * 0.05}`, stroke: '#2A1F10', 'stroke-width': 2.4, 'stroke-linecap': 'round' }); }
      }
      const my = y + r * 0.38, mw = r * 0.42, c = mood * r * 0.32;
      mk(g, 'path', { d: `M${x - mw},${my - c * 0.3} Q${x},${my + c} ${x + mw},${my - c * 0.3}`, stroke: '#2A1F10', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' });
      if (mood < -0.85) for (const q of [-1, 1]) mk(g, 'path', { d: `M${x + q * ex},${ey + r * 0.16} q${-r * 0.1},${r * 0.26} 0,${r * 0.32} q${r * 0.1},${-r * 0.06} 0,${-r * 0.32} Z`, fill: '#6EC1FF', opacity: Math.min(1, (-0.85 - mood) / 0.12) });
    };
    const doc = (p, x, y, s, fill, a = 1) => { const g = mk(p, 'g', { opacity: a }); mk(g, 'rect', { x: x - 8 * s, y: y - 10 * s, width: 16 * s, height: 20 * s, rx: 2.5 * s, fill, stroke: SO, 'stroke-width': 2 });
      for (const k of [0, 1, 2]) mk(g, 'path', { d: `M${x - 4.5 * s},${y - 4.5 * s + k * 5 * s} h${k === 2 ? 6 * s : 9 * s}`, stroke: SO, 'stroke-width': 1.6 * s, 'stroke-linecap': 'round' }); };
    const status = (p, x, y, parts) => { const g = mk(p, 'text', { x, y, 'font-size': 17 * F, 'font-family': MONO }); for (const [c, t] of parts) mk(g, 'tspan', { fill: c }, t); };
    const dyn = mk(svg, 'g', {});
    SIDES.forEach((sd, k) => {
      mk(svg, 'text', { x: sd.x, y: sd.oy + 50, 'font-size': 30 * F, 'font-weight': 800, fill: k ? SO : '#555' }, sd.title);
      const ya = sd.oy + Y0 + 5 * RH - 18;
      mk(svg, 'path', { d: `M${sd.x + BX},${ya} H${sd.x + BX + BW - 16}`, stroke: '#555', 'stroke-width': 2.2, fill: 'none' });
      mk(svg, 'path', { d: `M${sd.x + BX + BW - 6},${ya} l-14,-7 v14 Z`, fill: '#555' });
      mk(svg, 'text', { x: sd.x + BX + BW - 8, y: ya + 30, 'font-size': 20 * F, 'font-weight': 500, fill: '#444', 'text-anchor': 'end' }, 'Time');
    });
    mk(svg, 'path', { d: nar ? 'M20,860 H780' : 'M805,24 V820', stroke: '#E4E4E4', 'stroke-width': 2 });
    const set = t => {
      dyn.replaceChildren();
      const sp = SPIN[Math.floor(t * 10) % SPIN.length];
      SIDES.forEach((sd, k) => {
        const X0 = sd.x + BX, oy = sd.oy, y0 = oy + Y0, by0 = y0 + 40;
        if (k === 1) {
          const u = Ez((t - STUDY0) / STUDY), on = t >= STUDY0 ? '#333' : '#C8C8C8';
          mk(dyn, 'text', { x: sd.x, y: by0 + BH / 2 + 7, 'font-size': 19 * F, 'font-weight': 800, fill: on }, 'Proactive');
          mk(dyn, 'text', { x: sd.x, y: by0 + BH / 2 + 7 + 22 * F, 'font-size': 19 * F, 'font-weight': 800, fill: on }, 'study');
          if (u > 0) { mk(dyn, 'rect', { x: X0, y: by0, width: 0.97 * BW * u, height: BH, rx: 8, fill: EX });
            if (u > 0.5) mk(dyn, 'text', { x: X0 + 0.485 * BW, y: by0 + BH / 2 + 8, 'font-size': 21 * F, 'font-weight': 800, fill: '#FFF', 'text-anchor': 'middle', opacity: Ez((u - 0.5) / 0.2) }, 'Exploring repo, once'); }
          if (t >= STUDY0 && u < 1) status(dyn, X0, y0 + 30, [[CL, `${sp} Studying… `], ['#777', `Read(${READS[Math.floor((t - STUDY0) * 5) % READS.length]})`]]);
          else if (u >= 1) status(dyn, X0, y0 + 30, [[SO, '✓ Study done '], ['#999', nar ? '→ notes for every session' : '→ notes shared with every session']]);
        } else mk(dyn, 'text', { x: X0, y: by0 + BH / 2 + 7, 'font-size': 19 * F, 'font-style': 'italic', fill: '#AAAAAA' }, t < START ? 'idle, waiting for the first prompt' : 'no study');
        if (k === 1 && t >= STUDY0 + STUDY) {
          const cx = sd.x + BX - 15, yS = by0 + BH / 2, ap = Ez((t - STUDY0 - STUDY) / 0.4);
          S[1].forEach((R, i) => { const yi = oy + Y0 + (i + 1) * RH + 40 + BH / 2, u = Ez((t - (R.a - 0.45)) / 0.45);
            if (u > 0) { mk(dyn, 'path', { d: `M${cx},${yS + 14} V${yS + 14 + (yi - 14 - yS - 14) * u}`, stroke: SO, 'stroke-width': 3.4, opacity: 0.85 }); doc(dyn, cx, u < 1 ? yS + (yi - yS) * u : yi, 1.05, '#E3F4E8'); } });
          doc(dyn, cx, yS, 1.3, '#FFFFFF', ap);
        }
        S[k].forEach((R, i) => {
          const y = oy + Y0 + (i + 1) * RH, by = y + 40, on = t >= R.a;
          mk(dyn, 'text', { x: sd.x, y: by + BH / 2 + 7, 'font-size': 18 * F, 'font-weight': 500, fill: on ? '#333' : '#C8C8C8' }, nar ? `S${i + 1}` : `Session ${i + 1}`);
          if (!on) return;
          const ue = Ez((t - R.ty) / (R.ex - R.ty)), us = Ez((t - R.ex) / (R.so - R.ex)), low = k ? 0.55 : -1, end = k ? 1 : -0.55;
          const mood = t < R.ty ? 1 : t < R.ex ? 1 + (low - 1) * Math.pow(ue, 0.8) : low + (end - low) * us;
          face(dyn, sd.x + (nar ? 82 : 116), by + BH / 2, mood, 24 * (nar ? 1.25 : 1));
          const xe = X0 + R.e * BW * ue, xs0 = X0 + R.e * BW + 5, xs = xs0 + R.s * BW * us;
          if (ue > 0) { mk(dyn, 'rect', { x: X0, y: by, width: Math.max(0, xe - X0), height: BH, rx: 8, fill: EX });
            if (ue > 0.62 && R.e > 0.3) mk(dyn, 'text', { x: X0 + R.e * BW / 2, y: by + BH / 2 + 8, 'font-size': 21 * F, 'font-weight': 800, fill: '#FFF', 'text-anchor': 'middle', opacity: Ez((ue - 0.62) / 0.15) }, 'Exploring repo'); }
          if (us > 0) { mk(dyn, 'rect', { x: xs0, y: by, width: Math.max(0, xs - xs0), height: BH, rx: 8, fill: SO });
            if (us > 0.5) mk(dyn, 'text', { x: xs0 + R.s * BW / 2, y: by + BH / 2 + 7, 'font-size': 17 * F, 'font-weight': 800, fill: '#FFF', 'text-anchor': 'middle', opacity: Ez((us - 0.5) / 0.2) }, 'Solving'); }
          const sy = y + 30;
          if (t < R.ty) { const n = Math.ceil(PROMPTS[i].length * Ez((t - R.a) / (R.ty - R.a) * 1.15)); mk(dyn, 'text', { x: X0, y: sy, 'font-size': 17 * F, fill: '#222', 'font-family': MONO }, '> ' + PROMPTS[i].slice(0, n) + (Math.floor(t * 4) % 2 ? '▌' : ' ')); }
          else if (t < R.ex) status(dyn, X0, sy, [[CL, `${sp} Exploring… `], ['#777', `Read(${READS[(Math.floor((t - R.ty) * 5) + i * 3) % READS.length]})`]]);
          else if (t < R.so) status(dyn, X0, sy, [[CL, `${sp} Solving… `], ['#777', 'Edit(answer.md)']]);
          else status(dyn, X0, sy, [[SO, '✓ Done '], ['#999', nar ? '' : '> ' + PROMPTS[i]]]);
        });
      });
    };
    return { dur: TOTAL * 1000, render: t => set(t / 1000) };
  };

  // ── boot ───────────────────────────────────────────────────────────────────────────────────────────────────────
  fetch('data.json?v=20261030').then(r => r.json()).then(D => {
    const live = [];
    const build = el => {
      const i = live.findIndex(f => f.el === el), was = live[i];
      if (was) { was.player.stop(); QA('.ctl', el).forEach(c => c.remove()); }
      const make = FIGS[el.dataset.fig]; if (!make) return;
      const fig = make(el, D); fig.el = el;
      fig.still = !ANIMATED.has(el.dataset.fig);
      if (!fig.scrub && !fig.still) controls(el, fig);
      new Player(fig); fig.player.seek(fig.dur);
      if (was) { fig.seen = true; live[i] = fig; } else live.push(fig);
    };
    QA('[data-fig]').forEach(build);
    if (REDUCED) return;
    const io = new IntersectionObserver(es => es.forEach(e => {
      const fig = live.find(f => f.el === e.target); if (!fig) return;
      if (e.isIntersecting && !fig.seen && !fig.still) { fig.seen = true; fig.player.play(0); }
    }), { threshold: .35 });
    live.forEach(f => io.observe(f.el));
    // phone vs desktop layout: rebuild a figure when its width crosses 600 px
    let rt, narw = new Map(live.map(f => [f.el, f.el.clientWidth < 600]));
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => QA('[data-fig]').forEach(el => { const n = el.clientWidth < 600; if (narw.get(el) !== n) { narw.set(el, n); build(el); } }), 200); });
  }).catch(() => QA('figure.fig .stage').forEach(s => { s.textContent = 'This figure could not load its data. Reload the page, or open it over http(s).'; s.classList.add('err'); }));
  // contents rail: highlight the section being read
  const links = QA('nav.toc a'), heads = QA('main h2[id]');
  const so = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-10% 0px -80% 0px' });
  heads.forEach(h => so.observe(h));
})();
