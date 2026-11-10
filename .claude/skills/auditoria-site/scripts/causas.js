// 3) Causas do lag numa parte da página: rola por ela gravando (a) quais elementos recebem mudança de estilo/classe
// a cada quadro (e quantos filhos eles têm: mudar o pai de 800 elementos custa caro) e (b) o rastro do navegador:
// quanto tempo foi em JavaScript (e em que função), recálculo de estilo, layout, pintura.
// Uso: node causas.js --secao=#sobre [--aparelho=celular-fraco] [--modo=auto|normal|leve] [--pagina=index.html]
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium, args, abrir } = require('./comum');
(async () => {
  const a = args();
  if (!a.secao) { console.log('falta --secao=<seletor>, ex.: --secao=#faq'); process.exit(1); }
  const b = await chromium.launch();
  const { ctx, page, ap, erros } = await abrir(b, a.aparelho || 'celular-fraco', a.base + '/' + (a.pagina || 'index.html'), { modo: a.modo || 'auto', espera: 3000 });
  const y0 = await page.evaluate((s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top + scrollY : null; }, a.secao);
  if (y0 === null) { console.log('seção não encontrada: ' + a.secao); process.exit(1); }
  await page.evaluate((y) => scrollTo(0, Math.max(0, y)), y0 - ap.h * 0.6); await page.waitForTimeout(1500);
  await page.evaluate(() => {
    window.__m = new Map();
    window.__mo = new MutationObserver((ms) => ms.forEach((m) => { const t = m.target;
      const n = (t.tagName || '').toLowerCase() + (t.id ? '#' + t.id : '') + (typeof t.className === 'string' && t.className ? '.' + t.className.split(' ').slice(0, 2).join('.') : '') + ' [' + m.attributeName + '] filhos:' + (t.getElementsByTagName ? t.getElementsByTagName('*').length : 0);
      window.__m.set(n, (window.__m.get(n) || 0) + 1); }));
    window.__mo.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['style', 'class', 'd', 'transform'] });
  });
  const arq = path.join(os.tmpdir(), 'rastro-' + process.pid + '.json');
  await b.startTracing(page, { path: arq, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink'] });
  await page.mouse.move(ap.w / 2, ap.h / 2);
  for (let i = 0; i < 35; i++) { await page.mouse.wheel(0, 40); await page.waitForTimeout(16); }
  await page.waitForTimeout(1200);
  await b.stopTracing();
  const muts = await page.evaluate(() => { window.__mo.disconnect(); return [...window.__m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 12); });
  console.log(`== ${a.secao} em ${a.aparelho || 'celular-fraco'}${erros.length ? ' | ERROS: ' + erros.join(' || ') : ''}`);
  console.log('\nElementos mudados durante ~35 quadros de rolagem (vezes | elemento [atributo] filhos):');
  muts.forEach(([k, v]) => console.log('  ' + String(v).padStart(4) + '  ' + k));
  const d = JSON.parse(fs.readFileSync(arq, 'utf8')); fs.unlinkSync(arq);
  const ev = d.traceEvents || d;
  const thr = new Map(ev.filter((e) => e.ph === 'M' && e.name === 'thread_name').map((e) => [e.pid + ':' + e.tid, e.args.name]));
  const quer = new Set(['FunctionCall', 'UpdateLayoutTree', 'Layout', 'Paint', 'PrePaint', 'Layerize', 'Commit', 'RasterTask', 'HitTest', 'EventDispatch', 'FireAnimationFrame', 'GLES2::ReadPixels']);
  const tot = new Map(), fn = new Map();
  for (const e of ev) {
    if (e.ph !== 'X' || !quer.has(e.name)) continue;
    const k = (thr.get(e.pid + ':' + e.tid) || '?').slice(0, 14) + ' ' + e.name; tot.set(k, (tot.get(k) || 0) + (e.dur || 0));
    if (e.name === 'FunctionCall') { const x = (e.args && e.args.data) || {}; const f = (x.functionName || '(anônima)') + ' ' + String(x.url || '').split('/').pop() + ':' + x.lineNumber; fn.set(f, (fn.get(f) || 0) + (e.dur || 0)); }
  }
  console.log('\nTempo por tipo de trabalho:');
  [...tot.entries()].sort((x, y) => y[1] - x[1]).slice(0, 10).forEach(([k, v]) => console.log('  ' + String(Math.round(v / 1000)).padStart(6) + 'ms  ' + k));
  console.log('\nFunções JavaScript mais caras:');
  [...fn.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8).forEach(([k, v]) => console.log('  ' + String(Math.round(v / 1000)).padStart(6) + 'ms  ' + k));
  console.log('\nLeitura: UpdateLayoutTree alto + um elemento com muitos filhos mudando = variável/estilo mudado no pai a cada quadro.'
    + '\nLayout alto = algo anima top/left/width/height (troque por transform). Paint alto = sombra/filtro/degradê animado.'
    + '\nGLES2::ReadPixels = canvas WebGL sem placa de vídeo (só no navegador de teste; aparelho sem placa já cai no modo leve).');
  await ctx.close(); await b.close();
})();
