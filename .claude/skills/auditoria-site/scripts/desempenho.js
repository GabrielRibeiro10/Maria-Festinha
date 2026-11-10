// 2) Desempenho: rola a página inteira em cada aparelho e mede, seção por seção, o tempo de cada quadro,
// as travadas longas (>50 ms, as que a pessoa sente) e o quanto a página "pula" (CLS).
// Uso: node desempenho.js [--pagina=index.html] [--aparelhos=celular-fraco,pc-fraco] [--modo=auto|normal|leve]
//      [--css=".x{display:none}"]   (desliga algo para testar se é a causa)
// Referência: quadro médio até ~20 ms = liso; 20-35 ok; >35 a pessoa sente. Travada longa >100 ms = engasgo visível.
const { chromium, args, lista, abrir, rolarTudo, modoAtual } = require('./comum');
const init = () => {
  window.__lt = []; window.__cls = 0; window.__fr = [];
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
  let last = 0; const f = (t) => { if (last) window.__fr.push([Math.round(t - last), Math.round(scrollY)]); last = t; requestAnimationFrame(f); };
  requestAnimationFrame(f);
};
(async () => {
  const a = args();
  const aparelhos = lista(a.aparelhos, ['celular-fraco', 'celular-medio', 'celular-bom', 'tablet-fraco', 'pc-fraco', 'pc-medio', 'pc-bom']);
  const b = await chromium.launch(); const foraDaMeta = [];
  for (const nome of aparelhos) {
    const { ctx, page, ap, erros } = await abrir(b, nome, a.base + '/' + (a.pagina || 'index.html'), { modo: a.modo || 'auto', espera: 3500, init });
    if (a.css) await page.addStyleTag({ content: a.css });
    // seções: as maiores partes da página com id, <section>, <header> ou <footer>; cada ponto fica com a mais funda
    const secoes = await page.evaluate(() => [...document.querySelectorAll('[id], section, header, footer, main')]
      .map((e) => { const r = e.getBoundingClientRect(); return { n: e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''), t: r.top + scrollY, h: r.height }; })
      .filter((s) => s.h >= 250));
    await page.evaluate(() => { window.__fr = []; window.__lt = []; });
    const t0 = Date.now();
    await rolarTudo(page, ap);
    await page.waitForTimeout(1500);
    const [fr, lt, cls] = await page.evaluate(() => [window.__fr, window.__lt, window.__cls]);
    const sec = (y) => { const c = y + ap.h * 0.4; let best = null; for (const s of secoes) if (c >= s.t && c < s.t + s.h && (!best || s.h < best.h)) best = s; return best ? best.n : '(sem seção)'; };
    const ag = new Map();
    for (const [d, y] of fr) { const s = sec(y); const g = ag.get(s) || { n: 0, sum: 0, lentos: 0, pior: 0, y }; g.n++; g.sum += d; if (d > 50) g.lentos++; g.pior = Math.max(g.pior, d); ag.set(s, g); }
    const soma = lt.reduce((x, y) => x + y[1], 0);
    console.log(`\n== ${nome} ${ap.w}x${ap.h} cpu x${ap.cpu} | modo ${await modoAtual(page)} | rolou em ${((Date.now() - t0) / 1000).toFixed(1)}s`
      + ` | travadas longas ${lt.length} (soma ${soma}ms, maior ${Math.max(0, ...lt.map((x) => x[1]))}ms) | CLS ${cls.toFixed(3)}${erros.length ? ' | ERROS: ' + erros.join(' || ') : ''}`);
    const lim = ap.cpu >= 6 ? 35 : 22; const acima = [];
    for (const [s, g] of [...ag.entries()].sort((x, y) => x[1].y - y[1].y)) {
      const m = g.sum / g.n, marca = m > 35 || g.pior > 150 ? '!!' : m > 22 ? ' ~' : '  ';
      if (m > lim && g.n >= 5) acima.push(s + ' ' + m.toFixed(0) + 'ms');
      console.log(`  ${marca} ${s.padEnd(24)} quadro médio ${m.toFixed(0).padStart(3)}ms | lentos(>50ms) ${g.lentos}/${g.n} | pior ${g.pior}ms`);
    }
    // META (SKILL.md): bons/médios quadro médio ≤ 22 ms; fracos ≤ 35 ms e travadas longas somando ≤ 1 s na rolagem inteira
    const falhaSoma = ap.cpu >= 6 && soma > 1000;
    const ok = !acima.length && !falhaSoma;
    console.log(`  META ${ok ? 'ok' : 'NÃO'}${falhaSoma ? ' | travadas somam ' + (soma / 1000).toFixed(1) + ' s (meta ≤ 1 s)' : ''}${acima.length ? ' | acima de ' + lim + ' ms: ' + acima.join(', ') : ''}`);
    if (!ok) foraDaMeta.push(nome);
    await ctx.close();
  }
  if (foraDaMeta.length) console.log(`\nfora da meta: ${foraDaMeta.join(', ')}` + (foraDaMeta.some((n) => /fraco/.test(n))
    ? '\naparelho fraco fora da meta: ache a causa (passo 3) e, sem causa única, simplifique no modo leve (passo 3b). Não é pendência para o dono.' : ''));
  else console.log('\ntodos os aparelhos dentro da meta');
  await b.close();
})();
