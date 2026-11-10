// 4) Responsividade: cada página em 15 tamanhos (320 px a 2560 px, celular deitado incluso). Procura:
// rolagem para o lado, elemento vazando da tela, texto cortado, texto pequeno demais, e (em tela de toque)
// botões/links pequenos demais para o dedo (< 24 px). Tira uma foto de cada tamanho para olhar.
// Uso: node responsivo.js [--paginas=index.html] [--fotos=pasta] [--tamanhos=390x844,1440x900]
const fs = require('fs'), path = require('path');
const { chromium, TAMANHOS, args, lista, prepararModo, urlModo } = require('./comum');
(async () => {
  const a = args(); const raiz = a.raiz || process.cwd();
  const paginas = lista(a.paginas, fs.readdirSync(raiz).filter((f) => f.endsWith('.html')).sort());
  const tamanhos = a.tamanhos ? lista(a.tamanhos).map((s) => s.split('x').map(Number)) : TAMANHOS;
  if (a.fotos) fs.mkdirSync(a.fotos, { recursive: true });
  const b = await chromium.launch(); let ruins = 0;
  for (const pg of paginas) for (const [w, h] of tamanhos) {
    const toque = w < 1024 || h < 500;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, ...(toque ? { isMobile: true, hasTouch: true } : {}) });
    const p = await ctx.newPage();
    await prepararModo(p, 'normal');
    await p.goto(urlModo(a.base + '/' + pg, 'normal'), { waitUntil: 'networkidle', timeout: 90000 });
    const H = await p.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < H; y += h) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(60); }   // faz as entradas acontecerem
    await p.waitForTimeout(2500); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(400);
    const r = await p.evaluate(({ w, toque }) => {
      const vaza = new Set(), cortado = new Set(), pequeno = new Set(), miudo = new Set();
      const vis = (el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05; };
      const nome = (el) => el.tagName.toLowerCase() + ((el.className && (el.className.baseVal ?? el.className)) ? '.' + String(el.className.baseVal ?? el.className).split(' ')[0] : '');
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el); if (cs.position === 'fixed' || !vis(el)) continue;
        const rc = el.getBoundingClientRect(); if (!rc.width) continue;
        if (rc.right > w + 1 || rc.left < -1) {   // vaza, a não ser que um pai corte (overflow) de propósito
          let p = el.parentElement, corta = false;
          while (p && p !== document.body) { if (/(hidden|clip|auto|scroll)/.test(getComputedStyle(p).overflowX)) { corta = true; break; } p = p.parentElement; }
          if (!corta) vaza.add(nome(el));
        }
        if (el.children.length === 0 && el.textContent.trim() && /^(P|H1|H2|H3|H4|LI|SPAN|A|BUTTON|STRONG|EM|LABEL)$/.test(el.tagName)) {
          // cortado = o próprio texto passa da caixa visível (mede o texto, não enfeites como reflexos que saem da borda)
          const rg = document.createRange(); rg.selectNodeContents(el); const tr = rg.getBoundingClientRect();
          if (cs.overflow !== 'visible' && cs.textOverflow !== 'ellipsis' && (tr.right > rc.right + 2 || tr.left < rc.left - 2 || tr.bottom > rc.bottom + 2)) cortado.add(nome(el) + ' "' + el.textContent.trim().slice(0, 24) + '"');
          if (parseFloat(cs.fontSize) < 10.5 && rc.top < document.documentElement.scrollHeight) miudo.add(nome(el) + ' ' + cs.fontSize);
        }
        if (toque && /^(A|BUTTON)$/.test(el.tagName) && el.offsetParent) {
          // mede a área de toque real: o maior entre o elemento e um ::after/::before posicionado em volta dele
          let aw = rc.width, ah = rc.height;
          for (const ps of ['::after', '::before']) { const c = getComputedStyle(el, ps); if (c.content !== 'none' && c.position === 'absolute') {
            const ins = c.inset.split(' ').map(parseFloat); if (!ins.some(isNaN)) { aw = Math.max(aw, rc.width - (ins[1] ?? ins[0]) - (ins[3] ?? ins[1] ?? ins[0])); ah = Math.max(ah, rc.height - ins[0] - (ins[2] ?? ins[0])); } } }
          const dentroDeTexto = el.parentElement && /^(P|LI|TD|SPAN)$/.test(el.parentElement.tagName) && el.parentElement.textContent.trim().length > el.textContent.trim().length + 15;
          if ((aw < 24 || ah < 24) && !dentroDeTexto) pequeno.add('"' + (el.textContent.trim().slice(0, 18) || el.getAttribute('aria-label') || nome(el)) + '" ' + Math.round(aw) + 'x' + Math.round(ah));
        }
      }
      return { sw: document.documentElement.scrollWidth, vaza: [...vaza].slice(0, 6), cortado: [...cortado].slice(0, 6), pequeno: [...pequeno].slice(0, 6), miudo: [...miudo].slice(0, 4) };
    }, { w, toque });
    const ruim = r.sw > w || r.vaza.length || r.cortado.length || r.pequeno.length; if (ruim) ruins++;
    console.log(`${ruim ? '!!' : 'ok'} ${pg.padEnd(18)} ${(w + 'x' + h).padEnd(10)}${r.sw > w ? ' | ROLAGEM LATERAL ' + r.sw + 'px' : ''}`
      + (r.vaza.length ? ' | vaza: ' + r.vaza.join(', ') : '') + (r.cortado.length ? ' | texto cortado: ' + r.cortado.join(', ') : '')
      + (r.pequeno.length ? ' | toque pequeno: ' + r.pequeno.join(', ') : '') + (r.miudo.length ? ' | (texto < 10,5px: ' + r.miudo.join(', ') + ')' : ''));
    if (a.fotos) await p.screenshot({ path: path.join(a.fotos, `${pg.replace('.html', '')}-${w}x${h}.png`), fullPage: true });
    await ctx.close();
  }
  console.log(ruins ? `\n${ruins} combinação(ões) com problema` : '\nresponsividade ok em todas as combinações');
  await b.close();
})();
