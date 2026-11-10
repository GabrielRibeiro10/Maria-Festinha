// 5) Teste como cliente: em cada aparelho, faz o que uma pessoa faz e confere se o site responde.
//  - toca/clica em cada link e botão visível da primeira tela e verifica se nada está por cima dele (elemento coberto
//    = toque que não faz nada) e se os links internos (#secao) levam à seção certa;
//  - rola a página inteira e grava quadros para olhar (montagem em --fotos);
//  - nos aparelhos de toque, gira a tela no meio da página e volta (layout, crachá/animações no lugar, sem erro);
//  - volta e avança no histórico.
// Uso: node cliente.js [--pagina=index.html] [--aparelhos=celular-fraco,pc-bom] [--fotos=pasta]
const fs = require('fs'), path = require('path');
const { chromium, args, lista, abrir, modoAtual } = require('./comum');
(async () => {
  const a = args();
  const aparelhos = lista(a.aparelhos, ['celular-fraco', 'celular-bom', 'celular-deitado', 'tablet-bom', 'pc-fraco', 'pc-bom']);
  const pagina = a.pagina || 'index.html';
  if (a.fotos) fs.mkdirSync(a.fotos, { recursive: true });
  const b = await chromium.launch();
  for (const nome of aparelhos) {
    const { ctx, page, ap, erros } = await abrir(b, nome, a.base + '/' + pagina, { espera: 4000 });
    const out = [];
    // a) alvos da primeira tela: algo por cima?
    const alvos = await page.evaluate(() => [...document.querySelectorAll('a, button, [role=button], summary')].filter((el) => {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      return r.width && r.height && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && cs.visibility !== 'hidden' && +cs.opacity > 0.1;
    }).map((el, i) => { el.dataset.qa = i; const r = el.getBoundingClientRect(); return { i, t: (el.textContent.trim() || el.getAttribute('aria-label') || el.tagName).slice(0, 22), x: r.left + r.width / 2, y: r.top + r.height / 2, href: el.getAttribute('href') || '' }; }));
    const cobertos = [];
    for (const al of alvos) {
      const hit = await page.evaluate(({ i, x, y }) => { const el = document.querySelector(`[data-qa="${i}"]`), e = document.elementFromPoint(x, y);
        if (!e) return 'fora';
        if (e === el || el.contains(e)) return 'ok';
        return (e.tagName.toLowerCase() + '.' + String(e.className.baseVal ?? e.className).split(' ')[0]); }, al);
      if (hit !== 'ok' && hit !== 'fora') cobertos.push(`"${al.t}" coberto por ${hit}`);
    }
    out.push(`alvos na 1ª tela: ${alvos.length}, cobertos: ${cobertos.length ? cobertos.join('; ') : 'nenhum'}`);
    // b) links internos levam à seção
    const internos = alvos.filter((x) => /^#[\w-]+$/.test(x.href)).slice(0, 6);
    const errados = [];
    for (const al of internos) {
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(500);
      const el = page.locator(`[data-qa="${al.i}"]`);
      try { if (ap.toque) await el.tap({ timeout: 4000 }); else await el.click({ timeout: 4000 }); } catch (e) { errados.push(`"${al.t}" não clicável (${e.message.split('\n')[0].slice(0, 60)})`); continue; }
      await page.waitForTimeout(2200);
      const d = await page.evaluate((h) => { const t = document.querySelector(h); return t ? Math.round(t.getBoundingClientRect().top) : null; }, al.href);
      if (d === null || Math.abs(d) > ap.h * 0.35) errados.push(`"${al.t}" -> ${al.href} parou a ${d}px da seção`);
    }
    out.push(`links internos testados: ${internos.length}, problemas: ${errados.length ? errados.join('; ') : 'nenhum'}`);
    // c) rola tudo gravando quadros
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(600);
    await page.mouse.move(ap.w / 2, ap.h / 2);
    const H = await page.evaluate(() => document.documentElement.scrollHeight);
    let n = 0;
    for (let y = 0; y < H - ap.h; y += ap.h * 0.45) {
      for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, ap.h * 0.075); await page.waitForTimeout(25); }
      await page.waitForTimeout(500);
      if (a.fotos) await page.screenshot({ path: path.join(a.fotos, `${nome}-${String(n++).padStart(3, '0')}.png`) });
    }
    // d) girar a tela no meio da página (só toque)
    if (ap.toque) {
      await page.evaluate((h) => scrollTo(0, h * 0.4), H); await page.waitForTimeout(1500);
      await page.setViewportSize({ width: ap.h, height: ap.w }); await page.waitForTimeout(2000);
      const sw1 = await page.evaluate(() => document.documentElement.scrollWidth);
      await page.setViewportSize({ width: ap.w, height: ap.h }); await page.waitForTimeout(2000);
      const sw2 = await page.evaluate(() => document.documentElement.scrollWidth);
      out.push(`girar a tela: ${sw1 > ap.h || sw2 > ap.w ? 'ROLAGEM LATERAL depois de girar' : 'ok'}`);
    }
    // e) histórico
    try { await page.goBack({ timeout: 8000 }); await page.goForward({ timeout: 8000 }); await page.waitForTimeout(1500); out.push('voltar/avançar: ok'); }
    catch (e) { out.push('voltar/avançar: ' + e.message.split('\n')[0]); }
    console.log(`\n== ${nome} (${await modoAtual(page)})${erros.length ? ' | ERROS: ' + erros.join(' || ') : ' | sem erros'}`);
    out.forEach((l) => console.log('   ' + l));
    await ctx.close();
  }
  if (a.fotos) console.log('\nquadros em ' + a.fotos + ' (node montagem.js ' + a.fotos + ' para juntar e olhar)');
  await b.close();
})();
