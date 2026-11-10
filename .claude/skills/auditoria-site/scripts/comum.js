// Peças comuns dos scripts da auditoria: perfis de aparelho, abrir página, rolar como uma pessoa.
const { chromium } = require('playwright');

// Aparelhos simulados. cpu = quantas vezes mais lento que o computador do teste (1 = bom, 3 = médio, 6 = fraco).
// toque = tela de toque (celular/tablet): o site recebe eventos de toque e "pointer: coarse".
const APARELHOS = {
  'celular-bom':    { w: 390,  h: 844,  cpu: 1, toque: true },
  'celular-medio':  { w: 390,  h: 844,  cpu: 3, toque: true },
  'celular-fraco':  { w: 360,  h: 780,  cpu: 6, toque: true },
  'celular-deitado':{ w: 844,  h: 390,  cpu: 3, toque: true },
  'tablet-bom':     { w: 820,  h: 1180, cpu: 1, toque: true },
  'tablet-fraco':   { w: 768,  h: 1024, cpu: 6, toque: true },
  'pc-bom':         { w: 1440, h: 900,  cpu: 1, toque: false },
  'pc-medio':       { w: 1366, h: 768,  cpu: 3, toque: false },
  'pc-fraco':       { w: 1366, h: 768,  cpu: 6, toque: false },
  'monitor-grande': { w: 2560, h: 1440, cpu: 1, toque: false },
};

// Tamanhos da varredura de responsividade (do celular pequeno ao monitor grande, com celular deitado).
const TAMANHOS = [[320, 640], [360, 780], [375, 667], [390, 844], [430, 932], [667, 375], [844, 390],
  [768, 1024], [820, 1180], [1024, 768], [1280, 720], [1366, 768], [1440, 900], [1920, 1080], [2560, 1440]];

const args = () => {
  const o = { base: 'http://localhost:8123', _: [] };
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) o[m[1]] = m[2]; else if (a.startsWith('--')) o[a.slice(2)] = true; else o._.push(a);
  }
  return o;
};

const lista = (v, padrao) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : padrao);

// ---------- Modo leve de QUALQUER site ----------
// Cada site liga o "modo leve" (efeitos desligados em aparelho fraco) do seu jeito: classe no <html> com nomes
// diferentes ("leve" no portfólio, "lite" em outros), com ou sem parâmetro na URL para forçar. Os scripts não
// dependem disso: forçam o modo fingindo o aparelho (as mesmas pistas que os sites usam para decidir) e também
// mandam ?leve=0/1 (sites que não conhecem o parâmetro só ignoram). Classe com outro nome: --classe-leve=nome
// ou AUD_CLASSE_LEVE=nome. Descubra qual é com descobrir.js.
const CLASSES_LEVE = ['leve', 'lite', 'low-power', 'perf-lite', 'reduced-effects', 'is-lite', 'is-low-end'];
const classesLeve = () => {
  const extra = process.env.AUD_CLASSE_LEVE || (process.argv.find((x) => x.startsWith('--classe-leve=')) || '').split('=')[1];
  return extra ? [extra, ...CLASSES_LEVE] : CLASSES_LEVE;
};

// Script que roda antes do site, fingindo o aparelho. 'normal': placa de vídeo de verdade (o navegador de teste
// não tem e todo site que olha a placa cairia no leve), memória e núcleos de sobra, sem economia de dados nem
// bateria baixa. 'leve': pouca memória, 2 núcleos, economia de dados.
function fingirAparelho(modo) {
  return (m) => {
    const def = (o, k, v) => { try { Object.defineProperty(o, k, { get: () => v, configurable: true }); } catch (e) {} };
    if (m === 'normal') {
      for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
        if (!C) continue; const g = C.prototype.getParameter;
        C.prototype.getParameter = function (k) { return (k === 0x9246 || k === 0x1F01) ? 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)' : (k === 0x9245 || k === 0x1F00) ? 'Google Inc. (NVIDIA)' : g.call(this, k); };
      }
      // "placa de vídeo de verdade?" (failIfMajorPerformanceCaveat): sem placa, o navegador de teste diria que não
      const gc = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (t, o) { if (o && o.failIfMajorPerformanceCaveat) o = Object.assign({}, o, { failIfMajorPerformanceCaveat: false }); return gc.call(this, t, o); };
      def(Navigator.prototype, 'deviceMemory', 8); def(Navigator.prototype, 'hardwareConcurrency', 8);
      def(Navigator.prototype, 'getBattery', undefined);
      if (navigator.connection) { def(navigator.connection, 'saveData', false); def(navigator.connection, 'effectiveType', '4g'); }
    } else if (m === 'leve') {
      def(Navigator.prototype, 'deviceMemory', 1); def(Navigator.prototype, 'hardwareConcurrency', 2);
      if (navigator.connection) def(navigator.connection, 'saveData', true);
    }
  };
}
async function prepararModo(page, modo) { if (modo === 'normal' || modo === 'leve') await page.addInitScript(fingirAparelho(modo), modo); }
const urlModo = (url, modo) => { const q = modo === 'normal' ? 'leve=0' : modo === 'leve' ? 'leve=1' : ''; return q ? url + (url.includes('?') ? '&' : '?') + q : url; };

// Abre um aparelho. modo: 'auto' (o site decide sozinho), 'normal' (força todos os efeitos) ou 'leve' (força o
// modo leve). Veja fingirAparelho acima.
async function abrir(browser, nome, url, { modo = 'auto', espera = 2500, init } = {}) {
  const ap = APARELHOS[nome];
  if (!ap) throw new Error('aparelho desconhecido: ' + nome + ' (use: ' + Object.keys(APARELHOS).join(', ') + ')');
  const ctx = await browser.newContext({ viewport: { width: ap.w, height: ap.h }, ...(ap.toque ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  const erros = [], falhas = [];
  page.on('pageerror', (e) => erros.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => {
    const t = (r.failure() || {}).errorText || '';
    // vídeo baixado em pedaços (range request) aparece como ERR_ABORTED: é normal
    if (/ERR_ABORTED/.test(t) && /\.(mp4|webm)(\?|$)/.test(r.url())) return;
    falhas.push(r.url().split('/').slice(3).join('/') + ' ' + t);
  });
  await prepararModo(page, modo);
  if (init) await page.addInitScript(init);
  if (ap.cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: ap.cpu }); }
  await page.goto(urlModo(url, modo), { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(espera);
  return { ctx, page, ap, erros, falhas };
}

// Rola a página inteira com a roda do mouse, em passos curtos, como uma pessoa.
async function rolarTudo(page, ap, { passo = 40, pausa = 16 } = {}) {
  await page.mouse.move(ap.w / 2, ap.h / 2);
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H - ap.h; y += passo) { await page.mouse.wheel(0, passo); await page.waitForTimeout(pausa); }
}

// Em que modo o site ficou: "leve(motivo)" com o nome da classe que ele usa, ou "normal".
const modoAtual = (page) => page.evaluate((cls) => {
  const h = document.documentElement, c = cls.find((x) => h.classList.contains(x));
  if (!c) return 'normal';
  const motivo = h.dataset.leve || h.dataset.lite || h.getAttribute('data-' + c) || '?';
  return (c === 'leve' ? 'leve' : 'leve[.' + c + ']') + '(' + motivo + ')';
}, classesLeve());

module.exports = { chromium, APARELHOS, TAMANHOS, CLASSES_LEVE, classesLeve, args, lista, abrir, rolarTudo, modoAtual, prepararModo, urlModo, fingirAparelho };
