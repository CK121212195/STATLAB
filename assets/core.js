/* ============================================================
   STATLAB / core.js
   特殊関数・確率分布・記述統計・仮説検定
   依存ライブラリなし（自己完結）。数値は倍精度。
   ============================================================ */
(function (root) {
  'use strict';

  /* ---------- 特殊関数 ---------- */
  const LG_C = [676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7];

  function lgamma(z) {
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
    z -= 1;
    let x = 0.99999999999980993;
    for (let i = 0; i < 8; i++) x += LG_C[i] / (z + i + 1);
    const t = z + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }
  function lbeta(a, b) { return lgamma(a) + lgamma(b) - lgamma(a + b); }
  function factorialLn(n) { return lgamma(n + 1); }
  function combLn(n, k) { return factorialLn(n) - factorialLn(k) - factorialLn(n - k); }

  // 正則化下側不完全ガンマ関数 P(a,x)
  function gammaP(a, x) {
    if (x < 0 || a <= 0) return NaN;
    if (x === 0) return 0;
    if (x < a + 1) {
      let ap = a, sum = 1 / a, del = sum;
      for (let n = 1; n < 500; n++) {
        ap++; del *= x / ap; sum += del;
        if (Math.abs(del) < Math.abs(sum) * 1e-15) break;
      }
      return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
    }
    // 連分数（上側）
    const FPMIN = 1e-300;
    let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
    for (let i = 1; i < 500; i++) {
      const an = -i * (i - a);
      b += 2; d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; const del = d * c; h *= del;
      if (Math.abs(del - 1) < 1e-15) break;
    }
    return 1 - Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
  }

  // 正則化不完全ベータ関数 I_x(a,b)
  function betaI(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * betacf(x, a, b) / a;
    return 1 - bt * betacf(1 - x, b, a) / b;
  }
  function betacf(x, a, b) {
    const FPMIN = 1e-300, qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d; let h = d;
    for (let m = 1; m <= 300; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; const del = d * c; h *= del;
      if (Math.abs(del - 1) < 1e-15) break;
    }
    return h;
  }
  function erf(x) { return x < 0 ? -gammaP(0.5, x * x) : gammaP(0.5, x * x); }
  function erfc(x) { return 1 - erf(x); }

  /* ---------- 確率分布 ---------- */
  const SQRT2PI = Math.sqrt(2 * Math.PI);

  const normal = {
    pdf: (x, m = 0, s = 1) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * SQRT2PI),
    cdf: (x, m = 0, s = 1) => 0.5 * erfc(-(x - m) / (s * Math.SQRT2)),
    inv: function (p, m = 0, s = 1) {
      if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
      // Acklam の有理近似 + Halley 法で 1 回補正
      const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
        1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
      const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
        6.680131188771972e+01, -1.328068155288572e+01];
      const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
        -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
      const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
        3.754408661907416e+00];
      const pl = 0.02425; let q, r, x;
      if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
      else if (p <= 1 - pl) { q = p - 0.5; r = q * q; x = (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1); }
      else { q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
      const e = 0.5 * erfc(-x / Math.SQRT2) - p, u = e * SQRT2PI * Math.exp(x * x / 2);
      x = x - u / (1 + x * u / 2);
      return m + s * x;
    }
  };

  const studentt = {
    pdf: (x, v) => Math.exp(lgamma((v + 1) / 2) - lgamma(v / 2)) / Math.sqrt(v * Math.PI) * (1 + x * x / v) ** (-(v + 1) / 2),
    cdf: (x, v) => {
      const p = 0.5 * betaI(v / (v + x * x), v / 2, 0.5);
      return x > 0 ? 1 - p : p;
    },
    inv: (p, v) => invByBisect(q => studentt.cdf(q, v), p, -1e4, 1e4)
  };

  const chisquare = {
    pdf: (x, k) => x <= 0 ? 0 : Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - lgamma(k / 2) - (k / 2) * Math.LN2),
    cdf: (x, k) => x <= 0 ? 0 : gammaP(k / 2, x / 2),
    inv: (p, k) => invByBisect(q => chisquare.cdf(q, k), p, 0, 1e7)
  };

  const centralF = {
    pdf: (x, d1, d2) => {
      if (x <= 0) return 0;
      const lg = (d1 / 2) * Math.log(d1 / d2) + (d1 / 2 - 1) * Math.log(x)
        - ((d1 + d2) / 2) * Math.log(1 + d1 * x / d2) - lbeta(d1 / 2, d2 / 2);
      return Math.exp(lg);
    },
    cdf: (x, d1, d2) => x <= 0 ? 0 : betaI(d1 * x / (d1 * x + d2), d1 / 2, d2 / 2),
    inv: (p, d1, d2) => invByBisect(q => centralF.cdf(q, d1, d2), p, 0, 1e7)
  };

  const binomial = {
    pmf: (k, n, p) => (k < 0 || k > n) ? 0 : Math.exp(combLn(n, k) + (p === 0 ? (k === 0 ? 0 : -Infinity) : k * Math.log(p)) + (p === 1 ? (k === n ? 0 : -Infinity) : (n - k) * Math.log(1 - p))),
    cdf: (k, n, p) => { k = Math.floor(k); if (k < 0) return 0; if (k >= n) return 1; return betaI(1 - p, n - k, k + 1); },
    mean: (n, p) => n * p, variance: (n, p) => n * p * (1 - p)
  };

  const poisson = {
    pmf: (k, l) => k < 0 ? 0 : Math.exp(-l + k * Math.log(l) - factorialLn(k)),
    cdf: (k, l) => k < 0 ? 0 : 1 - gammaP(Math.floor(k) + 1, l)
  };

  const exponential = {
    pdf: (x, l) => x < 0 ? 0 : l * Math.exp(-l * x),
    cdf: (x, l) => x < 0 ? 0 : 1 - Math.exp(-l * x)
  };
  const uniform = {
    pdf: (x, a, b) => (x < a || x > b) ? 0 : 1 / (b - a),
    cdf: (x, a, b) => x < a ? 0 : (x > b ? 1 : (x - a) / (b - a))
  };
  const gammaDist = {
    pdf: (x, k, th) => x <= 0 ? 0 : Math.exp((k - 1) * Math.log(x) - x / th - lgamma(k) - k * Math.log(th)),
    cdf: (x, k, th) => x <= 0 ? 0 : gammaP(k, x / th)
  };
  const betaDist = {
    pdf: (x, a, b) => (x <= 0 || x >= 1) ? 0 : Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - lbeta(a, b)),
    cdf: (x, a, b) => betaI(x, a, b)
  };
  const lognormal = {
    pdf: (x, m, s) => x <= 0 ? 0 : Math.exp(-((Math.log(x) - m) ** 2) / (2 * s * s)) / (x * s * SQRT2PI),
    cdf: (x, m, s) => x <= 0 ? 0 : normal.cdf(Math.log(x), m, s)
  };
  const geometric = {
    pmf: (k, p) => k < 1 ? 0 : (1 - p) ** (k - 1) * p,
    cdf: (k, p) => k < 1 ? 0 : 1 - (1 - p) ** Math.floor(k)
  };
  const negbinom = {
    pmf: (k, r, p) => k < 0 ? 0 : Math.exp(combLn(k + r - 1, k) + r * Math.log(p) + k * Math.log(1 - p))
  };
  const weibull = {
    pdf: (x, k, l) => x < 0 ? 0 : (k / l) * (x / l) ** (k - 1) * Math.exp(-((x / l) ** k)),
    cdf: (x, k, l) => x < 0 ? 0 : 1 - Math.exp(-((x / l) ** k))
  };

  function invByBisect(cdf, p, lo, hi) {
    if (p <= 0) return lo; if (p >= 1) return hi;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (cdf(mid) < p) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /* ---------- 記述統計 ---------- */
  const num = a => a.filter(v => typeof v === 'number' && isFinite(v));
  const sum = a => a.reduce((s, v) => s + v, 0);
  const mean = a => sum(a) / a.length;
  function variance(a, sample = true) {
    const m = mean(a); const n = a.length;
    return a.reduce((s, v) => s + (v - m) ** 2, 0) / (sample ? n - 1 : n);
  }
  const sd = (a, s = true) => Math.sqrt(variance(a, s));
  const sem = a => sd(a) / Math.sqrt(a.length);
  function quantile(a, q, method = 7) {
    const x = a.slice().sort((p, r) => p - r), n = x.length;
    if (n === 0) return NaN; if (n === 1) return x[0];
    const h = (n - 1) * q, lo = Math.floor(h), hi = Math.ceil(h);
    return x[lo] + (h - lo) * (x[hi] - x[lo]);
  }
  const median = a => quantile(a, 0.5);
  const iqr = a => quantile(a, 0.75) - quantile(a, 0.25);
  function skewness(a) { // 標本歪度 g1 の不偏寄り補正 (G1)
    const n = a.length, m = mean(a), s = sd(a);
    const g1 = a.reduce((t, v) => t + ((v - m) / s) ** 3, 0) / n;
    return n > 2 ? Math.sqrt(n * (n - 1)) / (n - 2) * g1 : g1;
  }
  function kurtosis(a) { // 超過尖度 G2
    const n = a.length, m = mean(a), s = sd(a);
    const g2 = a.reduce((t, v) => t + ((v - m) / s) ** 4, 0) / n - 3;
    return n > 3 ? ((n - 1) / ((n - 2) * (n - 3))) * ((n + 1) * g2 + 6) : g2;
  }
  function mode(a) {
    const c = new Map(); let best = null, bn = -1;
    a.forEach(v => { const k = c.get(v) || 0; c.set(v, k + 1); if (k + 1 > bn) { bn = k + 1; best = v; } });
    return { value: best, count: bn };
  }
  function describe(a) {
    const x = num(a);
    if (!x.length) return null;
    return {
      n: x.length, mean: mean(x), sd: sd(x), variance: variance(x),
      sem: sem(x), min: Math.min(...x), max: Math.max(...x),
      q1: quantile(x, 0.25), median: median(x), q3: quantile(x, 0.75), iqr: iqr(x),
      skew: skewness(x), kurt: kurtosis(x), sum: sum(x), range: Math.max(...x) - Math.min(...x),
      cv: sd(x) / mean(x), mode: mode(x)
    };
  }
  function zscores(a) { const m = mean(a), s = sd(a); return a.map(v => (v - m) / s); }
  function ranks(a) { // 平均順位（同順位補正）
    const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(a.length); let i = 0;
    while (i < idx.length) {
      let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  }
  function tieGroups(a) {
    const s = a.slice().sort((p, q) => p - q), g = []; let i = 0;
    while (i < s.length) { let j = i; while (j + 1 < s.length && s[j + 1] === s[i]) j++; g.push(j - i + 1); i = j + 1; }
    return g;
  }

  /* ---------- カーネル密度推定 ---------- */
  function kde(data, points = 256, bwFactor = 1, lo, hi) {
    const x = num(data), n = x.length;
    const s = sd(x), r = iqr(x);
    let bw = 0.9 * Math.min(s, r > 0 ? r / 1.34 : s) * Math.pow(n, -0.2) * bwFactor; // Silverman
    if (!isFinite(bw) || bw <= 0) bw = (s || 1) * 0.5;
    const mn = lo !== undefined ? lo : Math.min(...x) - 3 * bw;
    const mx = hi !== undefined ? hi : Math.max(...x) + 3 * bw;
    const xs = [], ys = [];
    for (let i = 0; i < points; i++) {
      const v = mn + (mx - mn) * i / (points - 1);
      let d = 0;
      for (let j = 0; j < n; j++) d += Math.exp(-0.5 * ((v - x[j]) / bw) ** 2);
      xs.push(v); ys.push(d / (n * bw * SQRT2PI));
    }
    return { x: xs, y: ys, bandwidth: bw };
  }
  function histogramBins(x, rule = 'fd') {
    const n = x.length;
    if (rule === 'sturges') return Math.ceil(Math.log2(n) + 1);
    if (rule === 'sqrt') return Math.ceil(Math.sqrt(n));
    if (rule === 'scott') { const h = 3.49 * sd(x) * Math.pow(n, -1 / 3); return Math.max(1, Math.ceil((Math.max(...x) - Math.min(...x)) / h)); }
    const h = 2 * iqr(x) * Math.pow(n, -1 / 3);
    return h > 0 ? Math.max(1, Math.ceil((Math.max(...x) - Math.min(...x)) / h)) : Math.ceil(Math.sqrt(n));
  }

  /* ---------- 仮説検定 ---------- */
  function pFromT(t, df, alt) {
    if (alt === 'less') return studentt.cdf(t, df);
    if (alt === 'greater') return 1 - studentt.cdf(t, df);
    return 2 * (1 - studentt.cdf(Math.abs(t), df));
  }
  function pFromZ(z, alt) {
    if (alt === 'less') return normal.cdf(z);
    if (alt === 'greater') return 1 - normal.cdf(z);
    return 2 * (1 - normal.cdf(Math.abs(z)));
  }

  function tTestOne(x, mu = 0, alt = 'two-sided', conf = 0.95) {
    x = num(x); const n = x.length, m = mean(x), s = sd(x), se = s / Math.sqrt(n), df = n - 1;
    const t = (m - mu) / se, tc = studentt.inv(1 - (1 - conf) / 2, df);
    return {
      test: '1標本 t 検定', n, mean: m, sd: s, se, df, statistic: t, p: pFromT(t, df, alt), alt, mu,
      ci: [m - tc * se, m + tc * se], conf, cohensD: (m - mu) / s
    };
  }
  function tTestPaired(x, y, mu = 0, alt = 'two-sided', conf = 0.95) {
    const d = []; for (let i = 0; i < Math.min(x.length, y.length); i++) if (isFinite(x[i]) && isFinite(y[i])) d.push(x[i] - y[i]);
    const r = tTestOne(d, mu, alt, conf);
    r.test = '対応のある t 検定'; r.diff = d; return r;
  }
  function tTestTwo(x, y, { alt = 'two-sided', equalVar = false, conf = 0.95, mu = 0 } = {}) {
    x = num(x); y = num(y);
    const n1 = x.length, n2 = y.length, m1 = mean(x), m2 = mean(y), v1 = variance(x), v2 = variance(y);
    let df, se;
    if (equalVar) {
      const sp2 = ((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2);
      se = Math.sqrt(sp2 * (1 / n1 + 1 / n2)); df = n1 + n2 - 2;
    } else {
      se = Math.sqrt(v1 / n1 + v2 / n2);
      df = (v1 / n1 + v2 / n2) ** 2 / ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1));
    }
    const t = (m1 - m2 - mu) / se, tc = studentt.inv(1 - (1 - conf) / 2, df);
    const sp = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2));
    const d = (m1 - m2) / sp;
    const J = 1 - 3 / (4 * (n1 + n2) - 9);
    return {
      test: equalVar ? '2標本 t 検定（等分散仮定 / Student）' : 'Welch の t 検定（等分散を仮定しない）',
      n1, n2, mean1: m1, mean2: m2, sd1: Math.sqrt(v1), sd2: Math.sqrt(v2),
      diff: m1 - m2, se, df, statistic: t, p: pFromT(t, df, alt), alt, conf,
      ci: [m1 - m2 - tc * se, m1 - m2 + tc * se], cohensD: d, hedgesG: d * J
    };
  }
  function zTestMean(x, mu, sigma, alt = 'two-sided', conf = 0.95) {
    x = num(x); const n = x.length, m = mean(x), se = sigma / Math.sqrt(n), z = (m - mu) / se;
    const zc = normal.inv(1 - (1 - conf) / 2);
    return { test: '1標本 z 検定（母分散既知）', n, mean: m, se, statistic: z, p: pFromZ(z, alt), alt, conf, ci: [m - zc * se, m + zc * se] };
  }

  // 母比率
  function propTestOne(k, n, p0 = 0.5, alt = 'two-sided', conf = 0.95, correct = true) {
    const ph = k / n;
    let z = (ph - p0) / Math.sqrt(p0 * (1 - p0) / n);
    if (correct) {
      const c = 0.5 / n;
      const dif = Math.abs(ph - p0) - c;
      z = Math.sign(ph - p0) * Math.max(dif, 0) / Math.sqrt(p0 * (1 - p0) / n);
    }
    // Wilson 信頼区間
    const zc = normal.inv(1 - (1 - conf) / 2);
    const den = 1 + zc * zc / n, cen = (ph + zc * zc / (2 * n)) / den;
    const half = zc * Math.sqrt(ph * (1 - ph) / n + zc * zc / (4 * n * n)) / den;
    // 正確二項検定
    let pExact;
    if (alt === 'less') pExact = binomial.cdf(k, n, p0);
    else if (alt === 'greater') pExact = 1 - binomial.cdf(k - 1, n, p0);
    else {
      const d = binomial.pmf(k, n, p0) * (1 + 1e-7); let s = 0;
      for (let i = 0; i <= n; i++) { const pr = binomial.pmf(i, n, p0); if (pr <= d) s += pr; }
      pExact = Math.min(1, s);
    }
    return {
      test: '母比率の検定（1標本）', k, n, phat: ph, p0, statistic: z, p: pFromZ(z, alt),
      pExact, alt, conf, ciWilson: [Math.max(0, cen - half), Math.min(1, cen + half)],
      ciWald: [ph - zc * Math.sqrt(ph * (1 - ph) / n), ph + zc * Math.sqrt(ph * (1 - ph) / n)],
      continuity: correct
    };
  }
  function propTestTwo(k1, n1, k2, n2, alt = 'two-sided', conf = 0.95) {
    const p1 = k1 / n1, p2 = k2 / n2, pp = (k1 + k2) / (n1 + n2);
    const se0 = Math.sqrt(pp * (1 - pp) * (1 / n1 + 1 / n2));
    const z = (p1 - p2) / se0;
    const se1 = Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2);
    const zc = normal.inv(1 - (1 - conf) / 2);
    const or = (p1 / (1 - p1)) / (p2 / (1 - p2));
    return {
      test: '母比率の差の検定（2標本）', p1, p2, k1, n1, k2, n2, diff: p1 - p2,
      statistic: z, p: pFromZ(z, alt), alt, conf,
      ci: [p1 - p2 - zc * se1, p1 - p2 + zc * se1], riskRatio: p1 / p2, oddsRatio: or
    };
  }

  // 母分散
  function varTestOne(x, sigma2, alt = 'two-sided', conf = 0.95) {
    x = num(x); const n = x.length, df = n - 1, s2 = variance(x);
    const chi = df * s2 / sigma2;
    let p;
    if (alt === 'less') p = chisquare.cdf(chi, df);
    else if (alt === 'greater') p = 1 - chisquare.cdf(chi, df);
    else p = 2 * Math.min(chisquare.cdf(chi, df), 1 - chisquare.cdf(chi, df));
    const a = (1 - conf) / 2;
    return {
      test: '母分散の検定（カイ二乗）', n, df, s2, sigma2, statistic: chi, p, alt, conf,
      ci: [df * s2 / chisquare.inv(1 - a, df), df * s2 / chisquare.inv(a, df)]
    };
  }
  function fTestVar(x, y, alt = 'two-sided', conf = 0.95) {
    x = num(x); y = num(y);
    const v1 = variance(x), v2 = variance(y), d1 = x.length - 1, d2 = y.length - 1;
    const F = v1 / v2;
    let p;
    if (alt === 'less') p = centralF.cdf(F, d1, d2);
    else if (alt === 'greater') p = 1 - centralF.cdf(F, d1, d2);
    else p = 2 * Math.min(centralF.cdf(F, d1, d2), 1 - centralF.cdf(F, d1, d2));
    const a = (1 - conf) / 2;
    return {
      test: 'F 検定（2つの母分散の比）', v1, v2, df1: d1, df2: d2, statistic: F, p, alt, conf,
      ci: [F / centralF.inv(1 - a, d1, d2), F / centralF.inv(a, d1, d2)]
    };
  }
  function leveneTest(groups, center = 'median') {
    const zs = groups.map(g => { const c = center === 'median' ? median(g) : mean(g); return g.map(v => Math.abs(v - c)); });
    const r = anovaOneWay(zs);
    return { test: `Levene 検定（中心=${center === 'median' ? '中央値/Brown-Forsythe' : '平均'}）`, statistic: r.F, p: r.p, df1: r.dfB, df2: r.dfW };
  }
  function bartlettTest(groups) {
    const k = groups.length, N = sum(groups.map(g => g.length));
    const sp2 = sum(groups.map(g => (g.length - 1) * variance(g))) / (N - k);
    const num1 = (N - k) * Math.log(sp2) - sum(groups.map(g => (g.length - 1) * Math.log(variance(g))));
    const den = 1 + (sum(groups.map(g => 1 / (g.length - 1))) - 1 / (N - k)) / (3 * (k - 1));
    const chi = num1 / den;
    return { test: 'Bartlett 検定（分散の等質性）', statistic: chi, df: k - 1, p: 1 - chisquare.cdf(chi, k - 1) };
  }

  /* ---------- 分散分析 ---------- */
  function anovaOneWay(groups, labels) {
    groups = groups.map(num);
    const k = groups.length, N = sum(groups.map(g => g.length));
    const gm = sum(groups.map(g => sum(g))) / N;
    const ssB = sum(groups.map(g => g.length * (mean(g) - gm) ** 2));
    const ssW = sum(groups.map(g => sum(g.map(v => (v - mean(g)) ** 2))));
    const dfB = k - 1, dfW = N - k;
    const msB = ssB / dfB, msW = ssW / dfW, F = msB / msW;
    const eta2 = ssB / (ssB + ssW);
    const omega2 = (ssB - dfB * msW) / (ssB + ssW + msW);
    return {
      test: '一元配置分散分析', k, N, groups: groups.map((g, i) => ({
        label: labels ? labels[i] : `群${i + 1}`, n: g.length, mean: mean(g), sd: sd(g), sem: sem(g)
      })),
      ssB, ssW, ssT: ssB + ssW, dfB, dfW, msB, msW, F, p: 1 - centralF.cdf(F, dfB, dfW),
      eta2, omega2, etaPartial: eta2, grandMean: gm
    };
  }
  // 多重比較：Holm / Bonferroni（Welch ベース）
  function postHoc(groups, labels, method = 'holm', equalVar = false, msW, dfW) {
    const pairs = [];
    for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
      let r;
      if (equalVar && msW !== undefined) {
        const n1 = groups[i].length, n2 = groups[j].length;
        const se = Math.sqrt(msW * (1 / n1 + 1 / n2));
        const t = (mean(groups[i]) - mean(groups[j])) / se;
        r = { statistic: t, df: dfW, p: pFromT(t, dfW, 'two-sided'), diff: mean(groups[i]) - mean(groups[j]), se };
      } else {
        const tt = tTestTwo(groups[i], groups[j], { equalVar: false });
        r = { statistic: tt.statistic, df: tt.df, p: tt.p, diff: tt.diff, se: tt.se };
      }
      pairs.push({ a: labels ? labels[i] : `群${i + 1}`, b: labels ? labels[j] : `群${j + 1}`, ...r });
    }
    const m = pairs.length;
    if (method === 'bonferroni') pairs.forEach(p => p.padj = Math.min(1, p.p * m));
    else { // Holm
      const ord = pairs.map((p, i) => i).sort((a, b) => pairs[a].p - pairs[b].p);
      let prev = 0;
      ord.forEach((idx, r) => { const v = Math.min(1, (m - r) * pairs[idx].p); prev = Math.max(prev, v); pairs[idx].padj = prev; });
    }
    return { method: method === 'bonferroni' ? 'Bonferroni' : 'Holm', pairs };
  }
  // 二元配置分散分析（釣り合い型・交互作用あり）
  function anovaTwoWay(rows) { // rows: {a, b, y}
    const A = [...new Set(rows.map(r => r.a))], B = [...new Set(rows.map(r => r.b))];
    const N = rows.length, gm = mean(rows.map(r => r.y));
    const cell = {}, cnt = {};
    rows.forEach(r => { const k = r.a + '||' + r.b; (cell[k] = cell[k] || []).push(r.y); });
    const meanA = {}, meanB = {};
    A.forEach(a => meanA[a] = mean(rows.filter(r => r.a === a).map(r => r.y)));
    B.forEach(b => meanB[b] = mean(rows.filter(r => r.b === b).map(r => r.y)));
    let ssA = 0, ssB = 0, ssAB = 0, ssE = 0;
    A.forEach(a => { const n = rows.filter(r => r.a === a).length; ssA += n * (meanA[a] - gm) ** 2; });
    B.forEach(b => { const n = rows.filter(r => r.b === b).length; ssB += n * (meanB[b] - gm) ** 2; });
    let hasRep = false;
    A.forEach(a => B.forEach(b => {
      const c = cell[a + '||' + b]; if (!c) return;
      if (c.length > 1) hasRep = true;
      const cm = mean(c);
      ssAB += c.length * (cm - meanA[a] - meanB[b] + gm) ** 2;
      ssE += sum(c.map(v => (v - cm) ** 2));
    }));
    const dfA = A.length - 1, dfB2 = B.length - 1, dfAB = dfA * dfB2, dfE = N - A.length * B.length;
    const out = { test: '二元配置分散分析', levelsA: A, levelsB: B, N, hasRep, terms: [] };
    if (hasRep && dfE > 0) {
      const msE = ssE / dfE;
      out.terms.push({ name: '要因A', ss: ssA, df: dfA, ms: ssA / dfA, F: (ssA / dfA) / msE, p: 1 - centralF.cdf((ssA / dfA) / msE, dfA, dfE), eta2: ssA / (ssA + ssB + ssAB + ssE) });
      out.terms.push({ name: '要因B', ss: ssB, df: dfB2, ms: ssB / dfB2, F: (ssB / dfB2) / msE, p: 1 - centralF.cdf((ssB / dfB2) / msE, dfB2, dfE), eta2: ssB / (ssA + ssB + ssAB + ssE) });
      out.terms.push({ name: '交互作用 A×B', ss: ssAB, df: dfAB, ms: ssAB / dfAB, F: (ssAB / dfAB) / msE, p: 1 - centralF.cdf((ssAB / dfAB) / msE, dfAB, dfE), eta2: ssAB / (ssA + ssB + ssAB + ssE) });
      out.terms.push({ name: '残差', ss: ssE, df: dfE, ms: msE });
    } else { // 繰り返しなし：交互作用を誤差とみなす
      const msE = ssAB / dfAB;
      out.terms.push({ name: '要因A', ss: ssA, df: dfA, ms: ssA / dfA, F: (ssA / dfA) / msE, p: 1 - centralF.cdf((ssA / dfA) / msE, dfA, dfAB), eta2: ssA / (ssA + ssB + ssAB) });
      out.terms.push({ name: '要因B', ss: ssB, df: dfB2, ms: ssB / dfB2, F: (ssB / dfB2) / msE, p: 1 - centralF.cdf((ssB / dfB2) / msE, dfB2, dfAB), eta2: ssB / (ssA + ssB + ssAB) });
      out.terms.push({ name: '残差（=交互作用）', ss: ssAB, df: dfAB, ms: msE });
    }
    out.cellMeans = {}; A.forEach(a => B.forEach(b => { const c = cell[a + '||' + b]; if (c) out.cellMeans[a + '||' + b] = mean(c); }));
    out.meanA = meanA; out.meanB = meanB;
    return out;
  }

  /* ---------- ノンパラメトリック ---------- */
  function mannWhitney(x, y, alt = 'two-sided') {
    x = num(x); y = num(y);
    const all = x.concat(y), r = ranks(all);
    const R1 = sum(r.slice(0, x.length));
    const n1 = x.length, n2 = y.length;
    const U1 = R1 - n1 * (n1 + 1) / 2, U2 = n1 * n2 - U1;
    const U = Math.min(U1, U2);
    const mu = n1 * n2 / 2;
    const t = tieGroups(all);
    const N = n1 + n2;
    const tie = sum(t.map(v => v ** 3 - v));
    const sig = Math.sqrt(n1 * n2 / 12 * ((N + 1) - tie / (N * (N - 1))));
    const z = (U1 - mu - 0.5 * Math.sign(U1 - mu)) / sig;
    return {
      test: 'Mann–Whitney の U 検定（Wilcoxon 順位和）', U1, U2, U, z,
      p: pFromZ(z, alt), alt, effectR: Math.abs(z) / Math.sqrt(N),
      cles: U1 / (n1 * n2), note: '正規近似（同順位補正・連続性補正あり）'
    };
  }
  function wilcoxonSigned(x, y, alt = 'two-sided') {
    const d = [];
    for (let i = 0; i < Math.min(x.length, y.length); i++) { const v = x[i] - (y ? y[i] : 0); if (v !== 0 && isFinite(v)) d.push(v); }
    const ad = d.map(Math.abs), r = ranks(ad);
    let Wp = 0, Wm = 0;
    d.forEach((v, i) => { if (v > 0) Wp += r[i]; else Wm += r[i]; });
    const n = d.length, mu = n * (n + 1) / 4;
    const tie = sum(tieGroups(ad).map(v => v ** 3 - v));
    const sig = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24 - tie / 48);
    const W = Math.min(Wp, Wm);
    const z = (Wp - mu - 0.5 * Math.sign(Wp - mu)) / sig;
    return { test: 'Wilcoxon の符号付き順位検定', Wplus: Wp, Wminus: Wm, W, n, z, p: pFromZ(z, alt), alt, effectR: Math.abs(z) / Math.sqrt(n) };
  }
  function kruskalWallis(groups, labels) {
    groups = groups.map(num);
    const all = [].concat(...groups), r = ranks(all), N = all.length;
    let idx = 0, H = 0;
    const info = groups.map((g, i) => {
      const rr = r.slice(idx, idx + g.length); idx += g.length;
      H += (sum(rr) ** 2) / g.length;
      return { label: labels ? labels[i] : `群${i + 1}`, n: g.length, meanRank: mean(rr), median: median(g) };
    });
    H = 12 / (N * (N + 1)) * H - 3 * (N + 1);
    const tie = sum(tieGroups(all).map(v => v ** 3 - v));
    const C = 1 - tie / (N ** 3 - N);
    const Hc = C > 0 ? H / C : H;
    const df = groups.length - 1;
    return { test: 'Kruskal–Wallis 検定', H: Hc, df, p: 1 - chisquare.cdf(Hc, df), groups: info, epsilon2: (Hc - df + 1) / ((N * N - 1) / (N + 1)) };
  }


  /* ---------- 対応のあるデータ向けの検定（追加） ---------- */
  // McNemar 検定：b = 「1回目○・2回目×」、c = 「1回目×・2回目○」の不一致ペア数
  function mcnemarTest(b, c, correct = true) {
    const n = b + c;
    const chi = n === 0 ? 0 : (correct ? (Math.abs(b - c) - 1) ** 2 : (b - c) ** 2) / n;
    // 正確版（二項検定 p=0.5）
    let pExact = 0;
    for (let i = 0; i <= n; i++) { const pr = binomial.pmf(i, n, 0.5); if (pr <= binomial.pmf(Math.min(b, c), n, 0.5) * (1 + 1e-9)) pExact += pr; }
    return {
      test: 'McNemar 検定（対応のある2値データ）', b, c, discordant: n,
      statistic: Math.max(0, chi), df: 1, p: 1 - chisquare.cdf(Math.max(0, chi), 1),
      pExact: Math.min(1, pExact), correct,
      oddsRatio: c === 0 ? Infinity : b / c
    };
  }
  // Friedman 検定：rows = 被験者、cols = 条件
  function friedmanTest(rows, labels) {
    const n = rows.length, k = rows[0].length;
    const R = new Array(k).fill(0);
    let tieCorr = 0;
    rows.forEach(r => {
      const rk = ranks(r);
      rk.forEach((v, j) => R[j] += v);
      tieGroups(r).forEach(t => tieCorr += t ** 3 - t);
    });
    let chi = 12 / (n * k * (k + 1)) * sum(R.map(v => v * v)) - 3 * n * (k + 1);
    const denom = 1 - tieCorr / (n * (k ** 3 - k));
    if (denom > 0) chi = chi / denom;
    const W = chi / (n * (k - 1)); // Kendall の一致係数
    return {
      test: 'Friedman 検定（対応のある3群以上・ノンパラメトリック）',
      statistic: chi, df: k - 1, p: 1 - chisquare.cdf(chi, k - 1),
      n, k, meanRanks: R.map(v => v / n), kendallW: W,
      labels: labels || R.map((_, j) => `条件${j + 1}`)
    };
  }
  // 一元配置・反復測定分散分析（被験者内計画）
  function rmAnova(rows, labels) {
    const n = rows.length, k = rows[0].length;
    const grand = mean(rows.flat());
    const subjMean = rows.map(r => mean(r));
    const condMean = [];
    for (let j = 0; j < k; j++) condMean.push(mean(rows.map(r => r[j])));
    let ssT = 0; rows.forEach(r => r.forEach(v => ssT += (v - grand) ** 2));
    const ssSubj = k * sum(subjMean.map(m => (m - grand) ** 2));
    const ssCond = n * sum(condMean.map(m => (m - grand) ** 2));
    const ssErr = ssT - ssSubj - ssCond;
    const dfC = k - 1, dfE = (n - 1) * (k - 1);
    const msC = ssCond / dfC, msE = ssErr / dfE;
    const F = msC / msE;
    // Greenhouse–Geisser の ε（球面性の逸脱補正）
    const S = [];
    for (let i = 0; i < k; i++) { S.push([]); for (let j = 0; j < k; j++) {
      const a = rows.map(r => r[i]), b = rows.map(r => r[j]);
      const ma = mean(a), mb = mean(b);
      S[i][j] = sum(a.map((v, t) => (v - ma) * (b[t] - mb))) / (n - 1);
    } }
    const sBar = mean(S.flat());
    const rowBar = S.map(r => mean(r));
    const diagBar = mean(S.map((r, i) => r[i]));
    const num = k * k * (diagBar - sBar) ** 2;
    const den = (k - 1) * (sum(S.flat().map(v => v * v)) - 2 * k * sum(rowBar.map(v => v * v)) + k * k * sBar * sBar);
    let eps = den > 0 ? num / den : 1;
    eps = Math.max(1 / (k - 1), Math.min(1, eps));
    const hf = Math.min(1, (n * (k - 1) * eps - 2) / ((k - 1) * ((n - 1) - (k - 1) * eps)));
    return {
      test: '反復測定分散分析（被験者内一元配置）',
      n, k, labels: labels || condMean.map((_, j) => `条件${j + 1}`),
      condMean, ssCond, ssSubj, ssErr, ssT, dfC, dfE, msC, msE, F,
      p: 1 - centralF.cdf(F, dfC, dfE),
      etaPartial: ssCond / (ssCond + ssErr),
      ggEpsilon: eps, hfEpsilon: Math.max(eps, isFinite(hf) ? hf : eps),
      pGG: 1 - centralF.cdf(F, dfC * eps, dfE * eps)
    };
  }

  /* ---------- 適合度・独立性 ---------- */
  function chiSquareGOF(observed, expected) {
    const n = sum(observed);
    const exp = expected || observed.map(() => n / observed.length);
    const chi = sum(observed.map((o, i) => (o - exp[i]) ** 2 / exp[i]));
    const df = observed.length - 1;
    return { test: 'カイ二乗適合度検定', observed, expected: exp, statistic: chi, df, p: 1 - chisquare.cdf(chi, df), minExpected: Math.min(...exp) };
  }
  function chiSquareIndep(table) {
    const R = table.length, C = table[0].length;
    const rowT = table.map(sum), colT = [], N = sum(rowT);
    for (let j = 0; j < C; j++) colT.push(sum(table.map(r => r[j])));
    const exp = table.map((r, i) => r.map((_, j) => rowT[i] * colT[j] / N));
    let chi = 0; table.forEach((r, i) => r.forEach((o, j) => chi += (o - exp[i][j]) ** 2 / exp[i][j]));
    const df = (R - 1) * (C - 1);
    // Yates（2x2）
    let chiY = null;
    if (R === 2 && C === 2) {
      chiY = 0; table.forEach((r, i) => r.forEach((o, j) => chiY += (Math.abs(o - exp[i][j]) - 0.5) ** 2 / exp[i][j]));
    }
    const V = Math.sqrt(chi / (N * Math.min(R - 1, C - 1)));
    return {
      test: 'カイ二乗独立性検定', statistic: chi, chiYates: chiY, df, p: 1 - chisquare.cdf(chi, df),
      pYates: chiY !== null ? 1 - chisquare.cdf(chiY, df) : null,
      expected: exp, N, cramersV: V, minExpected: Math.min(...exp.flat()),
      contingencyC: Math.sqrt(chi / (chi + N))
    };
  }
  function fisherExact2x2(a, b, c, d) { // 両側
    const n = a + b + c + d, r1 = a + b, c1 = a + c;
    const lp = k => combLn(r1, k) + combLn(n - r1, c1 - k) - combLn(n, c1);
    const p0 = Math.exp(lp(a)) * (1 + 1e-9);
    const lo = Math.max(0, c1 - (n - r1)), hi = Math.min(r1, c1);
    let p = 0; for (let k = lo; k <= hi; k++) { const pk = Math.exp(lp(k)); if (pk <= p0) p += pk; }
    return { test: 'Fisher の正確確率検定（2×2）', p: Math.min(1, p), oddsRatio: (a * d) / (b * c) };
  }

  /* ---------- 正規性検定 ---------- */
  function shapiroWilk(x) {
    x = num(x).slice().sort((a, b) => a - b);
    const n = x.length;
    if (n < 3) return null;
    const m = [];
    for (let i = 1; i <= n; i++) m.push(normal.inv((i - 0.375) / (n + 0.25)));
    const mm = sum(m.map(v => v * v));
    const a = new Array(n);
    const u = 1 / Math.sqrt(n);
    const cn = m[n - 1] / Math.sqrt(mm), cn1 = m[n - 2] / Math.sqrt(mm);
    let phi;
    if (n > 5) {
      const an = -2.706056 * u ** 5 + 4.434685 * u ** 4 - 2.071190 * u ** 3 - 0.147981 * u ** 2 + 0.221157 * u + cn;
      const an1 = -3.582633 * u ** 5 + 5.682633 * u ** 4 - 1.752461 * u ** 3 - 0.293762 * u ** 2 + 0.042981 * u + cn1;
      phi = (mm - 2 * m[n - 1] ** 2 - 2 * m[n - 2] ** 2) / (1 - 2 * an * an - 2 * an1 * an1);
      a[n - 1] = an; a[0] = -an; a[n - 2] = an1; a[1] = -an1;
      for (let i = 2; i < n - 2; i++) a[i] = m[i] / Math.sqrt(phi);
    } else {
      const an = -2.706056 * u ** 5 + 4.434685 * u ** 4 - 2.071190 * u ** 3 - 0.147981 * u ** 2 + 0.221157 * u + cn;
      phi = (mm - 2 * m[n - 1] ** 2) / (1 - 2 * an * an);
      a[n - 1] = an; a[0] = -an;
      for (let i = 1; i < n - 1; i++) a[i] = m[i] / Math.sqrt(phi);
    }
    const xb = mean(x);
    const numr = sum(a.map((v, i) => v * x[i])) ** 2;
    const den = sum(x.map(v => (v - xb) ** 2));
    const W = numr / den;
    let p;
    if (n === 3) { p = Math.max(0, Math.min(1, 1.909859 * (Math.asin(Math.sqrt(W)) - 1.047198))); }
    else if (n <= 11) {
      const g = -2.273 + 0.459 * n;
      const mu = 0.5440 - 0.39978 * n + 0.025054 * n * n - 0.0006714 * n ** 3;
      const sg = Math.exp(1.3822 - 0.77857 * n + 0.062767 * n * n - 0.0020322 * n ** 3);
      const z = (-Math.log(g - Math.log(1 - W)) - mu) / sg;
      p = 1 - normal.cdf(z);
    } else {
      const lg = Math.log(n);
      const mu = 0.0038915 * lg ** 3 - 0.083751 * lg ** 2 - 0.31082 * lg - 1.5861;
      const sg = Math.exp(0.0030302 * lg * lg - 0.082676 * lg - 0.4803);
      const z = (Math.log(1 - W) - mu) / sg;
      p = 1 - normal.cdf(z);
    }
    return { test: 'Shapiro–Wilk 正規性検定', W, n, p, note: 'Royston (1992/1995) の近似' };
  }
  function jarqueBera(x) {
    x = num(x); const n = x.length, S = skewness(x), K = kurtosis(x);
    const jb = n / 6 * (S * S + K * K / 4);
    return { test: 'Jarque–Bera 検定', statistic: jb, df: 2, p: 1 - chisquare.cdf(jb, 2), skew: S, kurt: K };
  }
  function andersonDarling(x) {
    x = num(x).slice().sort((a, b) => a - b);
    const n = x.length, m = mean(x), s = sd(x);
    let A2 = 0;
    for (let i = 0; i < n; i++) {
      const p1 = normal.cdf((x[i] - m) / s), p2 = normal.cdf((x[n - 1 - i] - m) / s);
      A2 += (2 * (i + 1) - 1) * (Math.log(p1) + Math.log(1 - p2));
    }
    A2 = -n - A2 / n;
    const As = A2 * (1 + 0.75 / n + 2.25 / (n * n));
    let p;
    if (As < 0.2) p = 1 - Math.exp(-13.436 + 101.14 * As - 223.73 * As * As);
    else if (As < 0.34) p = 1 - Math.exp(-8.318 + 42.796 * As - 59.938 * As * As);
    else if (As < 0.6) p = Math.exp(0.9177 - 4.279 * As - 1.38 * As * As);
    else p = Math.exp(1.2937 - 5.709 * As + 0.0186 * As * As);
    return { test: 'Anderson–Darling 正規性検定', statistic: A2, adjusted: As, p: Math.max(0, Math.min(1, p)) };
  }
  function ksTestNormal(x) {
    x = num(x).slice().sort((a, b) => a - b);
    const n = x.length, m = mean(x), s = sd(x);
    let D = 0;
    for (let i = 0; i < n; i++) {
      const F = normal.cdf((x[i] - m) / s);
      D = Math.max(D, Math.abs((i + 1) / n - F), Math.abs(F - i / n));
    }
    // Lilliefors 近似 p 値（Dallal–Wilkinson / Abdi 近似）
    const Dc = D * (Math.sqrt(n) - 0.01 + 0.85 / Math.sqrt(n));
    let p;
    if (Dc <= 0.775) p = 0.15; else if (Dc >= 1.06) p = 0.005;
    else p = Math.exp(-7.01256 * Dc * Dc * (n + 2.78019) + 2.99587 * Dc * Math.sqrt(n + 2.78019) - 0.122119 + 0.974598 / Math.sqrt(n) + 1.67997 / n);
    return { test: 'Kolmogorov–Smirnov（Lilliefors 補正）', D, p: Math.max(0, Math.min(1, p)), note: 'p 値は近似値' };
  }

  /* ---------- 相関 ---------- */
  function pearson(x, y) {
    const n = x.length, mx = mean(x), my = mean(y);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { const a = x[i] - mx, b = y[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
    return sxy / Math.sqrt(sxx * syy);
  }
  function corTest(x, y, method = 'pearson', alt = 'two-sided', conf = 0.95) {
    const pair = [];
    for (let i = 0; i < Math.min(x.length, y.length); i++) if (isFinite(x[i]) && isFinite(y[i])) pair.push([x[i], y[i]]);
    const a = pair.map(p => p[0]), b = pair.map(p => p[1]), n = pair.length;
    let r, name, stat, df, p, ci = null;
    if (method === 'spearman') {
      r = pearson(ranks(a), ranks(b)); name = 'Spearman の順位相関 ρ';
      df = n - 2; stat = r * Math.sqrt(df / (1 - r * r)); p = pFromT(stat, df, alt);
    } else if (method === 'kendall') {
      let conc = 0, disc = 0, tx = 0, ty = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const dx = Math.sign(a[i] - a[j]), dy = Math.sign(b[i] - b[j]);
        if (dx === 0 && dy === 0) { tx++; ty++; }
        else if (dx === 0) tx++; else if (dy === 0) ty++;
        else if (dx * dy > 0) conc++; else disc++;
      }
      const n0 = n * (n - 1) / 2;
      r = (conc - disc) / Math.sqrt((n0 - tx) * (n0 - ty));
      name = 'Kendall の順位相関 τ-b';
      const sig = Math.sqrt(2 * (2 * n + 5) / (9 * n * (n - 1)));
      stat = r / sig; p = pFromZ(stat, alt); df = null;
    } else {
      r = pearson(a, b); name = 'Pearson の積率相関 r';
      df = n - 2; stat = r * Math.sqrt(df / (1 - r * r)); p = pFromT(stat, df, alt);
      const z = 0.5 * Math.log((1 + r) / (1 - r)), se = 1 / Math.sqrt(n - 3);
      const zc = normal.inv(1 - (1 - conf) / 2);
      ci = [Math.tanh(z - zc * se), Math.tanh(z + zc * se)];
    }
    return { test: name, method, r, n, df, statistic: stat, p, alt, ci, conf, r2: r * r };
  }
  function corMatrix(cols, method = 'pearson') {
    const k = cols.length, M = [], P = [];
    for (let i = 0; i < k; i++) { M.push([]); P.push([]); }
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
      if (i === j) { M[i][j] = 1; P[i][j] = 0; }
      else { const t = corTest(cols[i], cols[j], method); M[i][j] = t.r; P[i][j] = t.p; }
    }
    return { r: M, p: P, method };
  }
  function partialCorr(x, y, controls) {
    // 残差同士の相関
    const rx = residualize(x, controls), ry = residualize(y, controls);
    const n = x.length, k = controls.length;
    const r = pearson(rx, ry), df = n - 2 - k;
    const t = r * Math.sqrt(df / (1 - r * r));
    return { r, df, statistic: t, p: pFromT(t, df, 'two-sided'), controls: k };
  }
  function residualize(y, Xcols) {
    const X = y.map((_, i) => [1, ...Xcols.map(c => c[i])]);
    const b = olsSolve(X, y);
    return y.map((v, i) => v - X[i].reduce((s, xv, j) => s + xv * b[j], 0));
  }

  /* ---------- 線形代数 ---------- */
  function matMul(A, B) {
    const n = A.length, m = B[0].length, k = B.length, C = [];
    for (let i = 0; i < n; i++) { C.push(new Array(m).fill(0)); for (let p = 0; p < k; p++) { const a = A[i][p]; if (a === 0) continue; for (let j = 0; j < m; j++) C[i][j] += a * B[p][j]; } }
    return C;
  }
  const transpose = A => A[0].map((_, j) => A.map(r => r[j]));
  function inverse(A) {
    const n = A.length, M = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);
    for (let c = 0; c < n; c++) {
      let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      if (Math.abs(M[piv][c]) < 1e-12) throw new Error('行列が特異です（多重共線性の可能性）');
      [M[c], M[piv]] = [M[piv], M[c]];
      const d = M[c][c]; for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
      for (let r = 0; r < n; r++) { if (r === c) continue; const f = M[r][c]; if (f === 0) continue; for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; }
    }
    return M.map(r => r.slice(n));
  }
  function olsSolve(X, y) {
    const Xt = transpose(X);
    const XtX = matMul(Xt, X);
    const Xty = matMul(Xt, y.map(v => [v]));
    const inv = inverse(XtX);
    return matMul(inv, Xty).map(r => r[0]);
  }

  /* ---------- サンプルサイズ / 検出力 ---------- */
  function powerTTest2({ d, n, alpha = 0.05, power }) {
    const za = normal.inv(1 - alpha / 2);
    if (power === undefined) {
      const ncp = d * Math.sqrt(n / 2);
      return { power: 1 - normal.cdf(za - ncp) + normal.cdf(-za - ncp) };
    }
    const zb = normal.inv(power);
    return { n: Math.ceil(2 * ((za + zb) / d) ** 2) };
  }

  root.SL = Object.assign(root.SL || {}, {
    lgamma, lbeta, combLn, gammaP, betaI, erf, erfc,
    normal, studentt, chisquare, centralF, binomial, poisson, exponential, uniform,
    gammaDist, betaDist, lognormal, geometric, negbinom, weibull,
    num, sum, mean, variance, sd, sem, quantile, median, iqr, skewness, kurtosis, mode,
    describe, zscores, ranks, kde, histogramBins,
    tTestOne, tTestPaired, tTestTwo, zTestMean,
    propTestOne, propTestTwo, varTestOne, fTestVar, leveneTest, bartlettTest,
    anovaOneWay, anovaTwoWay, postHoc,
    mannWhitney, wilcoxonSigned, kruskalWallis,
    chiSquareGOF, chiSquareIndep, fisherExact2x2, mcnemarTest, friedmanTest, rmAnova,
    shapiroWilk, jarqueBera, andersonDarling, ksTestNormal,
    pearson, corTest, corMatrix, partialCorr,
    matMul, transpose, inverse, olsSolve, powerTTest2, pFromT, pFromZ
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = root.SL;
})(typeof window !== 'undefined' ? window : globalThis);
