// 7) Efeitos pesados para a PLACA DE VÍDEO (GPU), que o navegador de teste não consegue medir (ele não tem placa de
// vídeo: o custo de desfoque/máscara/mistura aparece diferente). Num celular fraco de verdade são justamente esses que
// travam a rolagem. Lista cada elemento visível com: backdrop-filter, filter com blur, mask-image, mix-blend-mode,
// box-shadow com desfoque grande, e se ele continua ligado no modo leve.
// Uso: node pesados.js [--pagina=index.html] [--largura=390]
const { chromium, args, prepararModo, urlModo, classesLeve } = require('./comum');
(async () => {
  const a = args(); const w = +(a.largura || 390), h = 844;
  const b = await chromium.launch();
  const coleta = async (modo) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, ...(w < 1024 ? { isMobile: true, hasTouch: true } : {}) });
    const p = await ctx.newPage();
    await prepararModo(p, modo);
    await p.goto(urlModo(a.base + '/' + (a.pagina || 'index.html'), modo), { waitUntil: 'networkidle', timeout: 90000 });
    const H = await p.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < H; y += h) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(80); }
    await p.waitForTimeout(1500);
    const cls = await p.evaluate((c) => c.find((x) => document.documentElement.classList.contains(x)) || '', classesLeve());
    if ((modo === 'leve') !== !!cls) console.log(`?? pedi o modo ${modo} e o site ficou ${cls ? 'leve (.' + cls + ')' : 'normal'}: veja descobrir.js / --classe-leve`);
    const r = await p.evaluate(() => {
      const out = [];
      const nome = (el, ps) => {
        let s = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + ((el.className && (el.className.baseVal ?? el.className)) ? '.' + String(el.className.baseVal ?? el.className).trim().split(/\s+/).slice(0, 2).join('.') : '');
        const sec = el.closest('[id]'); if (sec && sec !== el) s += '  (em #' + sec.id + ')';
        return s + (ps || '');
      };
      const maxBlur = (sh) => Math.max(0, ...[...sh.matchAll(/(-?\d+\.?\d*)px\s+(-?\d+\.?\d*)px\s+(\d+\.?\d*)px/g)].map((m) => +m[3]));
      for (const el of document.querySelectorAll('body *')) {
        const rc = el.getBoundingClientRect(); if (!rc.width || !rc.height) continue;
        for (const ps of ['', '::before', '::after']) {
          const cs = getComputedStyle(el, ps || null);
          if (ps && cs.content === 'none') continue;
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          const area = Math.round(rc.width * rc.height / 1000);   // mil px² (aprox. da caixa do elemento)
          const tipo = [];
          if (cs.backdropFilter && cs.backdropFilter !== 'none') tipo.push('backdrop-filter ' + cs.backdropFilter);
          if (/blur\(/.test(cs.filter)) tipo.push('filter ' + cs.filter.slice(0, 40));
          if ((cs.maskImage || cs.webkitMaskImage || 'none') !== 'none') tipo.push('mask');
          if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') tipo.push('mix-blend ' + cs.mixBlendMode);
          const sb = maxBlur(cs.boxShadow || ''); if (sb >= 30) tipo.push('box-shadow blur ' + sb + 'px');
          if (tipo.length) out.push({ n: nome(el, ps), t: tipo.join(' + '), area });
        }
      }
      return out;
    });
    await ctx.close(); return r;
  };
  const normal = await coleta('normal'), leve = await coleta('leve');
  const noLeve = new Set(leve.map((x) => x.n + '|' + x.t));
  // agrupa elementos iguais (mesmo nome e efeito): "13x span.tag ..."
  const ag = new Map();
  for (const x of normal) { const k = x.n.replace(/\s+\(em/, ' (em') + '|' + x.t; const g = ag.get(k) || { n: x.n, t: x.t, c: 0, area: 0 }; g.c++; g.area += x.area; ag.set(k, g); }
  const lista = [...ag.values()].sort((x, y) => (noLeve.has(y.n + '|' + y.t) - noLeve.has(x.n + '|' + x.t)) || y.area - x.area);
  console.log(`Efeitos de GPU em ${a.pagina || 'index.html'} (${w}px). "LEVE: liga" = continua no aparelho fraco (prioridade).\n`);
  for (const g of lista) {
    const ativo = noLeve.has(g.n + '|' + g.t);
    const risco = /backdrop-filter/.test(g.t) ? 'ALTO' : /filter blur|mask|mix-blend/.test(g.t) && g.area > 60 ? 'médio' : 'baixo';
    console.log(`${ativo ? '!! LEVE: liga ' : '   LEVE: desl.'} risco ${risco.padEnd(5)} ${String(g.c).padStart(3)}x ~${String(g.area).padStart(5)}k px²  ${g.n}\n${''.padStart(32)}${g.t}`);
  }
  console.log('\nLeitura: backdrop-filter (vidro fosco) em algo que rola junto com a página é o pior caso: a placa refaz o'
    + '\ndesfoque a cada quadro. Troque por fundo semitransparente (visual quase igual). mask/blur/mix-blend grandes:'
    + '\ndesligue no modo leve (classe de modo leve do site no <html>). Sombras grandes paradas custam só na primeira pintura.');
  await b.close();
})();
