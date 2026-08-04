/* ============================================================
   STATLAB / ui.js — 画面制御・作図・各解析の実行
   ============================================================ */
(function () {
  'use strict';
  const S = window.SL, AD = S.advice;
  const $ = id => document.getElementById(id);
  const el = (sel, ctx) => (ctx || document).querySelector(sel);
  const els = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];
  const fmt = (v, d = 4) => (v === null || v === undefined || (typeof v === 'number' && !isFinite(v))) ? '—'
    : (typeof v === 'number' ? (Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-4 && v !== 0) ? v.toExponential(3) : v.toFixed(d)) : v);
  const pcell = p => `<td class="${p < 0.05 ? 'sig' : 'nsig'}">${p < 1e-4 ? p.toExponential(2) : p.toFixed(4)}</td>`;

  /* ---------- 署名要素：二変量正規密度の等高線 ---------- */
  (function contour() {
    const cv = $('contourField'); if (!cv) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = cv.getContext('2d');
    let W, H, t = 0;
    const resize = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };
    resize(); addEventListener('resize', resize);
    const peaks = [
      { x: .24, y: .30, sx: .20, sy: .13, r: .35, w: 1.0 },
      { x: .74, y: .62, sx: .16, sy: .22, r: -.30, w: .85 },
      { x: .52, y: .18, sx: .13, sy: .10, r: .1, w: .55 }
    ];
    const dens = (px, py, tt) => {
      let s = 0;
      peaks.forEach((p, i) => {
        const ox = p.x + Math.sin(tt * .00013 + i * 2) * .05;
        const oy = p.y + Math.cos(tt * .00011 + i * 1.3) * .045;
        const dx = px - ox, dy = py - oy;
        const c = Math.cos(p.r), sn = Math.sin(p.r);
        const u = (dx * c + dy * sn) / p.sx, v = (-dx * sn + dy * c) / p.sy;
        s += p.w * Math.exp(-0.5 * (u * u + v * v));
      });
      return s;
    };
    const LV = [.06, .12, .2, .3, .42, .56, .72, .9];
    const COL = ['#440154', '#46337e', '#365c8d', '#277f8e', '#1fa187', '#4ac16d', '#a0da39', '#fde725'];
    function draw() {
      t += 16; ctx.clearRect(0, 0, W, H);
      const step = Math.max(9, Math.round(Math.min(W, H) / 90));
      const cols = Math.ceil(W / step), rows = Math.ceil(H / step);
      const grid = [];
      for (let j = 0; j <= rows; j++) { grid.push([]); for (let i = 0; i <= cols; i++) grid[j].push(dens(i * step / W, j * step / H, t)); }
      LV.forEach((lv, li) => {
        ctx.beginPath();
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
          const a = grid[j][i], b = grid[j][i + 1], c = grid[j + 1][i + 1], d = grid[j + 1][i];
          const x0 = i * step, y0 = j * step, x1 = x0 + step, y1 = y0 + step;
          const ip = (p, q, va, vb) => { const f = (lv - va) / (vb - va || 1e-9); return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]; };
          const P = [];
          if ((a < lv) !== (b < lv)) P.push(ip([x0, y0], [x1, y0], a, b));
          if ((b < lv) !== (c < lv)) P.push(ip([x1, y0], [x1, y1], b, c));
          if ((c < lv) !== (d < lv)) P.push(ip([x1, y1], [x0, y1], c, d));
          if ((d < lv) !== (a < lv)) P.push(ip([x0, y1], [x0, y0], d, a));
          if (P.length >= 2) { ctx.moveTo(P[0][0], P[0][1]); ctx.lineTo(P[1][0], P[1][1]); }
        }
        ctx.strokeStyle = COL[li] + '55'; ctx.lineWidth = li > 5 ? 1.1 : .8; ctx.stroke();
      });
      requestAnimationFrame(draw);
    }
    draw();
  })();

  /* ---------- Plotly 共通設定 ---------- */
  const VIRIDIS = ['#fde725', '#7ad151', '#22a884', '#2a788e', '#414487', '#440154', '#b12a90', '#fca636'];
  const BASE = {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(6,10,22,0.45)',
    font: { family: 'IBM Plex Mono, monospace', size: 11, color: '#b3c0dd' },
    colorway: VIRIDIS,
    margin: { l: 58, r: 24, t: 42, b: 50 },
    xaxis: { gridcolor: 'rgba(126,150,200,0.11)', zerolinecolor: 'rgba(126,150,200,0.24)', linecolor: 'rgba(126,150,200,0.24)' },
    yaxis: { gridcolor: 'rgba(126,150,200,0.11)', zerolinecolor: 'rgba(126,150,200,0.24)', linecolor: 'rgba(126,150,200,0.24)' },
    legend: { bgcolor: 'rgba(0,0,0,0)', font: { size: 10 } },
    title: { font: { family: 'Bricolage Grotesque, sans-serif', size: 14, color: '#e8eefb' }, x: 0, xanchor: 'left' },
    hoverlabel: { bgcolor: '#111a2d', bordercolor: '#22a884', font: { family: 'IBM Plex Mono', color: '#e8eefb' } }
  };
  const CFG = { displaylogo: false, responsive: true, modeBarButtonsToRemove: ['select2d', 'lasso2d'], toImageButtonOptions: { format: 'png', scale: 2 } };
  const merge = (o = {}) => {
    const L = JSON.parse(JSON.stringify(BASE));
    Object.keys(o).forEach(k => {
      if (k.startsWith('xaxis') || k.startsWith('yaxis')) L[k] = Object.assign({}, BASE.xaxis, o[k]);
      else if (k === 'title' && typeof o[k] === 'string') L.title = Object.assign({}, BASE.title, { text: o[k] });
      else if (typeof o[k] === 'object' && !Array.isArray(o[k]) && L[k]) L[k] = Object.assign(L[k], o[k]);
      else L[k] = o[k];
    });
    return L;
  };
  const plot = (id, data, layout) => Plotly.newPlot($(id), data, merge(layout), CFG);
  const clearPlot = id => { const n = $(id); if (n) { Plotly.purge(n); n.innerHTML = ''; } };

  /* ---------- 出力ヘルパ ---------- */
  function renderAdvice(id, list) {
    const tag = { key: '結論', ok: '良好', info: '補足', warn: '注意', risk: '重要' };
    $(id).innerHTML = (list || []).map(a =>
      `<div class="adv ${a.level}"><div class="t"><span class="tag">${tag[a.level] || ''}</span>${a.title}</div><div class="b">${a.body.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</div></div>`).join('');
  }
  function statCards(pairs) {
    return `<div class="stats">${pairs.map(([k, v, cls]) => `<div class="stat ${cls || ''}"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}</div>`;
  }
  function tableHTML(head, rows) {
    return `<div class="tbl-wrap"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  const td = (v, cls) => `<td${cls ? ` class="${cls}"` : ''}>${v}</td>`;

  /* ---------- データストア ---------- */
  const D = { cols: [], n: 0, name: '' };
  const numCols = () => D.cols.filter(c => c.type === 'num');
  const catCols = () => D.cols.filter(c => c.type === 'cat');
  const col = name => D.cols.find(c => c.name === name);
  const numOf = name => { const c = col(name); return c ? c.values.map(v => (v === null || v === '' || isNaN(+v)) ? NaN : +v) : []; };
  const strOf = name => { const c = col(name); return c ? c.values.map(v => v === null ? '' : String(v)) : []; };
  function pairsOf(names) { // 欠測を含む行を除いた完全ケース
    const arrs = names.map(numOf);
    const keep = [];
    for (let i = 0; i < D.n; i++) if (arrs.every(a => isFinite(a[i]))) keep.push(i);
    return { idx: keep, cols: arrs.map(a => keep.map(i => a[i])) };
  }
  function groupBy(yName, gName) {
    const y = numOf(yName), g = strOf(gName);
    const map = new Map();
    for (let i = 0; i < D.n; i++) { if (!isFinite(y[i]) || !g[i]) continue; if (!map.has(g[i])) map.set(g[i], []); map.get(g[i]).push(y[i]); }
    const labels = [...map.keys()].sort();
    return { labels, groups: labels.map(l => map.get(l)) };
  }

  function detectType(values) {
    const nonEmpty = values.filter(v => v !== null && v !== '' && v !== undefined);
    if (!nonEmpty.length) return 'cat';
    const nums = nonEmpty.filter(v => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && isFinite(+v.replace(/,/g, ''))));
    const uniq = new Set(nonEmpty.map(String)).size;
    if (nums.length / nonEmpty.length >= 0.9 && uniq > 2) return 'num';
    if (nums.length / nonEmpty.length >= 0.9 && uniq <= 2 && nonEmpty.every(v => +v === 0 || +v === 1)) return 'num';
    return 'cat';
  }
  function setData(rows, fields, name) {
    D.cols = fields.map(f => {
      const raw = rows.map(r => { const v = r[f]; return (v === undefined || v === null || String(v).trim() === '') ? null : v; });
      const type = detectType(raw);
      const values = type === 'num' ? raw.map(v => v === null ? null : (typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, '')))) : raw;
      return { name: f, values, type, missing: raw.filter(v => v === null).length };
    });
    D.n = rows.length; D.name = name;
    refreshUI();
  }

  /* ---------- セレクトの再構築 ---------- */
  const SEL = {
    all: ['ex_g', 'a_f1', 'a_f2', 'c_r', 'c_c', 'l_y', 'dt_y', 'n_y', 'ts_t', 's_date', 't_split'],
    num: ['ex_y', 'ex_x', 'd_overlay', 't_v1', 't_v2', 'a_y', 'v_v1', 'v_v2', 'g_y', 'ts_y', 's_close'],
    numMulti: ['r_vars', 'r_ctrl', 'g_x', 'l_x', 'dt_x', 'n_x', 'a_cols']
  };
  function fill(id, names, opt) {
    const s = $(id); if (!s) return;
    const prev = s.multiple ? [...s.selectedOptions].map(o => o.value) : s.value;
    s.innerHTML = (opt && opt.blank ? `<option value="">${opt.blank}</option>` : '') +
      names.map(n => `<option value="${n}">${n}</option>`).join('');
    if (s.multiple) [...s.options].forEach(o => { if (prev.includes(o.value)) o.selected = true; });
    else if (names.includes(prev)) s.value = prev;
  }
  function refreshUI() {
    const all = D.cols.map(c => c.name), nums = numCols().map(c => c.name), cats = D.cols.filter(c => c.type === 'cat').map(c => c.name);
    SEL.all.forEach(id => fill(id, all, { blank: '（なし）' }));
    SEL.num.forEach(id => fill(id, nums, { blank: id === 'ex_x' || id === 'v_v2' || id === 'd_overlay' ? '（なし）' : null }));
    SEL.numMulti.forEach(id => fill(id, nums));
    fill('a_f1', cats.length ? cats : all, { blank: '（なし）' });
    fill('a_f2', cats.length ? cats : all, { blank: '（なし）' });
    fill('ex_g', cats.length ? cats : all, { blank: '（なし）' });
    fill('t_split', cats.length ? cats : all, { blank: '使わない（2列を直接比較）' });
    fill('l_y', all, { blank: null });
    fill('dt_y', all, { blank: null });
    fill('n_y', all, { blank: null });
    if (nums.length > 1) { const x = $('ex_x'); if (x) x.selectedIndex = Math.min(2, x.options.length - 1); }
    $('dsDot').className = 'dot' + (D.n ? '' : ' off');
    $('dsInfo').textContent = D.n ? `${D.name} — ${D.n} 行 × ${D.cols.length} 列` : 'データ未読み込み';
    renderPreview(); renderColSummary(); updatePosLevels();
  }
  function renderPreview() {
    if (!D.n) { $('preview').innerHTML = ''; return; }
    $('previewHint').textContent = `${D.n} 行のうち先頭 50 行を表示しています。`;
    const rows = [];
    for (let i = 0; i < Math.min(50, D.n); i++) rows.push([td(i + 1)].concat(D.cols.map(c => td(c.values[i] === null ? '<span style="color:#e4548a">·</span>' : c.values[i]))));
    $('preview').innerHTML = `<div class="tbl-wrap data"><table><thead><tr><th>#</th>${D.cols.map(c => `<th>${c.name}<br><span style="opacity:.6">${c.type === 'num' ? '数値' : 'カテゴリ'}</span></th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function renderColSummary() {
    if (!D.n) return;
    const rows = D.cols.map(c => {
      if (c.type === 'num') {
        const d = S.describe(c.values.filter(v => v !== null));
        return [td(c.name), td('数値'), td(d ? d.n : 0), td(c.missing), td(fmt(d && d.mean)), td(fmt(d && d.sd)), td(fmt(d && d.min)), td(fmt(d && d.max))];
      }
      const u = new Set(c.values.filter(v => v !== null).map(String));
      return [td(c.name), td('カテゴリ'), td(D.n - c.missing), td(c.missing), td(`${u.size} 水準`), td([...u].slice(0, 4).join(', ') + (u.size > 4 ? ' …' : '')), td('—'), td('—')];
    });
    $('colSummary').innerHTML = tableHTML(['列名', '型', '有効数', '欠測', '平均 / 水準数', 'SD / 例', '最小', '最大'], rows);
  }

  /* ---------- ファイル読み込み ---------- */
  function decode(buf) {
    let txt = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    if ((txt.match(/\uFFFD/g) || []).length > 2) { try { txt = new TextDecoder('shift_jis').decode(buf); } catch (e) { } }
    return txt;
  }
  function parseText(txt, name) {
    const res = Papa.parse(txt.trim(), { header: true, skipEmptyLines: true, dynamicTyping: false });
    if (!res.meta.fields || res.meta.fields.length === 0) { alert('列を認識できませんでした。'); return; }
    setData(res.data, res.meta.fields.filter(f => f !== ''), name);
  }
  $('drop').addEventListener('click', () => $('file').click());
  $('drop').addEventListener('dragover', e => { e.preventDefault(); $('drop').classList.add('over'); });
  $('drop').addEventListener('dragleave', () => $('drop').classList.remove('over'));
  $('drop').addEventListener('drop', e => {
    e.preventDefault(); $('drop').classList.remove('over');
    if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
  });
  $('file').addEventListener('change', e => { if (e.target.files[0]) readFile(e.target.files[0]); });
  function readFile(f) {
    const r = new FileReader();
    r.onload = () => parseText(decode(r.result), f.name);
    r.readAsArrayBuffer(f);
  }
  $('manualLoad').addEventListener('click', () => {
    const body = $('manualBody').value.trim();
    if (!body) { alert('データを入力してください。'); return; }
    const head = $('manualHead').value.trim();
    const lines = body.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => l.split(/[,\t;\s]+/).filter(s => s !== ''));
    const w = Math.max(...lines.map(l => l.length));
    const fields = head ? head.split(/[,\t]+/).map(s => s.trim()) : Array.from({ length: w }, (_, i) => w === 1 ? 'x' : `列${i + 1}`);
    while (fields.length < w) fields.push(`列${fields.length + 1}`);
    const rows = lines.map(l => Object.fromEntries(fields.map((f, i) => [f, l[i] ?? null])));
    setData(rows, fields, '直接入力');
  });
  $('manualClear').addEventListener('click', () => { $('manualBody').value = ''; $('manualHead').value = ''; });

  /* ---------- サンプルデータ ---------- */
  function mkRnd(seed) {
    let x = seed >>> 0;
    const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
    const gauss = (m, s) => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const pick = a => a[Math.floor(rnd() * a.length)];
    const tdist = df => { let z = gauss(0, 1), c = 0; for (let i = 0; i < df; i++) c += gauss(0, 1) ** 2; return z / Math.sqrt(c / df); };
    return { rnd, gauss, pick, tdist };
  }
  const SAMPLES = {
    /* ① 中古マンション：回帰・分散分析・決定木・MLP の主役 */
    mansion() {
      const { rnd, gauss } = mkRnd(31415);
      const AR = [['都心3区', 1.44, 12, 35, .16], ['城南・城西', 1.22, 5, 22, .28],
      ['城東・城北', .96, 2, 14, .30], ['近郊（多摩・県境）', .71, .6, 8, .26]];
      const rows = [];
      for (let i = 0; i < 1200; i++) {
        const r = rnd(); let c = 0, a = AR[3];
        for (const q of AR) { c += q[4]; if (r <= c) { a = q; break; } }
        const P = Math.round((a[2] + rnd() * (a[3] - a[2])) * 10) / 10;
        let A = Math.round(gauss(56, 15) * 10) / 10; A = Math.min(Math.max(A, 22), 100);
        const age = [Math.floor(rnd() * 13), Math.floor(rnd() * 31), Math.floor(rnd() * 46)][Math.floor(rnd() * 3)];
        const walk = Math.max(1, Math.min(25, Math.floor(Math.abs(gauss(0, 6)) + 1)));
        const fl = Math.max(1, Math.min(38, Math.floor(Math.abs(gauss(0, 6)) + 1)));
        let u = 62 * a[1];
        u *= 1 + .55 * Math.log(1 + P / 3);
        u *= Math.exp(-.045 * walk);
        u *= age <= 10 ? 1 - .03 * age : .70 * Math.exp(-.012 * (age - 10));
        u *= Math.pow(55 / A, .18);
        u *= 1 + .011 * fl;
        if (walk <= 5 && P >= 15) u *= 1.16;
        u *= Math.exp(gauss(0, .085));
        rows.push({ エリア: a[0], 専有面積: A.toFixed(1), 築年数: age, 駅徒歩分: walk, 所在階: fl, 駅乗降客数: P.toFixed(1), 成約価格: Math.round(u * A / 10) * 10 });
      }
      return { rows, fields: ['エリア', '専有面積', '築年数', '駅徒歩分', '所在階', '駅乗降客数', '成約価格'], name: '中古マンション成約（生成データ・1200件）' };
    },

    /* ② サブスク解約：ロジスティック回帰・決定木・ROC の主役 */
    churn() {
      const { rnd, gauss, pick } = mkRnd(80512);
      const rows = [];
      const planName = f => f <= 790 ? 'ライト' : (f <= 1480 ? 'スタンダード' : 'プレミアム');
      for (let i = 0; i < 2000; i++) {
        const plan = pick([490, 790, 990, 1480, 1980]);
        const months = Math.max(1, Math.min(48, Math.round(Math.abs(gauss(0, 15)) + 1)));
        const login = Math.max(0, Math.min(30, Math.round(gauss(13, 8))));
        const hours = Math.max(0, Math.round((login * gauss(1.7, .7) + gauss(2, 3)) * 10) / 10);
        const support = Math.max(0, Math.round(Math.abs(gauss(0, 1.3))));
        const hike = rnd() < .34 ? 1 : 0;
        const lin = 0.05 - .145 * login - .030 * hours + .42 * support - .042 * months
          + .00058 * plan + .72 * hike + gauss(0, .30);
        const p = 1 / (1 + Math.exp(-lin));
        rows.push({
          プラン: planName(plan), 月額料金: plan, 契約月数: months,
          直近30日ログイン日数: login, 月間視聴時間: hours.toFixed(1),
          サポート問合せ回数: support, 値上げ経験: hike,
          解約: rnd() < p ? 1 : 0
        });
      }
      return { rows, fields: ['プラン', '月額料金', '契約月数', '直近30日ログイン日数', '月間視聴時間', 'サポート問合せ回数', '値上げ経験', '解約'], name: '動画サブスク解約（生成データ・2000件）' };
    },

    /* ③ 家庭の電気：時系列・季節分解・非線形回帰の主役 */
    power() {
      const { gauss } = mkRnd(60219);
      const rows = [];
      for (let i = 0; i < 84; i++) {                       // 7年 × 12か月
        const yr = 2019 + Math.floor(i / 12), mo = i % 12 + 1;
        const temp = 16.2 + 10.8 * Math.sin(2 * Math.PI * (mo - 4.2) / 12) + gauss(0, 1.1);
        const cool = 15.5 * Math.pow(Math.max(0, temp - 24), 1.32);
        const heat = 12.8 * Math.pow(Math.max(0, 16 - temp), 1.28);
        const trend = -0.55 * i;                            // 省エネ家電への置換で微減
        const kwh = Math.max(90, 268 + cool + heat + trend + gauss(0, 16));
        const unit = 26.5 + 0.115 * i;                      // 単価は年々上昇
        rows.push({
          年月: `${yr}-${String(mo).padStart(2, '0')}`,
          平均気温: temp.toFixed(1),
          電気使用量kWh: Math.round(kwh),
          電気料金円: Math.round((kwh * unit + 1200) / 10) * 10,
          在宅日数: Math.max(4, Math.min(31, Math.round(gauss(11, 3))))
        });
      }
      return { rows, fields: ['年月', '平均気温', '電気使用量kWh', '電気料金円', '在宅日数'], name: '家庭の電気使用量（生成データ・84か月）' };
    },

    /* ④ 株価：リスク指標・相関・ベータ推定の主役 */
    stock() {
      const { rnd, gauss, tdist } = mkRnd(70413);
      const rows = [];
      let px = 2480, idx = 33200, fx = 148.5, vol = .011, d = new Date(2023, 0, 4);
      for (let i = 0; i < 600; i++) {
        vol = .00004 + .90 * vol + .09 * Math.abs(gauss(0, .012));   // ボラティリティ・クラスタリング
        const mkt = gauss(.0004, .0092) + .0035 * tdist(4) * 0;
        const fxr = gauss(0, .0055);
        const shock = tdist(4) * vol;                                 // 裾の厚いショック
        const ret = .0002 + 1.25 * mkt + .28 * fxr + shock;
        const open = px * (1 + gauss(0, .003));
        px = px * (1 + ret);
        const hi = Math.max(open, px) * (1 + Math.abs(gauss(0, .004)));
        const lo = Math.min(open, px) * (1 - Math.abs(gauss(0, .004)));
        idx *= (1 + mkt); fx *= (1 + fxr);
        while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
        rows.push({
          日付: d.toISOString().slice(0, 10),
          始値: open.toFixed(1), 高値: hi.toFixed(1), 安値: lo.toFixed(1), 終値: px.toFixed(1),
          出来高: Math.round(9.2e5 * (1 + 3.4 * Math.abs(ret) / .01 * (.3 + rnd() * .5))),
          日経平均: Math.round(idx), ドル円: fx.toFixed(2)
        });
        d.setDate(d.getDate() + 1);
      }
      return { rows, fields: ['日付', '始値', '高値', '安値', '終値', '出来高', '日経平均', 'ドル円'], name: '株価・市場指数・為替（生成データ・600営業日）' };
    },

    /* ⑤ A/Bテスト：母比率の検定・カイ二乗・分散分析の主役 */
    abtest() {
      const { rnd, gauss, pick } = mkRnd(11242);
      const arms = [['A（現行）', .082, 42], ['B（新デザイン）', .118, 58], ['C（新コピー）', .091, 45]];
      const rows = [];
      arms.forEach(a => {
        for (let i = 0; i < 500; i++) {
          const dev = rnd() < .62 ? 'スマホ' : (rnd() < .78 ? 'PC' : 'タブレット');
          const stay = Math.max(5, Math.round(gauss(a[2], 22) * (dev === 'PC' ? 1.28 : 1)));
          const views = Math.max(1, Math.round(stay / 18 + gauss(1.4, 1.1)));
          const p = a[1] * (dev === 'PC' ? 1.22 : dev === 'タブレット' ? 1.05 : .92) * (1 + (views - 3) * .07);
          const buy = rnd() < Math.max(.005, Math.min(.6, p)) ? 1 : 0;
          rows.push({
            群: a[0], デバイス: dev, 滞在秒数: stay, ページ閲覧数: views,
            購入: buy, 購入額: buy ? Math.round(Math.exp(gauss(8.55, .52)) / 10) * 10 : 0
          });
        }
      });
      return { rows, fields: ['群', 'デバイス', '滞在秒数', 'ページ閲覧数', '購入', '購入額'], name: 'WebサイトA/Bテスト（生成データ・1500件）' };
    }
  };
  els('[data-sample]').forEach(b => b.addEventListener('click', () => {
    const s = SAMPLES[b.dataset.sample]();
    setData(s.rows, s.fields, s.name);
    b.blur();
  }));

  /* ---------- ナビゲーション ---------- */
  const META = {
    data: ['DATA', 'データを読み込む', 'CSV をドロップするか、数値を直接貼り付けてください。処理はすべてブラウザ内で完結し、データが外部に送信されることはありません。'],
    explore: ['EXPLORE', '記述統計とプロット', '分布の形を見ずに検定を選ぶことはできません。まずここで形を確かめます。'],
    dist: ['DISTRIBUTION', '確率分布ラボ', '母数を動かして密度関数と累積分布関数の変化を確かめ、確率とパーセント点を求めます。'],
    ttest: ['INFERENCE', '平均の検定（t / z）', '母平均に関する仮説を検定します。p 値だけでなく、効果量と信頼区間を必ず併せて読んでください。'],
    anova: ['INFERENCE', '分散分析・群間比較', '3 群以上の平均の比較と、その後の多重比較。ノンパラメトリック版も同じ画面から実行できます。'],
    propvar: ['INFERENCE', '母比率・母分散', '比率とばらつきに関する検定。正規近似が使えるかどうかを自動で判定します。'],
    cat: ['CATEGORICAL', 'カテゴリデータ（χ²）', 'クロス集計表から独立性・適合度を検定し、期待度数の条件も確認します。'],
    corr: ['ASSOCIATION', '相関・主成分', '変数どうしの関連の強さを測り、多変量を少数の軸に要約します。'],
    reg: ['MODELING', '回帰分析', '係数の推定に加えて、多重共線性・系列相関・影響力のある観測値まで診断します。'],
    logit: ['MODELING', 'ロジスティック回帰', '2 値の結果を予測し、オッズ比と判別性能（ROC）を評価します。'],
    tree: ['MODELING', '決定木・ランダムフォレスト', '分岐ルールとして解釈できるモデル。過学習の度合いを検証データで確認します。'],
    ts: ['TIME SERIES', '時系列解析', '定常性の確認、成分分解、コレログラム、そして予測まで。'],
    stock: ['FINANCE', '株価分析', 'リターンとリスクの記述統計、テクニカル指標、参考予測。投資助言ではありません。'],
    mlp: ['DEEP LEARNING', '多層パーセプトロン', 'ブラウザ内（TensorFlow.js）でニューラルネットを学習させます。'],
    navi: ['START HERE', 'やりたいことから探す', '統計の用語がわからなくても大丈夫です。目的から順に絞り込んで、使う手法と見るべき数字まで案内します。'],
    guide: ['HANDBOOK', '統計ハンドブック', '確率分布・検定・回帰・機械学習・時系列を、図と表で通して読める教科書パートです。']
  };
  function go(name) {
    els('.sect').forEach(s => s.classList.toggle('on', s.id === 'sect-' + name));
    els('.nav-item').forEach(b => b.setAttribute('aria-current', b.dataset.sect === name ? 'true' : 'false'));
    const m = META[name] || ['', '', ''];
    $('crumb').textContent = m[0]; $('pageTitle').textContent = m[1]; $('pageLede').textContent = m[2];
    if (innerWidth <= 900) { $('rail').classList.add('collapsed'); scrollTo({ top: 0, behavior: 'smooth' }); }
    els('.sect.on .plot').forEach(p => { if (p.data) Plotly.Plots.resize(p); });
  }
  els('.nav-item').forEach(b => b.addEventListener('click', () => go(b.dataset.sect)));
  $('railToggle').addEventListener('click', () => $('rail').classList.toggle('collapsed'));

  const need = () => { if (!D.n) { alert('先に「データを読み込む」でデータを用意してください。'); go('data'); return false; } return true; };

  /* ============================================================
     記述統計とプロット
     ============================================================ */
  els('#ex_plots .chip').forEach(c => c.addEventListener('click', () => {
    els('#ex_plots .chip').forEach(o => o.setAttribute('aria-pressed', o === c ? 'true' : 'false'));
  }));
  $('ex_run').addEventListener('click', () => {
    if (!need()) return;
    const yName = $('ex_y').value, gName = $('ex_g').value, xName = $('ex_x').value;
    if (!yName) { alert('数値変数を選んでください。'); return; }
    const kind = el('#ex_plots .chip[aria-pressed="true"]').dataset.p;
    const y = numOf(yName).filter(isFinite);
    const d = S.describe(y);
    $('ex_stats').innerHTML = statCards([
      ['n', d.n], ['平均', fmt(d.mean)], ['標準偏差', fmt(d.sd)], ['標準誤差', fmt(d.sem)],
      ['中央値', fmt(d.median)], ['第1四分位', fmt(d.q1)], ['第3四分位', fmt(d.q3)], ['四分位範囲', fmt(d.iqr)],
      ['最小', fmt(d.min)], ['最大', fmt(d.max)], ['歪度', fmt(d.skew, 3), Math.abs(d.skew) > 1 ? 'neg' : ''],
      ['超過尖度', fmt(d.kurt, 3), Math.abs(d.kurt) > 3 ? 'neg' : ''], ['変動係数', fmt(d.cv, 3)], ['合計', fmt(d.sum, 2)]
    ]) + (gName ? renderGroupTable(yName, gName) : '');
    drawExplore(kind, yName, gName, xName);
    const sw = y.length >= 3 && y.length <= 5000 ? S.shapiroWilk(y) : null;
    const jb = S.jarqueBera(y), ad = S.andersonDarling(y), ks = S.ksTestNormal(y);
    $('ex_norm').innerHTML = tableHTML(['検定', '統計量', 'p 値', '判定（α=0.05）'], [
      sw ? [td('Shapiro–Wilk'), td('W = ' + fmt(sw.W, 5)), pcell(sw.p), td(sw.p < .05 ? '正規性を棄却' : '正規性を棄却せず')] : null,
      [td('Jarque–Bera'), td(fmt(jb.statistic, 4)), pcell(jb.p), td(jb.p < .05 ? '正規性を棄却' : '正規性を棄却せず')],
      [td('Anderson–Darling'), td('A² = ' + fmt(ad.statistic, 4)), pcell(ad.p), td(ad.p < .05 ? '正規性を棄却' : '正規性を棄却せず')],
      [td('Kolmogorov–Smirnov'), td('D = ' + fmt(ks.D, 5)), pcell(ks.p), td(ks.p < .05 ? '正規性を棄却' : '正規性を棄却せず')]
    ].filter(Boolean));
    renderAdvice('ex_advice', AD.describe(d, yName).concat(AD.normality(sw, jb, ad)));
  });
  function renderGroupTable(yName, gName) {
    const { labels, groups } = groupBy(yName, gName);
    if (!labels.length) return '';
    return '<div style="margin-top:14px">' + tableHTML(['群', 'n', '平均', 'SD', '標準誤差', '中央値', '最小', '最大'],
      groups.map((g, i) => [td(labels[i]), td(g.length), td(fmt(S.mean(g))), td(fmt(S.sd(g))), td(fmt(S.sem(g))), td(fmt(S.median(g))), td(fmt(Math.min(...g))), td(fmt(Math.max(...g)))])) + '</div>';
  }
  function drawExplore(kind, yName, gName, xName) {
    const y = numOf(yName);
    const gs = gName ? groupBy(yName, gName) : { labels: [yName], groups: [y.filter(isFinite)] };
    const T = [];
    if (kind === 'hist') {
      gs.groups.forEach((g, i) => {
        T.push({ type: 'histogram', x: g, name: gs.labels[i], histnorm: 'probability density', opacity: .55, marker: { color: VIRIDIS[i % 8], line: { color: 'rgba(0,0,0,.35)', width: 1 } }, nbinsx: S.histogramBins(g) });
        const k = S.kde(g, 220);
        T.push({ type: 'scatter', mode: 'lines', x: k.x, y: k.y, name: `${gs.labels[i]} KDE`, line: { color: VIRIDIS[i % 8], width: 2.4 }, hovertemplate: '%{x:.3f}<br>密度 %{y:.4f}<extra></extra>' });
      });
      return plot('ex_plot', T, { barmode: 'overlay', title: `${yName} の分布（ヒストグラム＋カーネル密度推定）`, xaxis: { title: yName }, yaxis: { title: '密度' } });
    }
    if (kind === 'violin') {
      gs.groups.forEach((g, i) => T.push({
        type: 'violin', y: g, name: gs.labels[i], box: { visible: true, width: .18 }, meanline: { visible: true },
        points: g.length <= 400 ? 'all' : false, jitter: .28, pointpos: 0, marker: { size: 3, opacity: .45, color: '#e8eefb' },
        line: { color: VIRIDIS[i % 8], width: 2 }, fillcolor: VIRIDIS[i % 8] + '44', spanmode: 'soft'
      }));
      return plot('ex_plot', T, { title: `${yName} のバイオリンプロット${gName ? `（${gName} 別）` : ''}`, yaxis: { title: yName } });
    }
    if (kind === 'box') {
      gs.groups.forEach((g, i) => T.push({ type: 'box', y: g, name: gs.labels[i], boxmean: 'sd', boxpoints: 'suspectedoutliers', marker: { color: VIRIDIS[i % 8], outliercolor: '#e4548a' }, line: { width: 1.8 } }));
      return plot('ex_plot', T, { title: `${yName} の箱ひげ図（■=平均、点線=±1SD）`, yaxis: { title: yName } });
    }
    if (kind === 'strip') {
      gs.groups.forEach((g, i) => T.push({ type: 'box', y: g, name: gs.labels[i], boxpoints: 'all', jitter: .75, pointpos: 0, fillcolor: 'rgba(0,0,0,0)', line: { color: 'rgba(0,0,0,0)' }, marker: { color: VIRIDIS[i % 8], size: 6, opacity: .62 } }));
      return plot('ex_plot', T, { title: `${yName} のストリップチャート（個々の観測値）`, yaxis: { title: yName } });
    }
    if (kind === 'ridge') {
      gs.groups.forEach((g, i) => {
        const k = S.kde(g, 200);
        const mx = Math.max(...k.y);
        T.push({ type: 'scatter', mode: 'lines', x: k.x, y: k.y.map(v => v / mx * .9 + i), fill: 'tonexty', name: gs.labels[i], line: { color: VIRIDIS[i % 8], width: 2 }, fillcolor: VIRIDIS[i % 8] + '40' });
      });
      return plot('ex_plot', T, { title: `リッジラインプロット（${gName || yName}）`, xaxis: { title: yName }, yaxis: { tickvals: gs.labels.map((_, i) => i), ticktext: gs.labels, title: '' } });
    }
    if (kind === 'ecdf') {
      gs.groups.forEach((g, i) => {
        const s = g.slice().sort((a, b) => a - b);
        T.push({ type: 'scatter', mode: 'lines', line: { shape: 'hv', color: VIRIDIS[i % 8], width: 2.2 }, x: s, y: s.map((_, k) => (k + 1) / s.length), name: gs.labels[i] });
      });
      return plot('ex_plot', T, { title: `経験累積分布関数（ECDF）`, xaxis: { title: yName }, yaxis: { title: '累積確率', range: [0, 1.02] } });
    }
    if (kind === 'qq') {
      gs.groups.forEach((g, i) => {
        const s = g.slice().sort((a, b) => a - b), n = s.length;
        const th = s.map((_, k) => S.normal.inv((k + 1 - .375) / (n + .25)));
        T.push({ type: 'scatter', mode: 'markers', x: th, y: s, name: gs.labels[i], marker: { color: VIRIDIS[i % 8], size: 6, opacity: .8 } });
        const m = S.mean(g), sdv = S.sd(g);
        const lo = Math.min(...th), hi = Math.max(...th);
        T.push({ type: 'scatter', mode: 'lines', x: [lo, hi], y: [m + sdv * lo, m + sdv * hi], name: '理論直線', line: { color: '#fde725', dash: 'dash', width: 1.6 }, showlegend: i === 0 });
      });
      return plot('ex_plot', T, { title: `正規 Q-Q プロット — 点が直線に乗れば正規分布に近い`, xaxis: { title: '理論分位点（標準正規）' }, yaxis: { title: '標本分位点' } });
    }
    if (kind === 'scatter') {
      if (!xName) { $('ex_plot').innerHTML = '<div class="empty"><b>X 変数を選んでください</b>散布図には数値変数が 2 つ必要です。</div>'; return; }
      const { cols } = pairsOf([xName, yName]);
      const [X, Y] = cols;
      T.push({ type: 'scatter', mode: 'markers', x: X, y: Y, name: '観測値', marker: { color: Y, colorscale: 'Viridis', size: 8, opacity: .8, line: { color: 'rgba(0,0,0,.4)', width: .6 } } });
      const m = S.ols(Y, [X], ['x']);
      const xs = [Math.min(...X), Math.max(...X)];
      T.push({ type: 'scatter', mode: 'lines', x: xs, y: xs.map(v => m.coefs[0].estimate + m.coefs[1].estimate * v), name: `回帰直線 (R²=${m.R2.toFixed(3)})`, line: { color: '#fde725', width: 2.4 } });
      const grid = []; const mn = xs[0], mx = xs[1];
      for (let i = 0; i <= 60; i++) grid.push(mn + (mx - mn) * i / 60);
      const pr = grid.map(v => m.predict([v]));
      T.push({ type: 'scatter', mode: 'lines', x: grid.concat(grid.slice().reverse()), y: pr.map(p => p.ciHi).concat(pr.map(p => p.ciLo).reverse()), fill: 'toself', fillcolor: 'rgba(253,231,37,.13)', line: { width: 0 }, name: '95% 信頼帯', hoverinfo: 'skip' });
      return plot('ex_plot', T, { title: `${xName} と ${yName}（r = ${S.pearson(X, Y).toFixed(4)}）`, xaxis: { title: xName }, yaxis: { title: yName } });
    }
    if (kind === 'density2d') {
      if (!xName) { $('ex_plot').innerHTML = '<div class="empty"><b>X 変数を選んでください</b></div>'; return; }
      const { cols } = pairsOf([xName, yName]);
      return plot('ex_plot', [
        { type: 'histogram2dcontour', x: cols[0], y: cols[1], colorscale: 'Viridis', ncontours: 16, showscale: true, contours: { coloring: 'heatmap' }, opacity: .92 },
        { type: 'scatter', mode: 'markers', x: cols[0], y: cols[1], marker: { color: 'rgba(232,238,251,.5)', size: 4 }, name: '観測値' }
      ], { title: `2 次元密度（等高線）`, xaxis: { title: xName }, yaxis: { title: yName } });
    }
    if (kind === 'pair') {
      const names = numCols().slice(0, 5).map(c => c.name);
      const { cols } = pairsOf(names);
      return plot('ex_plot', [{
        type: 'splom', dimensions: names.map((n, i) => ({ label: n, values: cols[i] })),
        marker: { color: VIRIDIS[2], size: 4, opacity: .6, line: { width: .3, color: 'rgba(0,0,0,.4)' } }, diagonal: { visible: false }, showupperhalf: false
      }], { title: '散布図行列（数値変数を最大 5 個）', height: 620 });
    }
    if (kind === 'bar') {
      const ms = gs.groups.map(g => S.mean(g)), es = gs.groups.map(g => 1.96 * S.sem(g));
      return plot('ex_plot', [{ type: 'bar', x: gs.labels, y: ms, error_y: { type: 'data', array: es, color: '#fde725', thickness: 1.6 }, marker: { color: gs.labels.map((_, i) => VIRIDIS[i % 8]), opacity: .82 } }],
        { title: `群ごとの平均と 95% 信頼区間`, yaxis: { title: yName } });
    }
    if (kind === 'parallel') {
      const names = numCols().slice(0, 6).map(c => c.name);
      const { cols } = pairsOf(names);
      return plot('ex_plot', [{
        type: 'parcoords', line: { color: cols[0], colorscale: 'Viridis' },
        dimensions: names.map((n, i) => ({ label: n, values: cols[i] }))
      }], { title: '平行座標プロット' });
    }
  }

  /* ============================================================
     分布ラボ
     ============================================================ */
  const DIST_META = {
    normal: { l: ['平均 μ', '標準偏差 σ'], d: [0, 1], cont: true, f: (x, a, b) => S.normal.pdf(x, a, b), F: (x, a, b) => S.normal.cdf(x, a, b), Q: (p, a, b) => S.normal.inv(p, a, b), rng: (a, b) => [a - 4 * b, a + 4 * b] },
    t: { l: ['自由度 ν', '—'], d: [10, 0], cont: true, f: (x, a) => S.studentt.pdf(x, a), F: (x, a) => S.studentt.cdf(x, a), Q: (p, a) => S.studentt.inv(p, a), rng: () => [-5, 5] },
    chisquare: { l: ['自由度 k', '—'], d: [5, 0], cont: true, f: (x, a) => S.chisquare.pdf(x, a), F: (x, a) => S.chisquare.cdf(x, a), Q: (p, a) => S.chisquare.inv(p, a), rng: a => [0, Math.max(12, a * 3.4)] },
    f: { l: ['自由度 d₁', '自由度 d₂'], d: [3, 10], cont: true, f: (x, a, b) => S.centralF.pdf(x, a, b), F: (x, a, b) => S.centralF.cdf(x, a, b), Q: (p, a, b) => S.centralF.inv(p, a, b), rng: () => [0, 6] },
    exponential: { l: ['率 λ', '—'], d: [1, 0], cont: true, f: (x, a) => S.exponential.pdf(x, a), F: (x, a) => S.exponential.cdf(x, a), Q: (p, a) => -Math.log(1 - p) / a, rng: a => [0, 6 / a] },
    uniform: { l: ['下限 a', '上限 b'], d: [0, 1], cont: true, f: (x, a, b) => S.uniform.pdf(x, a, b), F: (x, a, b) => S.uniform.cdf(x, a, b), Q: (p, a, b) => a + p * (b - a), rng: (a, b) => [a - (b - a) * .2, b + (b - a) * .2] },
    lognormal: { l: ['対数平均 μ', '対数SD σ'], d: [0, .5], cont: true, f: (x, a, b) => S.lognormal.pdf(x, a, b), F: (x, a, b) => S.lognormal.cdf(x, a, b), Q: (p, a, b) => Math.exp(S.normal.inv(p, a, b)), rng: (a, b) => [0, Math.exp(a + 3.2 * b)] },
    gamma: { l: ['形状 k', '尺度 θ'], d: [2, 1], cont: true, f: (x, a, b) => S.gammaDist.pdf(x, a, b), F: (x, a, b) => S.gammaDist.cdf(x, a, b), Q: (p, a, b) => bisect(x => S.gammaDist.cdf(x, a, b), p, 0, a * b * 40), rng: (a, b) => [0, a * b * 4.5] },
    beta: { l: ['α', 'β'], d: [2, 5], cont: true, f: (x, a, b) => S.betaDist.pdf(x, a, b), F: (x, a, b) => S.betaDist.cdf(x, a, b), Q: (p, a, b) => bisect(x => S.betaDist.cdf(x, a, b), p, 0, 1), rng: () => [0, 1] },
    weibull: { l: ['形状 k', '尺度 λ'], d: [1.5, 1], cont: true, f: (x, a, b) => S.weibull.pdf(x, a, b), F: (x, a, b) => S.weibull.cdf(x, a, b), Q: (p, a, b) => b * Math.pow(-Math.log(1 - p), 1 / a), rng: (a, b) => [0, b * 3.2] },
    binomial: { l: ['試行数 n', '成功確率 p'], d: [20, .35], cont: false, f: (k, a, b) => S.binomial.pmf(k, a, b), F: (k, a, b) => S.binomial.cdf(k, a, b), rng: a => [0, a] },
    poisson: { l: ['λ', '—'], d: [4, 0], cont: false, f: (k, a) => S.poisson.pmf(k, a), F: (k, a) => S.poisson.cdf(k, a), rng: a => [0, Math.ceil(a + 4.5 * Math.sqrt(a) + 3)] },
    geometric: { l: ['成功確率 p', '—'], d: [.3, 0], cont: false, f: (k, a) => S.geometric.pmf(k, a), F: (k, a) => S.geometric.cdf(k, a), rng: a => [1, Math.ceil(6 / a)] },
    negbinom: { l: ['成功回数 r', '成功確率 p'], d: [3, .4], cont: false, f: (k, a, b) => S.negbinom.pmf(k, a, b), F: (k, a, b) => { let s = 0; for (let i = 0; i <= k; i++) s += S.negbinom.pmf(i, a, b); return s; }, rng: (a, b) => [0, Math.ceil(a * (1 - b) / b * 4 + 8)] }
  };
  function bisect(F, p, lo, hi) { for (let i = 0; i < 120; i++) { const m = (lo + hi) / 2; if (F(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; }
  function syncDist() {
    const m = DIST_META[$('d_kind').value];
    $('d_l1').textContent = m.l[0]; $('d_l2').textContent = m.l[1];
    $('d_p1').value = m.d[0]; $('d_p2').value = m.d[1];
    $('d_p2').disabled = m.l[1] === '—';
  }
  $('d_kind').addEventListener('change', syncDist); syncDist();
  $('d_run').addEventListener('click', () => {
    const kind = $('d_kind').value, m = DIST_META[kind];
    const a = +$('d_p1').value, b = +$('d_p2').value;
    const x = +$('d_x').value, q = +$('d_q').value;
    const [lo, hi] = m.rng(a, b);
    const T1 = [], T2 = [];
    if (m.cont) {
      const xs = [], ys = [], cs = [];
      for (let i = 0; i <= 500; i++) { const v = lo + (hi - lo) * i / 500; xs.push(v); ys.push(m.f(v, a, b)); cs.push(m.F(v, a, b)); }
      T1.push({ type: 'scatter', mode: 'lines', x: xs, y: ys, name: '確率密度 f(x)', line: { color: '#22a884', width: 2.6 } });
      const shade = xs.filter(v => v <= x);
      T1.push({ type: 'scatter', mode: 'lines', fill: 'tozeroy', x: shade, y: shade.map(v => m.f(v, a, b)), fillcolor: 'rgba(253,231,37,.22)', line: { width: 0 }, name: `P(X ≤ ${x})` });
      T2.push({ type: 'scatter', mode: 'lines', x: xs, y: cs, name: '累積分布 F(x)', line: { color: '#7ad151', width: 2.6 } });
    } else {
      const ks = [], ps = [], cs = [];
      for (let k = Math.ceil(lo); k <= hi; k++) { ks.push(k); ps.push(m.f(k, a, b)); cs.push(m.F(k, a, b)); }
      T1.push({ type: 'bar', x: ks, y: ps, name: '確率質量 P(X=k)', marker: { color: ks.map(k => k <= x ? '#fde725' : '#22a884'), opacity: .88 } });
      T2.push({ type: 'scatter', mode: 'lines+markers', line: { shape: 'hv', color: '#7ad151', width: 2.2 }, x: ks, y: cs, name: '累積分布 F(k)' });
    }
    const ov = $('d_overlay').value;
    if (ov && m.cont) {
      const y = numOf(ov).filter(isFinite);
      T1.push({ type: 'histogram', x: y, histnorm: 'probability density', name: `${ov} の実データ`, opacity: .4, marker: { color: '#414487' } });
    }
    plot('d_pdf', T1, { title: m.cont ? '確率密度関数' : '確率質量関数', xaxis: { title: 'x' }, yaxis: { title: m.cont ? 'f(x)' : 'P(X = k)' } });
    plot('d_cdf', T2, { title: '累積分布関数', xaxis: { title: 'x' }, yaxis: { title: 'F(x)', range: [0, 1.03] } });
    const F = m.F(x, a, b);
    const Q = m.Q ? m.Q(q, a, b) : bisect(v => m.F(v, a, b), q, lo, hi);
    const cards = [['P(X ≤ x)', fmt(F, 6), 'pos'], ['P(X > x)', fmt(1 - F, 6)], [`${(q * 100).toFixed(1)}% 点`, fmt(Q, 6), 'hot']];
    if (kind === 'normal') cards.push(['両側 P(|Z|>|x|)', fmt(2 * (1 - S.normal.cdf(Math.abs((x - a) / b))), 6)]);
    if (kind === 'binomial') cards.push(['平均 np', fmt(a * b, 4)], ['分散 np(1-p)', fmt(a * b * (1 - b), 4)], ['P(X = x)', fmt(m.f(Math.round(x), a, b), 6)]);
    if (kind === 'poisson') cards.push(['平均 = 分散 = λ', fmt(a, 4)], ['P(X = x)', fmt(m.f(Math.round(x), a), 6)]);
    $('d_stats').innerHTML = statCards(cards);
    renderAdvice('d_advice', AD.distribution(kind));
  });
  $('d_fit').addEventListener('click', () => {
    const ov = $('d_overlay').value;
    if (!ov) { alert('「データに重ねる」で列を選んでください。'); return; }
    const y = numOf(ov).filter(isFinite);
    const kind = $('d_kind').value;
    let a, b;
    if (kind === 'normal') { a = S.mean(y); b = S.sd(y, false); }
    else if (kind === 'lognormal') { const l = y.filter(v => v > 0).map(Math.log); a = S.mean(l); b = S.sd(l, false); }
    else if (kind === 'exponential') { a = 1 / S.mean(y); b = 0; }
    else if (kind === 'poisson') { a = S.mean(y); b = 0; }
    else if (kind === 'gamma') { const m = S.mean(y), v = S.variance(y); a = m * m / v; b = v / m; }
    else if (kind === 'uniform') { a = Math.min(...y); b = Math.max(...y); }
    else { alert('この分布への当てはめは未対応です（正規・対数正規・指数・ポアソン・ガンマ・一様に対応）。'); return; }
    $('d_p1').value = a.toFixed(6); $('d_p2').value = b.toFixed(6);
    $('d_run').click();
  });

  /* ============================================================
     t 検定
     ============================================================ */
  function syncT() {
    const k = $('t_kind').value;
    $('t_v2wrap').style.display = (k === 'two' || k === 'paired') ? '' : 'none';
    $('t_sigwrap').style.display = k === 'z' ? '' : 'none';
    $('t_evwrap').style.display = k === 'two' ? '' : 'none';
  }
  $('t_kind').addEventListener('change', syncT); syncT();
  $('t_run').addEventListener('click', () => {
    if (!need()) return;
    const k = $('t_kind').value, alt = $('t_alt').value, alpha = +$('t_alpha').value, mu = +$('t_mu').value;
    const v1 = $('t_v1').value, v2 = $('t_v2').value, split = $('t_split').value;
    let r, A = [], B = [], labels = [];
    try {
      if (k === 'one') { A = numOf(v1).filter(isFinite); labels = [v1]; r = S.tTestOne(A, mu, alt, .95); }
      else if (k === 'z') { A = numOf(v1).filter(isFinite); labels = [v1]; r = S.zTestMean(A, mu, +$('t_sigma').value, alt, .95); }
      else if (k === 'paired') {
        const p = pairsOf([v1, v2]); A = p.cols[0]; B = p.cols[1]; labels = [v1, v2];
        r = S.tTestPaired(A, B, mu, alt, .95);
      } else {
        if (split) {
          const g = groupBy(v1, split);
          if (g.labels.length !== 2) { alert(`グループ変数「${split}」の水準が ${g.labels.length} 個あります。2 群にしてください（3 群以上は分散分析へ）。`); return; }
          A = g.groups[0]; B = g.groups[1]; labels = g.labels;
        } else { A = numOf(v1).filter(isFinite); B = numOf(v2).filter(isFinite); labels = [v1, v2]; }
        r = S.tTestTwo(A, B, { alt, equalVar: $('t_ev').value === 'student', conf: .95, mu });
      }
    } catch (e) { alert('計算できませんでした：' + e.message); return; }

    const rows = [[td(r.test), td(fmt(r.statistic, 5)), td(fmt(r.df, 4)), pcell(r.p), td(r.ci ? `[${fmt(r.ci[0])}, ${fmt(r.ci[1])}]` : '—'), td(r.p < alpha ? '有意' : '有意でない', r.p < alpha ? 'sig' : 'nsig')]];
    $('t_out').innerHTML = statCards([
      ['検定統計量', fmt(r.statistic, 4), 'hot'], ['自由度', fmt(r.df, 3)], ['p 値', r.p < 1e-4 ? r.p.toExponential(2) : r.p.toFixed(5), r.p < alpha ? 'pos' : ''],
      ['判定', r.p < alpha ? `棄却 (α=${alpha})` : '棄却せず'],
      ...(k === 'two' ? [['群1 平均', fmt(r.mean1)], ['群2 平均', fmt(r.mean2)], ['平均差', fmt(r.diff)], ['Cohen d', fmt(r.cohensD, 3)], ['Hedges g', fmt(r.hedgesG, 3)]]
        : [['平均', fmt(r.mean)], ['標準誤差', fmt(r.se)], ...(r.cohensD !== undefined ? [['Cohen d', fmt(r.cohensD, 3)]] : [])])
    ]) + '<div style="margin-top:14px">' + tableHTML(['手法', '統計量', '自由度', 'p 値', '95% 信頼区間', '判定'], rows) + '</div>';

    // 可視化
    const T = []; let MU_LINE = null;
    if (k === 'one' || k === 'z') {
      T.push({ type: 'violin', y: A, name: v1, box: { visible: true }, meanline: { visible: true }, points: 'all', jitter: .3, pointpos: 0, line: { color: '#22a884' }, fillcolor: '#22a88444', marker: { size: 4, opacity: .5 } });
      MU_LINE = mu;
    } else if (k === 'paired') {
      A.forEach((v, i) => T.push({ type: 'scatter', mode: 'lines+markers', x: [labels[0], labels[1]], y: [v, B[i]], line: { color: B[i] > v ? 'rgba(122,209,81,.4)' : 'rgba(228,84,138,.4)', width: 1 }, marker: { size: 5 }, showlegend: false, hoverinfo: 'y' }));
      T.push({ type: 'scatter', mode: 'lines+markers', x: [labels[0], labels[1]], y: [S.mean(A), S.mean(B)], line: { color: '#fde725', width: 3.4 }, marker: { size: 11, color: '#fde725' }, name: '平均' });
    } else {
      [A, B].forEach((g, i) => T.push({ type: 'violin', y: g, name: labels[i], box: { visible: true }, meanline: { visible: true }, points: 'all', jitter: .3, pointpos: 0, line: { color: VIRIDIS[i * 2] }, fillcolor: VIRIDIS[i * 2] + '44', marker: { size: 4, opacity: .5 } }));
    }
    const lay1 = { title: k === 'paired' ? '対応のある観測値の変化' : 'データの分布', yaxis: { title: '値' } };
    if (MU_LINE !== null) {
      lay1.shapes = [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: MU_LINE, y1: MU_LINE, line: { color: '#fde725', dash: 'dash', width: 2 } }];
      lay1.annotations = [{ xref: 'paper', x: 1, y: MU_LINE, text: `μ₀ = ${MU_LINE}`, showarrow: false, font: { color: '#fde725', size: 11 }, xanchor: 'right', yanchor: 'bottom' }];
    }
    plot('t_plot', T, lay1);

    // 検定統計量の分布
    const df = isFinite(r.df) ? r.df : 1e6;
    const xs = [], ys = [];
    const lim = Math.max(4.2, Math.abs(r.statistic) * 1.3);
    for (let i = 0; i <= 500; i++) { const v = -lim + 2 * lim * i / 500; xs.push(v); ys.push(k === 'z' ? S.normal.pdf(v) : S.studentt.pdf(v, df)); }
    const T2 = [{ type: 'scatter', mode: 'lines', x: xs, y: ys, name: k === 'z' ? '標準正規分布' : `t 分布 (df=${fmt(df, 1)})`, line: { color: '#2a788e', width: 2.4 } }];
    const cv = k === 'z' ? S.normal.inv(1 - alpha / (alt === 'two-sided' ? 2 : 1)) : S.studentt.inv(1 - alpha / (alt === 'two-sided' ? 2 : 1), df);
    const rej = xs.filter(v => alt === 'two-sided' ? Math.abs(v) >= cv : (alt === 'greater' ? v >= cv : v <= -cv));
    T2.push({ type: 'scatter', mode: 'lines', fill: 'tozeroy', x: rej, y: rej.map(v => k === 'z' ? S.normal.pdf(v) : S.studentt.pdf(v, df)), fillcolor: 'rgba(228,84,138,.3)', line: { width: 0 }, name: `棄却域 (α=${alpha})` });
    T2.push({ type: 'scatter', mode: 'lines', x: [r.statistic, r.statistic], y: [0, Math.max(...ys) * 1.05], name: `観測値 t = ${fmt(r.statistic, 3)}`, line: { color: '#fde725', width: 2.6 } });
    plot('t_plot2', T2, { title: '検定統計量と棄却域', xaxis: { title: '統計量' }, yaxis: { title: '密度' } });

    renderAdvice('t_advice', AD.tTest(r, alpha));

    // 前提条件
    const chk = [];
    const groupsToCheck = k === 'paired' ? [A.map((v, i) => v - B[i])] : (k === 'two' ? [A, B] : [A]);
    groupsToCheck.forEach((g, i) => {
      if (g.length >= 3 && g.length <= 5000) {
        const sw = S.shapiroWilk(g);
        chk.push({ level: sw.p < .05 ? 'warn' : 'ok', title: `正規性（${k === 'paired' ? '差' : (labels[i] || '標本')}）`, body: `Shapiro–Wilk W = ${fmt(sw.W, 5)}、p = ${fmt(sw.p, 5)}。${sw.p < .05 ? (g.length >= 30 ? '正規性は棄却されましたが、n ≥ 30 のため中心極限定理により t 検定は比較的頑健です。心配ならノンパラメトリック検定と結果を比べてください。' : 'n が小さく正規性も疑わしいため、Mann–Whitney / Wilcoxon 検定の使用を推奨します。') : '正規性の仮定に問題は見られません。'}` });
      }
    });
    if (k === 'two') {
      const lv = S.leveneTest([A, B]), ft = S.fTestVar(A, B);
      chk.push({ level: lv.p < .05 ? 'warn' : 'ok', title: '等分散性', body: `Levene 検定 p = ${fmt(lv.p, 5)}、F 検定 p = ${fmt(ft.p, 5)}（分散比 ${fmt(ft.statistic, 4)}）。${lv.p < .05 ? '等分散は成り立ちません。Welch を使ってください（既定）。' : '等分散を仮定しても差し支えありませんが、Welch のままで問題ありません。'}` });
      const pw = S.powerTTest2({ d: Math.abs(r.cohensD), n: Math.min(A.length, B.length) });
      chk.push({ level: pw.power < .8 ? 'warn' : 'ok', title: '検出力の目安', body: `観測された効果量 d = ${fmt(Math.abs(r.cohensD), 3)}、各群 n = ${Math.min(A.length, B.length)} のときの検出力はおよそ ${(pw.power * 100).toFixed(1)}%。${pw.power < .8 ? `80% に届いていません。同じ効果量を検出するには各群 ${S.powerTTest2({ d: Math.abs(r.cohensD), power: .8 }).n} 例程度が必要です（事後検出力の解釈には議論があるため、あくまで次の研究設計の参考として使ってください）。` : '一般的な基準 80% を満たしています。'}` });
    }
    renderAdvice('t_assump', chk);
  });

  /* ============================================================
     分散分析
     ============================================================ */
  function syncAnova() {
    const k = $('a_kind').value;
    const wide = (k === 'rm' || k === 'friedman');
    $('a_f2wrap').style.display = k === 'two' ? '' : 'none';
    $('a_wide').style.display = wide ? '' : 'none';
    $('a_y').parentElement.style.display = wide ? 'none' : '';
    $('a_f1').parentElement.style.display = wide ? 'none' : '';
  }
  $('a_kind').addEventListener('change', syncAnova); syncAnova();
  $('a_run').addEventListener('click', () => {
    if (!need()) return;
    const kind = $('a_kind').value, alpha = +$('a_alpha').value;
    const yN = $('a_y').value, f1 = $('a_f1').value, f2 = $('a_f2').value;
    clearPlot('a_plot');
    if (kind === 'rm' || kind === 'friedman') { runWide(kind, alpha); return; }
    if (!yN) { alert('目的変数を選んでください。'); return; }
    if (kind === 'two') {
      if (!f1 || !f2) { alert('要因 A と要因 B を選んでください。'); return; }
      const y = numOf(yN), a = strOf(f1), b = strOf(f2), rows = [];
      for (let i = 0; i < D.n; i++) if (isFinite(y[i]) && a[i] && b[i]) rows.push({ a: a[i], b: b[i], y: y[i] });
      const r = S.anovaTwoWay(rows);
      $('a_out').innerHTML = tableHTML(['要因', '平方和 SS', '自由度', '平均平方 MS', 'F 値', 'p 値', 'η²'],
        r.terms.map(t => [td(t.name), td(fmt(t.ss, 3)), td(t.df), td(fmt(t.ms, 4)), td(t.F ? fmt(t.F, 4) : '—'), t.p !== undefined ? pcell(t.p) : td('—'), td(t.eta2 ? fmt(t.eta2, 4) : '—')]));
      const T = r.levelsB.map((bl, i) => ({
        type: 'scatter', mode: 'lines+markers', name: `${f2}=${bl}`,
        x: r.levelsA, y: r.levelsA.map(al => r.cellMeans[al + '||' + bl]),
        line: { color: VIRIDIS[i % 8], width: 2.6 }, marker: { size: 9 }
      }));
      plot('a_plot', T, { title: '交互作用プロット（線が平行でなければ交互作用あり）', xaxis: { title: f1 }, yaxis: { title: yN } });
      $('a_post').innerHTML = '<div class="empty"><b>二元配置では単純主効果分析を行ってください</b>交互作用が有意な場合、主効果の解釈は慎重に。要因 B の水準ごとにデータを分けて一元配置を実行するのが定石です。</div>';
      const it = r.terms.find(t => t.name.includes('交互作用'));
      renderAdvice('a_advice', [
        { level: 'key', title: '主効果と交互作用', body: r.terms.filter(t => t.F).map(t => `${t.name}：F(${t.df}, ${r.terms[r.terms.length - 1].df}) = ${fmt(t.F, 4)}、p = ${fmt(t.p, 5)} → ${t.p < alpha ? '有意' : '有意でない'}`).join('<br>') },
        it && it.p < alpha ? { level: 'risk', title: '交互作用が有意', body: '要因 A の効果が要因 B の水準によって変わります。この場合、主効果を単独で解釈すると誤読につながります。上の交互作用プロットで線の交差・傾きの差を確認し、水準ごとの単純主効果を見てください。' }
          : { level: 'ok', title: '交互作用は有意でない', body: '2 つの要因の効果は加法的とみなせます。各主効果をそのまま解釈できます。' },
        !r.hasRep ? { level: 'warn', title: '繰り返しのないデータ', body: '各セルの観測が 1 個のため、交互作用を誤差として扱っています。交互作用の検定はできません。' } : null
      ].filter(Boolean));
      $('a_var').innerHTML = '';
      return;
    }
    if (!f1) { alert('群を表す変数を選んでください。'); return; }
    const { labels, groups } = groupBy(yN, f1);
    if (labels.length < 2) { alert('2 群以上必要です。'); return; }
    // 群プロット
    plot('a_plot', groups.map((g, i) => ({
      type: 'violin', y: g, name: labels[i], box: { visible: true, width: .16 }, meanline: { visible: true },
      points: g.length <= 300 ? 'all' : false, jitter: .3, pointpos: 0,
      line: { color: VIRIDIS[i % 8], width: 2 }, fillcolor: VIRIDIS[i % 8] + '3d', marker: { size: 4, opacity: .5 }
    })), { title: `${f1} 別の ${yN} の分布`, yaxis: { title: yN } });

    if (kind === 'one') {
      const r = S.anovaOneWay(groups, labels);
      $('a_out').innerHTML = tableHTML(['変動要因', '平方和 SS', '自由度', '平均平方 MS', 'F 値', 'p 値'], [
        [td('群間'), td(fmt(r.ssB, 3)), td(r.dfB), td(fmt(r.msB, 4)), td(fmt(r.F, 4)), pcell(r.p)],
        [td('群内（誤差）'), td(fmt(r.ssW, 3)), td(r.dfW), td(fmt(r.msW, 4)), td('—'), td('—')],
        [td('全体'), td(fmt(r.ssT, 3)), td(r.dfB + r.dfW), td('—'), td('—'), td('—')]
      ]) + '<div style="margin-top:12px">' + statCards([['F 値', fmt(r.F, 4), 'hot'], ['p 値', r.p < 1e-4 ? r.p.toExponential(2) : r.p.toFixed(5), r.p < alpha ? 'pos' : ''], ['η²', fmt(r.eta2, 4)], ['ω²', fmt(r.omega2, 4)], ['群数', r.k], ['全 n', r.N]]) + '</div>'
        + '<div style="margin-top:14px">' + tableHTML(['群', 'n', '平均', 'SD', '標準誤差', '95% 信頼区間'],
          r.groups.map(g => [td(g.label), td(g.n), td(fmt(g.mean)), td(fmt(g.sd)), td(fmt(g.sem)), td(`[${fmt(g.mean - 1.96 * g.sem)}, ${fmt(g.mean + 1.96 * g.sem)}]`)])) + '</div>';
      const ph = S.postHoc(groups, labels, $('a_ph').value, true, r.msW, r.dfW);
      $('a_post').innerHTML = tableHTML(['対比較', '平均差', '標準誤差', 't 値', '自由度', '未調整 p', '調整済み p', '判定'],
        ph.pairs.map(p => [td(`${p.a} − ${p.b}`), td(fmt(p.diff)), td(fmt(p.se)), td(fmt(p.statistic, 4)), td(fmt(p.df, 1)), pcell(p.p), pcell(p.padj), td(p.padj < alpha ? '有意' : '—', p.padj < alpha ? 'sig' : 'nsig')]));
      renderAdvice('a_advice', AD.anova(r, ph, alpha));
      const lv = S.leveneTest(groups), bt = S.bartlettTest(groups);
      $('a_var').innerHTML = tableHTML(['検定', '統計量', 'p 値', '解釈'], [
        [td(lv.test), td('F = ' + fmt(lv.statistic, 4)), pcell(lv.p), td(lv.p < .05 ? '等分散を棄却（Welch 型や変換を検討）' : '等分散を棄却せず')],
        [td(bt.test), td('χ² = ' + fmt(bt.statistic, 4)), pcell(bt.p), td(bt.p < .05 ? '等分散を棄却（正規性に敏感な点に注意）' : '等分散を棄却せず')]
      ]);
      return;
    }
    if (kind === 'kw') {
      const r = S.kruskalWallis(groups, labels);
      $('a_out').innerHTML = statCards([['H 統計量', fmt(r.H, 4), 'hot'], ['自由度', r.df], ['p 値', r.p < 1e-4 ? r.p.toExponential(2) : r.p.toFixed(5), r.p < alpha ? 'pos' : ''], ['ε²', fmt(r.epsilon2, 4)]])
        + '<div style="margin-top:14px">' + tableHTML(['群', 'n', '平均順位', '中央値'], r.groups.map(g => [td(g.label), td(g.n), td(fmt(g.meanRank, 2)), td(fmt(g.median))])) + '</div>';
      $('a_post').innerHTML = '';
      renderAdvice('a_advice', AD.nonparam(r, alpha)); $('a_var').innerHTML = '';
      return;
    }
    if (kind === 'mw') {
      if (labels.length !== 2) { alert('Mann–Whitney は 2 群専用です。'); return; }
      const r = S.mannWhitney(groups[0], groups[1]);
      $('a_out').innerHTML = statCards([['U 統計量', fmt(r.U, 2), 'hot'], ['z 値', fmt(r.z, 4)], ['p 値', r.p < 1e-4 ? r.p.toExponential(2) : r.p.toFixed(5), r.p < alpha ? 'pos' : ''], ['効果量 r', fmt(r.effectR, 3)], ['優越確率', fmt(r.cles, 3)]]);
      $('a_post').innerHTML = ''; renderAdvice('a_advice', AD.nonparam(r, alpha)); $('a_var').innerHTML = '';
      return;
    }
    if (kind === 'wil') {
      if (labels.length !== 2) { alert('対応のある 2 条件が必要です。群変数で 2 水準に分けてください。'); return; }
      if (groups[0].length !== groups[1].length) { alert('対応のあるデータは 2 群のサイズが同じである必要があります。'); return; }
      const r = S.wilcoxonSigned(groups[0], groups[1]);
      $('a_out').innerHTML = statCards([['W 統計量', fmt(r.W, 2), 'hot'], ['z 値', fmt(r.z, 4)], ['p 値', r.p.toFixed(5), r.p < alpha ? 'pos' : ''], ['有効 n', r.n], ['効果量 r', fmt(r.effectR, 3)]]);
      $('a_post').innerHTML = ''; renderAdvice('a_advice', AD.nonparam(r, alpha)); $('a_var').innerHTML = '';
    }
  });


  // 対応のあるデータ（横持ち：条件ごとに列）
  function runWide(kind, alpha) {
    const names = [...$('a_cols').selectedOptions].map(o => o.value);
    if (names.length < 3) { alert('条件の列を 3 つ以上選んでください（同じ対象を繰り返し測った列を並べます）。'); return; }
    const P = pairsOf(names);
    const rows = P.idx.map((_, i) => names.map((_, j) => P.cols[j][i]));
    if (rows.length < 3) { alert('欠測を除いた完全なケースが少なすぎます。'); return; }
    plot('a_plot', names.map((n, j) => ({
      type: 'violin', y: rows.map(r => r[j]), name: n, box: { visible: true, width: .16 }, meanline: { visible: true },
      points: 'all', jitter: .3, pointpos: 0, line: { color: VIRIDIS[j % 8], width: 2 }, fillcolor: VIRIDIS[j % 8] + '3d', marker: { size: 4, opacity: .5 }
    })).concat(rows.slice(0, 60).map(r => ({
      type: 'scatter', mode: 'lines', x: names, y: r, line: { color: 'rgba(232,238,251,.16)', width: 1 }, showlegend: false, hoverinfo: 'skip'
    }))), { title: '条件ごとの分布（細線は同一対象の推移）', yaxis: { title: '値' } });

    if (kind === 'rm') {
      const r = S.rmAnova(rows, names);
      $('a_out').innerHTML = tableHTML(['変動要因', '平方和 SS', '自由度', '平均平方 MS', 'F 値', 'p 値'], [
        [td('条件（被験者内要因）'), td(fmt(r.ssCond, 3)), td(r.dfC), td(fmt(r.msC, 4)), td(fmt(r.F, 4)), pcell(r.p)],
        [td('被験者（個人差）'), td(fmt(r.ssSubj, 3)), td(r.n - 1), td(fmt(r.ssSubj / (r.n - 1), 4)), td('—'), td('—')],
        [td('残差'), td(fmt(r.ssErr, 3)), td(r.dfE), td(fmt(r.msE, 4)), td('—'), td('—')],
        [td('全体'), td(fmt(r.ssT, 3)), td(r.n * r.k - 1), td('—'), td('—'), td('—')]
      ]) + '<div style="margin-top:12px">' + statCards([
        ['F 値', fmt(r.F, 4), 'hot'], ['p 値', r.p < 1e-4 ? r.p.toExponential(2) : r.p.toFixed(5), r.p < alpha ? 'pos' : ''],
        ['偏 η²', fmt(r.etaPartial, 4)], ['対象数 n', r.n], ['条件数 k', r.k],
        ['GG の ε', fmt(r.ggEpsilon, 4), r.ggEpsilon < .75 ? 'neg' : ''], ['GG 補正後 p', r.pGG < 1e-4 ? r.pGG.toExponential(2) : r.pGG.toFixed(5)]
      ]) + '</div><div style="margin-top:14px">' + tableHTML(['条件', '平均'], names.map((n, j) => [td(n), td(fmt(r.condMean[j]))])) + '</div>';
      const groups = names.map((_, j) => rows.map(x => x[j]));
      const ph = S.postHoc(groups, names, $('a_ph').value, true, r.msE, r.dfE);
      $('a_post').innerHTML = tableHTML(['対比較', '平均差', 't 値', '未調整 p', '調整済み p', '判定'],
        ph.pairs.map(x => [td(`${x.a} − ${x.b}`), td(fmt(x.diff)), td(fmt(x.statistic, 4)), pcell(x.p), pcell(x.padj), td(x.padj < alpha ? '有意' : '—', x.padj < alpha ? 'sig' : 'nsig')]))
        + '<p class="note">対応のあるデータなので、対比較も同一対象内の差で行っています。</p>';
      renderAdvice('a_advice', [
        { level: 'key', title: '反復測定分散分析の結論', body: `F(${r.dfC}, ${r.dfE}) = ${fmt(r.F, 4)}、p = ${fmt(r.p, 5)}。帰無仮説は「すべての条件の母平均が等しい」です。${r.p < alpha ? '棄却されます。条件によって平均が異なります。' : '棄却されません。'} 個人差（被験者の変動）を誤差から取り除いているため、対応なしの分散分析より検出力が高くなります。` },
        { level: r.ggEpsilon < .75 ? 'warn' : 'ok', title: '球面性（sphericity）の確認', body: `Greenhouse–Geisser の ε = ${fmt(r.ggEpsilon, 4)}。1 に近いほど球面性が保たれています。${r.ggEpsilon < .75 ? '0.75 を下回っているため、自由度を補正した GG 補正後 p 値（' + fmt(r.pGG, 5) + '）で判断してください。無補正の p 値は甘すぎます。' : '0.75 以上なので、無補正の p 値をそのまま使って差し支えありません。'} 球面性とは「どの 2 条件の差をとっても分散が等しい」という仮定です。` },
        { level: 'info', title: '効果量', body: `偏 η² = ${fmt(r.etaPartial, 4)}。条件の効果が、条件＋残差の変動のうち占める割合です。被験者間の個人差を分母から除いているため、通常の η² より大きめの値になります。` },
        { level: 'info', title: 'データの形', body: '同じ対象を条件の数だけ測った「横持ち」のデータを想定しています。1 行 = 1 人（1 個体）、列 = 条件です。欠測のある行は自動的に除外しています（リストワイズ除去）。' }
      ]);
      $('a_var').innerHTML = '';
      return;
    }
    const r = S.friedmanTest(rows, names);
    $('a_out').innerHTML = statCards([
      ['χ² 統計量', fmt(r.statistic, 4), 'hot'], ['自由度', r.df],
      ['p 値', r.p < 1e-4 ? r.p.toExponential(2) : r.p.toFixed(5), r.p < alpha ? 'pos' : ''],
      ['対象数 n', r.n], ['条件数 k', r.k], ['Kendall の W', fmt(r.kendallW, 4)]
    ]) + '<div style="margin-top:14px">' + tableHTML(['条件', '平均順位', '中央値'],
      names.map((n, j) => [td(n), td(fmt(r.meanRanks[j], 3)), td(fmt(S.median(rows.map(x => x[j]))))])) + '</div>';
    $('a_post').innerHTML = '';
    renderAdvice('a_advice', [
      { level: 'key', title: 'Friedman 検定の結論', body: `χ²(${r.df}) = ${fmt(r.statistic, 4)}、p = ${fmt(r.p, 5)}。${r.p < alpha ? '条件によって分布の位置が異なると判断できます。' : '条件間に差があるとは言えません。'} 各対象の中だけで順位をつけ、条件ごとの順位の偏りを見る検定です。個人差の影響を受けません。` },
      { level: 'info', title: 'Kendall の一致係数 W', body: `W = ${fmt(r.kendallW, 4)}（0〜1）。対象どうしが同じ順位づけをしている度合いです。0.5 を超えると、多くの対象で条件の順序が一致していることを意味します。` },
      { level: 'info', title: '使いどころ', body: '反復測定分散分析の正規性が疑わしいとき、順序尺度（5 段階評価など）のとき、外れ値が大きいときに使います。代償として、正規分布が成り立つ場面では検出力がやや落ちます。' }
    ]);
    $('a_var').innerHTML = '';
  }

  /* ============================================================
     母比率・母分散
     ============================================================ */
  $('p_run').addEventListener('click', () => {
    const k1 = +$('p_k1').value, n1 = +$('p_n1').value, p0 = +$('p_p0').value, alt = $('p_alt').value;
    const k2 = $('p_k2').value === '' ? null : +$('p_k2').value, n2 = $('p_n2').value === '' ? null : +$('p_n2').value;
    if (!(n1 > 0) || k1 < 0 || k1 > n1) { alert('成功数と標本サイズを確認してください（0 ≤ x ≤ n）。'); return; }
    let r;
    if (k2 !== null && n2) r = S.propTestTwo(k1, n1, k2, n2, alt);
    else r = S.propTestOne(k1, n1, p0, alt);
    $('p_out').innerHTML = statCards(k2 !== null && n2
      ? [['p̂₁', fmt(r.p1, 4)], ['p̂₂', fmt(r.p2, 4)], ['差', fmt(r.diff, 4), 'hot'], ['z 値', fmt(r.statistic, 4)], ['p 値', r.p.toFixed(5), r.p < .05 ? 'pos' : ''], ['オッズ比', fmt(r.oddsRatio, 4)]]
      : [['p̂', fmt(r.phat, 4), 'hot'], ['z 値', fmt(r.statistic, 4)], ['p 値（近似）', r.p.toFixed(5), r.p < .05 ? 'pos' : ''], ['p 値（正確）', r.pExact.toFixed(5)], ['Wilson CI 下限', fmt(r.ciWilson[0], 4)], ['Wilson CI 上限', fmt(r.ciWilson[1], 4)]]);
    renderAdvice('pv_advice', AD.prop(r, .05));
    // 標本分布
    if (!(k2 !== null && n2)) {
      const ks = [], ps = [];
      for (let i = 0; i <= n1; i++) { ks.push(i); ps.push(S.binomial.pmf(i, n1, p0)); }
      plot('pv_plot', [
        { type: 'bar', x: ks, y: ps, name: `帰無分布 B(${n1}, ${p0})`, marker: { color: ks.map(v => Math.abs(v - n1 * p0) >= Math.abs(k1 - n1 * p0) ? '#e4548a' : '#2a788e'), opacity: .85 } },
        { type: 'scatter', mode: 'lines', x: [k1, k1], y: [0, Math.max(...ps) * 1.08], name: `観測 x = ${k1}`, line: { color: '#fde725', width: 2.6 } }
      ], { title: '帰無仮説のもとでの標本分布（赤＝観測値以上に極端な領域）', xaxis: { title: '成功数' }, yaxis: { title: '確率' } });
    } else clearPlot('pv_plot');
  });
  $('v_run').addEventListener('click', () => {
    if (!need()) return;
    const v1 = $('v_v1').value, v2 = $('v_v2').value, alt = $('v_alt').value;
    const A = numOf(v1).filter(isFinite);
    let r;
    if (v2) { const B = numOf(v2).filter(isFinite); r = S.fTestVar(A, B, alt); }
    else r = S.varTestOne(A, +$('v_s2').value, alt);
    $('v_out').innerHTML = statCards(v2
      ? [['s₁²', fmt(r.v1)], ['s₂²', fmt(r.v2)], ['F 値', fmt(r.statistic, 4), 'hot'], ['自由度', `${r.df1}, ${r.df2}`], ['p 値', r.p.toFixed(5), r.p < .05 ? 'pos' : ''], ['分散比 CI', `[${fmt(r.ci[0], 3)}, ${fmt(r.ci[1], 3)}]`]]
      : [['標本分散 s²', fmt(r.s2)], ['χ² 値', fmt(r.statistic, 4), 'hot'], ['自由度', r.df], ['p 値', r.p.toFixed(5), r.p < .05 ? 'pos' : ''], ['σ² の CI 下限', fmt(r.ci[0])], ['σ² の CI 上限', fmt(r.ci[1])]]);
    renderAdvice('pv_advice', AD.variance(r, .05));
    const df = v2 ? null : r.df;
    const xs = [], ys = [];
    if (v2) { for (let i = 1; i <= 500; i++) { const x = i * 5 / 500; xs.push(x); ys.push(S.centralF.pdf(x, r.df1, r.df2)); } }
    else { const hi = Math.max(r.statistic * 1.6, df * 3); for (let i = 1; i <= 500; i++) { const x = i * hi / 500; xs.push(x); ys.push(S.chisquare.pdf(x, df)); } }
    plot('pv_plot', [
      { type: 'scatter', mode: 'lines', x: xs, y: ys, name: v2 ? `F(${r.df1}, ${r.df2})` : `χ²(${df})`, line: { color: '#2a788e', width: 2.4 } },
      { type: 'scatter', mode: 'lines', x: [r.statistic, r.statistic], y: [0, Math.max(...ys) * 1.05], name: `観測値 ${fmt(r.statistic, 3)}`, line: { color: '#fde725', width: 2.6 } }
    ], { title: '検定統計量の帰無分布', xaxis: { title: '統計量' }, yaxis: { title: '密度' } });
  });

  /* ============================================================
     カテゴリデータ
     ============================================================ */
  $('c_kind').addEventListener('change', () => {
    const k = $('c_kind').value;
    $('c_manwrap').style.display = k === 'manual' ? '' : 'none';
    $('c_expwrap').style.display = k === 'gof' ? '' : 'none';
    $('c_mcwrap').style.display = k === 'mcnemar' ? '' : 'none';
    $('c_c').parentElement.style.display = k === 'indep' ? '' : 'none';
    $('c_r').parentElement.style.display = (k === 'indep' || k === 'gof') ? '' : 'none';
  });
  $('c_run').addEventListener('click', () => {
    const kind = $('c_kind').value;
    if (kind === 'mcnemar') {
      const b = +$('c_b').value, c2 = +$('c_c2').value;
      const r = S.mcnemarTest(b, c2);
      $('c_table').innerHTML = tableHTML(['', '2回目 ○', '2回目 ×', '合計'], [
        [td('<b>1回目 ○</b>'), td('a（一致）'), td(`<b style="color:#fde725">${b}</b>`), td('—')],
        [td('<b>1回目 ×</b>'), td(`<b style="color:#fde725">${c2}</b>`), td('d（一致）'), td('—')]
      ]) + '<div style="margin-top:12px">' + statCards([
        ['χ²（Yates 補正）', fmt(r.statistic, 4), 'hot'], ['自由度', 1],
        ['p 値', r.p < 1e-4 ? r.p.toExponential(2) : r.p.toFixed(5), r.p < .05 ? 'pos' : ''],
        ['正確二項 p', r.pExact.toFixed(5)], ['不一致ペア数', r.discordant], ['オッズ比 b/c', fmt(r.oddsRatio, 4)]
      ]) + '</div><p class="note">McNemar 検定は一致セル（a, d）を使いません。変化した人だけを見て、変化の向きが偏っているかを判定します。</p>';
      plot('c_plot', [{ type: 'bar', x: ['○→×', '×→○'], y: [b, c2], marker: { color: ['#e4548a', '#22a884'] } }],
        { title: '不一致ペアの内訳' });
      clearPlot('c_plot2');
      renderAdvice('c_advice', [
        { level: 'key', title: 'McNemar 検定の結論', body: `χ² = ${fmt(r.statistic, 4)}、p = ${fmt(r.p, 5)}（正確二項検定では ${fmt(r.pExact, 5)}）。帰無仮説は「○→× と ×→○ が同じ確率で起こる」です。${r.p < .05 ? '棄却されるため、変化の向きに偏りがあると判断できます。' : '棄却されません。変化の向きに偏りがあるとは言えません。'}` },
        { level: r.discordant < 25 ? 'warn' : 'ok', title: '近似の妥当性', body: `不一致ペアは ${r.discordant} 組です。${r.discordant < 25 ? '25 組未満のときはカイ二乗近似が不正確になるため、正確二項検定の p 値を採用してください。' : '25 組以上あり、カイ二乗近似は妥当です。'}` },
        { level: 'info', title: '使いどころ', body: '同じ対象を前後 2 回、○×で測ったとき（治療前後の症状の有無、キャンペーン前後の購入有無など）に使います。対応のない 2×2 表にカイ二乗検定を当てるのは誤りです。' }
      ]);
      return;
    }
    let table, rowLab, colLab;
    if (kind === 'manual') {
      const lines = $('c_man').value.trim().split(/\r?\n/).filter(Boolean);
      table = lines.map(l => l.split(/[,\t\s]+/).filter(s => s !== '').map(Number));
      if (!table.length || table.some(r => r.length !== table[0].length || r.some(isNaN))) { alert('度数表の形式を確認してください。'); return; }
      rowLab = table.map((_, i) => `行${i + 1}`); colLab = table[0].map((_, j) => `列${j + 1}`);
    } else if (kind === 'gof') {
      if (!need()) return;
      const v = strOf($('c_r').value).filter(s => s !== '');
      const m = new Map(); v.forEach(s => m.set(s, (m.get(s) || 0) + 1));
      rowLab = [...m.keys()].sort(); const obs = rowLab.map(k2 => m.get(k2));
      let exp = null;
      const et = $('c_exp').value.trim();
      if (et) { const w = et.split(/[,\s]+/).map(Number); if (w.length === obs.length) { const s = w.reduce((a, b) => a + b, 0); exp = w.map(x => x / s * obs.reduce((a, b) => a + b, 0)); } }
      const r = S.chiSquareGOF(obs, exp);
      $('c_table').innerHTML = tableHTML(['水準', '観測度数', '期待度数', '残差', '標準化残差'],
        rowLab.map((l, i) => [td(l), td(obs[i]), td(fmt(r.expected[i], 2)), td(fmt(obs[i] - r.expected[i], 2)), td(fmt((obs[i] - r.expected[i]) / Math.sqrt(r.expected[i]), 3), Math.abs((obs[i] - r.expected[i]) / Math.sqrt(r.expected[i])) > 2 ? 'sig' : '')]))
        + '<div style="margin-top:12px">' + statCards([['χ²', fmt(r.statistic, 4), 'hot'], ['自由度', r.df], ['p 値', r.p.toFixed(5), r.p < .05 ? 'pos' : ''], ['最小期待度数', fmt(r.minExpected, 2)]]) + '</div>';
      plot('c_plot', [
        { type: 'bar', x: rowLab, y: obs, name: '観測度数', marker: { color: '#22a884' } },
        { type: 'bar', x: rowLab, y: r.expected, name: '期待度数', marker: { color: '#414487' } }
      ], { title: '観測度数と期待度数', barmode: 'group' });
      clearPlot('c_plot2');
      renderAdvice('c_advice', AD.chisq(r, .05));
      return;
    } else {
      if (!need()) return;
      const a = strOf($('c_r').value), b = strOf($('c_c').value);
      rowLab = [...new Set(a.filter(Boolean))].sort(); colLab = [...new Set(b.filter(Boolean))].sort();
      table = rowLab.map(() => colLab.map(() => 0));
      for (let i = 0; i < D.n; i++) { if (!a[i] || !b[i]) continue; table[rowLab.indexOf(a[i])][colLab.indexOf(b[i])]++; }
    }
    const r = S.chiSquareIndep(table);
    const rowT = table.map(x => x.reduce((p, q) => p + q, 0));
    const colT = colLab.map((_, j) => table.reduce((s, x) => s + x[j], 0));
    const rows = table.map((x, i) => [td(rowLab[i])].concat(x.map((v, j) => td(`${v}<br><span style="opacity:.55;font-size:10px">期待 ${r.expected[i][j].toFixed(1)}</span>`)), td(rowT[i])));
    rows.push([td('<b>合計</b>')].concat(colT.map(v => td(`<b>${v}</b>`)), td(`<b>${r.N}</b>`)));
    $('c_table').innerHTML = tableHTML([''].concat(colLab, '合計'), rows)
      + '<div style="margin-top:12px">' + statCards([['χ²', fmt(r.statistic, 4), 'hot'], ['自由度', r.df], ['p 値', r.p < 1e-4 ? r.p.toExponential(2) : r.p.toFixed(5), r.p < .05 ? 'pos' : ''], ['Cramér V', fmt(r.cramersV, 4)], ['最小期待度数', fmt(r.minExpected, 2), r.minExpected < 5 ? 'neg' : ''], ...(r.chiYates !== null ? [['χ²（Yates）', fmt(r.chiYates, 4)], ['p（Yates）', r.pYates.toFixed(5)]] : [])]) + '</div>'
      + (table.length === 2 && table[0].length === 2 ? (() => { const fe = S.fisherExact2x2(table[0][0], table[0][1], table[1][0], table[1][1]); return `<div style="margin-top:12px">${statCards([['Fisher 正確 p', fe.p.toFixed(5), fe.p < .05 ? 'pos' : ''], ['オッズ比', fmt(fe.oddsRatio, 4)]])}</div>`; })() : '');
    plot('c_plot', colLab.map((c, j) => ({ type: 'bar', x: rowLab, y: table.map(x => x[j]), name: c, marker: { color: VIRIDIS[j % 8] } })),
      { title: 'クロス集計（積み上げ）', barmode: 'stack' });
    const stdres = table.map((x, i) => x.map((v, j) => {
      const e = r.expected[i][j];
      return (v - e) / Math.sqrt(e * (1 - rowT[i] / r.N) * (1 - colT[j] / r.N));
    }));
    plot('c_plot2', [{ type: 'heatmap', z: stdres, x: colLab, y: rowLab, colorscale: [[0, '#414487'], [.5, '#0b1020'], [1, '#fde725']], zmid: 0, colorbar: { title: '調整済み残差' } }],
      { title: '調整済み標準化残差（|2| 超が乖離の大きいセル）' });
    renderAdvice('c_advice', AD.chisq(r, .05));
  });

  /* ============================================================
     相関・主成分
     ============================================================ */
  $('r_run').addEventListener('click', () => {
    if (!need()) return;
    const names = [...$('r_vars').selectedOptions].map(o => o.value);
    if (names.length < 2) { alert('変数を 2 つ以上選んでください。'); return; }
    const method = $('r_method').value;
    const { cols } = pairsOf(names);
    const M = S.corMatrix(cols, method);
    plot('r_heat', [{
      type: 'heatmap', z: M.r, x: names, y: names, colorscale: 'Viridis', zmin: -1, zmax: 1,
      text: M.r.map(row => row.map(v => v.toFixed(3))), texttemplate: '%{text}', textfont: { size: 11 },
      colorbar: { title: '相関係数' }
    }], { title: `相関行列（${method === 'pearson' ? 'Pearson' : method === 'spearman' ? 'Spearman' : 'Kendall'}）`, height: 460 });
    const rows = [];
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      const t = S.corTest(cols[i], cols[j], method);
      rows.push([td(`${names[i]} × ${names[j]}`), td(fmt(t.r, 5)), td(t.ci ? `[${fmt(t.ci[0], 3)}, ${fmt(t.ci[1], 3)}]` : '—'), td(fmt(t.statistic, 4)), pcell(t.p), td(t.n)]);
    }
    $('r_tbl').innerHTML = tableHTML(['変数の組', '相関係数', '95% 信頼区間', '統計量', 'p 値', 'n'], rows);
    const ctrl = [...$('r_ctrl').selectedOptions].map(o => o.value).filter(c => !names.includes(c));
    let extra = [];
    if (ctrl.length && names.length >= 2) {
      const all = pairsOf(names.concat(ctrl));
      const pc = S.partialCorr(all.cols[0], all.cols[1], ctrl.map((_, k) => all.cols[names.length + k]));
      extra = [{ level: 'key', title: `偏相関（${ctrl.join(', ')} を統制）`, body: `${names[0]} と ${names[1]} の偏相関 = ${fmt(pc.r, 5)}（単純相関 ${fmt(M.r[0][1], 5)}、p = ${fmt(pc.p, 5)}）。統制後に相関が大きく縮むなら、元の相関は統制変数を経由した見かけの関連だった可能性が高いです。` }];
    }
    plot('r_pairs', [{
      type: 'splom', dimensions: names.map((n, i) => ({ label: n, values: cols[i] })),
      marker: { color: VIRIDIS[2], size: 4, opacity: .6 }, diagonal: { visible: false }, showupperhalf: false
    }], { title: '散布図行列', height: 640 });
    const t0 = S.corTest(cols[0], cols[1], method);
    renderAdvice('r_advice', AD.correlation(t0, .05).concat(extra));
  });
  $('r_pca').addEventListener('click', () => {
    if (!need()) return;
    const names = [...$('r_vars').selectedOptions].map(o => o.value);
    if (names.length < 2) { alert('変数を 2 つ以上選んでください。'); return; }
    const { cols } = pairsOf(names);
    const p = S.pca(cols, names);
    $('r_pcaout').innerHTML = tableHTML(['主成分', '固有値', '寄与率', '累積寄与率'].concat(names.map(n => `負荷量 ${n}`)),
      p.eigenvalues.map((v, i) => [td(`PC${i + 1}`), td(fmt(v, 4)), td((p.explained[i] * 100).toFixed(2) + '%'), td((p.cumulative[i] * 100).toFixed(2) + '%')].concat(p.loadings[i].map(l => td(fmt(l, 3), Math.abs(l) > .6 ? 'sig' : '')))))
      + `<div style="margin-top:16px" id="r_scree" class="plot short"></div><div id="r_biplot" class="plot"></div>`;
    plot('r_scree', [
      { type: 'bar', x: p.eigenvalues.map((_, i) => `PC${i + 1}`), y: p.eigenvalues, name: '固有値', marker: { color: '#22a884' } },
      { type: 'scatter', mode: 'lines+markers', x: p.eigenvalues.map((_, i) => `PC${i + 1}`), y: p.cumulative.map(v => v * p.eigenvalues[0] / p.cumulative[p.cumulative.length - 1]), name: '累積寄与率（右軸）', yaxis: 'y2', line: { color: '#fde725', width: 2.4 } }
    ], { title: 'スクリープロット', yaxis: { title: '固有値' }, yaxis2: { overlaying: 'y', side: 'right', title: '累積寄与率', range: [0, 1], tickformat: '.0%' } });
    plot('r_biplot', [
      { type: 'scatter', mode: 'markers', x: p.scores.map(s => s[0]), y: p.scores.map(s => s[1]), name: '観測値', marker: { color: '#2a788e', size: 6, opacity: .7 } },
      ...names.map((n, i) => ({ type: 'scatter', mode: 'lines+text', x: [0, p.loadings[0][i] * 3], y: [0, p.loadings[1][i] * 3], text: ['', n], textposition: 'top center', line: { color: '#fde725', width: 2 }, showlegend: false, textfont: { color: '#fde725' } }))
    ], { title: 'バイプロット（PC1 × PC2）', xaxis: { title: `PC1 (${(p.explained[0] * 100).toFixed(1)}%)` }, yaxis: { title: `PC2 (${(p.explained[1] * 100).toFixed(1)}%)` } });
    renderAdvice('r_advice', AD.pca(p));
  });


  /* ============================================================
     学習したモデルで「新しいデータ」を予測する共通パネル
     ============================================================ */
  const medianOf = name => { const a = numOf(name).filter(isFinite); return a.length ? S.median(a) : 0; };
  function predictPanel(boxId, inputNames, handlers) {
    const box = $(boxId); if (!box) return;
    const defs = inputNames.map(n => {
      const v = medianOf(n);
      return Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 100) / 100;
    });
    box.innerHTML = `
      <p class="hint">${handlers.hint || '説明変数の値を入れると、学習済みモデルがその1件について予測します。初期値は各変数の中央値です。'}</p>
      <div class="grid g3">${inputNames.map((n, i) =>
        `<div class="field"><label>${n}</label><input type="number" step="any" id="${boxId}_f${i}" value="${defs[i]}"></div>`).join('')}</div>
      <div class="btnrow">
        <button class="btn" id="${boxId}_go">この条件で予測する</button>
        <button class="btn ghost" id="${boxId}_reset">中央値に戻す</button>
      </div>
      <div id="${boxId}_out" style="margin-top:16px"></div>
      <div class="note">
        <b style="color:var(--v4)">まとめて予測（複数件を一度に）</b><br>
        1 行に 1 件、列の順は <span style="color:var(--ink)">${inputNames.join(' , ')}</span>。カンマ・タブ・空白のいずれでも区切れます。
      </div>
      <div class="field"><textarea id="${boxId}_batch" placeholder="${defs.join(', ')}\n${defs.join(', ')}" style="min-height:88px"></textarea></div>
      <div class="btnrow">
        <button class="btn ghost" id="${boxId}_bgo">まとめて予測する</button>
        <button class="btn ghost" id="${boxId}_dl" disabled>結果を CSV で保存</button>
      </div>
      <div id="${boxId}_bout" style="margin-top:12px"></div>`;

    // 学習データの範囲（外挿の警告に使う）
    const ranges = inputNames.map(n => { const a = numOf(n).filter(isFinite); return a.length ? [Math.min(...a), Math.max(...a)] : [-Infinity, Infinity]; });
    const outOfRange = v => v.map((x, i) => (x < ranges[i][0] || x > ranges[i][1]) ? `<b>${inputNames[i]}</b>（学習データは ${fmt(ranges[i][0], 2)} 〜 ${fmt(ranges[i][1], 2)}）` : null).filter(Boolean);
    const rangeWarn = v => {
      const bad = outOfRange(v);
      return bad.length ? `<div class="warnbox" style="margin-bottom:12px"><b>外挿になっています</b>：${bad.join('、')} が学習データの範囲の外です。モデルは範囲外でも計算はしますが、その根拠はどこにもありません。この予測は使わないでください。</div>` : '';
    };
    const read = () => inputNames.map((_, i) => +$(`${boxId}_f${i}`).value);
    $(`${boxId}_reset`).onclick = () => { inputNames.forEach((_, i) => $(`${boxId}_f${i}`).value = defs[i]); };
    $(`${boxId}_go`).onclick = async () => {
      const v = read();
      if (v.some(x => !isFinite(x))) { alert('すべての欄に数値を入れてください。'); return; }
      $(`${boxId}_out`).innerHTML = '<div class="empty">計算中…</div>';
      try { $(`${boxId}_out`).innerHTML = rangeWarn(v) + await handlers.single(v); }
      catch (e) { $(`${boxId}_out`).innerHTML = `<div class="empty"><b>計算できませんでした</b>${e.message}</div>`; }
    };
    let lastCsv = null;
    $(`${boxId}_bgo`).onclick = async () => {
      const txt = $(`${boxId}_batch`).value.trim();
      if (!txt) { alert('まとめて予測したい行を貼り付けてください。'); return; }
      const rows = txt.split(/\r?\n/).filter(l => l.trim()).map(l => l.split(/[,\t;\s]+/).filter(x => x !== '').map(Number));
      const bad = rows.findIndex(r => r.length !== inputNames.length || r.some(v => !isFinite(v)));
      if (bad >= 0) { alert(`${bad + 1} 行目の列数か数値が正しくありません（${inputNames.length} 列必要です）。`); return; }
      $(`${boxId}_bout`).innerHTML = '<div class="empty">計算中…</div>';
      try {
        const r = await handlers.batch(rows);
        const flags = rows.map(v => outOfRange(v).length);
        const body = r.body.map((row, i) => row.concat(flags[i] ? td('<b style="color:#fca636">範囲外</b>') : td('—')));
        $(`${boxId}_bout`).innerHTML = tableHTML(r.head.concat('外挿判定'), body) +
          `<p class="note">${rows.length} 件を予測しました。${flags.filter(Boolean).length ? `<b style="color:#fca636">うち ${flags.filter(Boolean).length} 件が学習データの範囲外です。</b>` : ''}${r.note || ''}</p>`;
        lastCsv = r.csv;
        $(`${boxId}_dl`).disabled = false;
      } catch (e) { $(`${boxId}_bout`).innerHTML = `<div class="empty"><b>計算できませんでした</b>${e.message}</div>`; }
    };
    $(`${boxId}_dl`).onclick = () => {
      if (!lastCsv) return;
      const blob = new Blob(['\ufeff' + lastCsv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `statlab_predictions_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
  }
  const bigCard = (label, value, sub) =>
    `<div class="result" style="margin-bottom:12px"><div class="tag">${label}</div><h4 style="margin:6px 0 4px">${value}</h4>${sub ? `<div class="why" style="margin:0">${sub}</div>` : ''}</div>`;
  const csvOf = (head, body) => [head.join(',')].concat(body.map(r => r.join(','))).join('\n');

  /* ============================================================
     回帰分析
     ============================================================ */
  $('g_run').addEventListener('click', () => {
    if (!need()) return;
    const yN = $('g_y').value;
    let xs = [...$('g_x').selectedOptions].map(o => o.value).filter(n => n !== yN);
    if (!yN || !xs.length) { alert('目的変数と説明変数を選んでください。'); return; }
    const poly = +$('g_poly').value, conf = +$('g_conf').value;
    const modelKind = $('g_model').value;
    const tr = modelKind === 'poisson' ? 'none' : $('g_tr').value;
    const P = pairsOf([yN].concat(xs));
    let y = P.cols[0].slice(), cols = P.cols.slice(1), names = xs.slice();
    if (tr === 'log') { if (y.some(v => v <= 0)) { alert('対数変換には正の値が必要です。'); return; } y = y.map(Math.log); }
    if (tr === 'sqrt') { if (y.some(v => v < 0)) { alert('平方根変換には非負の値が必要です。'); return; } y = y.map(Math.sqrt); }
    if (xs.length === 1 && poly > 1) {
      for (let d = 2; d <= poly; d++) { cols.push(P.cols[1].map(v => Math.pow(v, d))); names.push(`${xs[0]}^${d}`); }
    }
    if (modelKind === 'poisson') { runPoisson(y, cols, names, yN, conf); return; }
    let m;
    try { m = S.ols(y, cols, names, { conf }); } catch (e) { alert('推定できませんでした：' + e.message); return; }
    $('g_out').innerHTML = statCards([
      ['R²', fmt(m.R2, 4), 'hot'], ['調整済み R²', fmt(m.adjR2, 4)], ['F 値', fmt(m.F, 4)],
      ['p 値（F）', m.pF < 1e-4 ? m.pF.toExponential(2) : m.pF.toFixed(5), m.pF < .05 ? 'pos' : ''],
      ['残差標準誤差', fmt(m.se, 4)], ['n', m.n], ['AIC', fmt(m.aic, 2)], ['BIC', fmt(m.bic, 2)], ['Durbin–Watson', fmt(m.durbinWatson, 4)]
    ]) + '<div style="margin-top:14px">' + tableHTML(['項', '係数', '標準誤差', 't 値', 'p 値', `${conf * 100}% 信頼区間`, '標準化係数 β', 'VIF'],
      m.coefs.map((c, i) => [td(c.name), td(fmt(c.estimate, 5)), td(fmt(c.se, 5)), td(fmt(c.t, 4)), pcell(c.p),
      td(`[${fmt(c.lo, 4)}, ${fmt(c.hi, 4)}]`), td(c.beta === null ? '—' : fmt(c.beta, 4)),
      td(i === 0 ? '—' : fmt(m.vif[i - 1], 3), m.vif[i - 1] > 10 ? 'sig' : '')])) + '</div>'
      + `<div class="formula">${yN}${tr !== 'none' ? `（${tr === 'log' ? '対数' : '平方根'}変換後）` : ''} = ${m.coefs.map((c, i) => i === 0 ? fmt(c.estimate, 4) : `${c.estimate >= 0 ? ' + ' : ' − '}${fmt(Math.abs(c.estimate), 4)} × ${c.name}`).join('')}</div>`;

    // 新しいデータでの予測パネル
    const inv = tr === 'log' ? (v => Math.exp(v)) : tr === 'sqrt' ? (v => v * v) : (v => v);
    const expand = vals => (xs.length === 1 && poly > 1)
      ? names.map(n => n.includes('^') ? Math.pow(vals[0], +n.split('^')[1]) : vals[0])
      : vals;
    predictPanel('g_predict', xs, {
      hint: `学習した回帰式に条件を入れると、${yN} の予測値を返します。${tr !== 'none' ? '（目的変数を変換しているため、元の単位に戻して表示します）' : ''}`,
      single: v => {
        const pr = m.predict(expand(v));
        const neg = (inv(pr.fit) < 0 && Math.min(...y) >= 0)
          ? `<div class="warnbox" style="margin-bottom:12px"><b>ありえない予測が出ています</b>：目的変数は学習データではすべて 0 以上なのに、予測値が負になりました。線形モデルが直線を範囲外まで延長した結果です。この条件では線形回帰は使えません。決定木や多層パーセプトロン、あるいは目的変数の対数変換を検討してください。</div>` : '';
        return neg + bigCard(`${yN} の予測値`, fmt(inv(pr.fit), 2),
          `この条件の<b>母平均</b>の 95% 信頼区間：[${fmt(inv(pr.ciLo), 2)}, ${fmt(inv(pr.ciHi), 2)}]<br>` +
          `<b>次の 1 件</b>の 95% 予測区間：[${fmt(inv(pr.piLo), 2)}, ${fmt(inv(pr.piHi), 2)}]`)
          + `<div class="advice"><div class="adv key"><div class="t"><span class="tag">結論</span>2 つの区間の使い分け</div><div class="b">` +
          `<b>信頼区間</b>は「同じ条件の物件を無数に集めたときの平均」の範囲、<b>予測区間</b>は「いま目の前にある 1 件」の範囲です。個別の売買や採否を判断するときに使うのは<b>予測区間</b>のほうです。予測区間は必ず広くなります。` +
          `</div></div><div class="adv warn"><div class="t"><span class="tag">注意</span>外挿はしない</div><div class="b">` +
          `学習データにない範囲の値（極端に広い面積、極端な築年数など）を入れると、モデルは根拠なく直線を延長します。入力値が元データの範囲に収まっているか確認してください。` +
          `</div></div></div>`;
      },
      batch: rows => {
        const body = rows.map((r, i) => {
          const pr = m.predict(expand(r));
          return [td(i + 1)].concat(r.map(v => td(fmt(v, 2))),
            td(`<b style="color:var(--v5)">${fmt(inv(pr.fit), 2)}</b>`),
            td(`${fmt(inv(pr.piLo), 2)} 〜 ${fmt(inv(pr.piHi), 2)}`));
        });
        const csv = csvOf(['#'].concat(xs, ['予測値', '予測区間下限', '予測区間上限']),
          rows.map((r, i) => { const pr = m.predict(expand(r)); return [i + 1].concat(r, [inv(pr.fit).toFixed(3), inv(pr.piLo).toFixed(3), inv(pr.piHi).toFixed(3)]); }));
        return { head: ['#'].concat(xs, ['予測値', '95% 予測区間']), body, csv, note: '予測区間つきで書き出せます。' };
      }
    });
    // 診断図
    plot('g_p1', [
      { type: 'scatter', mode: 'markers', x: m.fitted, y: m.resid, marker: { color: m.cook, colorscale: 'Viridis', size: 8, opacity: .82, colorbar: { title: 'Cook 距離', thickness: 10 } }, name: '残差' },
      { type: 'scatter', mode: 'lines', x: [Math.min(...m.fitted), Math.max(...m.fitted)], y: [0, 0], line: { color: '#fde725', dash: 'dash' }, showlegend: false }
    ], { title: '残差 vs 予測値（ランダムな帯なら良好）', xaxis: { title: '予測値' }, yaxis: { title: '残差' } });
    const sr = m.stdRes.slice().sort((a, b) => a - b), nn = sr.length;
    plot('g_p2', [
      { type: 'scatter', mode: 'markers', x: sr.map((_, i) => S.normal.inv((i + 1 - .375) / (nn + .25))), y: sr, marker: { color: '#22a884', size: 7, opacity: .8 }, name: '標準化残差' },
      { type: 'scatter', mode: 'lines', x: [-3, 3], y: [-3, 3], line: { color: '#fde725', dash: 'dash' }, name: '基準線' }
    ], { title: '残差の正規 Q-Q プロット', xaxis: { title: '理論分位点' }, yaxis: { title: '標準化残差' } });
    plot('g_p3', [{ type: 'scatter', mode: 'markers', x: m.leverage, y: m.stdRes, marker: { size: m.cook.map(c => 6 + Math.min(26, c * 260)), color: '#7ad151', opacity: .7 }, text: m.leverage.map((_, i) => `行 ${i + 1}`), name: '観測値' }],
      { title: 'てこ比 vs 標準化残差（円の大きさ = Cook 距離）', xaxis: { title: 'てこ比（leverage）' }, yaxis: { title: '標準化残差' } });
    if (cols.length === 1 || (xs.length === 1 && poly > 1)) {
      const X = P.cols[1], ord = X.map((v, i) => i).sort((a, b) => X[a] - X[b]);
      plot('g_p4', [
        { type: 'scatter', mode: 'markers', x: X, y: y, marker: { color: '#2a788e', size: 7, opacity: .8 }, name: '観測値' },
        { type: 'scatter', mode: 'lines', x: ord.map(i => X[i]), y: ord.map(i => m.fitted[i]), line: { color: '#fde725', width: 2.6 }, name: '回帰曲線' }
      ], { title: '当てはめ', xaxis: { title: xs[0] }, yaxis: { title: yN } });
    } else {
      plot('g_p4', [{ type: 'scatter', mode: 'markers', x: y, y: m.fitted, marker: { color: '#2a788e', size: 7, opacity: .8 }, name: '観測 vs 予測' },
      { type: 'scatter', mode: 'lines', x: [Math.min(...y), Math.max(...y)], y: [Math.min(...y), Math.max(...y)], line: { color: '#fde725', dash: 'dash' }, name: '完全一致' }],
        { title: '観測値 vs 予測値', xaxis: { title: '観測値' }, yaxis: { title: '予測値' } });
    }
    const adv = AD.regression(m, .05);
    if (tr !== 'none') adv.push({ level: 'warn', title: '変換した目的変数の解釈', body: `目的変数を${tr === 'log' ? '対数' : '平方根'}変換しています。係数は元の単位ではありません。${tr === 'log' ? '対数変換の場合、係数 b は「x が 1 増えると y がおよそ (e^b − 1)×100 % 変化する」と読みます。' : ''}` });
    renderAdvice('g_advice', adv);
  });


  function runPoisson(y, cols, names, yN, conf) {
    if (y.some(v => v < 0 || Math.abs(v - Math.round(v)) > 1e-9)) {
      alert('ポアソン回帰の目的変数は 0 以上の整数（回数・件数）である必要があります。'); return;
    }
    let m;
    try { m = S.poissonReg(y, cols, names, { conf }); } catch (e) { alert('推定できませんでした：' + e.message); return; }
    $('g_out').innerHTML = statCards([
      ['n', m.n], ['尤度比 χ²', fmt(m.lrChi2, 4), 'hot'],
      ['p 値', m.lrP < 1e-4 ? m.lrP.toExponential(2) : m.lrP.toFixed(5), m.lrP < .05 ? 'pos' : ''],
      ['McFadden R²', fmt(m.mcfadden, 4)], ['逸脱度', fmt(m.deviance, 2)], ['残差自由度', m.dfRes],
      ['過分散の指標', fmt(m.dispersion, 4), m.dispersion > 1.5 ? 'neg' : 'pos'],
      ['AIC', fmt(m.aic, 2)], ['平均 / 分散', `${fmt(m.meanY, 3)} / ${fmt(m.varY, 3)}`]
    ]) + '<div style="margin-top:14px">' + tableHTML(['項', '係数（対数スケール）', '標準誤差', 'z 値', 'p 値', '発生率比 IRR', 'IRR の 95% 区間'],
      m.coefs.map(c => [td(c.name), td(fmt(c.estimate, 5)), td(fmt(c.se, 5)), td(fmt(c.z, 4)), pcell(c.p), td(fmt(c.irr, 4)), td(`[${fmt(c.irrLo, 3)}, ${fmt(c.irrHi, 3)}]`)])) + '</div>'
      + `<div class="formula">log(E[${yN}]) = ${m.coefs.map((c, i) => i === 0 ? fmt(c.estimate, 4) : `${c.estimate >= 0 ? ' + ' : ' − '}${fmt(Math.abs(c.estimate), 4)} × ${c.name}`).join('')}</div>`;
    plot('g_p1', [
      { type: 'scatter', mode: 'markers', x: m.fitted, y: m.devResid, marker: { color: '#22a884', size: 7, opacity: .8 }, name: '逸脱度残差' },
      { type: 'scatter', mode: 'lines', x: [Math.min(...m.fitted), Math.max(...m.fitted)], y: [0, 0], line: { color: '#fde725', dash: 'dash' }, showlegend: false }
    ], { title: '逸脱度残差 vs 予測値', xaxis: { title: '予測される平均 μ' }, yaxis: { title: '逸脱度残差' } });
    const sr = m.devResid.slice().sort((a, b) => a - b), nn = sr.length;
    plot('g_p2', [
      { type: 'scatter', mode: 'markers', x: sr.map((_, i) => S.normal.inv((i + 1 - .375) / (nn + .25))), y: sr, marker: { color: '#2a788e', size: 7, opacity: .8 }, name: '逸脱度残差' },
      { type: 'scatter', mode: 'lines', x: [-3, 3], y: [-3, 3], line: { color: '#fde725', dash: 'dash' }, name: '基準線' }
    ], { title: '逸脱度残差の Q-Q プロット', xaxis: { title: '理論分位点' } });
    const mx = Math.max(...y), obs = [], exp = [];
    for (let k = 0; k <= Math.min(mx, 20); k++) {
      obs.push(y.filter(v => v === k).length);
      exp.push(S.sum(m.fitted.map(mu => S.poisson.pmf(k, mu))));
    }
    plot('g_p3', [
      { type: 'bar', x: obs.map((_, k) => k), y: obs, name: '観測度数', marker: { color: '#22a884' } },
      { type: 'scatter', mode: 'lines+markers', x: exp.map((_, k) => k), y: exp, name: 'モデルの期待度数', line: { color: '#fde725', width: 2.4 } }
    ], { title: '観測度数とモデルの期待度数', xaxis: { title: yN + ' の値' }, yaxis: { title: '件数' } });
    plot('g_p4', [
      { type: 'scatter', mode: 'markers', x: y, y: m.fitted, marker: { color: '#2a788e', size: 7, opacity: .8 }, name: '観測 vs 予測' },
      { type: 'scatter', mode: 'lines', x: [0, Math.max(...y)], y: [0, Math.max(...y)], line: { color: '#fde725', dash: 'dash' }, name: '完全一致' }
    ], { title: '観測値 vs 予測平均', xaxis: { title: '観測値' }, yaxis: { title: '予測平均' } });
    predictPanel('g_predict', names, {
      hint: `条件を入れると、${yN} の<b>期待件数</b>を返します。`,
      single: v => {
        const pr = m.predict(v);
        return bigCard(`${yN} の期待件数`, fmt(pr.fit, 3),
          `95% 信頼区間：[${fmt(pr.lo, 3)}, ${fmt(pr.hi, 3)}]<br>この条件で観測が 1 単位あたり平均 ${fmt(pr.fit, 3)} 件起こる、という意味です。`)
          + `<div class="advice"><div class="adv key"><div class="t"><span class="tag">結論</span>件数は「平均」であって「必ずその数」ではない</div><div class="b">` +
          `期待件数が ${fmt(pr.fit, 2)} でも、実際にはポアソン分布に従ってばらつきます。0 件のことも、その 2 倍のこともあります。在庫や人員を決めるときは、期待値ではなく<b>上振れした場合</b>（例：95 パーセント点）で備えてください。「確率分布ラボ」でポアソン分布に ${fmt(pr.fit, 2)} を入れると、その分布が確認できます。` +
          `</div></div></div>`;
      },
      batch: rows => {
        const body = rows.map((r, i) => [td(i + 1)].concat(r.map(v => td(fmt(v, 2))),
          td(`<b style="color:var(--v5)">${fmt(m.predict(r).fit, 3)}</b>`), td(`${fmt(m.predict(r).lo, 3)} 〜 ${fmt(m.predict(r).hi, 3)}`)));
        const csv = csvOf(['#'].concat(names, ['期待件数', 'CI下限', 'CI上限']),
          rows.map((r, i) => { const pr = m.predict(r); return [i + 1].concat(r, [pr.fit.toFixed(4), pr.lo.toFixed(4), pr.hi.toFixed(4)]); }));
        return { head: ['#'].concat(names, ['期待件数', '95% 信頼区間']), body, csv };
      }
    });
    renderAdvice('g_advice', [
      { level: 'key', title: 'モデル全体の有意性', body: `尤度比検定 χ²(${m.lrDf}) = ${fmt(m.lrChi2, 4)}、p = ${fmt(m.lrP, 5)}。${m.lrP < .05 ? '説明変数なしのモデルより有意に当てはまりが良いです。' : '説明変数なしのモデルと比べて改善していません。'} McFadden R² = ${fmt(m.mcfadden, 4)}、AIC = ${fmt(m.aic, 2)}。` },
      { level: 'key', title: '発生率比（IRR）の読み方', body: m.coefs.slice(1).map(c => `<b>${c.name}</b>：IRR = ${fmt(c.irr, 4)}（95%CI ${fmt(c.irrLo, 3)}–${fmt(c.irrHi, 3)}、p = ${fmt(c.p, 5)}）→ ${c.name} が 1 単位増えると、他を一定として発生件数の期待値が <b>${fmt(c.irr, 3)} 倍</b>（${c.irr > 1 ? ((c.irr - 1) * 100).toFixed(1) + '% 増' : ((1 - c.irr) * 100).toFixed(1) + '% 減'}）。`).join('<br>') + '<br>IRR の信頼区間が 1 をまたぐ変数は有意ではありません。' },
      { level: m.dispersion > 1.5 ? 'risk' : 'ok', title: '過分散（overdispersion）の確認', body: `Pearson χ² / 残差自由度 = ${fmt(m.dispersion, 4)}。1 に近ければポアソン分布の仮定（平均 = 分散）と整合します。${m.dispersion > 1.5 ? 'この値は 1.5 を超えており、分散が平均より大きい「過分散」の状態です。標準誤差が過小評価され、p 値が甘くなります。負の二項回帰や準ポアソン回帰が適切ですが、本ツールでは未実装のため、R の MASS::glm.nb などで再確認してください。' : '過分散の兆候はありません。'} 参考：目的変数の実測平均 ${fmt(m.meanY, 3)}、実測分散 ${fmt(m.varY, 3)}。` },
      { level: 'info', title: 'なぜ対数リンクなのか', body: '件数は負にならないため、直接 y を線形式で予測すると負の予測が出てしまいます。log(E[y]) を線形式で表すことで予測は必ず正になり、係数は「掛け算の効果（何倍になるか）」として解釈できます。' },
      { level: 'info', title: '観測期間が違う場合', body: '「1 か月あたりの件数」と「1 年あたりの件数」が混在するデータでは、そのままでは比較できません。本来はオフセット項（log の観測期間）を入れます。本ツールの画面からはオフセットを指定できないため、あらかじめ期間をそろえてから読み込んでください。' }
    ]);
  }

  /* ============================================================
     ロジスティック回帰
     ============================================================ */
  function updatePosLevels() {
    const yn = $('l_y') && $('l_y').value;
    if (!yn || !col(yn)) return;
    const u = [...new Set(col(yn).values.filter(v => v !== null).map(String))].sort();
    $('l_pos').innerHTML = u.map(v => `<option value="${v}">${v}</option>`).join('');
    if (u.includes('1')) $('l_pos').value = '1';
  }
  $('l_y') && $('l_y').addEventListener('change', updatePosLevels);
  const thrVal = () => (+$('l_thr').value).toFixed(2);
  $('l_thr').addEventListener('input', () => { $('l_thrv').textContent = thrVal(); });
  let LAST_LOGIT = null;
  $('l_thr').addEventListener('change', () => { if (LAST_LOGIT) renderLogitThreshold(); });
  $('l_run').addEventListener('click', () => {
    if (!need()) return;
    const yn = $('l_y').value, pos = $('l_pos').value;
    const xs = [...$('l_x').selectedOptions].map(o => o.value).filter(n => n !== yn);
    if (!yn || !xs.length) { alert('目的変数と説明変数を選んでください。'); return; }
    const yraw = strOf(yn);
    const arrs = xs.map(numOf);
    const idx = [];
    for (let i = 0; i < D.n; i++) if (yraw[i] !== '' && arrs.every(a => isFinite(a[i]))) idx.push(i);
    const y = idx.map(i => yraw[i] === pos ? 1 : 0);
    if (new Set(y).size < 2) { alert('目的変数が 1 種類しかありません。陽性の水準を確認してください。'); return; }
    const cols = arrs.map(a => idx.map(i => a[i]));
    let m;
    try { m = S.logistic(y, cols, xs, { l2: +$('l_l2').value }); } catch (e) { alert('推定できませんでした：' + e.message); return; }
    const roc = S.rocCurve(y, m.prob);
    LAST_LOGIT = { m, y, roc, xs, pos };
    $('l_out').innerHTML = statCards([
      ['n', m.n], ['陽性数', y.reduce((a, b) => a + b, 0)], ['AUC', fmt(roc.auc, 4), 'hot'],
      ['McFadden R²', fmt(m.mcfadden, 4)], ['Nagelkerke R²', fmt(m.nagelkerke, 4)],
      ['尤度比 χ²', fmt(m.lrChi2, 4)], ['p 値', m.lrP < 1e-4 ? m.lrP.toExponential(2) : m.lrP.toFixed(5), m.lrP < .05 ? 'pos' : ''],
      ['AIC', fmt(m.aic, 2)], ['反復回数', m.iter]
    ]) + '<div style="margin-top:14px">' + tableHTML(['項', '係数（対数オッズ）', '標準誤差', 'z 値', 'p 値', 'オッズ比', 'オッズ比の 95% 区間'],
      m.coefs.map(c => [td(c.name), td(fmt(c.estimate, 5)), td(fmt(c.se, 5)), td(fmt(c.z, 4)), pcell(c.p), td(fmt(c.or, 4)), td(`[${fmt(c.orLo, 3)}, ${fmt(c.orHi, 3)}]`)])) + '</div>';
    plot('l_p1', [
      { type: 'scatter', mode: 'lines', x: roc.fpr, y: roc.tpr, fill: 'tozeroy', fillcolor: 'rgba(34,168,132,.18)', line: { color: '#22a884', width: 2.6 }, name: `ROC (AUC=${roc.auc.toFixed(4)})` },
      { type: 'scatter', mode: 'lines', x: [0, 1], y: [0, 1], line: { color: '#7c8bb0', dash: 'dash' }, name: 'ランダム (AUC=0.5)' }
    ], { title: 'ROC 曲線', xaxis: { title: '偽陽性率 (1 − 特異度)' }, yaxis: { title: '真陽性率（感度）' } });
    plot('l_p2', [
      { type: 'violin', x: y.map(v => v ? `陽性（${pos}）` : '陰性'), y: m.prob, points: 'all', jitter: .3, pointpos: 0, box: { visible: true }, line: { color: '#2a788e' }, fillcolor: '#2a788e44', marker: { size: 4, opacity: .5 }, name: '予測確率' }
    ], { title: '実際のクラス別の予測確率', yaxis: { title: '予測確率', range: [0, 1] } });
    renderLogitThreshold();
    predictPanel('l_predict', xs, {
      hint: `条件を入れると、「${pos}」になる確率を返します。判定は上のスライダーの閾値を使います。`,
      single: v => {
        const r = m.predictCI(v);
        const thr = +$('l_thr').value;
        const judge = r.prob >= thr;
        const con = r.contrib.slice(1).sort((a, b) => Math.abs(b.term) - Math.abs(a.term));
        return bigCard(`「${pos}」になる確率`, (r.prob * 100).toFixed(1) + ' %',
          `95% 信頼区間：${(r.lo * 100).toFixed(1)} 〜 ${(r.hi * 100).toFixed(1)} %　／　オッズ ${fmt(r.odds, 3)}<br>` +
          `現在の閾値 ${thr.toFixed(2)} では <b style="color:${judge ? '#fde725' : '#7ad151'}">「${judge ? pos : 'それ以外'}」と判定</b>されます。`)
          + '<div style="margin-top:4px">' + tableHTML(['寄与の大きい順', '入力値', '係数', '対数オッズへの寄与'],
            con.map(c => [td(c.name), td(fmt(c.value, 3)), td(fmt(c.coef, 4)),
              td(`<b style="color:${c.term >= 0 ? '#fca636' : '#7ad151'}">${c.term >= 0 ? '+' : ''}${fmt(c.term, 4)}</b>`)])) + '</div>'
          + `<div class="advice" style="margin-top:12px"><div class="adv key"><div class="t"><span class="tag">結論</span>この表の読み方</div><div class="b">` +
          `寄与がプラスの変数はこの 1 件を「${pos}」の方向へ、マイナスの変数は反対方向へ押しています。合計に切片 ${fmt(r.contrib[0].term, 3)} を足したものが対数オッズ ${fmt(r.logit, 3)} で、それをロジスティック関数に通した値が上の確率です。<b>どの変数がこの判断を決めたか</b>が、ここで分かります。` +
          `</div></div><div class="adv warn"><div class="t"><span class="tag">注意</span>閾値は目的で決める</div><div class="b">` +
          `0.5 は既定値にすぎません。見逃しのコストが高いなら閾値を下げ、誤検知のコストが高いなら上げてください。混同行列の数字がその場で変わるので、どちらの損失が小さいかを見て決めます。` +
          `</div></div></div>`;
      },
      batch: rows => {
        const thr = +$('l_thr').value;
        const body = rows.map((r, i) => {
          const q = m.predictCI(r);
          return [td(i + 1)].concat(r.map(v => td(fmt(v, 2))),
            td(`<b style="color:var(--v5)">${(q.prob * 100).toFixed(1)}%</b>`),
            td(`${(q.lo * 100).toFixed(1)} 〜 ${(q.hi * 100).toFixed(1)}%`),
            td(q.prob >= thr ? `<b class="sig">${pos}</b>` : 'それ以外'));
        });
        const csv = csvOf(['#'].concat(xs, ['確率', 'CI下限', 'CI上限', `判定(閾値${thr})`]),
          rows.map((r, i) => { const q = m.predictCI(r); return [i + 1].concat(r, [q.prob.toFixed(5), q.lo.toFixed(5), q.hi.toFixed(5), q.prob >= thr ? pos : 'それ以外']); }));
        return { head: ['#'].concat(xs, ['確率', '95% 信頼区間', '判定']), body, csv, note: `確率の高い順に並べ替えれば、そのまま「優先的に手を打つリスト」になります。` };
      }
    });
  });
  function renderLogitThreshold() {
    const { m, y, roc } = LAST_LOGIT;
    const thr = +$('l_thr').value;
    const cm = S.confusion(y, m.prob, thr);
    $('l_cm').innerHTML = tableHTML(['', `予測：陽性`, `予測：陰性`, '合計'], [
      [td('<b>実際：陽性</b>'), td(`<b style="color:#7ad151">${cm.tp}</b>（真陽性）`), td(`<b style="color:#e4548a">${cm.fn}</b>（偽陰性・見逃し）`), td(cm.tp + cm.fn)],
      [td('<b>実際：陰性</b>'), td(`<b style="color:#e4548a">${cm.fp}</b>（偽陽性・誤検知）`), td(`<b style="color:#7ad151">${cm.tn}</b>（真陰性）`), td(cm.fp + cm.tn)]
    ]) + '<div style="margin-top:12px">' + statCards([
      ['閾値', thr.toFixed(2)], ['正解率', fmt(cm.accuracy, 4), 'hot'], ['感度（再現率）', fmt(cm.recall, 4)],
      ['特異度', fmt(cm.specificity, 4)], ['適合率', fmt(cm.precision, 4)], ['F1 スコア', fmt(cm.f1, 4)],
      ['MCC', fmt(cm.mcc, 4)], ['バランス精度', fmt(cm.balanced, 4)]
    ]) + '</div><p class="note">スライダーで閾値を動かすと、感度と特異度が入れ替わりで変化します。Youden 指数が最大になる閾値は ' + roc.bestThreshold.toFixed(3) + ' です。</p>';
    renderAdvice('l_advice', AD.logistic(m, cm, roc, .05));
  }

  /* ============================================================
     決定木
     ============================================================ */
  let LAST_TREE = null, LAST_MLP = null;
  $('dt_run').addEventListener('click', () => {
    if (!need()) return;
    const yn = $('dt_y').value, task = $('dt_task').value;
    const xs = [...$('dt_x').selectedOptions].map(o => o.value).filter(n => n !== yn);
    if (!yn || !xs.length) { alert('目的変数と説明変数を選んでください。'); return; }
    const yraw = task === 'classification' ? strOf(yn) : numOf(yn);
    const arrs = xs.map(numOf), X = [], Y = [];
    for (let i = 0; i < D.n; i++) {
      if (!arrs.every(a => isFinite(a[i]))) continue;
      if (task === 'classification' ? !yraw[i] : !isFinite(yraw[i])) continue;
      X.push(arrs.map(a => a[i])); Y.push(yraw[i]);
    }
    if (X.length < 10) { alert('有効なデータが少なすぎます。'); return; }
    const t = S.decisionTree(X, Y, xs, { maxDepth: +$('dt_depth').value, minLeaf: +$('dt_leaf').value, minSamples: Math.max(2, +$('dt_leaf').value * 2), task, testRatio: +$('dt_test').value });
    LAST_TREE = { t, X, Y, xs, task };
    drawTree(t.tree, t.task);
    $('dt_out').innerHTML = statCards(task === 'classification'
      ? [['学習データ正解率', fmt(t.train.accuracy, 4)], ['検証データ正解率', fmt(t.test.accuracy, 4), 'hot'], ['学習 n', t.nTrain], ['検証 n', t.nTest], ['深さ', t.depth]]
      : [['学習 R²', fmt(t.train.r2, 4)], ['検証 R²', fmt(t.test.r2, 4), 'hot'], ['学習 RMSE', fmt(t.train.rmse, 4)], ['検証 RMSE', fmt(t.test.rmse, 4)], ['深さ', t.depth]]);
    const ord = t.importance.map((v, i) => ({ n: xs[i], v })).sort((a, b) => a.v - b.v);
    plot('dt_imp', [{ type: 'bar', orientation: 'h', x: ord.map(o => o.v), y: ord.map(o => o.n), marker: { color: ord.map((_, i) => VIRIDIS[i % 8]) } }],
      { title: '変数重要度', xaxis: { title: '不純度減少の割合', tickformat: '.0%' } });
    drawBoundary();
    predictPanel('dt_predict', xs, {
      hint: '条件を入れると、木のどの分岐をたどって予測にたどり着いたかを表示します。決定木の最大の強みは、この「経路」がそのまま説明になることです。',
      single: v => {
        const pth = S.treePath(t.tree, v);
        const leaf = pth.leaf;
        const val = task === 'classification' ? leaf.value : fmt(leaf.value, 3);
        const steps = pth.steps.map((st, i) =>
          `<div style="padding:7px 0;border-bottom:1px solid rgba(126,150,200,.1)">
             <span style="font-family:var(--mono);color:var(--ink-dim)">${i + 1}.</span>
             <b>${st.name}</b> = ${fmt(st.value, 3)} は ${fmt(st.threshold, 3)} 以下か？ →
             <b style="color:${st.go ? '#7ad151' : '#fca636'}">${st.go ? 'はい（左へ）' : 'いいえ（右へ）'}</b>
             <span style="color:var(--ink-dim);font-size:11px">（このノードの学習データ ${st.n} 件）</span>
           </div>`).join('');
        let probHtml = '';
        if (task === 'classification' && leaf.prob) {
          probHtml = '<div style="margin-top:12px">' + tableHTML(['クラス', 'この葉での割合', '学習データ件数'],
            Object.entries(leaf.prob).sort((a, b) => b[1] - a[1]).map(([k, p]) =>
              [td(k), td((p * 100).toFixed(1) + '%'), td(leaf.counts[k])])) + '</div>';
        }
        return bigCard('予測', val, `深さ ${pth.steps.length} の分岐をたどり、学習データ ${leaf.n} 件が集まった葉に到達しました。`)
          + `<div style="margin-top:6px"><div class="crumb" style="margin-bottom:6px">たどった経路</div>${steps}</div>` + probHtml
          + `<div class="advice" style="margin-top:12px"><div class="adv key"><div class="t"><span class="tag">結論</span>説明できる予測</div><div class="b">` +
          `この経路をそのまま日本語にすれば、決裁資料に書ける根拠になります。「${pth.steps.map(st => `${st.name}が${fmt(st.threshold, 2)}${st.go ? '以下' : '超'}`).join('、')}だから ${val}」という具合です。` +
          `</div></div><div class="adv warn"><div class="t"><span class="tag">注意</span>葉の件数を見る</div><div class="b">` +
          `到達した葉の学習データが ${leaf.n} 件です。${leaf.n < 20 ? 'これは少なく、たまたまその数件の特徴を覚えただけの可能性があります。木を浅くするか、ランダムフォレストの結果と比べてください。' : '十分な件数があり、この予測は安定していると考えられます。'}` +
          `</div></div></div>`;
      },
      batch: rows => {
        const body = rows.map((r, i) => {
          const pth = S.treePath(t.tree, r);
          return [td(i + 1)].concat(r.map(v => td(fmt(v, 2))),
            td(`<b style="color:var(--v5)">${task === 'classification' ? pth.leaf.value : fmt(pth.leaf.value, 3)}</b>`),
            td(pth.leaf.n), td(pth.steps.map(st => `${st.name}${st.go ? '≤' : '>'}${fmt(st.threshold, 2)}`).join(' & ')));
        });
        const csv = csvOf(['#'].concat(xs, ['予測', '葉の件数', '条件']),
          rows.map((r, i) => { const pth = S.treePath(t.tree, r); return [i + 1].concat(r, [pth.leaf.value, pth.leaf.n, '"' + pth.steps.map(st => `${st.name}${st.go ? '<=' : '>'}${fmt(st.threshold, 2)}`).join(' & ') + '"']); }));
        return { head: ['#'].concat(xs, ['予測', '葉の件数', '適用されたルール']), body, csv };
      }
    });
    renderAdvice('dt_advice', AD.tree(t));
  });
  $('rf_run').addEventListener('click', () => {
    if (!LAST_TREE) { alert('先に決定木を作ってください。'); return; }
    const { X, Y, xs, task } = LAST_TREE;
    const rf = S.randomForest(X, Y, xs, { nTrees: 100, maxDepth: 8, task });
    const ord = rf.importance.map((v, i) => ({ n: xs[i], v })).sort((a, b) => a.v - b.v);
    plot('dt_imp', [
      { type: 'bar', orientation: 'h', x: ord.map(o => o.v), y: ord.map(o => o.n), name: 'ランダムフォレスト', marker: { color: '#22a884' } },
      { type: 'bar', orientation: 'h', x: ord.map(o => LAST_TREE.t.importance[xs.indexOf(o.n)]), y: ord.map(o => o.n), name: '単一の決定木', marker: { color: '#414487' } }
    ], { title: '変数重要度の比較', barmode: 'group', xaxis: { tickformat: '.0%' } });
    $('dt_out').innerHTML += '<div style="margin-top:12px">' + statCards([['森の本数', rf.nTrees], ['分割候補変数 mtry', rf.mtry],
    ...(task === 'classification' ? [['OOB 正解率', fmt(rf.oob.accuracy, 4), 'hot']] : [['OOB R²', fmt(rf.oob.r2, 4), 'hot'], ['OOB RMSE', fmt(rf.oob.rmse, 4)]])]) + '</div>';
    renderAdvice('dt_advice', AD.tree(LAST_TREE.t).concat([{
      level: 'info', title: 'ランダムフォレストとの比較',
      body: `OOB（out-of-bag）は各木の学習に使われなかったデータでの精度で、交差検証に近い信頼性があります。単一の木より精度が上がるのが普通ですが、代わりに「1 本の図として読む」ことはできなくなります。重要度が単一木と大きく違う変数は、木の構造が不安定であることを示しています。`
    }]));
  });

  $('pi_run').addEventListener('click', () => {
    if (!LAST_TREE) { alert('先に決定木を作ってください。'); return; }
    const { t, X, Y, xs, task } = LAST_TREE;
    const predict = row => S.treePredict(t.tree, row);
    const pi = S.permutationImportance(predict, X, Y, { task, repeats: 12 });
    const ord = pi.importance.map((o, i) => ({ n: xs[i], ...o })).sort((a, b) => a.mean - b.mean);
    plot('dt_perm', [{
      type: 'bar', orientation: 'h', x: ord.map(o => o.mean), y: ord.map(o => o.n),
      error_x: { type: 'data', array: ord.map(o => o.sd), color: '#fde725', thickness: 1.4 },
      marker: { color: ord.map((_, i) => VIRIDIS[i % 8]) }
    }], { title: `並べ替え重要度（${task === 'classification' ? '正解率' : 'R²'}の低下量）`, xaxis: { title: '性能の低下' } });
    const cls = task === 'classification' ? [...new Set(Y)].sort()[0] : null;
    const T = xs.map((n, i) => {
      const pd = S.partialDependence(predict, X, i, { grid: 30, classIndex: cls });
      const lo = Math.min(...pd.x), hi = Math.max(...pd.x);
      return { type: 'scatter', mode: 'lines', x: pd.x.map(v => (v - lo) / ((hi - lo) || 1)), y: pd.y, name: n, line: { color: VIRIDIS[i % 8], width: 2.4 } };
    });
    plot('dt_pdp', T, {
      title: task === 'classification' ? `部分依存プロット（P(${cls}) の平均）` : '部分依存プロット（予測値の平均）',
      xaxis: { title: '各変数の値（0＝最小値、1＝最大値に正規化）' }, yaxis: { title: task === 'classification' ? `P(${cls})` : '予測値' }
    });
    renderAdvice('dt_advice', AD.tree(t).concat([
      { level: 'key', title: '並べ替え重要度（permutation importance）', body: `その変数の値だけをランダムに入れ替えたときに性能がどれだけ落ちるかを測っています（12 回の平均、誤差棒は標準偏差）。基準性能は ${fmt(pi.baseScore, 4)}。落ち込みが大きい変数ほど予測に不可欠です。木の分割回数に基づく重要度と違い、モデルの種類を問わず同じ意味で比較できます。` },
      { level: 'key', title: '部分依存プロット（PDP）', body: '重要度は「どれだけ効くか」しか教えてくれません。PDP は「どちら向きに、どんな形で効くか」を示します。右上がりなら値が大きいほど予測が上がり、階段状なら決定木が閾値で切っていることが分かります。' },
      { level: 'warn', title: 'PDP の前提', body: '他の変数を実際の分布のまま固定して平均を取るため、変数どうしが強く相関している場合（例：身長と体重）、現実にはあり得ない組み合わせを平均に含んでしまいます。相関の強い変数がある場合は解釈に注意してください。' },
      { level: 'info', title: 'SHAP との関係', body: '同じ「予測の理由を説明する」道具として SHAP がありますが、本ツールには実装していません。SHAP は 1 件ごとの寄与を分解できる点が優れています。PDP と並べ替え重要度は、全体の傾向を見るぶんには SHAP とおおむね同じ結論を与えます。' }
    ]));
  });

  function drawTree(node, task) {
    const W = 1180, levelH = 108;
    let maxD = 0; (function d(n, k) { maxD = Math.max(maxD, k); if (!n.leaf) { d(n.left, k + 1); d(n.right, k + 1); } })(node, 0);
    const H = (maxD + 1) * levelH + 60;
    const parts = [];
    (function walk(n, x, y, w) {
      const isLeaf = n.leaf;
      const label = isLeaf
        ? (task === 'classification' ? `${n.value}` : fmt(n.value, 3))
        : `${n.featureName} ≤ ${fmt(n.threshold, 3)}`;
      const sub = task === 'classification'
        ? `n=${n.n} / gini=${n.impurity.toFixed(3)}`
        : `n=${n.n} / 平均 ${fmt(n.value, 3)}`;
      if (!isLeaf) {
        const cw = w / 2;
        [[n.left, x - cw / 2, '真'], [n.right, x + cw / 2, '偽']].forEach(([c, cx, lab]) => {
          parts.push(`<path class="tedge" d="M ${x} ${y + 22} C ${x} ${y + 62}, ${cx} ${y + 48}, ${cx} ${y + levelH - 22}"/>`);
          parts.push(`<text x="${(x + cx) / 2}" y="${y + 62}" fill="#7c8bb0" font-size="9.5" text-anchor="middle" font-family="IBM Plex Mono">${lab}</text>`);
        });
        walk(n.left, x - cw / 2, y + levelH, cw);
        walk(n.right, x + cw / 2, y + levelH, cw);
      }
      const bw = Math.max(96, Math.min(180, label.length * 8 + 26));
      const fill = isLeaf ? (task === 'classification' ? '#22a88433' : '#41448733') : '#111a2d';
      const stroke = isLeaf ? '#22a884' : 'rgba(126,150,200,.34)';
      parts.push(`<g class="tnode"><rect x="${x - bw / 2}" y="${y - 22}" width="${bw}" height="44" fill="${fill}" stroke="${stroke}"/>` +
        `<text x="${x}" y="${y - 4}" text-anchor="middle" font-weight="600">${label}</text>` +
        `<text x="${x}" y="${y + 12}" text-anchor="middle" fill="#7c8bb0" font-size="9">${sub}</text></g>`);
    })(node, W / 2, 44, W * 0.94);
    $('dt_tree').innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>
      <p class="note">条件が真なら左、偽なら右に進みます。緑の枠が葉（最終的な予測）です。</p>`;
  }
  function drawBoundary() {
    const { t, X, Y, xs, task } = LAST_TREE;
    if (xs.length !== 2) { $('dt_bound').innerHTML = '<div class="empty"><b>説明変数を 2 つ選ぶと決定境界を描画します</b>現在は ' + xs.length + ' 個選択されています。</div>'; return; }
    const x0 = X.map(r => r[0]), x1 = X.map(r => r[1]);
    const mn0 = Math.min(...x0), mx0 = Math.max(...x0), mn1 = Math.min(...x1), mx1 = Math.max(...x1);
    const N = 90, gx = [], gy = [], z = [];
    for (let i = 0; i < N; i++) gx.push(mn0 + (mx0 - mn0) * i / (N - 1));
    for (let j = 0; j < N; j++) gy.push(mn1 + (mx1 - mn1) * j / (N - 1));
    const cls = task === 'classification' ? [...new Set(Y)].sort() : null;
    for (let j = 0; j < N; j++) { const row = []; for (let i = 0; i < N; i++) { const p = S.treePredict(t.tree, [gx[i], gy[j]]); row.push(task === 'classification' ? cls.indexOf(String(p)) : p); } z.push(row); }
    const T = [{ type: 'heatmap', z, x: gx, y: gy, colorscale: 'Viridis', opacity: .45, showscale: false, hoverinfo: 'skip' }];
    if (task === 'classification') {
      cls.forEach((c, i) => {
        const ix = Y.map((v, k) => String(v) === c ? k : -1).filter(k => k >= 0);
        T.push({ type: 'scatter', mode: 'markers', x: ix.map(k => X[k][0]), y: ix.map(k => X[k][1]), name: c, marker: { color: VIRIDIS[i % 8], size: 7, line: { color: '#05070d', width: 1 } } });
      });
    } else T.push({ type: 'scatter', mode: 'markers', x: x0, y: x1, marker: { color: Y, colorscale: 'Viridis', size: 7, line: { color: '#05070d', width: 1 } }, name: '観測値' });
    plot('dt_bound', T, { title: '決定境界（矩形に分割されるのが決定木の特徴）', xaxis: { title: xs[0] }, yaxis: { title: xs[1] } });
  }


  // 時系列の x 軸：内部は通し番号、目盛だけ元のラベル（日付など）に差し替える
  function tsAxis(labels, n, h, view) {
    const lo = Math.max(1, Math.round(view ? view[0] : 1));
    const hi = Math.min(n + h, Math.round(view ? view[1] : n + h));
    const step = Math.max(1, Math.ceil((hi - lo + 1) / 9));
    const tickvals = [], ticktext = [];
    for (let i = lo; i <= hi; i += step) {
      tickvals.push(i);
      ticktext.push(i <= n ? (labels[i - 1] !== undefined ? String(labels[i - 1]) : String(i)) : `+${i - n}`);
    }
    return { tickmode: 'array', tickvals, ticktext, tickangle: ticktext.some(t => t.length > 6) ? -30 : 0 };
  }

  /* ============================================================
     時系列
     ============================================================ */
  $('ts_run').addEventListener('click', () => {
    if (!need()) return;
    const yn = $('ts_y').value, tn = $('ts_t').value;
    if (!yn) { alert('値の列を選んでください。'); return; }
    let y = numOf(yn).filter(isFinite);
    const period = Math.max(1, +$('ts_period').value), h = +$('ts_h').value, d = +$('ts_d').value;
    const labels = tn ? strOf(tn).filter((_, i) => isFinite(numOf(yn)[i])) : y.map((_, i) => String(i + 1));
    if (y.length < 8) { alert('データ点が少なすぎます。'); return; }
    let work = y;
    if (d > 0) work = S.diff(y, d);
    // x 軸は通し番号で持ち、目盛だけ元のラベルに置き換える
    // （文字列ラベルのまま予測を継ぎ足すと、Plotly が "+1" を数値 1 と解釈して左端に描いてしまう）
    const n = y.length;
    const xs = y.map((_, i) => i + 1);
    const fcX = []; for (let i = 1; i <= h; i++) fcX.push(n + i);
    const view = n > 200 ? [Math.max(0.5, n - Math.max(120, h * 8)), n + h + 0.5] : null;
    const axis = tsAxis(labels, n, h, view);
    const T = [{ type: 'scatter', mode: 'lines', x: xs, y, name: yn, line: { color: '#22a884', width: 2 }, text: labels, hovertemplate: '%{text}<br>%{y}<extra></extra>' }];
    const ma = S.movingAverage(y, Math.max(2, +$('ts_ma').value));
    T.push({ type: 'scatter', mode: 'lines', x: xs, y: ma, name: `${$('ts_ma').value} 期移動平均`, line: { color: '#fde725', width: 1.8 } });
    const method = $('ts_method').value;
    let res = {};
    // 予測線は最後の実測値から始めて、実績と切れ目なくつなぐ
    const fcTrace = (fc, name) => ({ type: 'scatter', mode: 'lines', x: [n].concat(fcX), y: [y[n - 1]].concat(fc), name, line: { color: '#e4548a', width: 2.8 } });
    const bandTrace = (lo, hi) => ({ type: 'scatter', mode: 'lines', x: fcX.concat(fcX.slice().reverse()), y: hi.concat(lo.slice().reverse()), fill: 'toself', fillcolor: 'rgba(228,84,138,.20)', line: { width: 0 }, name: '95% 予測区間', hoverinfo: 'skip' });
    if (method === 'hw') {
      const hw = S.holtWinters(y, { period, seasonal: $('ts_model').value, horizon: h });
      res.hw = hw;
      T.push({ type: 'scatter', mode: 'lines', x: xs, y: hw.fitted, name: '当てはめ値', line: { color: '#2a788e', width: 1.4, dash: 'dot' } });
      T.push(bandTrace(hw.lo, hw.hi));
      T.push(fcTrace(hw.forecast, '予測'));
      res.resid = hw.resid;
    } else if (method === 'add') {
      const t = y.map((_, i) => i);
      const fo = period > 1 ? [{ period, order: Math.min(6, Math.floor(period / 2)) }] : [];
      const af = S.additiveForecast(t, y, { horizon: h, fourierOrders: fo, nChangepoints: Math.min(15, Math.floor(y.length / 8)) });
      res.af = af;
      T.push({ type: 'scatter', mode: 'lines', x: xs, y: af.fitted, name: '当てはめ値', line: { color: '#2a788e', width: 1.6, dash: 'dot' } });
      T.push(bandTrace(af.lo, af.hi));
      T.push(fcTrace(af.forecast, '予測'));
      res.resid = af.resid;
    } else {
      const p = Math.min(+$('ts_p').value, Math.floor(y.length / 4));
      const m = S.arFit(y, p); res.ar = m;
      const fc = []; const hist = y.slice();
      for (let i = 0; i < h; i++) {
        let v = m.coefs[0].estimate;
        for (let k = 1; k <= p; k++) v += m.coefs[k].estimate * hist[hist.length - k];
        hist.push(v); fc.push(v);
      }
      T.push({ type: 'scatter', mode: 'lines', x: xs.slice(p), y: m.fitted, name: `AR(${p}) 当てはめ`, line: { color: '#2a788e', width: 1.6, dash: 'dot' } });
      T.push(fcTrace(fc, '予測'));
      res.resid = m.resid;
    }
    plot('ts_main', T, {
      title: `${yn} の推移と予測（右端の縦線から先が予測）`,
      xaxis: Object.assign({ title: (tn || '時点') + (view ? '（直近を拡大表示。ツールバーの Autoscale で全期間）' : '') }, axis, view ? { range: view } : {}),
      yaxis: { title: yn },
      shapes: [{ type: 'line', x0: n + .5, x1: n + .5, yref: 'paper', y0: 0, y1: 1, line: { color: '#fde725', dash: 'dot', width: 1.4 } }],
      annotations: [{ x: n + .5, yref: 'paper', y: 1.02, text: '予測開始', showarrow: false, font: { color: '#fde725', size: 10 }, xanchor: 'right' }]
    });

    // 分解
    if (period > 1 && y.length >= period * 2) {
      const dec = S.decompose(y, period, $('ts_model').value);
      res.decomp = dec;
      plot('ts_dec', [
        { type: 'scatter', mode: 'lines', x: labels, y, name: '原系列', line: { color: '#7c8bb0', width: 1.4 }, yaxis: 'y' },
        { type: 'scatter', mode: 'lines', x: labels, y: dec.trend, name: 'トレンド', line: { color: '#fde725', width: 2.2 }, yaxis: 'y2' },
        { type: 'scatter', mode: 'lines', x: labels, y: dec.seasonal, name: '季節', line: { color: '#22a884', width: 1.6 }, yaxis: 'y3' },
        { type: 'bar', x: labels, y: dec.resid, name: '残差', marker: { color: '#e4548a', opacity: .6 }, yaxis: 'y4' }
      ], {
        title: `成分分解（${$('ts_model').value === 'additive' ? '加法' : '乗法'}・周期 ${period}）`, height: 520, showlegend: true,
        yaxis: { domain: [.78, 1], title: '原系列' }, yaxis2: { domain: [.53, .74], title: 'トレンド' },
        yaxis3: { domain: [.28, .49], title: '季節' }, yaxis4: { domain: [0, .24], title: '残差' },
        xaxis: { anchor: 'y4' }, margin: { l: 66, r: 20, t: 42, b: 44 }
      });
    } else { $('ts_dec').innerHTML = '<div class="empty"><b>成分分解には 2 周期以上のデータが必要です</b>季節周期を確認してください。</div>'; }

    // コレログラム
    const lagMax = Math.min(36, Math.floor(work.length / 3));
    const ac = S.acf(work, lagMax), pc = S.pacf(work, lagMax);
    const ci = 1.96 / Math.sqrt(work.length);
    const bars = (v, title) => [
      { type: 'bar', x: v.map((_, i) => i), y: v, marker: { color: v.map(x => Math.abs(x) > ci ? '#fde725' : '#2a788e') }, name: title },
      { type: 'scatter', mode: 'lines', x: [0, lagMax], y: [ci, ci], line: { color: '#e4548a', dash: 'dash', width: 1 }, showlegend: false },
      { type: 'scatter', mode: 'lines', x: [0, lagMax], y: [-ci, -ci], line: { color: '#e4548a', dash: 'dash', width: 1 }, showlegend: false }
    ];
    plot('ts_acf', bars(ac, 'ACF'), { title: `自己相関 ACF${d ? `（${d} 階差分後）` : ''}`, xaxis: { title: 'ラグ' } });
    plot('ts_pacf', bars(pc, 'PACF'), { title: `偏自己相関 PACF${d ? `（${d} 階差分後）` : ''}`, xaxis: { title: 'ラグ' } });

    res.adf = y.length > 12 ? S.adfTest(y) : null;
    res.lb = res.resid ? S.ljungBox(res.resid.filter(isFinite), Math.min(20, Math.floor(y.length / 5))) : null;
    const cards = [['n', y.length], ['平均', fmt(S.mean(y))], ['標準偏差', fmt(S.sd(y))]];
    if (res.adf) cards.push(['ADF 統計量', fmt(res.adf.statistic, 4), res.adf.stationary ? 'pos' : 'neg'], ['5% 臨界値', res.adf.critical['5%']], ['定常性', res.adf.stationary ? '定常とみなせる' : '非定常の疑い']);
    if (res.hw) cards.push(['RMSE', fmt(res.hw.rmse, 4)], ['MAPE', fmt(res.hw.mape, 2) + '%'], ['α', fmt(res.hw.alpha, 3)]);
    if (res.af) cards.push(['R²', fmt(res.af.r2, 4)], ['RMSE', fmt(res.af.rmse, 4)], ['MAPE', fmt(res.af.mape, 2) + '%']);
    if (res.ar) cards.push(['R²', fmt(res.ar.R2, 4)], ['AIC', fmt(res.ar.aic, 2)]);
    if (res.lb) cards.push(['Ljung–Box p', res.lb.p < 1e-4 ? res.lb.p.toExponential(2) : res.lb.p.toFixed(5), res.lb.p < .05 ? 'neg' : 'pos']);
    let extra = '';
    if (res.ar) extra = '<div style="margin-top:14px">' + tableHTML(['項', '係数', '標準誤差', 't 値', 'p 値'],
      res.ar.coefs.map(c => [td(c.name), td(fmt(c.estimate, 5)), td(fmt(c.se, 5)), td(fmt(c.t, 4)), pcell(c.p)])) + '</div>';
    $('ts_out').innerHTML = statCards(cards) + extra;
    renderAdvice('ts_advice', AD.timeseries(res));
  });

  /* ============================================================
     株価
     ============================================================ */
  $('s_run').addEventListener('click', () => {
    if (!need()) return;
    const cn = $('s_close').value, dn = $('s_date').value;
    if (!cn) { alert('終値の列を選んでください。'); return; }
    const raw = numOf(cn);
    const keep = []; for (let i = 0; i < D.n; i++) if (isFinite(raw[i])) keep.push(i);
    const close = keep.map(i => raw[i]);
    const labels = dn ? keep.map(i => strOf(dn)[i]) : close.map((_, i) => String(i + 1));
    if (close.length < 30) { alert('30 点以上の価格データが必要です。'); return; }
    const ppy = +$('s_ppy').value || 252;
    const pa = S.priceAnalytics(close, { periodsPerYear: ppy });
    const mas = $('s_ma').value.split(/[,\s]+/).map(Number).filter(v => v > 1);
    const bb = S.bollinger(close, 20, 2);
    const T = [{ type: 'scatter', mode: 'lines', x: labels, y: close, name: '終値', line: { color: '#e8eefb', width: 1.8 } }];
    T.push({ type: 'scatter', mode: 'lines', x: labels, y: bb.up, name: 'ボリンジャー +2σ', line: { color: '#414487', width: 1 } });
    T.push({ type: 'scatter', mode: 'lines', x: labels, y: bb.dn, name: 'ボリンジャー −2σ', line: { color: '#414487', width: 1 }, fill: 'tonexty', fillcolor: 'rgba(65,68,135,.16)' });
    mas.forEach((w, i) => T.push({ type: 'scatter', mode: 'lines', x: labels, y: S.movingAverage(close, w), name: `${w} 日移動平均`, line: { color: VIRIDIS[i % 8], width: 1.8 } }));
    const rs = S.rsi(close, +$('s_rsi').value), mac = S.macd(close);
    plot('s_chart', T.concat([
      { type: 'scatter', mode: 'lines', x: labels, y: rs, name: `RSI(${$('s_rsi').value})`, yaxis: 'y2', line: { color: '#fca636', width: 1.4 } },
      { type: 'bar', x: labels, y: mac.hist, name: 'MACD ヒストグラム', yaxis: 'y3', marker: { color: mac.hist.map(v => v >= 0 ? '#22a884' : '#e4548a'), opacity: .7 } }
    ]), {
      title: '価格チャートとテクニカル指標', height: 620,
      yaxis: { domain: [.44, 1], title: '価格' },
      yaxis2: { domain: [.23, .40], title: 'RSI', range: [0, 100] },
      yaxis3: { domain: [0, .19], title: 'MACD' },
      xaxis: { anchor: 'y3' }, margin: { l: 62, r: 24, t: 42, b: 44 }
    });
    $('s_stats').innerHTML = statCards([
      ['期間', `${close.length} 本`], ['始値→終値', `${fmt(close[0], 2)} → ${fmt(close[close.length - 1], 2)}`],
      ['累積リターン', ((close[close.length - 1] / close[0] - 1) * 100).toFixed(2) + '%', close[close.length - 1] >= close[0] ? 'pos' : 'neg'],
      ['CAGR', (pa.cagr * 100).toFixed(2) + '%', pa.cagr >= 0 ? 'pos' : 'neg'],
      ['年率ボラティリティ', (pa.annVol * 100).toFixed(2) + '%', 'hot'],
      ['シャープレシオ', fmt(pa.sharpe, 3)], ['ソルティノレシオ', fmt(pa.sortino, 3)],
      ['最大ドローダウン', (pa.maxDrawdown * 100).toFixed(2) + '%', 'neg'],
      ['カルマーレシオ', fmt(pa.calmar, 3)],
      ['VaR 95%（日次）', (pa.var95 * 100).toFixed(2) + '%'], ['VaR 99%（日次）', (pa.var99 * 100).toFixed(2) + '%'],
      ['CVaR 95%', (pa.cvar95 * 100).toFixed(2) + '%'], ['歪度', fmt(pa.skew, 3)], ['超過尖度', fmt(pa.kurt, 3)],
      ['直近 RSI', fmt(rs[rs.length - 1], 2)]
    ]);
    const k = S.kde(pa.returns, 200);
    const m = S.mean(pa.returns), sdv = S.sd(pa.returns);
    plot('s_ret', [
      { type: 'histogram', x: pa.returns, histnorm: 'probability density', name: '日次リターン', marker: { color: '#2a788e' }, opacity: .6, nbinsx: 50 },
      { type: 'scatter', mode: 'lines', x: k.x, y: k.y, name: 'カーネル密度', line: { color: '#7ad151', width: 2.2 } },
      { type: 'scatter', mode: 'lines', x: k.x, y: k.x.map(v => S.normal.pdf(v, m, sdv)), name: '正規分布（比較）', line: { color: '#fde725', dash: 'dash', width: 1.8 } }
    ], { title: 'リターン分布 — 正規分布より裾が厚いのが典型', xaxis: { title: '日次リターン', tickformat: '.1%' } });
    plot('s_dd', [{ type: 'scatter', mode: 'lines', x: labels, y: pa.drawdown, fill: 'tozeroy', fillcolor: 'rgba(228,84,138,.24)', line: { color: '#e4548a', width: 1.6 }, name: 'ドローダウン' }],
      { title: '高値からの下落率（ドローダウン）', yaxis: { tickformat: '.0%' } });
    const hh = +$('s_h').value;
    const af = S.additiveForecast(close.map((_, i) => i), close, { horizon: hh, nChangepoints: 14, fourierOrders: [] });
    const nn = close.length;
    const cx = close.map((_, i) => i + 1);
    const fx2 = []; for (let i = 1; i <= hh; i++) fx2.push(nn + i);
    const view2 = [Math.max(0.5, nn - Math.max(120, hh * 8)), nn + hh + 0.5];
    plot('s_fc', [
      { type: 'scatter', mode: 'lines', x: cx, y: close, name: '実績', line: { color: '#e8eefb', width: 1.6 }, text: labels, hovertemplate: '%{text}<br>%{y}<extra></extra>' },
      { type: 'scatter', mode: 'lines', x: cx, y: af.trend, name: '推定トレンド', line: { color: '#22a884', width: 2 } },
      { type: 'scatter', mode: 'lines', x: fx2.concat(fx2.slice().reverse()), y: af.hi.concat(af.lo.slice().reverse()), fill: 'toself', fillcolor: 'rgba(228,84,138,.20)', line: { width: 0 }, name: '95% 区間', hoverinfo: 'skip' },
      { type: 'scatter', mode: 'lines', x: [nn].concat(fx2), y: [close[nn - 1]].concat(af.forecast), name: '参考予測', line: { color: '#e4548a', width: 2.8 } }
    ], {
      title: '参考予測（区分線形トレンド＋変化点／Prophet の考え方を自前実装したもの）',
      xaxis: Object.assign({ title: '直近を拡大表示。ツールバーの Autoscale で全期間' }, tsAxis(labels, nn, hh, view2), { range: view2 }),
      shapes: [{ type: 'line', x0: nn + .5, x1: nn + .5, yref: 'paper', y0: 0, y1: 1, line: { color: '#fde725', dash: 'dot', width: 1.4 } }],
      annotations: [{ x: nn + .5, yref: 'paper', y: 1.02, text: '予測開始', showarrow: false, font: { color: '#fde725', size: 10 }, xanchor: 'right' }]
    });
    renderAdvice('s_advice', AD.stock(pa).concat([{
      level: 'warn', title: 'この「予測」の位置づけ',
      body: '過去のトレンドを延長しているだけで、将来の材料・イベント・市場環境の変化は一切考慮していません。効率的市場仮説のもとでは、価格の系列からの将来予測は原理的に困難です。区間の広さを、不確実性の大きさとして読んでください。'
    }]));
  });

  /* ============================================================
     MLP
     ============================================================ */
  $('n_run').addEventListener('click', async () => {
    if (!need()) return;
    const yn = $('n_y').value, task = $('n_task').value;
    const xs = [...$('n_x').selectedOptions].map(o => o.value).filter(n => n !== yn);
    if (!yn || !xs.length) { alert('目的変数と説明変数を選んでください。'); return; }
    const yraw = task === 'regression' ? numOf(yn) : strOf(yn);
    const arrs = xs.map(numOf), X = [], Y = [];
    for (let i = 0; i < D.n; i++) {
      if (!arrs.every(a => isFinite(a[i]))) continue;
      if (task === 'regression' ? !isFinite(yraw[i]) : !yraw[i]) continue;
      X.push(arrs.map(a => a[i])); Y.push(yraw[i]);
    }
    if (X.length < 20) { alert('有効なデータが 20 行以上必要です。'); return; }
    const hidden = $('n_hidden').value.split(/[,\s]+/).map(Number).filter(v => v >= 1);
    if (!hidden.length) { alert('隠れ層の構成を入力してください（例：32, 16）。'); return; }
    const btn = $('n_run'); btn.disabled = true;
    if (LAST_MLP && LAST_MLP.dispose) LAST_MLP.dispose();   // 前回のネットワークを解放
    LAST_MLP = null;
    $('n_status').textContent = '学習中…'; $('n_status').className = 'pill live';
    const cfg = {
      hidden, activation: $('n_act').value, epochs: +$('n_ep').value, lr: +$('n_lr').value,
      batchSize: +$('n_bs').value, task, valRatio: +$('n_val').value, dropout: +$('n_do').value,
      l2: +$('n_l2').value, optimizer: $('n_opt').value
    };
    try {
      const r = await S.trainMLP(X, Y, cfg, (e, tot, h) => {
        $('n_bar').style.width = (e / tot * 100) + '%';
        $('n_status').textContent = `${e} / ${tot} エポック — loss ${h.loss[h.loss.length - 1].toFixed(5)}`;
        plot('n_curve', [
          { type: 'scatter', mode: 'lines', y: h.loss, name: '学習損失', line: { color: '#22a884', width: 2 } },
          { type: 'scatter', mode: 'lines', y: h.val_loss, name: '検証損失', line: { color: '#fde725', width: 2 } }
        ], { title: '学習曲線', xaxis: { title: 'エポック' }, yaxis: { title: '損失' } });
      });
      $('n_status').textContent = '完了'; $('n_status').className = 'pill';
      plot('n_curve', [
        { type: 'scatter', mode: 'lines', y: r.history.loss, name: '学習損失', line: { color: '#22a884', width: 2 } },
        { type: 'scatter', mode: 'lines', y: r.history.val_loss, name: '検証損失', line: { color: '#fde725', width: 2 } }
      ], { title: '学習曲線（検証損失が上昇し始めたら過学習）', xaxis: { title: 'エポック' }, yaxis: { title: '損失' } });
      if (task === 'regression') {
        $('n_out').innerHTML = statCards([['R²', fmt(r.r2, 4), 'hot'], ['RMSE', fmt(r.rmse, 4)], ['MAE', fmt(r.mae, 4)], ['検証 RMSE', fmt(r.valRmse, 4)], ['パラメータ数', r.nParams.toLocaleString()], ['構成', r.arch.join('-')]]);
        plot('n_pred', [
          { type: 'scatter', mode: 'markers', x: Y, y: r.predictions, marker: { color: '#2a788e', size: 7, opacity: .75 }, name: '予測' },
          { type: 'scatter', mode: 'lines', x: [Math.min(...Y), Math.max(...Y)], y: [Math.min(...Y), Math.max(...Y)], line: { color: '#fde725', dash: 'dash' }, name: '完全一致' }
        ], { title: '観測値 vs 予測値', xaxis: { title: '観測値' }, yaxis: { title: '予測値' } });
      } else {
        $('n_out').innerHTML = statCards([['正解率', fmt(r.accuracy, 4), 'hot'], ['学習', fmt(r.trainAccuracy, 4)], ['検証', fmt(r.valAccuracy, 4)], ...(r.roc ? [['AUC', fmt(r.roc.auc, 4)]] : []), ['クラス数', r.classes.length], ['パラメータ数', r.nParams.toLocaleString()]]);
        const cls = r.classes;
        const cm = cls.map(() => cls.map(() => 0));
        Y.forEach((v, i) => cm[cls.indexOf(String(v))][cls.indexOf(String(r.predictions[i]))]++);
        plot('n_pred', [{ type: 'heatmap', z: cm, x: cls.map(c => '予測:' + c), y: cls.map(c => '実際:' + c), colorscale: 'Viridis', text: cm, texttemplate: '%{text}', showscale: false }],
          { title: '混同行列' });
      }
      renderAdvice('n_advice', AD.mlp(r));
      LAST_MLP = r;
      predictPanel('n_predict', xs, {
        hint: '学習したネットワークはページを開いている間ずっと保持されます。条件を入れれば何度でも予測できます。',
        single: async v => {
          const out = (await r.predictRows([v]))[0];
          if (task === 'regression') {
            const err = r.valRmse;
            return bigCard(`${yn} の予測値`, fmt(out.value, 3),
              `検証データでの平均的な誤差は ±${fmt(err, 2)} 程度です。目安として <b>${fmt(out.value - 1.96 * err, 2)} 〜 ${fmt(out.value + 1.96 * err, 2)}</b> の幅で考えてください。`)
              + `<div class="advice"><div class="adv warn"><div class="t"><span class="tag">注意</span>この幅は簡易的な目安</div><div class="b">` +
              `ニューラルネットは回帰と違って理論的な予測区間を持ちません。ここでは検証データの誤差の大きさから幅を当てはめているだけです。厳密な区間が必要なら、重回帰の予測区間を併用してください。` +
              `</div></div><div class="adv warn"><div class="t"><span class="tag">注意</span>外挿に特に弱い</div><div class="b">` +
              `学習データの範囲外の値を入れると、ニューラルネットは回帰以上に予測不能な値を返します。入力が元データの範囲内かを必ず確認してください。` +
              `</div></div></div>`;
          }
          const rows = out.classes.map((c, i) => [td(c), td((out.probs[i] * 100).toFixed(1) + '%'),
            td(`<div style="background:linear-gradient(90deg,var(--v3) ${out.probs[i] * 100}%,transparent ${out.probs[i] * 100}%);height:10px;border-radius:5px"></div>`)]);
          return bigCard('予測されたクラス', out.label, `最も確率が高いクラスです。確率の内訳は下のとおりです。`)
            + tableHTML(['クラス', '確率', ''], rows)
            + `<div class="advice" style="margin-top:12px"><div class="adv key"><div class="t"><span class="tag">結論</span>確率で受け取る</div><div class="b">` +
            `${(Math.max(...out.probs) * 100).toFixed(1)}% という数字は「この予測をどれだけ信じてよいか」です。40% と 95% では、同じ「予測クラス」でも next action が変わります。低いときは追加情報を取りにいくのが正解です。` +
            `</div></div></div>`;
        },
        batch: async rows => {
          const outs = await r.predictRows(rows);
          if (task === 'regression') {
            const body = rows.map((rr, i) => [td(i + 1)].concat(rr.map(v => td(fmt(v, 2))), td(`<b style="color:var(--v5)">${fmt(outs[i].value, 3)}</b>`)));
            return { head: ['#'].concat(xs, ['予測値']), body, csv: csvOf(['#'].concat(xs, ['予測値']), rows.map((rr, i) => [i + 1].concat(rr, [outs[i].value.toFixed(4)]))) };
          }
          const body = rows.map((rr, i) => [td(i + 1)].concat(rr.map(v => td(fmt(v, 2))),
            td(`<b style="color:var(--v5)">${outs[i].label}</b>`), td((Math.max(...outs[i].probs) * 100).toFixed(1) + '%')));
          return {
            head: ['#'].concat(xs, ['予測クラス', '最大確率']), body,
            csv: csvOf(['#'].concat(xs, ['予測クラス'], outs[0].classes.map(c => 'P(' + c + ')')),
              rows.map((rr, i) => [i + 1].concat(rr, [outs[i].label], outs[i].probs.map(p => p.toFixed(5)))))
          };
        }
      });
    } catch (e) {
      $('n_status').textContent = 'エラー'; $('n_status').className = 'pill';
      alert('学習に失敗しました：' + e.message);
    } finally { btn.disabled = false; $('n_bar').style.width = '0'; }
  });

  window.SLUI = {
    plot, clearPlot, go, renderAdvice, statCards, tableHTML, td, pcell, fmt, VIRIDIS, merge, CFG,
    hasData: () => D.n > 0
  };
  go('data');
})();
