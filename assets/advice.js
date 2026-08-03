/* ============================================================
   STATLAB / advice.js
   結果の「読み方」を生成する解説エンジン
   level: key(結論) / ok(良好) / warn(注意) / info(補足) / risk(重大)
   ============================================================ */
(function (root) {
  'use strict';
  const S = root.SL;
  const f = (v, d = 4) => (v === null || v === undefined || !isFinite(v)) ? '—' : Number(v).toFixed(d);
  const pf = p => p < 1e-4 ? 'p < 0.0001' : `p = ${p.toFixed(4)}`;
  const A = (level, title, body) => ({ level, title, body });

  function sig(p, alpha) {
    return p < alpha
      ? `有意水準 ${alpha} のもとで **帰無仮説は棄却されます**（${pf(p)}）。`
      : `有意水準 ${alpha} のもとで **帰無仮説は棄却されません**（${pf(p)}）。`;
  }
  function pCaution(p, alpha) {
    if (p >= alpha) return A('info', '「差がない」とは言えない',
      '棄却されなかったことは「差がない証拠」ではありません。検出力不足（n が小さい）でも同じ結果になります。効果量と信頼区間の幅を必ず併せて確認してください。');
    if (p > alpha * 0.5) return A('warn', 'ぎりぎりの有意',
      `p 値が有意水準の近傍（${pf(p)}）です。標本を少し変えると結論が反転しうる領域です。事前に決めた仮説かどうか、多重比較をしていないかを点検してください。`);
    return null;
  }
  function dText(d) {
    const a = Math.abs(d);
    const s = a < 0.2 ? 'ごく小さい' : a < 0.5 ? '小さい（small）' : a < 0.8 ? '中程度（medium）' : a < 1.2 ? '大きい（large）' : '非常に大きい';
    return `Cohen の d = ${f(d, 3)} → 効果量は **${s}**（目安 0.2 / 0.5 / 0.8）。`;
  }
  function rText(r) {
    const a = Math.abs(r);
    return a < 0.2 ? 'ほとんど相関なし' : a < 0.4 ? '弱い相関' : a < 0.7 ? '中程度の相関' : a < 0.9 ? '強い相関' : '非常に強い相関';
  }

  const advice = {
    describe(d, name) {
      const out = [];
      out.push(A('key', '分布の位置と広がり',
        `平均 ${f(d.mean)}、中央値 ${f(d.median)}、標準偏差 ${f(d.sd)}（不偏）。平均の標準誤差は ${f(d.sem)} なので、母平均の 95% 信頼区間はおよそ ${f(d.mean - 1.96 * d.sem)} 〜 ${f(d.mean + 1.96 * d.sem)} の範囲になります。`));
      const gap = Math.abs(d.mean - d.median) / (d.sd || 1);
      if (gap > 0.3) out.push(A('warn', '平均と中央値がずれている',
        `差は標準偏差の ${f(gap, 2)} 倍あります。外れ値または歪んだ分布の可能性が高く、代表値としては中央値、検定はノンパラメトリック手法が安全です。`));
      if (Math.abs(d.skew) > 1) out.push(A('warn', '強い歪み',
        `歪度 ${f(d.skew, 3)}（${d.skew > 0 ? '右に裾が長い' : '左に裾が長い'}）。対数変換や Box–Cox 変換で正規性が改善することがあります。`));
      else out.push(A('ok', '歪みは許容範囲', `歪度 ${f(d.skew, 3)}。おおむね左右対称です（|歪度| < 1 が目安）。`));
      if (d.kurt > 3) out.push(A('warn', '裾が重い', `超過尖度 ${f(d.kurt, 3)}。正規分布より外れ値が出やすい分布です。平均・分散に基づく手法は影響を受けます。`));
      const outLo = d.q1 - 1.5 * d.iqr, outHi = d.q3 + 1.5 * d.iqr;
      out.push(A('info', '外れ値の判定基準',
        `Tukey の基準では ${f(outLo)} 未満または ${f(outHi)} 超が外れ値候補です（箱ひげ図のひげの外側）。変動係数 CV = ${f(d.cv, 3)}。`));
      if (d.n < 30) out.push(A('warn', '標本サイズが小さい', `n = ${d.n}。中心極限定理に頼りにくいため、正規性の確認と t 分布の利用が前提になります。`));
      return out;
    },

    normality(sw, jb, ad) {
      const out = [];
      if (sw) {
        out.push(A(sw.p < 0.05 ? 'warn' : 'ok', 'Shapiro–Wilk 検定',
          `W = ${f(sw.W, 5)}、${pf(sw.p)}。帰無仮説は「母集団は正規分布」です。${sw.p < 0.05 ? '棄却されるため、正規性の仮定は疑わしいと判断します。' : '棄却されないため、正規性に大きな問題はないと判断できます。'}`));
      }
      if (jb) out.push(A('info', 'Jarque–Bera 検定', `統計量 ${f(jb.statistic, 4)}、${pf(jb.p)}。歪度 ${f(jb.skew, 3)} と超過尖度 ${f(jb.kurt, 3)} の組み合わせで判定しています。`));
      if (ad) out.push(A('info', 'Anderson–Darling 検定', `A² = ${f(ad.statistic, 4)}、${pf(ad.p)}。裾の乖離に敏感な検定です。`));
      out.push(A('info', '検定より Q-Q プロットを見る',
        'n が大きいと些細なズレでも有意になり、n が小さいと歪んだ分布でも棄却されません。最終判断は Q-Q プロットが直線に乗るかどうかで行うのが実務的です。'));
      return out;
    },

    tTest(r, alpha = 0.05) {
      const out = [];
      out.push(A('key', '検定の結論',
        `${r.test}。t = ${f(r.statistic, 4)}、自由度 ${f(r.df, 3)}、${pf(r.p)}。${sig(r.p, alpha)}`));
      if (r.ci) out.push(A('key', `${Math.round(r.conf * 100)}% 信頼区間`,
        `[${f(r.ci[0])}, ${f(r.ci[1])}]。${(r.ci[0] > 0 || r.ci[1] < 0) ? 'この区間は 0 を含まないため、検定結果と整合します。' : 'この区間は 0 を含みます。差が 0 である可能性を否定できません。'} 区間の幅そのものが「推定の精度」を表します。`));
      if (r.cohensD !== undefined) out.push(A('info', '効果量', dText(r.cohensD) + ' p 値は標本サイズで動きますが、効果量は動きません。実務判断はこちらで行います。'));
      const c = pCaution(r.p, alpha); if (c) out.push(c);
      if (r.test.includes('Welch')) out.push(A('ok', 'Welch を既定にしている理由',
        '等分散を仮定しない Welch 法は、等分散が成り立つ場合でも性能をほとんど落としません。「まず F 検定で等分散を確認してから」という手順は多重検定になるため、現在は Welch を既定とする流儀が主流です。'));
      return out;
    },

    anova(r, ph, alpha = 0.05) {
      const out = [];
      out.push(A('key', '分散分析の結論',
        `F(${r.dfB}, ${r.dfW}) = ${f(r.F, 4)}、${pf(r.p)}。帰無仮説は「すべての群の母平均が等しい」です。${sig(r.p, alpha)}`));
      out.push(A('info', '効果量',
        `η² = ${f(r.eta2, 4)}（全変動のうち群間で説明できる割合 ${(r.eta2 * 100).toFixed(1)}%）、ω² = ${f(r.omega2, 4)}（偏りを補正した推定値、こちらが推奨）。目安は 0.01 小 / 0.06 中 / 0.14 大。`));
      if (r.p < alpha) out.push(A('key', 'どの群が違うのかは別問題',
        'F 検定が有意でも「どこかに差がある」としか言えません。下の多重比較で対ごとに確認してください。'));
      if (ph) out.push(A('info', `多重比較（${ph.method} 法）`,
        `対比較を ${ph.pairs.length} 回行うため、補正なしでは第一種の過誤が最大 ${(100 * (1 - Math.pow(1 - alpha, ph.pairs.length))).toFixed(1)}% まで膨らみます。調整済み p 値（p.adj）で判断してください。`));
      const ns = r.groups.map(g => g.n);
      if (Math.max(...ns) / Math.min(...ns) > 1.5) out.push(A('warn', '群のサイズが不揃い',
        `n の比が ${f(Math.max(...ns) / Math.min(...ns), 2)} 倍あります。不釣り合いデータでは等分散性の逸脱に敏感になります。Welch の分散分析や Kruskal–Wallis の併用を検討してください。`));
      out.push(A('info', '前提条件', '①各群の独立性 ②群内の正規性 ③等分散性（Levene / Bartlett で確認）。③が崩れる場合は Welch 型、②が崩れる場合は Kruskal–Wallis を使います。'));
      return out;
    },

    prop(r, alpha = 0.05) {
      const out = [];
      if (r.p0 !== undefined) {
        out.push(A('key', '母比率の検定', `標本比率 p̂ = ${f(r.phat, 4)}（${r.k}/${r.n}）を p₀ = ${r.p0} と比較。z = ${f(r.statistic, 4)}、${pf(r.p)}。${sig(r.p, alpha)}`));
        out.push(A('key', 'Wilson 信頼区間', `[${f(r.ciWilson[0], 4)}, ${f(r.ciWilson[1], 4)}]。標本比率が 0 や 1 に近いときは、通常の Wald 区間より Wilson 区間の方が被覆確率が正確です。`));
        out.push(A('info', '正確二項検定', `二項分布に基づく正確な p 値は ${f(r.pExact, 5)}。近似 z 検定と乖離が大きい場合は正確検定を採用してください。`));
        const min = Math.min(r.n * r.p0, r.n * (1 - r.p0));
        if (min < 5) out.push(A('risk', '正規近似が使えない', `np₀ = ${f(r.n * r.p0, 2)}、n(1−p₀) = ${f(r.n * (1 - r.p0), 2)}。どちらも 5 以上（できれば 10 以上）が近似の目安です。正確二項検定の結果を使ってください。`));
        else out.push(A('ok', '正規近似の条件', `np₀ と n(1−p₀) がともに 5 以上あり、正規近似は妥当です。`));
      } else {
        out.push(A('key', '母比率の差の検定', `p̂₁ = ${f(r.p1, 4)}、p̂₂ = ${f(r.p2, 4)}、差 = ${f(r.diff, 4)}。z = ${f(r.statistic, 4)}、${pf(r.p)}。${sig(r.p, alpha)}`));
        out.push(A('key', '差の 95% 信頼区間', `[${f(r.ci[0], 4)}, ${f(r.ci[1], 4)}]。${(r.ci[0] > 0 || r.ci[1] < 0) ? '0 を含まないため差があると判断できます。' : '0 を含むため差があるとは言えません。'}`));
        out.push(A('info', 'リスク比とオッズ比', `リスク比 RR = ${f(r.riskRatio, 4)}、オッズ比 OR = ${f(r.oddsRatio, 4)}。まれな事象では両者は近づきますが、頻度が高い事象では OR は差を誇張します。`));
      }
      const c = pCaution(r.p, alpha); if (c) out.push(c);
      return out;
    },

    variance(r, alpha = 0.05) {
      const out = [];
      if (r.sigma2 !== undefined) {
        out.push(A('key', '母分散の検定', `χ² = ${f(r.statistic, 4)}（自由度 ${r.df}）、${pf(r.p)}。標本分散 s² = ${f(r.s2)} を σ₀² = ${r.sigma2} と比較しています。${sig(r.p, alpha)}`));
        out.push(A('key', '母分散の信頼区間', `[${f(r.ci[0])}, ${f(r.ci[1])}]。標準偏差なら [${f(Math.sqrt(r.ci[0]))}, ${f(Math.sqrt(r.ci[1]))}]。分散の区間は左右非対称になります（カイ二乗分布が非対称なため）。`));
        out.push(A('risk', '正規性への強い依存', 'カイ二乗検定・F 検定は正規性からのずれに非常に敏感です。裾が重いだけで結果が大きく歪むため、先に正規性を必ず確認してください。'));
      } else {
        out.push(A('key', '2つの母分散の比', `F = ${f(r.statistic, 4)}（自由度 ${r.df1}, ${r.df2}）、${pf(r.p)}。${sig(r.p, alpha)} 分散比の 95% 信頼区間は [${f(r.ci[0])}, ${f(r.ci[1])}]。`));
        out.push(A('info', '等分散性の確認に使う場合', 'F 検定の代わりに、正規性に頑健な Levene 検定（Brown–Forsythe）を推奨します。そもそも平均の比較なら Welch の t 検定を使えば等分散の判定自体が不要です。'));
      }
      return out;
    },

    correlation(r, alpha = 0.05) {
      const out = [];
      out.push(A('key', '相関の強さ', `${r.test} = ${f(r.r, 5)} → **${rText(r.r)}**（${r.r > 0 ? '正' : '負'}の関係）。${pf(r.p)}。${sig(r.p, alpha)}`));
      if (r.ci) out.push(A('key', '相関係数の 95% 信頼区間', `[${f(r.ci[0], 4)}, ${f(r.ci[1], 4)}]（Fisher の z 変換による）。区間が広いときは n を増やさない限り「相関の大きさ」は特定できません。`));
      if (r.method === 'pearson') {
        out.push(A('info', '決定係数', `r² = ${f(r.r2, 4)}。一方の変数の分散のうち ${(r.r2 * 100).toFixed(1)}% がもう一方と共有されています。`));
        out.push(A('warn', 'Pearson の前提', '直線関係・外れ値の影響・正規性に敏感です。散布図で曲線的な関係や外れ値が見えるときは Spearman を使ってください。'));
      }
      out.push(A('risk', '相関は因果ではない', '第三の変数（交絡）による見かけの相関、逆向きの因果、選択バイアスの可能性を常に検討してください。層別すると相関の符号が反転することもあります（シンプソンのパラドックス）。'));
      const c = pCaution(r.p, alpha); if (c) out.push(c);
      return out;
    },

    regression(m, alpha = 0.05) {
      const out = [];
      out.push(A('key', 'モデル全体の説明力',
        `R² = ${f(m.R2, 4)}（${(m.R2 * 100).toFixed(1)}% を説明）、自由度調整済み R² = ${f(m.adjR2, 4)}。F(${m.dfModel}, ${m.df}) = ${f(m.F, 4)}、${pf(m.pF)}。${m.pF < alpha ? 'モデルは全体として有意です。' : 'モデル全体として有意ではありません。説明変数の選択を見直してください。'}`));
      out.push(A('info', '自由度調整済み R² を見る理由', '説明変数を増やせば R² は必ず上がります。変数の数で罰則をかけた調整済み R²、および AIC = ' + f(m.aic, 2) + ' / BIC = ' + f(m.bic, 2) + ' でモデルを比較してください。'));
      const sigv = m.coefs.filter((c, i) => !(m.intercept && i === 0) && c.p < alpha);
      const nsv = m.coefs.filter((c, i) => !(m.intercept && i === 0) && c.p >= alpha);
      if (sigv.length) out.push(A('key', '有意な説明変数',
        sigv.map(c => `**${c.name}**: 係数 ${f(c.estimate, 5)}（${pf(c.p)}）→ 他を一定としたとき ${c.name} が 1 単位増えると目的変数は平均 ${f(c.estimate, 4)} 変化。95%CI [${f(c.lo, 4)}, ${f(c.hi, 4)}]、標準化係数 β = ${f(c.beta, 3)}`).join('<br>')));
      if (nsv.length) out.push(A('warn', '有意でない説明変数',
        nsv.map(c => `${c.name}（${pf(c.p)}）`).join('、') + '。ただし多重共線性があると本来効いている変数でも有意でなくなります。すぐに落とさず VIF を確認してください。'));
      out.push(A('info', '標準化係数 β の使いどころ', '単位が異なる変数どうしの「効きの大きさ」を比べるときは、生の係数ではなく β を比較します。'));
      const maxVif = Math.max(...m.vif);
      if (maxVif > 10) out.push(A('risk', '深刻な多重共線性', `最大 VIF = ${f(maxVif, 2)}（> 10）。説明変数どうしが強く相関しており、係数の符号や大きさが信用できません。変数を削るか、主成分回帰・リッジ回帰を検討してください。`));
      else if (maxVif > 5) out.push(A('warn', '多重共線性の兆候', `最大 VIF = ${f(maxVif, 2)}（5〜10）。係数の標準誤差が膨らんでいます。`));
      else out.push(A('ok', '多重共線性は問題なし', `最大 VIF = ${f(maxVif, 2)}。説明変数どうしの重複は小さいです。`));
      const dw = m.durbinWatson;
      if (dw < 1.5 || dw > 2.5) out.push(A('warn', '残差の系列相関', `Durbin–Watson = ${f(dw, 4)}（2 付近が理想）。${dw < 1.5 ? '正の系列相関' : '負の系列相関'}が疑われます。時系列データなら通常の OLS の標準誤差は過小評価になります。`));
      else out.push(A('ok', '残差の独立性', `Durbin–Watson = ${f(dw, 4)}。系列相関の兆候はありません。`));
      const infl = m.cook.map((c, i) => ({ i, c })).filter(o => o.c > 4 / m.n).sort((a, b) => b.c - a.c).slice(0, 5);
      if (infl.length) out.push(A('warn', '影響力の大きい観測値',
        `Cook 距離が閾値 4/n = ${f(4 / m.n, 4)} を超える点：行 ${infl.map(o => o.i + 1).join(', ')}（最大 ${f(infl[0].c, 4)}）。これらを除いて再推定し、結論が変わらないか確認してください。`));
      out.push(A('info', '残差プロットの読み方',
        '① 残差 vs 予測値：ランダムな帯なら OK。ラッパ状に広がるなら不等分散（対数変換や加重最小二乗）。曲線を描くなら非線形項が必要。② Q-Q プロット：直線から外れると残差の正規性が崩れており、係数の p 値と信頼区間が信用できません。'));
      return out;
    },

    logistic(m, cm, roc, alpha = 0.05) {
      const out = [];
      if (m.separated) out.push(A('risk', '完全分離（separation）',
        '説明変数だけで結果が完全に判別できてしまい、係数が発散しています。推定値と p 値は解釈できません。L2 正則化を有効にするか、変数を減らしてください。'));
      out.push(A('key', 'モデル全体の有意性',
        `尤度比検定 χ²(${m.lrDf}) = ${f(m.lrChi2, 4)}、${pf(m.lrP)}。${m.lrP < alpha ? '説明変数なしのモデルより有意に当てはまりが良いです。' : '説明変数なしのモデルと比べて改善していません。'}`));
      out.push(A('info', '疑似決定係数',
        `McFadden R² = ${f(m.mcfadden, 4)}、Nagelkerke R² = ${f(m.nagelkerke, 4)}。McFadden は 0.2〜0.4 でも「非常に良い当てはまり」とされます。線形回帰の R² と同じ感覚で読まないでください。AIC = ${f(m.aic, 2)}。`));
      const sv = m.coefs.slice(1);
      out.push(A('key', 'オッズ比の読み方',
        sv.map(c => `**${c.name}**: OR = ${f(c.or, 4)}（95%CI ${f(c.orLo, 3)}–${f(c.orHi, 3)}、${pf(c.p)}）→ ${c.name} が 1 単位増えると、他を一定として事象の起こるオッズが **${f(c.or, 3)} 倍**（${c.or > 1 ? `${((c.or - 1) * 100).toFixed(1)}% 増` : `${((1 - c.or) * 100).toFixed(1)}% 減`}）。`).join('<br>')
        + '<br>OR の信頼区間が 1 をまたぐ変数は有意ではありません。'));
      if (roc) {
        const a = roc.auc;
        const g = a >= 0.9 ? '極めて良好' : a >= 0.8 ? '良好' : a >= 0.7 ? '許容範囲' : a >= 0.6 ? '不十分' : 'ほぼ判別できていない';
        out.push(A(a >= 0.7 ? 'ok' : 'warn', '判別性能（ROC-AUC）',
          `AUC = ${f(a, 4)} → **${g}**（0.5 = でたらめ、1.0 = 完全）。AUC は「無作為に選んだ陽性例の予測確率が陰性例より高い確率」です。Youden 指数が最大になる閾値は ${f(roc.bestThreshold, 3)}。`));
      }
      if (cm) out.push(A('info', `分類性能（閾値 ${cm.threshold}）`,
        `正解率 ${f(cm.accuracy, 4)}、感度（再現率）${f(cm.recall, 4)}、特異度 ${f(cm.specificity, 4)}、適合率 ${f(cm.precision, 4)}、F1 ${f(cm.f1, 4)}、MCC ${f(cm.mcc, 4)}。<br>陽性が少ない不均衡データでは正解率は無意味に高く出ます。目的に応じて「見逃しを減らす（感度重視・閾値を下げる）」か「誤検知を減らす（適合率重視・閾値を上げる）」かを決めてください。`));
      const epv = m.n * Math.min(S.mean(m.prob), 1 - S.mean(m.prob)) / (m.p - 1);
      if (epv < 10) out.push(A('warn', 'イベント数が少ない', `説明変数 1 個あたりのイベント数（EPV）が約 ${f(epv, 1)} と少なく、係数が過大推定されやすい状態です（目安 10 以上）。変数を減らすか標本を増やしてください。`));
      return out;
    },

    tree(t) {
      const out = [];
      if (t.task === 'classification') {
        out.push(A('key', '予測精度', `学習データ正解率 ${f(t.train.accuracy, 4)}、未使用の検証データ正解率 ${f(t.test.accuracy, 4)}（n = ${t.nTest}）。`));
        const gap = t.train.accuracy - t.test.accuracy;
        if (gap > 0.15) out.push(A('risk', '過学習しています', `学習と検証の差が ${f(gap, 3)} あります。木の深さを浅くする、葉の最小サンプル数を増やす、などで単純化してください。`));
        else out.push(A('ok', '汎化はおおむね健全', `学習と検証の差は ${f(gap, 3)} で、過学習は目立ちません。`));
      } else {
        out.push(A('key', '予測精度', `学習 R² = ${f(t.train.r2, 4)} / RMSE ${f(t.train.rmse, 4)}、検証 R² = ${f(t.test.r2, 4)} / RMSE ${f(t.test.rmse, 4)}。`));
      }
      const imp = t.importance.map((v, i) => ({ n: t.featureNames[i], v })).sort((a, b) => b.v - a.v);
      out.push(A('key', '重要な変数',
        imp.slice(0, 5).map(o => `${o.n}: ${(o.v * 100).toFixed(1)}%`).join(' / ') + '。重要度は「その変数での分割が不純度をどれだけ下げたか」の合計割合です。'));
      out.push(A('warn', '重要度の落とし穴', '水準数の多いカテゴリや連続変数は重要度が過大評価されます。また、相関の強い変数どうしでは重要度が一方に吸われます。ランダムフォレストの結果と比較すると安定性を確認できます。'));
      out.push(A('info', '木の読み方', '各ノードの条件が真なら左、偽なら右へ進みます。葉に到達したときの多数派クラス（回帰では平均）が予測値です。決定木は解釈しやすい反面、データが少し変わると構造が大きく変わる不安定さがあります。'));
      return out;
    },

    timeseries(res) {
      const out = [];
      if (res.adf) out.push(A(res.adf.stationary ? 'ok' : 'warn', '定常性（ADF 検定）',
        `検定統計量 ${f(res.adf.statistic, 4)}（5% 臨界値 ${res.adf.critical['5%']}）。帰無仮説は「単位根をもつ＝非定常」です。${res.adf.stationary ? '棄却されるため定常とみなせます。' : '棄却できないため非定常の可能性が高く、差分を取ってから分析してください。'} ${res.adf.note}`));
      if (res.decomp) out.push(A('key', '成分分解',
        `トレンドの強さ ${f(res.decomp.strengthTrend, 3)}、季節性の強さ ${f(res.decomp.strengthSeasonal, 3)}（0〜1）。0.6 を超えれば「その成分が支配的」と言えます。加法モデルは変動幅が一定のとき、乗法モデルは水準に比例して変動幅が広がるときに適します。`));
      if (res.lb) out.push(A(res.lb.p < 0.05 ? 'warn' : 'ok', '残差の自己相関（Ljung–Box）',
        `Q = ${f(res.lb.Q, 3)}、${pf(res.lb.p)}。${res.lb.p < 0.05 ? '残差にまだ構造が残っています。ラグ項や季節項を追加する余地があります。' : '残差はホワイトノイズとみなせ、モデルは情報を取り切っています。'}`));
      out.push(A('info', 'コレログラムの読み方',
        'ACF が指数的に減衰し PACF が p 次で切れる → AR(p)。ACF が q 次で切れ PACF が減衰 → MA(q)。ACF がゆっくりしか減衰しない → 非定常なので差分が必要。青い帯は 95% 信頼限界で、その外に出たラグが有意です。'));
      if (res.hw) out.push(A('key', '予測モデル',
        `${res.hw.type}。平滑化パラメータ α = ${f(res.hw.alpha, 3)}（水準）、β = ${f(res.hw.beta, 3)}（トレンド）、γ = ${f(res.hw.gamma, 3)}（季節）。当てはめ RMSE ${f(res.hw.rmse, 4)}、MAPE ${f(res.hw.mape, 2)}%。α が大きいほど直近を重視します。`));
      out.push(A('risk', '予測区間は必ず併記する', '点予測だけを示すのは危険です。予測区間は先の期間ほど急速に広がります。区間の幅が意思決定に耐えない広さなら、その予測は使うべきではありません。'));
      return out;
    },

    stock(p) {
      const out = [];
      out.push(A('key', 'リターンとリスク',
        `年率換算リターン ${(p.annReturn * 100).toFixed(2)}%（CAGR ${(p.cagr * 100).toFixed(2)}%）、年率ボラティリティ ${(p.annVol * 100).toFixed(2)}%、シャープレシオ ${f(p.sharpe, 3)}、ソルティノレシオ ${f(p.sortino, 3)}。シャープは 1 を超えると良好とされますが、期間の取り方で大きく変わります。`));
      out.push(A('key', 'ドローダウン',
        `最大ドローダウン ${(p.maxDrawdown * 100).toFixed(2)}%。過去の高値からの最大下落率で、心理的な耐久力の目安になります。カルマーレシオ ${f(p.calmar, 3)}。`));
      out.push(A('info', 'VaR / CVaR',
        `ヒストリカル VaR(95%) = ${(p.var95 * 100).toFixed(2)}%／日、VaR(99%) = ${(p.var99 * 100).toFixed(2)}%。期待ショートフォール CVaR(95%) = ${(p.cvar95 * 100).toFixed(2)}%。VaR は「その水準を超える損失がどれだけ大きいか」を語りません。裾リスクは CVaR で見てください。`));
      const jb = p.jb;
      out.push(A(jb.p < 0.05 ? 'warn' : 'ok', 'リターン分布の正規性',
        `歪度 ${f(p.skew, 3)}、超過尖度 ${f(p.kurt, 3)}、Jarque–Bera ${pf(jb.p)}。${jb.p < 0.05 ? '正規分布は棄却されました。金融時系列では典型的な「ファットテール」です。正規分布前提の VaR は裾リスクを過小評価します。' : '正規分布から大きくは外れていません。'}`));
      out.push(A('risk', '投資判断への利用について',
        'ここでの計算は過去データの記述統計であり、将来の収益を予測するものではありません。取引コスト・税・流動性・生存者バイアスは考慮されていません。投資助言ではなく、必ずご自身の判断と責任で利用してください。'));
      return out;
    },

    mlp(r) {
      const out = [];
      const h = r.history;
      const last = h.loss.length - 1;
      out.push(A('key', '学習結果',
        `構成 ${r.arch.join(' → ')}（総パラメータ ${r.nParams.toLocaleString()}）。最終の学習損失 ${f(h.loss[last], 5)}、検証損失 ${f(h.val_loss[last], 5)}。`));
      if (r.task === 'regression') out.push(A('key', '予測精度', `全体 R² = ${f(r.r2, 4)}、RMSE = ${f(r.rmse, 4)}、MAE = ${f(r.mae, 4)}、検証データ RMSE = ${f(r.valRmse, 4)}。`));
      else out.push(A('key', '予測精度', `全体正解率 ${f(r.accuracy, 4)}、学習 ${f(r.trainAccuracy, 4)}、検証 ${f(r.valAccuracy, 4)}${r.roc ? `、AUC ${f(r.roc.auc, 4)}` : ''}。`));
      const vl = h.val_loss.filter(v => v !== null && isFinite(v));
      const minV = Math.min(...vl), minAt = vl.indexOf(minV);
      if (minAt < vl.length - 10 && vl[vl.length - 1] > minV * 1.1) out.push(A('risk', '過学習しています',
        `検証損失は ${minAt + 1} エポック目で最小（${f(minV, 5)}）になった後、上昇しています。エポック数を ${minAt + 1} 程度に減らす、ドロップアウトや L2 正則化を強める、隠れ層を小さくする、のいずれかが必要です。`));
      else if (h.loss[last] > h.loss[0] * 0.9) out.push(A('warn', '学習が進んでいない',
        '損失がほとんど下がっていません。学習率を上げる、エポックを増やす、隠れ層を増やす、入力に有効な変数が含まれているかを確認してください。'));
      else out.push(A('ok', '学習曲線は健全', '学習損失と検証損失がともに下がり、乖離も小さい状態です。'));
      out.push(A('warn', 'ニューラルネットを使う前に',
        '表形式データでは、勾配ブースティングや線形モデルの方が高精度かつ解釈可能なことが多いです。MLP の係数は解釈できないため、「なぜその予測になったか」を説明する必要がある場面では回帰や決定木を選んでください。'));
      out.push(A('info', '検証データの意味',
        '検証データは学習に使っていないデータです。学習精度だけが高く検証精度が低ければ、それは丸暗記であって予測能力ではありません。'));
      return out;
    },

    chisq(r, alpha = 0.05) {
      const out = [];
      out.push(A('key', '検定の結論', `χ² = ${f(r.statistic, 4)}（自由度 ${r.df}）、${pf(r.p)}。${sig(r.p, alpha)}`));
      if (r.cramersV !== undefined) {
        const v = r.cramersV;
        out.push(A('info', '関連の強さ', `Cramér の V = ${f(v, 4)} → ${v < 0.1 ? 'ごく弱い' : v < 0.3 ? '弱い' : v < 0.5 ? '中程度' : '強い'}関連。χ² は標本サイズに比例して大きくなるため、強さの判断は必ず V で行います。`));
      }
      if (r.minExpected < 5) out.push(A('risk', '期待度数が小さすぎる',
        `最小期待度数 ${f(r.minExpected, 2)} < 5。カイ二乗近似が成立しません。2×2 なら Fisher の正確確率検定、それ以上ならカテゴリを併合してください。`));
      else out.push(A('ok', '近似の妥当性', `最小期待度数 ${f(r.minExpected, 2)} ≥ 5。カイ二乗近似は妥当です（全セルの 80% 以上が 5 以上、が基準）。`));
      if (r.pYates) out.push(A('info', 'Yates の連続性補正', `補正後 χ² = ${f(r.chiYates, 4)}、${pf(r.pYates)}。2×2 表では保守的（有意になりにくい）方向に働きます。`));
      out.push(A('info', '残差でセルを特定', '有意でも「どのセルが効いたか」は別問題です。調整済み標準化残差の絶対値が 2 を超えるセルが、独立を仮定した場合との乖離が大きい箇所です。'));
      return out;
    },

    nonparam(r, alpha = 0.05) {
      const out = [];
      out.push(A('key', '検定の結論', `${r.test}。${r.H !== undefined ? `H = ${f(r.H, 4)}（自由度 ${r.df}）` : `検定統計量 ${f(r.U !== undefined ? r.U : r.W, 3)}、z = ${f(r.z, 4)}`}、${pf(r.p)}。${sig(r.p, alpha)}`));
      out.push(A('info', '何を比べているのか',
        r.H !== undefined ? '各群の「平均順位」を比較しています。分布の形が群間で同じなら「中央値の差」と解釈できますが、形が違う場合は「分布全体が異なる」としか言えません。'
          : '2 群の値を混ぜて順位に置き換え、順位の偏りを見ています。分布の形が同じであれば中央値の差の検定と解釈できます。'));
      if (r.effectR !== undefined) out.push(A('info', '効果量', `r = |z|/√N = ${f(r.effectR, 3)}（0.1 小 / 0.3 中 / 0.5 大）。${r.cles !== undefined ? `また「群1 から無作為に選んだ値が群2 より大きい確率」は ${f(r.cles, 3)} です。` : ''}`));
      if (r.epsilon2 !== undefined) out.push(A('info', '効果量', `ε² = ${f(r.epsilon2, 4)}（順位に基づく説明率）。`));
      out.push(A('ok', 'ノンパラメトリックの利点と代償', '正規性を仮定せず外れ値に強い一方、正規分布が成り立つ場面では t 検定より検出力がやや落ちます（漸近相対効率 約 0.955）。'));
      return out;
    },

    pca(r) {
      const out = [];
      const k = r.cumulative.findIndex(v => v >= 0.8) + 1;
      out.push(A('key', '何成分に要約できるか',
        `第1主成分の寄与率 ${(r.explained[0] * 100).toFixed(1)}%、累積 80% に到達するのは第 ${k || r.explained.length} 主成分までです。固有値 1 以上の成分は ${r.eigenvalues.filter(v => v >= 1).length} 個（カイザー基準）。`));
      out.push(A('info', '主成分の解釈', '因子負荷量（loading）の絶対値が大きい変数がその主成分の意味を決めます。符号が同じ変数どうしは同じ方向に動く変数群です。スクリープロットの「肘」も採用成分数の判断に使えます。'));
      return out;
    },

    distribution(kind, params) {
      const map = {
        normal: '正規分布は「多数の独立な小さい要因の和」で現れます（中心極限定理）。平均±1σ に約 68.3%、±2σ に約 95.4%、±3σ に約 99.7% が入ります。',
        binomial: '二項分布は「成功確率 p の独立試行を n 回」の成功回数です。np ≥ 5 かつ n(1−p) ≥ 5 で正規近似、n が大きく p が小さいときはポアソン分布（λ = np）で近似できます。',
        poisson: 'ポアソン分布は「単位時間・単位面積あたりの稀な事象の回数」です。平均と分散がともに λ に等しいのが特徴で、実データの分散が平均より大きい場合は過分散として負の二項分布を検討します。',
        t: 't 分布は母分散が未知のときの標本平均の分布です。自由度が小さいほど裾が重く、自由度 30 を超えると標準正規分布にほぼ一致します。',
        chisquare: 'カイ二乗分布は標準正規変量の二乗和の分布で、分散の推定・適合度検定・独立性検定に使われます。自由度が増えるにつれて正規分布に近づきます。',
        f: 'F 分布は2つの独立なカイ二乗変量の比で、分散比の検定と分散分析に使われます。右に裾を引く非対称分布です。',
        exponential: '指数分布は「ポアソン過程における事象間隔」です。無記憶性（過去の待ち時間が将来に影響しない）をもちます。',
        uniform: '一様分布はすべての値が等確率です。乱数生成や無情報事前分布の出発点になります。',
        lognormal: '対数正規分布は「対数を取ると正規分布」になる分布です。所得・株価・粒径など、比率的に変動する量に現れます。',
        gamma: 'ガンマ分布は待ち時間の和や、正の連続量のモデルに使われます。形状母数 k が整数のときアーラン分布になります。',
        beta: 'ベータ分布は 0〜1 の割合を表す分布で、ベイズ統計では二項分布の共役事前分布として使われます。',
        weibull: 'ワイブル分布は寿命・故障解析の標準です。形状母数 k < 1 で初期故障、k = 1 で偶発故障（指数分布）、k > 1 で摩耗故障を表します。',
        geometric: '幾何分布は「初めて成功するまでの試行回数」です。指数分布の離散版で、こちらも無記憶性をもちます。',
        negbinom: '負の二項分布は「r 回成功するまでの失敗回数」で、過分散のカウントデータのモデルとしても広く使われます。'
      };
      return [A('info', 'この分布について', map[kind] || '')];
    }
  };

  root.SL.advice = advice;
  root.SL.fmt = f;
  if (typeof module !== 'undefined' && module.exports) module.exports = advice;
})(typeof window !== 'undefined' ? window : globalThis);
