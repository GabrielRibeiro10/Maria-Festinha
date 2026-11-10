// 0) Descobrir o site (rode PRIMEIRO, em qualquer site): como ele liga o modo leve e quais efeitos ele usa.
//  - modo leve: abre o site fingindo um aparelho bom e um fraco e compara as classes do <html> (a que só aparece no
//    fraco é a classe de modo leve); confere também se ?leve=1 sozinho força o modo;
//  - efeitos: rola a página inteira (no modo normal, computador e celular) e lista o que roda: animações presas à
//    rolagem (GSAP ScrollTrigger), rolagem suave, 3D/WebGL, canvas, vídeo, mapas/iframes, vidro fosco, desfoque,
//    máscara, mistura de cores, animações infinitas, texto letra a letra, 3D em CSS, elementos fixos ao rolar;
//  - compara com a base de conhecimento (conhecimento/efeitos.md): efeito que NÃO está lá aparece como NOVO. Efeito
//    novo = medir (desempenho.js/pesados.js), decidir como ele fica no modo leve e documentar em efeitos.md.
// Uso: node descobrir.js [--pagina=index.html] [--base=http://localhost:8123]
const fs = require('fs'), path = require('path');
const { chromium, args, prepararModo, urlModo, CLASSES_LEVE } = require('./comum');

// Cada efeito tem um id; o mesmo id marca a ficha dele em conhecimento/efeitos.md (<!-- efeito: id -->).
const NOMES = {
  'scroll-scrub': 'animações presas à rolagem (ScrollTrigger com scrub)',
  'scroll-pin': 'seção presa na tela enquanto rola (ScrollTrigger pin)',
  'rolagem-suave': 'rolagem suave (Lenis/Locomotive)',
  'webgl-3d': '3D/WebGL (three.js ou canvas webgl)',
  'canvas': 'canvas 2D animado',
  'sequencia-quadros': 'sequência de quadros (muitas imagens trocadas pela rolagem)',
  'video-fundo': 'vídeo de fundo (autoplay, mudo, em loop)',
  'iframe-externo': 'iframe de outro site (mapa, vídeo, widget)',
  'backdrop-filter': 'vidro fosco (backdrop-filter)',
  'filter-blur': 'desfoque (filter: blur)',
  'mask': 'máscara (mask-image)',
  'mix-blend': 'mistura de cores (mix-blend-mode)',
  'animacao-infinita': 'animações CSS em loop infinito',
  'texto-letra-a-letra': 'texto quebrado em letras/palavras animadas',
  'css-3d': '3D em CSS (preserve-3d / perspectiva)',
  'sticky': 'elementos fixos ao rolar (position: sticky)',
  'muitas-camadas': 'muitas camadas (will-change em dezenas de elementos)',
};

const inventario = () => {
  const ef = {}; const add = (id, n, ex) => { const e = ef[id] || (ef[id] = { n: 0, ex: [] }); e.n += n; if (ex && e.ex.length < 3 && !e.ex.includes(ex)) e.ex.push(ex); };
  const nome = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : '');
  const ST = window.ScrollTrigger;
  if (ST && ST.getAll) {
    const all = ST.getAll();
    const sc = all.filter((t) => t.vars && (t.vars.scrub || t.vars.onUpdate)); if (sc.length) add('scroll-scrub', sc.length, sc.length + ' de ' + all.length + ' gatilhos');
    const pn = all.filter((t) => t.vars && t.vars.pin); if (pn.length) add('scroll-pin', pn.length);
  }
  if (window.Lenis || window.lenis || window.LocomotiveScroll || /\b(lenis|has-scroll-smooth)\b/.test(document.documentElement.className)) add('rolagem-suave', 1);
  if (window.THREE) add('webgl-3d', 1, 'three.js');
  for (const c of document.querySelectorAll('canvas')) {
    const r = c.getBoundingClientRect(); if (r.width * r.height < 5000) continue;
    // tipo registrado quando o próprio site criou o contexto (ver abre): chamar getContext aqui "roubaria" o canvas
    const t = c.dataset.audCtx || '';
    add(/webgl/.test(t) ? 'webgl-3d' : 'canvas', 1, nome(c) + (t ? ' (' + t + ')' : ''));
  }
  const imgs = performance.getEntriesByType('resource').filter((e) => /\.(webp|jpe?g|png|avif)(\?|$)/.test(e.name));
  const porPasta = {}; for (const e of imgs) { const d = e.name.split('?')[0].replace(/[^/]+$/, ''); porPasta[d] = (porPasta[d] || 0) + 1; }
  for (const [d, n] of Object.entries(porPasta)) if (n >= 40) add('sequencia-quadros', n, n + ' imagens em ' + d.split('/').slice(-2).join('/'));
  for (const v of document.querySelectorAll('video')) if (v.autoplay || v.loop || v.muted) add('video-fundo', 1, nome(v));
  for (const f of document.querySelectorAll('iframe')) { const src = f.src || f.dataset.src || ''; if (src) add('iframe-externo', 1, src.split('/')[2] || src.slice(0, 40)); }
  let wc = 0;
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    for (const ps of [null, '::before', '::after']) {
      const cs = getComputedStyle(el, ps); if (ps && cs.content === 'none') continue;
      if (cs.backdropFilter && cs.backdropFilter !== 'none') add('backdrop-filter', 1, nome(el) + (ps || ''));
      if (/blur\(/.test(cs.filter)) add('filter-blur', 1, nome(el) + (ps || ''));
      if ((cs.maskImage || cs.webkitMaskImage || 'none') !== 'none') add('mask', 1, nome(el) + (ps || ''));
      if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') add('mix-blend', 1, nome(el) + (ps || ''));
      if (!ps && cs.transformStyle === 'preserve-3d') add('css-3d', 1, nome(el));
      if (!ps && cs.position === 'sticky') add('sticky', 1, nome(el));
      if (!ps && cs.willChange !== 'auto') wc++;
    }
    // texto quebrado: pai com 8+ filhos <span> de 1 caractere
    if (el.children.length >= 8 && [...el.children].filter((c) => c.tagName === 'SPAN' && c.textContent.length <= 2).length >= 8) add('texto-letra-a-letra', 1, nome(el));
  }
  if (wc >= 25) add('muitas-camadas', wc, wc + ' elementos com will-change');
  const inf = document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().iterations === Infinity && a.playState === 'running');
  if (inf.length) add('animacao-infinita', inf.length, [...new Set(inf.map((a) => (a.animationName || '?') + ' em ' + (a.effect.target ? nome(a.effect.target) : '?')))].slice(0, 3).join('; '));
  return ef;
};

(async () => {
  const a = args(); const raiz = a.raiz || process.cwd(); const pagina = a.pagina || 'index.html';
  const url = a.base + '/' + pagina;
  const b = await chromium.launch();
  const abre = async (w, h, modo, soParametro) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, ...(w < 900 ? { isMobile: true, hasTouch: true } : {}) });
    const p = await ctx.newPage(); await prepararModo(p, soParametro ? 'normal' : modo);   // parâmetro: aparelho bom + ?leve=1
    await p.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (t, o) { try { if (!this.dataset.audCtx) this.dataset.audCtx = t; } catch (e) {} return g.call(this, t, o); }; });
    await p.goto(soParametro ? url + '?leve=1' : urlModo(url, modo), { waitUntil: 'load', timeout: 90000 });
    // classes logo ao carregar: alguns sites ligam o modo leve depois, medindo a fluidez, e o navegador de teste
    // (sem placa de vídeo, com outras abas abertas) cai nisso mesmo fingindo um aparelho bom
    const cedo = await p.evaluate(() => [...document.documentElement.classList]);
    await p.waitForLoadState('networkidle').catch(() => {}); await p.waitForTimeout(3000);
    return { ctx, p, cedo };
  };
  const classes = async (p) => p.evaluate(() => [...document.documentElement.classList]);

  console.log('== Site: ' + raiz);
  const pags = fs.readdirSync(raiz).filter((f) => f.endsWith('.html'));
  console.log('páginas: ' + pags.join(', '));
  console.log('hospedagem: ' + (fs.existsSync(path.join(raiz, 'vercel.json')) ? 'Vercel (vercel.json)' : fs.existsSync(path.join(raiz, 'netlify.toml')) || fs.existsSync(path.join(raiz, '_headers')) ? 'Netlify' : 'não identificada (sem vercel.json)')
    + ' | 404 própria: ' + (fs.existsSync(path.join(raiz, '404.html')) ? 'sim' : 'NÃO'));

  // ---- modo leve ----
  const n = await abre(1366, 768, 'normal'), l = await abre(1366, 768, 'leve'), q = await abre(1366, 768, 'normal', true);
  const cn = n.cedo, cl = [...new Set([...l.cedo, ...await classes(l.p)])], cq = q.cedo;
  const cnDepois = await classes(n.p);
  const so = cl.filter((c) => !cn.includes(c));
  const conhecida = so.find((c) => CLASSES_LEVE.includes(c));
  const doLeve = conhecida || so[0];
  console.log('\n-- modo leve');
  if (!so.length) console.log('NÃO encontrado: fingindo um aparelho fraco, nenhuma classe nova apareceu no <html>. O site provavelmente não tem modo leve:\n   em aparelho fraco ele roda todos os efeitos. Proponha ao dono criar um (passo 3b.5).');
  else {
    const motivo = await l.p.evaluate((c) => { const h = document.documentElement; return h.dataset.leve || h.dataset.lite || h.getAttribute('data-' + c) || ''; }, doLeve);
    console.log(`classe do modo leve: "${doLeve}"${motivo ? ' (motivo registrado: ' + motivo + ')' : ''}${so.length > 1 ? ' | outras classes que mudaram: ' + so.filter((c) => c !== doLeve).join(', ') : ''}`);
    if (!CLASSES_LEVE.includes(doLeve)) console.log(`   nome fora do padrão: rode os outros scripts com --classe-leve=${doLeve} (ou AUD_CLASSE_LEVE=${doLeve}) e acrescente o nome em CLASSES_LEVE no comum.js`);
    console.log(`?leve=1 na URL força o modo leve: ${cq.includes(doLeve) ? 'sim' : 'não (os scripts forçam fingindo o aparelho; funciona igual)'}`);
    if (cnDepois.includes(doLeve)) {
      const mot = await n.p.evaluate((c) => { const h = document.documentElement; return h.dataset.leve || h.dataset.lite || h.getAttribute('data-' + c) || '?'; }, doLeve);
      console.log(`?? fingindo um aparelho bom, o site entrou no modo leve DEPOIS de abrir (motivo: ${mot}). Se o motivo for fluidez`
        + ' (fps/rolagem), é o navegador de teste sem placa de vídeo: as medições "--modo=normal" podem acabar no modo leve.\n   Confira o modo na linha "==" de cada resultado do desempenho.js antes de comparar números.');
    }
  }
  for (const x of [n, l, q]) await x.ctx.close();

  // ---- efeitos (modo normal, computador e celular, depois de rolar a página inteira) ----
  const ef = {};
  for (const [w, h] of [[1366, 768], [390, 844]]) {
    const { ctx, p } = await abre(w, h, 'normal');
    const H = await p.evaluate(() => document.documentElement.scrollHeight);
    let parcial = {};
    for (let y = 0; y < H; y += h * 0.7) {
      await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(250);
      const r = await p.evaluate(inventario);
      for (const [id, v] of Object.entries(r)) { const e = parcial[id] || (parcial[id] = { n: 0, ex: [] }); e.n = Math.max(e.n, v.n); for (const x of v.ex) if (e.ex.length < 3 && !e.ex.includes(x)) e.ex.push(x); }
    }
    for (const [id, v] of Object.entries(parcial)) { const e = ef[id] || (ef[id] = { n: 0, ex: [], onde: [] }); e.n = Math.max(e.n, v.n); e.onde.push(w < 900 ? 'celular' : 'PC'); for (const x of v.ex) if (e.ex.length < 3 && !e.ex.includes(x)) e.ex.push(x); }
    await ctx.close();
  }
  await b.close();

  const base = path.join(__dirname, '..', 'conhecimento', 'efeitos.md');
  const doc = fs.existsSync(base) ? fs.readFileSync(base, 'utf8') : '';
  const conhecidos = new Set([...doc.matchAll(/<!--\s*efeito:\s*([\w-]+)\s*-->/g)].map((m) => m[1]));
  console.log('\n-- efeitos encontrados (modo normal)');
  const novos = [];
  for (const [id, v] of Object.entries(ef).sort((x, y) => y[1].n - x[1].n)) {
    const novo = !conhecidos.has(id); if (novo) novos.push(id);
    console.log(`${novo ? 'NOVO ' : '     '}${(NOMES[id] || id).padEnd(62)} x${String(v.n).padEnd(4)} ${[...new Set(v.onde)].join('+').padEnd(11)} ${v.ex.join(' | ')}`);
  }
  if (!Object.keys(ef).length) console.log('nenhum efeito pesado encontrado');
  console.log(novos.length
    ? `\n${novos.length} efeito(s) NOVO(s) para a base: ${novos.join(', ')}.\nMeça cada um (desempenho.js --css / pesados.js), decida como fica no modo leve e grave a ficha em conhecimento/efeitos.md (seção "Aprendizado" do SKILL.md).`
    : '\ntodos os efeitos já têm ficha em conhecimento/efeitos.md: leia as fichas deles antes de medir.');
})();
