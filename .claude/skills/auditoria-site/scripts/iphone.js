// 8) iPhone / iPad (Safari): abre o site no motor do Safari (WebKit) em TODOS os iPhones que o Playwright conhece
// (iPhone 6 ao 17, Mini, Plus, Pro, Pro Max, SE, Air), em pé e deitado, e nos iPads. Em cada um confere sozinho:
//  - erros de JavaScript e arquivos que falharam;
//  - rolagem para o lado (algo vazando da tela);
//  - QUALQUER site: rola a página inteira e confere cada <canvas> e <video> grande: tem que aparecer com conteúdo,
//    não em branco/cinza liso (o Safari esconde canvas e vídeo sem dar erro: limite de memória, 3D, autoplay);
//  - checagens de efeitos conhecidos, só se o site tiver o elemento (exemplos do portfólio: notebook dos Projetos
//    mostra o site e não a tampa cinza; crachá 3D com a foto). Efeito novo com 3D/canvas/vídeo: acrescente aqui.
// As cores são medidas na própria foto da tela (sem depender de olho). Salva as fotos com --fotos para conferir.
// Na 1ª vez da sessão instale o WebKit (ver SKILL.md, passo 5b).
// Uso: PLAYWRIGHT_BROWSERS_PATH=<pasta> node iphone.js [--fotos=pasta] [--aparelhos="iPhone 13 Pro Max,iPhone SE"]
//      [--grupo=iphones|ipads|todos] [--deitado]   (padrão: todos os iPhones em pé)
const fs = require('fs'), path = require('path');
const { webkit, devices } = require('playwright');
const { args, lista } = require('./comum');

// estatística de cor de uma foto PNG, calculada num canvas do próprio WebKit
async function cores(page, png) {
  return page.evaluate(async (b64) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const c = document.createElement('canvas'); const w = c.width = 64, h = c.height = Math.max(1, Math.round(64 * im.height / im.width));
    const x = c.getContext('2d'); x.drawImage(im, 0, 0, w, h); const d = x.getImageData(0, 0, w, h).data;
    let sat = 0, lum = [], n = 0;
    for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i + 1], b = d[i + 2]; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); sat += mx - mn; lum.push(0.3 * r + 0.59 * g + 0.11 * b); n++; }
    const m = lum.reduce((a, b) => a + b, 0) / n, dp = Math.sqrt(lum.reduce((a, b) => a + (b - m) ** 2, 0) / n);
    return { sat: Math.round(sat / n), desvio: Math.round(dp), lum: Math.round(m) };
  }, png.toString('base64'));
}

(async () => {
  const a = args();
  const todos = Object.keys(devices).filter((k) => !/landscape/.test(k));
  const grupo = a.grupo || 'iphones';
  const padrao = todos.filter((k) => (grupo === 'todos' ? /iPhone|iPad/ : grupo === 'ipads' ? /iPad/ : /iPhone/).test(k));
  const nomes = lista(a.aparelhos, padrao);
  if (a.fotos) fs.mkdirSync(a.fotos, { recursive: true });
  const ruins = [];
  for (const nome of nomes) for (const deitado of a.deitado ? [false, true] : [false]) {
    const base = devices[nome + (deitado ? ' landscape' : '')] || devices[nome];
    if (!base) { console.log('?? aparelho desconhecido: ' + nome); continue; }
    // um navegador novo por aparelho: dezenas de aparelhos no mesmo navegador estouram a memória do container
    const b = await webkit.launch();
    const ctx = await b.newContext({ ...base }); const p = await ctx.newPage();
    const erros = [], falhas = [];
    p.on('pageerror', (e) => erros.push(e.message));
    p.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
    p.on('requestfailed', (r) => { const t = (r.failure() || {}).errorText || ''; if (!/\.(mp4|webm)/.test(r.url()) && !/cancel/i.test(t)) falhas.push(r.url().split('/').pop() + ' ' + t); });
    const tag = (nome + (deitado ? ' deitado' : '')).replace(/[^\w]+/g, '-');
    const prob = [];
    try {
      await p.goto(a.base + '/' + (a.pagina || 'index.html'), { waitUntil: 'networkidle', timeout: 90000 });
      await p.waitForTimeout(3500);
      const vw = base.viewport.width, sw = await p.evaluate(() => document.documentElement.scrollWidth);
      if (sw > vw) prob.push(`rolagem lateral (${sw}px numa tela de ${vw}px)`);
      // notebook
      if (await p.$('.pj')) {
        // rola até o notebook (em tela pequena ele fica mais abaixo da seção e só abre quando aparece)
        await p.evaluate(() => { const l = document.querySelector('.pj-slide .laptop') || document.querySelector('.pj'); const r = l.getBoundingClientRect(); scrollTo(0, r.top + scrollY - Math.max(20, (innerHeight - r.height) / 2)); });
        await p.waitForTimeout(5500);
        const tela = await p.$('.pj-slide.is-active .lp-screen');
        if (!tela) prob.push('notebook: tela não encontrada');
        else {
          const png = await tela.screenshot(); if (a.fotos) fs.writeFileSync(path.join(a.fotos, `${tag}-notebook.png`), png);
          const c = await cores(p, png);
          // tampa cinza: quase sem cor e uniforme. Site: cores e contraste
          if (c.sat < 18 && c.desvio < 22) prob.push(`notebook cinza (sem o site): saturação ${c.sat}, contraste ${c.desvio}`);
        }
      }
      // crachá
      if (await p.$('.about-me')) {
        await p.evaluate(() => scrollTo(0, document.querySelector('.about-me').getBoundingClientRect().top + scrollY - 40));
        await p.waitForTimeout(6500);
        const st = await p.evaluate(() => {
          const ab = document.querySelector('.about'), cv = document.querySelector('.cracha-canvas'), ly = document.querySelector('.lanyard');
          const fig = document.querySelector('.cracha'); const r = (cv || fig).getBoundingClientRect();
          return { modo: ab.className, canvas: !!cv, desenhado: !!ly, vis: cv ? cv.style.visibility !== 'hidden' : true, box: [r.left, r.top, r.width, r.height] };
        });
        if (!st.canvas && !st.desenhado) prob.push('crachá não montou (nem 3D nem desenhado)');
        // foto do cartão: recorta a região do cartão e mede o contraste (cartão em branco = sem foto)
        const card = await p.evaluate(() => {
          const el = document.querySelector('.cracha-canvas') ? null : document.querySelector('.cracha img');
          if (el) { const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }
          return null;
        });
        let clip;
        if (card) clip = { x: Math.max(0, card[0]), y: Math.max(0, card[1]), width: Math.max(10, card[2]), height: Math.max(10, card[3]) };
        else { const s = await (await p.$('.cracha-slot')).boundingBox(); clip = { x: Math.max(0, s.x), y: Math.max(0, s.y - 40), width: Math.min(base.viewport.width - Math.max(0, s.x), s.width), height: Math.min(420, base.viewport.height - Math.max(0, s.y - 40)) }; }
        const png = await p.screenshot({ clip }); if (a.fotos) fs.writeFileSync(path.join(a.fotos, `${tag}-cracha.png`), png);
        const c = await cores(p, png);
        if (c.desvio < 25) prob.push(`crachá sem foto (região quase lisa: contraste ${c.desvio})`);
      }
      // canvas e vídeos de qualquer site: rola até cada um e mede a foto (lisa demais = em branco)
      const midias = await p.evaluate(() => [...document.querySelectorAll('canvas, video')].map((el, i) => {
        el.dataset.audMidia = i; const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return { i, tag: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''), area: r.width * r.height, vis: cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 };
      }).filter((m) => m.vis && m.area >= 20000).slice(0, 6));
      for (const m of midias) {
        await p.evaluate((i) => { const el = document.querySelector('[data-aud-midia="' + i + '"]'); const r = el.getBoundingClientRect(); scrollTo(0, r.top + scrollY - Math.max(0, (innerHeight - r.height) / 2)); }, m.i);
        await p.waitForTimeout(2500);
        const el = await p.$('[data-aud-midia="' + m.i + '"]'); const box = el && await el.boundingBox();
        if (!box || box.width < 10 || box.height < 10) continue;
        const vw2 = base.viewport.width, vh2 = base.viewport.height;
        const clip = { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(box.width, vw2 - Math.max(0, box.x)), height: Math.min(box.height, vh2 - Math.max(0, box.y)) };
        if (clip.width < 10 || clip.height < 10) continue;
        const png = await p.screenshot({ clip }); if (a.fotos) fs.writeFileSync(path.join(a.fotos, `${tag}-${m.tag.replace(/[^\w]+/g, '-')}.png`), png);
        const c = await cores(p, png);
        if (c.desvio < 5 && c.sat < 12) prob.push(`${m.tag} em branco/liso (contraste ${c.desvio}): o Safari pode não estar desenhando`);
      }
    } catch (e) { prob.push('não terminou: ' + e.message.split('\n')[0]); }
    if (erros.length) prob.push('ERROS: ' + erros.slice(0, 3).join(' || '));
    if (falhas.length) prob.push('FALHAS: ' + falhas.slice(0, 3).join(' || '));
    console.log(`${prob.length ? '!!' : 'ok'} ${(nome + (deitado ? ' (deitado)' : '')).padEnd(30)} ${prob.join(' | ')}`);
    if (prob.length) ruins.push(nome);
    await ctx.close(); await b.close();
  }
  console.log(ruins.length ? `\n${ruins.length} aparelho(s) com problema: ${[...new Set(ruins)].join(', ')}` : `\nok em todos os ${nomes.length} aparelhos`);
  if (a.fotos) console.log(`fotos em ${a.fotos} (node montagem.js ${a.fotos} para juntar e olhar)`);
  process.exit(ruins.length ? 1 : 0);
})();
