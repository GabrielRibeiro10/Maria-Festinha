// 1) Erros e rede: cada página em cada aparelho, rolando até o fim (o que carrega tarde também entra).
// Uso: node erros.js [--paginas=index.html,termos.html] [--aparelhos=celular-fraco,pc-bom] [--base=http://localhost:8123]
const fs = require('fs');
const { chromium, args, lista, abrir, modoAtual } = require('./comum');
(async () => {
  const a = args();
  const raiz = a.raiz || process.cwd();
  const paginas = lista(a.paginas, fs.readdirSync(raiz).filter((f) => f.endsWith('.html')).sort());
  const aparelhos = lista(a.aparelhos, ['celular-fraco', 'celular-bom', 'tablet-bom', 'pc-fraco', 'pc-bom']);
  const b = await chromium.launch();
  let problemas = 0;
  for (const pg of paginas) for (const nome of aparelhos) {
    const { ctx, page, ap, erros, falhas } = await abrir(b, nome, a.base + '/' + pg, { espera: 1500 });
    const H = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < H; y += ap.h * 0.8) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(150); }
    await page.waitForTimeout(1500);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    // peso: tudo que a página baixou (lista do próprio navegador); arquivos > 400 KB aparecem pelo nome
    const [bytes, grandes] = await page.evaluate(() => { const r = performance.getEntriesByType('resource').concat(performance.getEntriesByType('navigation'));
      const tam = (e) => e.encodedBodySize || e.transferSize || 0;
      return [r.reduce((s, e) => s + tam(e), 0), r.filter((e) => tam(e) > 400e3).map((e) => e.name.split('/').pop() + ' ' + Math.round(tam(e) / 1024) + 'KB')]; });
    const ruim = erros.length || falhas.length || sw > ap.w;
    if (ruim) problemas++;
    console.log(`${ruim ? '!!' : 'ok'} ${pg} ${nome} (${await modoAtual(page)}) | rolagem lateral: ${sw > ap.w ? 'SIM ' + sw + 'px' : 'não'}`
      + ` | peso ~${Math.round(bytes / 1024)}KB${grandes.length ? ' (grandes: ' + grandes.join(', ') + ')' : ''}`
      + (erros.length ? '\n     ERROS: ' + erros.join(' || ') : '') + (falhas.length ? '\n     FALHAS: ' + falhas.join(' || ') : ''));
    await ctx.close();
  }
  console.log(problemas ? `\n${problemas} combinação(ões) com problema` : '\nsem erros, falhas ou rolagem lateral');
  await b.close();
})();
