/* ============================================================
   STATLAB / models.js
   回帰 / ロジスティック回帰 / 決定木・ランダムフォレスト /
   時系列 / テクニカル指標 / 加法モデル予測 / MLP(TensorFlow.js)
   ============================================================ */
(function (root) {
  'use strict';
  const S = root.SL;
  const { mean, sd, variance, sum, transpose, matMul, inverse, normal, studentt, chisquare, centralF, pFromT, pFromZ } = S;

  /* ================= 重回帰（OLS） ================= */
  function ols(y, Xcols, names, { conf = 0.95, intercept = true } = {}) {
    const n = y.length;
    const X = y.map((_, i) => (intercept ? [1] : []).concat(Xcols.map(c => c[i])));
    const p = X[0].length;
    const labels = (intercept ? ['切片'] : []).concat(names);
    const Xt = transpose(X);
    const XtX = matMul(Xt, X);
    const XtXi = inverse(XtX);
    const b = matMul(XtXi, matMul(Xt, y.map(v => [v]))).map(r => r[0]);
    const fitted = X.map(r => r.reduce((s, v, j) => s + v * b[j], 0));
    const resid = y.map((v, i) => v - fitted[i]);
    const df = n - p;
    const sse = sum(resid.map(r => r * r));
    const ybar = mean(y);
    const sst = sum(y.map(v => (v - ybar) ** 2));
    const ssr = sst - sse;
    const mse = sse / df, se = Math.sqrt(mse);
    const R2 = 1 - sse / sst;
    const adjR2 = 1 - (1 - R2) * (n - 1) / df;
    const dfModel = p - (intercept ? 1 : 0);
    const F = (ssr / dfModel) / mse;
    const tc = studentt.inv(1 - (1 - conf) / 2, df);
    const coefs = b.map((v, j) => {
      const s = Math.sqrt(mse * XtXi[j][j]);
      const t = v / s;
      return {
        name: labels[j], estimate: v, se: s, t, p: pFromT(t, df, 'two-sided'),
        lo: v - tc * s, hi: v + tc * s
      };
    });
    // 標準化偏回帰係数
    const sy = sd(y);
    coefs.forEach((c, j) => {
      if (intercept && j === 0) { c.beta = null; return; }
      const col = Xcols[j - (intercept ? 1 : 0)];
      c.beta = c.estimate * sd(col) / sy;
    });
    // 影響力診断
    const H = matMul(matMul(X, XtXi), Xt);
    const lev = H.map((r, i) => r[i]);
    const stdRes = resid.map((r, i) => r / (se * Math.sqrt(Math.max(1e-12, 1 - lev[i]))));
    const cook = resid.map((r, i) => (stdRes[i] ** 2 / p) * (lev[i] / Math.max(1e-12, 1 - lev[i])));
    let dw = 0; for (let i = 1; i < n; i++) dw += (resid[i] - resid[i - 1]) ** 2; dw /= sse;
    // VIF
    const vif = Xcols.map((c, j) => {
      if (Xcols.length < 2) return 1;
      const others = Xcols.filter((_, k) => k !== j);
      try {
        const Xo = c.map((_, i) => [1, ...others.map(o => o[i])]);
        const bo = matMul(inverse(matMul(transpose(Xo), Xo)), matMul(transpose(Xo), c.map(v => [v]))).map(r => r[0]);
        const fit = Xo.map(r => r.reduce((s2, v, k) => s2 + v * bo[k], 0));
        const cm = mean(c);
        const r2 = 1 - sum(c.map((v, i) => (v - fit[i]) ** 2)) / sum(c.map(v => (v - cm) ** 2));
        return 1 / Math.max(1e-9, 1 - r2);
      } catch (e) { return Infinity; }
    });
    const logLik = -n / 2 * (Math.log(2 * Math.PI) + Math.log(sse / n) + 1);
    return {
      type: '重回帰分析（最小二乗法）', n, p, df, coefs, fitted, resid, stdRes, leverage: lev, cook,
      sse, ssr, sst, mse, se, R2, adjR2, F, pF: 1 - centralF.cdf(F, dfModel, df), dfModel,
      durbinWatson: dw, vif, names, XtXi, intercept, conf,
      aic: -2 * logLik + 2 * (p + 1), bic: -2 * logLik + Math.log(n) * (p + 1), logLik,
      predict(xrow) {
        const r = (intercept ? [1] : []).concat(xrow);
        const yh = r.reduce((s, v, j) => s + v * b[j], 0);
        const q = matMul(matMul([r], XtXi), transpose([r]))[0][0];
        return {
          fit: yh,
          ciLo: yh - tc * Math.sqrt(mse * q), ciHi: yh + tc * Math.sqrt(mse * q),
          piLo: yh - tc * Math.sqrt(mse * (1 + q)), piHi: yh + tc * Math.sqrt(mse * (1 + q))
        };
      }
    };
  }

  /* ================= ロジスティック回帰（IRLS） ================= */
  function logistic(y, Xcols, names, { maxIter = 60, tol = 1e-10, conf = 0.95, l2 = 0 } = {}) {
    const n = y.length;
    const X = y.map((_, i) => [1, ...Xcols.map(c => c[i])]);
    const p = X[0].length, labels = ['切片', ...names];
    let b = new Array(p).fill(0);
    b[0] = Math.log((mean(y) + 1e-6) / (1 - mean(y) + 1e-6));
    let XtWXi = null, iter = 0, sep = false;
    for (iter = 0; iter < maxIter; iter++) {
      const eta = X.map(r => r.reduce((s, v, j) => s + v * b[j], 0));
      const mu = eta.map(e => 1 / (1 + Math.exp(-e)));
      const W = mu.map(m => Math.max(m * (1 - m), 1e-10));
      const XtW = transpose(X).map(row => row.map((v, i) => v * W[i]));
      const XtWX = matMul(XtW, X);
      if (l2 > 0) for (let j = 1; j < p; j++) XtWX[j][j] += l2;
      const z = y.map((yy, i) => eta[i] + (yy - mu[i]) / W[i]);
      let inv;
      try { inv = inverse(XtWX); } catch (e) { sep = true; break; }
      const nb = matMul(inv, matMul(XtW, z.map(v => [v]))).map(r => r[0]);
      const delta = Math.max(...nb.map((v, j) => Math.abs(v - b[j])));
      b = nb; XtWXi = inv;
      if (delta < tol) break;
      if (!isFinite(delta)) { sep = true; break; }
    }
    const eta = X.map(r => r.reduce((s, v, j) => s + v * b[j], 0));
    const prob = eta.map(e => 1 / (1 + Math.exp(-e)));
    const ll = sum(y.map((yy, i) => yy * Math.log(Math.max(prob[i], 1e-12)) + (1 - yy) * Math.log(Math.max(1 - prob[i], 1e-12))));
    const pbar = mean(y);
    const ll0 = sum(y.map(yy => yy * Math.log(pbar) + (1 - yy) * Math.log(1 - pbar)));
    const zc = normal.inv(1 - (1 - conf) / 2);
    const coefs = b.map((v, j) => {
      const s = XtWXi ? Math.sqrt(Math.abs(XtWXi[j][j])) : NaN;
      const z = v / s;
      return {
        name: labels[j], estimate: v, se: s, z, p: pFromZ(z, 'two-sided'),
        or: Math.exp(v), orLo: Math.exp(v - zc * s), orHi: Math.exp(v + zc * s)
      };
    });
    const lr = 2 * (ll - ll0), dfLR = p - 1;
    const cs = 1 - Math.exp(2 * (ll0 - ll) / n);
    return {
      type: 'ロジスティック回帰（二項・ロジットリンク）', n, p, coefs, prob, ll, ll0, iter, separated: sep,
      lrChi2: lr, lrDf: dfLR, lrP: 1 - chisquare.cdf(lr, dfLR),
      mcfadden: 1 - ll / ll0, coxSnell: cs, nagelkerke: cs / (1 - Math.exp(2 * ll0 / n)),
      aic: -2 * ll + 2 * p, bic: -2 * ll + Math.log(n) * p, names,
      predictProb(xrow) { const e = [1, ...xrow].reduce((s, v, j) => s + v * b[j], 0); return 1 / (1 + Math.exp(-e)); },
      // 線形予測子の標準誤差から、予測確率の 95% 信頼区間も返す
      predictCI(xrow) {
        const r = [1, ...xrow];
        const eta = r.reduce((s, v, j) => s + v * b[j], 0);
        let se = NaN;
        try { se = Math.sqrt(Math.max(0, matMul(matMul([r], XtWXi), transpose([r]))[0][0])); } catch (e) { }
        const g = e => 1 / (1 + Math.exp(-e));
        return {
          prob: g(eta), logit: eta, odds: Math.exp(eta),
          lo: isFinite(se) ? g(eta - 1.96 * se) : NaN, hi: isFinite(se) ? g(eta + 1.96 * se) : NaN,
          contrib: r.map((v, j) => ({ name: labels[j], value: v, coef: b[j], term: v * b[j] }))
        };
      }
    };
  }
  function confusion(yTrue, prob, thr = 0.5) {
    let tp = 0, fp = 0, tn = 0, fn = 0;
    yTrue.forEach((y, i) => {
      const pd = prob[i] >= thr ? 1 : 0;
      if (y === 1 && pd === 1) tp++; else if (y === 0 && pd === 1) fp++;
      else if (y === 0 && pd === 0) tn++; else fn++;
    });
    const acc = (tp + tn) / yTrue.length;
    const prec = tp / (tp + fp || 1), rec = tp / (tp + fn || 1), spec = tn / (tn + fp || 1);
    const f1 = 2 * prec * rec / ((prec + rec) || 1);
    const mccDen = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn)) || 1;
    return { tp, fp, tn, fn, accuracy: acc, precision: prec, recall: rec, specificity: spec, f1, threshold: thr, mcc: (tp * tn - fp * fn) / mccDen, balanced: (rec + spec) / 2 };
  }
  function rocCurve(yTrue, prob) {
    const pairs = yTrue.map((y, i) => [prob[i], y]).sort((a, b) => b[0] - a[0]);
    const P = sum(yTrue), N = yTrue.length - P;
    let tp = 0, fp = 0; const fpr = [0], tpr = [0], thr = [1];
    pairs.forEach(([s, y]) => {
      if (y === 1) tp++; else fp++;
      fpr.push(fp / N); tpr.push(tp / P); thr.push(s);
    });
    let auc = 0;
    for (let i = 1; i < fpr.length; i++) auc += (fpr[i] - fpr[i - 1]) * (tpr[i] + tpr[i - 1]) / 2;
    // Youden 指数が最大の閾値
    let best = 0, bi = 0;
    for (let i = 0; i < fpr.length; i++) { const j = tpr[i] - fpr[i]; if (j > best) { best = j; bi = i; } }
    return { fpr, tpr, thr, auc, bestThreshold: thr[bi], youden: best };
  }

  /* ================= 決定木（CART） ================= */
  function buildTree(X, y, opts, depth = 0) {
    const { maxDepth, minSamples, minLeaf, task, featureNames, nFeat } = opts;
    const n = y.length;
    const node = { n, depth };
    if (task === 'classification') {
      const cnt = {}; y.forEach(v => cnt[v] = (cnt[v] || 0) + 1);
      node.counts = cnt;
      node.value = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
      node.impurity = gini(y);
      node.prob = Object.fromEntries(Object.entries(cnt).map(([k, v]) => [k, v / n]));
    } else {
      node.value = mean(y); node.impurity = variance(y, false);
    }
    if (depth >= maxDepth || n < minSamples || node.impurity <= 1e-12) { node.leaf = true; return node; }
    const nf = X[0].length;
    let feats = [...Array(nf).keys()];
    if (nFeat && nFeat < nf) feats = feats.sort(() => Math.random() - 0.5).slice(0, nFeat);
    let best = null;
    feats.forEach(f => {
      const vals = [...new Set(X.map(r => r[f]))].sort((a, b) => a - b);
      for (let i = 0; i < vals.length - 1; i++) {
        const t = (vals[i] + vals[i + 1]) / 2;
        const li = [], ri = [];
        X.forEach((r, k) => (r[f] <= t ? li : ri).push(k));
        if (li.length < minLeaf || ri.length < minLeaf) continue;
        const yl = li.map(k => y[k]), yr = ri.map(k => y[k]);
        const imp = (li.length * impurity(yl, task) + ri.length * impurity(yr, task)) / n;
        const gain = node.impurity - imp;
        if (!best || gain > best.gain) best = { f, t, gain, li, ri };
      }
    });
    if (!best || best.gain <= 1e-12) { node.leaf = true; return node; }
    node.feature = best.f; node.featureName = featureNames[best.f];
    node.threshold = best.t; node.gain = best.gain;
    node.left = buildTree(best.li.map(k => X[k]), best.li.map(k => y[k]), opts, depth + 1);
    node.right = buildTree(best.ri.map(k => X[k]), best.ri.map(k => y[k]), opts, depth + 1);
    return node;
  }
  function gini(y) { const c = {}; y.forEach(v => c[v] = (c[v] || 0) + 1); return 1 - Object.values(c).reduce((s, v) => s + (v / y.length) ** 2, 0); }
  function entropy(y) { const c = {}; y.forEach(v => c[v] = (c[v] || 0) + 1); return -Object.values(c).reduce((s, v) => { const p = v / y.length; return s + p * Math.log2(p); }, 0); }
  function impurity(y, task) { return task === 'classification' ? gini(y) : variance(y, false); }
  function treePredict(node, row) { if (node.leaf) return node.value; return treePredict(row[node.feature] <= node.threshold ? node.left : node.right, row); }
  // 予測に至るまでの分岐をすべて記録して返す（説明用）
  function treePath(node, row) {
    const steps = [];
    let nd = node;
    while (!nd.leaf) {
      const go = row[nd.feature] <= nd.threshold;
      steps.push({ name: nd.featureName, threshold: nd.threshold, value: row[nd.feature], go, n: nd.n });
      nd = go ? nd.left : nd.right;
    }
    return { steps, leaf: nd };
  }
  function treeProb(node, row, cls) { if (node.leaf) return (node.prob && node.prob[cls]) || 0; return treeProb(row[node.feature] <= node.threshold ? node.left : node.right, row, cls); }
  function featureImportance(node, nf, total) {
    const imp = new Array(nf).fill(0);
    (function walk(nd) {
      if (nd.leaf) return;
      imp[nd.feature] += nd.n * nd.gain;
      walk(nd.left); walk(nd.right);
    })(node);
    const s = sum(imp) || 1;
    return imp.map(v => v / s);
  }
  function decisionTree(X, y, featureNames, { maxDepth = 4, minSamples = 5, minLeaf = 2, task = 'classification', testRatio = 0.25, seed = 42 } = {}) {
    const idx = [...Array(y.length).keys()];
    let rnd = seed;
    const rand = () => { rnd = (rnd * 1103515245 + 12345) % 2147483648; return rnd / 2147483648; };
    idx.sort(() => rand() - 0.5);
    const nTest = Math.max(1, Math.floor(y.length * testRatio));
    const te = idx.slice(0, nTest), tr = idx.slice(nTest);
    const opts = { maxDepth, minSamples, minLeaf, task, featureNames };
    const tree = buildTree(tr.map(i => X[i]), tr.map(i => y[i]), opts);
    const full = buildTree(X, y, opts);
    const evalSet = ids => {
      const pred = ids.map(i => treePredict(tree, X[i]));
      if (task === 'classification') return { accuracy: mean(ids.map((i, k) => pred[k] == y[i] ? 1 : 0)) };
      const yy = ids.map(i => y[i]), m = mean(yy);
      const sse = sum(ids.map((i, k) => (y[i] - pred[k]) ** 2));
      return { rmse: Math.sqrt(sse / ids.length), r2: 1 - sse / sum(yy.map(v => (v - m) ** 2)) };
    };
    return {
      type: task === 'classification' ? '決定木（CART・分類）' : '決定木（CART・回帰）',
      tree: full, treeTrain: tree, task, featureNames,
      importance: featureImportance(full, featureNames.length),
      train: evalSet(tr), test: evalSet(te), nTrain: tr.length, nTest: te.length,
      predictAll: X.map(r => treePredict(full, r)),
      depth: maxDepth, classes: task === 'classification' ? [...new Set(y)].map(String) : null
    };
  }
  function randomForest(X, y, featureNames, { nTrees = 100, maxDepth = 6, minLeaf = 1, task = 'classification', seed = 7 } = {}) {
    let rnd = seed;
    const rand = () => { rnd = (rnd * 1103515245 + 12345) % 2147483648; return rnd / 2147483648; };
    const n = y.length, nf = featureNames.length;
    const mtry = task === 'classification' ? Math.max(1, Math.round(Math.sqrt(nf))) : Math.max(1, Math.round(nf / 3));
    const trees = [], impAcc = new Array(nf).fill(0);
    const oobPred = Array.from({ length: n }, () => []);
    for (let t = 0; t < nTrees; t++) {
      const bag = [], inBag = new Set();
      for (let i = 0; i < n; i++) { const k = Math.floor(rand() * n); bag.push(k); inBag.add(k); }
      const tr = buildTree(bag.map(i => X[i]), bag.map(i => y[i]), { maxDepth, minSamples: 2, minLeaf, task, featureNames, nFeat: mtry });
      trees.push(tr);
      featureImportance(tr, nf).forEach((v, j) => impAcc[j] += v / nTrees);
      for (let i = 0; i < n; i++) if (!inBag.has(i)) oobPred[i].push(treePredict(tr, X[i]));
    }
    let oob = null;
    const used = oobPred.map((p, i) => p.length ? i : -1).filter(i => i >= 0);
    if (used.length) {
      if (task === 'classification') {
        oob = { accuracy: mean(used.map(i => { const c = {}; oobPred[i].forEach(v => c[v] = (c[v] || 0) + 1); const m = Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; return m == y[i] ? 1 : 0; })) };
      } else {
        const yy = used.map(i => y[i]), mm = mean(yy);
        const sse = sum(used.map(i => (y[i] - mean(oobPred[i])) ** 2));
        oob = { rmse: Math.sqrt(sse / used.length), r2: 1 - sse / sum(yy.map(v => (v - mm) ** 2)) };
      }
    }
    return { type: 'ランダムフォレスト', nTrees, mtry, importance: impAcc, oob, task, featureNames };
  }

  /* ================= 時系列 ================= */
  function acf(x, lagMax) {
    const n = x.length, m = mean(x);
    const c0 = sum(x.map(v => (v - m) ** 2)) / n;
    const out = [];
    for (let k = 0; k <= lagMax; k++) {
      let c = 0; for (let i = k; i < n; i++) c += (x[i] - m) * (x[i - k] - m);
      out.push((c / n) / c0);
    }
    return out;
  }
  function pacf(x, lagMax) { // Durbin–Levinson
    const r = acf(x, lagMax);
    const phi = [[]]; const out = [1];
    let prev = [];
    for (let k = 1; k <= lagMax; k++) {
      let numr = r[k];
      for (let j = 1; j < k; j++) numr -= prev[j - 1] * r[k - j];
      let den = 1;
      for (let j = 1; j < k; j++) den -= prev[j - 1] * r[j];
      const pk = numr / den;
      const cur = [];
      for (let j = 1; j < k; j++) cur.push(prev[j - 1] - pk * prev[k - j - 1]);
      cur.push(pk);
      prev = cur; out.push(pk);
    }
    return out;
  }
  function ljungBox(x, lags = 10, dfAdj = 0) {
    const n = x.length, r = acf(x, lags);
    let Q = 0; for (let k = 1; k <= lags; k++) Q += r[k] ** 2 / (n - k);
    Q *= n * (n + 2);
    const df = Math.max(1, lags - dfAdj);
    return { test: 'Ljung–Box 検定（残差の自己相関）', Q, df, p: 1 - chisquare.cdf(Q, df), lags };
  }
  function diff(x, d = 1, lag = 1) {
    let y = x.slice();
    for (let i = 0; i < d; i++) { const z = []; for (let j = lag; j < y.length; j++) z.push(y[j] - y[j - lag]); y = z; }
    return y;
  }
  function movingAverage(x, w) {
    const out = [];
    for (let i = 0; i < x.length; i++) {
      if (i < w - 1) { out.push(null); continue; }
      out.push(mean(x.slice(i - w + 1, i + 1)));
    }
    return out;
  }
  function centeredMA(x, period) {
    const out = new Array(x.length).fill(null);
    const half = Math.floor(period / 2);
    for (let i = half; i < x.length - half; i++) {
      if (period % 2 === 0) {
        let s = 0.5 * x[i - half] + 0.5 * x[i + half];
        for (let j = i - half + 1; j <= i + half - 1; j++) s += x[j];
        out[i] = s / period;
      } else { out[i] = mean(x.slice(i - half, i + half + 1)); }
    }
    return out;
  }
  function decompose(x, period, model = 'additive') {
    const trend = centeredMA(x, period);
    const detr = x.map((v, i) => trend[i] === null ? null : (model === 'additive' ? v - trend[i] : v / trend[i]));
    const seasonAvg = new Array(period).fill(0).map(() => []);
    detr.forEach((v, i) => { if (v !== null && isFinite(v)) seasonAvg[i % period].push(v); });
    let seas = seasonAvg.map(a => a.length ? mean(a) : (model === 'additive' ? 0 : 1));
    const adj = model === 'additive' ? mean(seas) : Math.pow(seas.reduce((a, b) => a * b, 1), 1 / period);
    seas = seas.map(v => model === 'additive' ? v - adj : v / adj);
    const seasonal = x.map((_, i) => seas[i % period]);
    const resid = x.map((v, i) => trend[i] === null ? null : (model === 'additive' ? v - trend[i] - seasonal[i] : v / (trend[i] * seasonal[i])));
    const varT = variance(x.filter((_, i) => trend[i] !== null));
    const rr = resid.filter(v => v !== null);
    return {
      type: `古典的季節分解（${model === 'additive' ? '加法' : '乗法'}モデル・周期 ${period}）`,
      trend, seasonal, resid, seasonIndex: seas, model, period,
      strengthTrend: Math.max(0, 1 - variance(rr) / Math.max(1e-12, varT)),
      strengthSeasonal: Math.max(0, 1 - variance(rr) / Math.max(1e-12, variance(detr.filter(v => v !== null))))
    };
  }
  function holtWinters(x, { period = 12, seasonal = 'additive', horizon = 12, alpha, beta, gamma } = {}) {
    const useSeason = period > 1 && x.length >= 2 * period;
    function run(a, b, g) {
      let level, trend, seas = [];
      if (useSeason) {
        const s1 = mean(x.slice(0, period)), s2 = mean(x.slice(period, 2 * period));
        level = s1; trend = (s2 - s1) / period;
        for (let i = 0; i < period; i++) seas.push(seasonal === 'additive' ? x[i] - s1 : x[i] / s1);
      } else { level = x[0]; trend = x.length > 1 ? x[1] - x[0] : 0; }
      const fit = []; let sse = 0;
      for (let i = 0; i < x.length; i++) {
        const sIdx = i % period;
        const sv = useSeason ? seas[sIdx] : (seasonal === 'additive' ? 0 : 1);
        const f = seasonal === 'additive' || !useSeason ? level + trend + (useSeason ? sv : 0) : (level + trend) * sv;
        fit.push(f); sse += (x[i] - f) ** 2;
        const prevL = level;
        if (useSeason && seasonal === 'multiplicative') level = a * (x[i] / (sv || 1e-9)) + (1 - a) * (level + trend);
        else level = a * (x[i] - (useSeason ? sv : 0)) + (1 - a) * (level + trend);
        trend = b * (level - prevL) + (1 - b) * trend;
        if (useSeason) {
          seas[sIdx] = seasonal === 'multiplicative'
            ? g * (x[i] / (level || 1e-9)) + (1 - g) * sv
            : g * (x[i] - level) + (1 - g) * sv;
        }
      }
      return { sse, level, trend, seas, fit };
    }
    let best = null;
    const grid = (alpha !== undefined) ? [[alpha, beta ?? 0.1, gamma ?? 0.1]] : (() => {
      const g = [];
      for (let a = 0.1; a <= 0.95; a += 0.15) for (let b = 0.02; b <= 0.5; b += 0.12) for (let c = 0.05; c <= 0.6; c += 0.15) g.push([a, b, useSeason ? c : 0]);
      return g;
    })();
    grid.forEach(([a, b, g]) => { const r = run(a, b, g); if (!best || r.sse < best.sse) best = { ...r, a, b, g }; });
    const fc = []; const n = x.length;
    for (let h = 1; h <= horizon; h++) {
      const sv = useSeason ? best.seas[(n + h - 1) % period] : (seasonal === 'additive' ? 0 : 1);
      fc.push(seasonal === 'multiplicative' && useSeason ? (best.level + h * best.trend) * sv : best.level + h * best.trend + (useSeason ? sv : 0));
    }
    const resid = x.map((v, i) => v - best.fit[i]);
    const s = Math.sqrt(sum(resid.map(r => r * r)) / (n - 2));
    const z = normal.inv(0.975);
    return {
      type: useSeason ? `Holt–Winters 指数平滑（${seasonal === 'additive' ? '加法' : '乗法'}季節）` : 'Holt 線形トレンド指数平滑',
      alpha: best.a, beta: best.b, gamma: best.g, fitted: best.fit, forecast: fc,
      lo: fc.map((v, h) => v - z * s * Math.sqrt(1 + h * 0.12)), hi: fc.map((v, h) => v + z * s * Math.sqrt(1 + h * 0.12)),
      resid, sse: best.sse, rmse: Math.sqrt(best.sse / n),
      mape: mean(x.map((v, i) => Math.abs((v - best.fit[i]) / (v || 1e-9)))) * 100, seasonal, period, useSeason
    };
  }
  function arFit(x, p) {
    const y = x.slice(p);
    const cols = [];
    for (let k = 1; k <= p; k++) cols.push(x.slice(p - k, x.length - k));
    const m = ols(y, cols, cols.map((_, i) => `lag${i + 1}`));
    return m;
  }
  function adfTest(x, lags) {
    const n = x.length;
    if (lags === undefined) lags = Math.floor(Math.pow(n - 1, 1 / 3));
    const dx = diff(x);
    const start = lags + 1;
    const y = [], xl = [], trendCol = [], lagCols = Array.from({ length: lags }, () => []);
    for (let i = start; i < dx.length + 1; i++) {
      y.push(dx[i - 1]); xl.push(x[i - 1]); trendCol.push(i);
      for (let k = 1; k <= lags; k++) lagCols[k - 1].push(dx[i - 1 - k]);
    }
    const cols = [xl, ...lagCols];
    const m = ols(y, cols, ['lag1', ...lagCols.map((_, i) => `d.lag${i + 1}`)]);
    const c = m.coefs[1];
    const crit = { '1%': -3.43, '5%': -2.86, '10%': -2.57 };
    return {
      test: '拡張ディッキー–フラー検定（定数項あり）', statistic: c.t, lags, n: y.length,
      critical: crit, stationary: c.t < crit['5%'],
      note: '臨界値は大標本近似（MacKinnon）。p 値は算出せず臨界値と比較します。'
    };
  }

  /* ========== 加法モデル予測（Prophet 風・自作実装） ========== */
  function additiveForecast(t, y, { horizon = 30, nChangepoints = 12, fourierOrders = [], regLambda = 0.5 } = {}) {
    const n = y.length;
    const tn = t.map(v => (v - t[0]) / (t[n - 1] - t[0] || 1)); // 0..1
    const cps = [];
    for (let i = 1; i <= nChangepoints; i++) cps.push(0.8 * i / (nChangepoints + 1));
    const build = (tt, absT) => {
      const row = [1, tt];
      cps.forEach(c => row.push(Math.max(0, tt - c)));
      fourierOrders.forEach(({ period, order }) => {
        for (let k = 1; k <= order; k++) {
          row.push(Math.sin(2 * Math.PI * k * absT / period));
          row.push(Math.cos(2 * Math.PI * k * absT / period));
        }
      });
      return row;
    };
    const X = tn.map((v, i) => build(v, t[i]));
    const p = X[0].length;
    // リッジ回帰（切片とトレンドは弱く、変化点と季節性は強めに正則化）
    const Xt = transpose(X), XtX = matMul(Xt, X);
    for (let j = 2; j < p; j++) XtX[j][j] += regLambda * n / 100;
    const b = matMul(inverse(XtX), matMul(Xt, y.map(v => [v]))).map(r => r[0]);
    const dot = r => r.reduce((s, v, j) => s + v * b[j], 0);
    const fitted = X.map(dot);
    const resid = y.map((v, i) => v - fitted[i]);
    const s = Math.sqrt(sum(resid.map(r => r * r)) / Math.max(1, n - p));
    const step = (t[n - 1] - t[0]) / (n - 1 || 1);
    const ft = [], fy = [], lo = [], hi = [];
    for (let h = 1; h <= horizon; h++) {
      const abs = t[n - 1] + h * step;
      const tt = (abs - t[0]) / (t[n - 1] - t[0] || 1);
      const v = dot(build(tt, abs));
      ft.push(abs); fy.push(v);
      const w = s * Math.sqrt(1 + h / n * 3);
      lo.push(v - 1.96 * w); hi.push(v + 1.96 * w);
    }
    // 成分分解
    const trendOnly = X.map(r => { const rr = r.slice(); for (let j = 2 + cps.length; j < p; j++) rr[j] = 0; return dot(rr); });
    const seasonOnly = fitted.map((v, i) => v - trendOnly[i]);
    const ybar = mean(y);
    return {
      type: '加法モデル予測（区分線形トレンド＋フーリエ季節項／Prophet の考え方を自前実装）',
      fitted, resid, forecastT: ft, forecast: fy, lo, hi, trend: trendOnly, seasonality: seasonOnly,
      changepoints: cps.map(c => t[0] + c * (t[n - 1] - t[0])),
      sigma: s, r2: 1 - sum(resid.map(r => r * r)) / sum(y.map(v => (v - ybar) ** 2)),
      rmse: Math.sqrt(mean(resid.map(r => r * r))),
      mape: mean(y.map((v, i) => Math.abs((v - fitted[i]) / (v || 1e-9)))) * 100
    };
  }

  /* ================= 株価・テクニカル ================= */
  function ema(x, w) {
    const k = 2 / (w + 1), out = [x[0]];
    for (let i = 1; i < x.length; i++) out.push(x[i] * k + out[i - 1] * (1 - k));
    return out;
  }
  function rsi(close, w = 14) {
    const out = new Array(close.length).fill(null);
    let ag = 0, al = 0;
    for (let i = 1; i <= w; i++) { const d = close[i] - close[i - 1]; if (d > 0) ag += d; else al -= d; }
    ag /= w; al /= w;
    out[w] = 100 - 100 / (1 + ag / (al || 1e-9));
    for (let i = w + 1; i < close.length; i++) {
      const d = close[i] - close[i - 1];
      ag = (ag * (w - 1) + Math.max(d, 0)) / w;
      al = (al * (w - 1) + Math.max(-d, 0)) / w;
      out[i] = 100 - 100 / (1 + ag / (al || 1e-9));
    }
    return out;
  }
  function macd(close, f = 12, s = 26, sig = 9) {
    const ef = ema(close, f), es = ema(close, s);
    const line = close.map((_, i) => ef[i] - es[i]);
    const signal = ema(line, sig);
    return { line, signal, hist: line.map((v, i) => v - signal[i]) };
  }
  function bollinger(close, w = 20, k = 2) {
    const mid = [], up = [], dn = [];
    for (let i = 0; i < close.length; i++) {
      if (i < w - 1) { mid.push(null); up.push(null); dn.push(null); continue; }
      const seg = close.slice(i - w + 1, i + 1), m = mean(seg), s = sd(seg);
      mid.push(m); up.push(m + k * s); dn.push(m - k * s);
    }
    return { mid, up, dn, width: mid.map((m, i) => m === null ? null : (up[i] - dn[i]) / m) };
  }
  function priceAnalytics(close, { periodsPerYear = 252, rf = 0 } = {}) {
    const ret = [], lret = [];
    for (let i = 1; i < close.length; i++) { ret.push(close[i] / close[i - 1] - 1); lret.push(Math.log(close[i] / close[i - 1])); }
    const mu = mean(ret), s = sd(ret);
    let peak = close[0], maxDD = 0; const dd = [];
    close.forEach(v => { peak = Math.max(peak, v); const d = v / peak - 1; dd.push(d); maxDD = Math.min(maxDD, d); });
    const sorted = ret.slice().sort((a, b) => a - b);
    const q = a => sorted[Math.max(0, Math.floor(a * sorted.length))];
    const var95 = q(0.05), var99 = q(0.01);
    const cvar95 = mean(sorted.slice(0, Math.max(1, Math.floor(0.05 * sorted.length))));
    const down = ret.filter(v => v < 0);
    const sortino = (mu - rf / periodsPerYear) / (sd(down.length ? down : [0, 0]) || 1e-9) * Math.sqrt(periodsPerYear);
    return {
      n: close.length, returns: ret, logReturns: lret, drawdown: dd,
      meanReturn: mu, dailySd: s, annReturn: mu * periodsPerYear,
      cagr: Math.pow(close[close.length - 1] / close[0], periodsPerYear / (close.length - 1)) - 1,
      annVol: s * Math.sqrt(periodsPerYear),
      sharpe: (mu * periodsPerYear - rf) / (s * Math.sqrt(periodsPerYear) || 1e-9), sortino,
      maxDrawdown: maxDD, var95, var99, cvar95,
      var95Param: normal.inv(0.05, mu, s), skew: S.skewness(ret), kurt: S.kurtosis(ret),
      jb: S.jarqueBera(ret), calmar: (mu * periodsPerYear) / Math.abs(maxDD || 1e-9)
    };
  }

  /* ================= MLP（TensorFlow.js） ================= */
  async function trainMLP(Xraw, yraw, cfg, onEpoch) {
    if (typeof tf === 'undefined') throw new Error('TensorFlow.js が読み込まれていません。');
    const { hidden = [16, 8], activation = 'relu', epochs = 120, lr = 0.01, batchSize = 16,
      task = 'regression', valRatio = 0.2, dropout = 0, l2 = 0, optimizer = 'adam', seed = 42 } = cfg;
    // 標準化
    const nf = Xraw[0].length;
    const mu = [], sg = [];
    for (let j = 0; j < nf; j++) { const c = Xraw.map(r => r[j]); mu.push(mean(c)); sg.push(sd(c) || 1); }
    const Xs = Xraw.map(r => r.map((v, j) => (v - mu[j]) / sg[j]));
    let yMu = 0, ySd = 1, classes = null, yEnc = yraw;
    if (task === 'regression') { yMu = mean(yraw); ySd = sd(yraw) || 1; yEnc = yraw.map(v => (v - yMu) / ySd); }
    else { classes = [...new Set(yraw)].map(String).sort(); yEnc = yraw.map(v => classes.indexOf(String(v))); }
    // シャッフル + 分割
    const idx = [...Array(Xs.length).keys()];
    let rnd = seed; const rand = () => { rnd = (rnd * 1103515245 + 12345) % 2147483648; return rnd / 2147483648; };
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const nVal = Math.max(1, Math.floor(idx.length * valRatio));
    const vi = idx.slice(0, nVal), ti = idx.slice(nVal);
    const nCls = classes ? classes.length : 1;
    const model = tf.sequential();
    hidden.forEach((h, i) => model.add(tf.layers.dense({
      units: h, activation, inputShape: i === 0 ? [nf] : undefined,
      kernelRegularizer: l2 > 0 ? tf.regularizers.l2({ l2 }) : undefined
    })));
    if (dropout > 0) model.add(tf.layers.dropout({ rate: dropout }));
    if (task === 'regression') model.add(tf.layers.dense({ units: 1 }));
    else if (nCls === 2) model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
    else model.add(tf.layers.dense({ units: nCls, activation: 'softmax' }));
    const opt = optimizer === 'sgd' ? tf.train.sgd(lr) : optimizer === 'rmsprop' ? tf.train.rmsprop(lr) : tf.train.adam(lr);
    const loss = task === 'regression' ? 'meanSquaredError' : (nCls === 2 ? 'binaryCrossentropy' : 'categoricalCrossentropy');
    model.compile({ optimizer: opt, loss, metrics: task === 'regression' ? ['mse'] : ['accuracy'] });
    const mk = ids => {
      const xs = tf.tensor2d(ids.map(i => Xs[i]));
      let ys;
      if (task === 'regression' || nCls === 2) ys = tf.tensor2d(ids.map(i => [yEnc[i]]));
      else ys = tf.oneHot(tf.tensor1d(ids.map(i => yEnc[i]), 'int32'), nCls);
      return [xs, ys];
    };
    const [xtr, ytr] = mk(ti), [xva, yva] = mk(vi);
    const hist = { loss: [], val_loss: [], acc: [], val_acc: [] };
    await model.fit(xtr, ytr, {
      epochs, batchSize, validationData: [xva, yva], shuffle: true, verbose: 0,
      callbacks: {
        onEpochEnd: async (e, logs) => {
          hist.loss.push(logs.loss); hist.val_loss.push(logs.val_loss);
          hist.acc.push(logs.acc ?? logs.accuracy ?? null);
          hist.val_acc.push(logs.val_acc ?? logs.val_accuracy ?? null);
          if (onEpoch && (e % 2 === 0 || e === epochs - 1)) { onEpoch(e + 1, epochs, hist); await tf.nextFrame(); }
        }
      }
    });
    const predT = model.predict(tf.tensor2d(Xs));
    const pred = await predT.array();
    predT.dispose(); xtr.dispose(); ytr.dispose(); xva.dispose(); yva.dispose();
    let out;
    if (task === 'regression') {
      const yh = pred.map(r => r[0] * ySd + yMu);
      const ym = mean(yraw);
      const sse = sum(yraw.map((v, i) => (v - yh[i]) ** 2));
      out = { predictions: yh, rmse: Math.sqrt(sse / yraw.length), r2: 1 - sse / sum(yraw.map(v => (v - ym) ** 2)), mae: mean(yraw.map((v, i) => Math.abs(v - yh[i]))) };
      const sseV = sum(vi.map(i => (yraw[i] - yh[i]) ** 2));
      out.valRmse = Math.sqrt(sseV / vi.length);
    } else {
      const lab = pred.map(r => nCls === 2 ? (r[0] >= 0.5 ? 1 : 0) : r.indexOf(Math.max(...r)));
      out = {
        predictions: lab.map(i => classes[i]), probs: pred, classes,
        accuracy: mean(yEnc.map((v, i) => v === lab[i] ? 1 : 0)),
        valAccuracy: mean(vi.map(i => yEnc[i] === lab[i] ? 1 : 0)),
        trainAccuracy: mean(ti.map(i => yEnc[i] === lab[i] ? 1 : 0))
      };
      if (nCls === 2) out.roc = rocCurve(yEnc, pred.map(r => r[0]));
    }
    const nParams = model.countParams();
    // モデルは破棄せず保持し、新しいデータの予測に使えるようにする
    const predictRows = async rows => {
      const xs = tf.tensor2d(rows.map(r => r.map((v, j) => (v - mu[j]) / sg[j])));
      const t = model.predict(xs);
      const arr = await t.array();
      xs.dispose(); t.dispose();
      if (task === 'regression') return arr.map(r => ({ value: r[0] * ySd + yMu }));
      return arr.map(r => {
        if (nCls === 2) { const p = r[0]; return { probs: [1 - p, p], label: classes[p >= .5 ? 1 : 0], classes }; }
        const k = r.indexOf(Math.max(...r));
        return { probs: r, label: classes[k], classes };
      });
    };
    return {
      type: '多層パーセプトロン（MLP）', history: hist, nParams, task, valIdx: vi, trainIdx: ti,
      arch: [nf, ...hidden, nCls], predictRows, dispose: () => { try { model.dispose(); } catch (e) { } },
      featureMean: mu, featureSd: sg, ...out
    };
  }


  /* ================= ポアソン回帰（対数リンク・IRLS） ================= */
  function poissonReg(y, Xcols, names, { maxIter = 60, tol = 1e-10, conf = 0.95, offset = null } = {}) {
    const n = y.length;
    const X = y.map((_, i) => [1, ...Xcols.map(c => c[i])]);
    const p = X[0].length, labels = ['切片', ...names];
    const off = offset || new Array(n).fill(0);
    let b = new Array(p).fill(0);
    b[0] = Math.log(Math.max(mean(y), 1e-6));
    let XtWXi = null, iter = 0;
    for (iter = 0; iter < maxIter; iter++) {
      const eta = X.map((r, i) => r.reduce((s, v, j) => s + v * b[j], 0) + off[i]);
      const mu = eta.map(e => Math.exp(Math.min(e, 700)));
      const W = mu.map(m => Math.max(m, 1e-10));
      const XtW = transpose(X).map(row => row.map((v, i) => v * W[i]));
      const XtWX = matMul(XtW, X);
      const z = y.map((yy, i) => eta[i] - off[i] + (yy - mu[i]) / W[i]);
      let inv; try { inv = inverse(XtWX); } catch (e) { break; }
      const nb = matMul(inv, matMul(XtW, z.map(v => [v]))).map(r => r[0]);
      const delta = Math.max(...nb.map((v, j) => Math.abs(v - b[j])));
      b = nb; XtWXi = inv;
      if (delta < tol || !isFinite(delta)) break;
    }
    const eta = X.map((r, i) => r.reduce((s, v, j) => s + v * b[j], 0) + off[i]);
    const mu = eta.map(e => Math.exp(Math.min(e, 700)));
    const ll = sum(y.map((yy, i) => yy * Math.log(Math.max(mu[i], 1e-300)) - mu[i] - S.lgamma(yy + 1)));
    const muNull = mean(y);
    const llNull = sum(y.map(yy => yy * Math.log(muNull) - muNull - S.lgamma(yy + 1)));
    const dev = 2 * sum(y.map((yy, i) => (yy > 0 ? yy * Math.log(yy / mu[i]) : 0) - (yy - mu[i])));
    const devNull = 2 * sum(y.map(yy => (yy > 0 ? yy * Math.log(yy / muNull) : 0) - (yy - muNull)));
    const pearson = sum(y.map((yy, i) => (yy - mu[i]) ** 2 / mu[i]));
    const dfRes = n - p;
    const zc = normal.inv(1 - (1 - conf) / 2);
    const coefs = b.map((v, j) => {
      const se = XtWXi ? Math.sqrt(Math.abs(XtWXi[j][j])) : NaN;
      const z = v / se;
      return {
        name: labels[j], estimate: v, se, z, p: pFromZ(z, 'two-sided'),
        irr: Math.exp(v), irrLo: Math.exp(v - zc * se), irrHi: Math.exp(v + zc * se)
      };
    });
    return {
      type: 'ポアソン回帰（一般化線形モデル・対数リンク）', n, p, coefs, fitted: mu,
      resid: y.map((yy, i) => yy - mu[i]),
      devResid: y.map((yy, i) => Math.sign(yy - mu[i]) * Math.sqrt(Math.max(0, 2 * ((yy > 0 ? yy * Math.log(yy / mu[i]) : 0) - (yy - mu[i]))))),
      ll, deviance: dev, nullDeviance: devNull, dfRes, dfNull: n - 1,
      pearsonChi2: pearson, dispersion: pearson / dfRes,
      lrChi2: 2 * (ll - llNull), lrDf: p - 1, lrP: 1 - chisquare.cdf(2 * (ll - llNull), p - 1),
      mcfadden: 1 - ll / llNull, aic: -2 * ll + 2 * p, bic: -2 * ll + Math.log(n) * p,
      iter, names,
      meanY: mean(y), varY: variance(y),
      predict(xrow) {
        const r = [1, ...xrow];
        const eta = r.reduce((s, v, j) => s + v * b[j], 0);
        let se = NaN;
        try { se = Math.sqrt(Math.max(0, matMul(matMul([r], XtWXi), transpose([r]))[0][0])); } catch (e) { }
        return { fit: Math.exp(eta), lo: Math.exp(eta - 1.96 * se), hi: Math.exp(eta + 1.96 * se) };
      }
    };
  }

  /* ================= 並べ替え重要度・部分依存 ================= */
  function permutationImportance(predict, X, y, { task = 'classification', repeats = 10, seed = 3 } = {}) {
    let rnd = seed;
    const rand = () => { rnd = (rnd * 1103515245 + 12345) % 2147483648; return rnd / 2147483648; };
    const score = rows => {
      const pr = rows.map(predict);
      if (task === 'classification') return mean(y.map((v, i) => String(v) === String(pr[i]) ? 1 : 0));
      const m = mean(y);
      return 1 - sum(y.map((v, i) => (v - pr[i]) ** 2)) / sum(y.map(v => (v - m) ** 2));
    };
    const base = score(X);
    const nf = X[0].length;
    const out = [];
    for (let f = 0; f < nf; f++) {
      const drops = [];
      for (let r = 0; r < repeats; r++) {
        const col = X.map(row => row[f]);
        for (let i = col.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [col[i], col[j]] = [col[j], col[i]]; }
        const Xp = X.map((row, i) => { const c = row.slice(); c[f] = col[i]; return c; });
        drops.push(base - score(Xp));
      }
      out.push({ mean: mean(drops), sd: sd(drops) });
    }
    return { baseScore: base, importance: out, task, repeats };
  }
  function partialDependence(predict, X, featureIdx, { grid = 24, classIndex = null } = {}) {
    const col = X.map(r => r[featureIdx]);
    const lo = Math.min(...col), hi = Math.max(...col);
    const xs = [], ys = [];
    for (let g = 0; g < grid; g++) {
      const v = lo + (hi - lo) * g / (grid - 1);
      const preds = X.map(r => { const c = r.slice(); c[featureIdx] = v; return predict(c); });
      xs.push(v);
      ys.push(classIndex === null ? mean(preds.map(Number)) : mean(preds.map(p => String(p) === classIndex ? 1 : 0)));
    }
    return { x: xs, y: ys };
  }

  /* ================= 主成分分析（おまけ） ================= */
  function pca(cols, names) {
    const n = cols[0].length, k = cols.length;
    const Z = cols.map(c => { const m = mean(c), s = sd(c) || 1; return c.map(v => (v - m) / s); });
    const C = [];
    for (let i = 0; i < k; i++) { C.push([]); for (let j = 0; j < k; j++) C[i][j] = sum(Z[i].map((v, t) => v * Z[j][t])) / (n - 1); }
    // ヤコビ法で固有値分解
    let A = C.map(r => r.slice());
    let V = C.map((_, i) => C.map((_, j) => i === j ? 1 : 0));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0;
      for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) off += A[i][j] ** 2;
      if (off < 1e-14) break;
      for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) {
        if (Math.abs(A[i][j]) < 1e-15) continue;
        const th = (A[j][j] - A[i][i]) / (2 * A[i][j]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let m = 0; m < k; m++) {
          const aim = A[i][m], ajm = A[j][m];
          A[i][m] = c * aim - s * ajm; A[j][m] = s * aim + c * ajm;
        }
        for (let m = 0; m < k; m++) {
          const ami = A[m][i], amj = A[m][j];
          A[m][i] = c * ami - s * amj; A[m][j] = s * ami + c * amj;
          const vmi = V[m][i], vmj = V[m][j];
          V[m][i] = c * vmi - s * vmj; V[m][j] = s * vmi + c * vmj;
        }
      }
    }
    const eig = A.map((r, i) => ({ value: r[i], vec: V.map(row => row[i]) })).sort((a, b) => b.value - a.value);
    const tot = sum(eig.map(e => Math.max(0, e.value)));
    const scores = [];
    for (let i = 0; i < n; i++) scores.push(eig.map(e => sum(e.vec.map((v, j) => v * Z[j][i]))));
    return {
      type: '主成分分析（相関行列ベース）', names,
      eigenvalues: eig.map(e => e.value), explained: eig.map(e => e.value / tot),
      cumulative: eig.reduce((a, e) => { a.push((a.length ? a[a.length - 1] : 0) + e.value / tot); return a; }, []),
      loadings: eig.map(e => e.vec.map(v => v * Math.sqrt(Math.max(0, e.value)))), scores
    };
  }

  root.SL = Object.assign(root.SL, {
    ols, logistic, poissonReg, confusion, rocCurve, decisionTree, randomForest, treePredict, treePath,
    permutationImportance, partialDependence,
    acf, pacf, ljungBox, diff, movingAverage, centeredMA, decompose, holtWinters, arFit, adfTest,
    additiveForecast, ema, rsi, macd, bollinger, priceAnalytics, trainMLP, pca
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.SL;
})(typeof window !== 'undefined' ? window : globalThis);
