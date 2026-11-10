// MODO LEVE (modelo universal da skill auditoria-site) — detecta aparelho fraco e liga o modo leve sozinho.
// Mesma detecção do portfólio (js/desempenho.js), sem nada específico de um site.
//
// Como instalar num site:
//   1. copie este arquivo para js/modo-leve.js;
//   2. no <head> de TODAS as páginas, ANTES do CSS e sem defer/async: <script src="/js/modo-leve.js"></script>
//      (arquivo do próprio site: a CSP 'self' já libera, não precisa de hash);
//   3. no CSS, escreva o que desliga no modo leve com html.leve (ex.: .leve .brilho { animation: none });
//   4. no JS, confira o modo ao começar cada efeito (document.documentElement.classList.contains('leve')) e pare
//      o efeito quando o modo ligar no meio do uso: document.addEventListener('leve:liga', ...).
//
// O que ele faz (classe "leve" no <html>, motivo em data-leve), antes da primeira pintura:
//   - internet: economia de dados ou 2G                                                        → "dados"
//   - placa de vídeo: sem WebGL, WebGL por software, ou placa conhecida por ser fraca           → "gpu"
//   - processador: teste de ~12 ms (celular fraco faz < 1/5 das contas de um computador comum) → "cpu"
//   - até 2 núcleos ou 2 GB de memória (o Safari esconde esses números: lá vale só a medida)   → "aparelho"
//   O perfil do aparelho fica guardado 30 dias (localStorage): as próximas visitas nem medem de novo.
//   Rede de segurança: se mesmo assim a página ficar abaixo de ~25 quadros por segundo por 4 s seguidos
//   (com a aba à vista, na entrada e enquanto a pessoa rola), liga no meio do uso → "fps" (vale até fechar a aba).
//   Um engasgo isolado não conta; 30 fps fixos (economia de bateria do iPhone) também não.
//
// Para testar: ?leve=1 força o modo leve, ?leve=0 desliga (e não mede), ?leve=info mostra na tela o que foi
// detectado (para conferir num celular de verdade). No console: window.modoLeve.perfil.
(() => {
  const html = document.documentElement;
  const CHAVE = 'modo-leve-perfil-v1', SESSAO = 'modo-leve';
  let force = null;
  try { force = new URLSearchParams(location.search).get('leve'); } catch (e) { /* sem URLSearchParams */ }
  const ss = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } };
  const api = window.modoLeve = { perfil: null, janelas: [], ativo: () => html.classList.contains('leve') };

  const on = (why) => {
    if (html.classList.contains('leve')) return;
    html.classList.add('leve');
    html.dataset.leve = why;
    if (force !== '1') ss(SESSAO, '1');
    // quem precisa parar um efeito no meio do uso escuta este evento
    document.dispatchEvent(new CustomEvent('leve:liga', { detail: why }));
  };
  api.ligar = on;

  // ?leve=info: caixinha com o que foi detectado (montada quando o <body> existir)
  if (force === 'info') {
    const caixa = () => {
      const box = document.createElement('div');
      box.setAttribute('role', 'status');
      box.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;padding:10px 12px;border-radius:12px;' +
        'background:rgba(30,24,48,.93);color:#fff;font:12px/1.5 system-ui,sans-serif;white-space:pre-wrap;pointer-events:none';
      const show = () => {
        const p = api.perfil || {}, n = navigator, c = n.connection || {};
        box.textContent = 'Modo: ' + (api.ativo() ? 'LEVE (' + html.dataset.leve + ')' : 'normal') +
          '\nPlaca de vídeo: ' + (p.gpu || '?') + (p.why === 'gpu' ? '  ← fraca/sem aceleração' : '') +
          '\nProcessador (teste): ' + (p.cpu || '?') + ' (fraco < 350)' +
          '\nMemória: ' + (n.deviceMemory ? n.deviceMemory + ' GB' : 'não informada') + ' · núcleos: ' + (n.hardwareConcurrency || '?') +
          ' · economia de dados: ' + (c.saveData ? 'sim' : 'não') +
          '\nFluidez (mediana por janela de 2 s, lento > 40 ms): ' + (api.janelas.length ? api.janelas.join(', ') + ' ms' : 'role a página para medir');
      };
      document.body.appendChild(box); show(); setInterval(show, 1000);
    };
    if (document.body) caixa(); else document.addEventListener('DOMContentLoaded', caixa);
  }

  if (force === '0') { ss(SESSAO, '0'); return; }

  // Perfil do aparelho (placa de vídeo + processador + memória): é do aparelho, não da visita.
  const perfil = () => {
    try { const p = JSON.parse(localStorage.getItem(CHAVE)); if (p && Date.now() - p.t < 2592e6) return p; } catch (e) { /* sem storage */ }
    const p = { t: Date.now(), gpu: '', cpu: 0, why: '' };
    try {
      const cv = document.createElement('canvas');
      const gl = cv.getContext('webgl', { failIfMajorPerformanceCaveat: true });
      if (!gl) p.why = 'gpu';
      else {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        p.gpu = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
        if (/swiftshader|llvmpipe|softpipe|software|basic render|gdi generic|mali-[2-4]\d\d|mali-t[0-8]\d\d|mali-g[35]1\b|adreno\D*([1-4]\d\d|50\d)\b|powervr sgx|ge8\d{3}|videocore|\bgma\b|hd graphics( family)?\b(?! \d)|hd graphics [2-4]\d{3}\b/i.test(p.gpu)) p.why = 'gpu';
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
    } catch (e) { p.why = 'gpu'; }
    // processador: quanta conta cabe em 3 ms, 4 vezes, valendo a melhor. Computador comum ≈ 1500+, celular fraco < 350.
    const bench = () => {
      const a = new Float64Array(256);
      let x = 0, best = 0;
      for (let w = 0; w < 4; w++) {
        let n = 0;
        const end = performance.now() + 3;
        do { for (let i = 0; i < 200; i++) a[i & 255] = x = (x + Math.sqrt(n + i) * 1.0001) % 1e6; n += 200; }
        while (performance.now() < end && n < 4e5);
        if (n > best) best = n;
      }
      return Math.round(best / 100) + (a[7] < 0 ? 1 : 0);
    };
    p.cpu = bench();
    if (p.cpu < 350) p.cpu = Math.max(p.cpu, bench());   // confirma antes de concluir que é fraco
    const apple = /apple/i.test(p.gpu);
    const cores = navigator.hardwareConcurrency || 8, mem = navigator.deviceMemory || 8;
    if (!p.why && p.cpu < 350) p.why = 'cpu';
    if (!p.why && !apple && (cores <= 2 || mem <= 2)) p.why = 'aparelho';
    try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch (e) { /* sem storage */ }
    return p;
  };

  const c = navigator.connection || {};
  if (force === '1') on('forçado');
  else if (ss(SESSAO) === '1') on('sessão');
  else if (c.saveData || /(^|-)2g$/.test(c.effectiveType || '')) on('dados');
  if (!api.perfil) { api.perfil = perfil(); if (!api.ativo() && api.perfil.why) on(api.perfil.why); }
  if (api.ativo() || ss(SESSAO) === '0') return;

  // Rede de segurança: janelas de 2 s; liga se duas seguidas tiverem a mediana acima de 40 ms (< 25 fps).
  let frames = [], spent = 0, bad = 0, last = 0, raf = 0, until = 0;
  const tick = (t) => {
    raf = 0;
    const dt = last ? t - last : 0;
    last = t;
    if (dt > 0 && dt < 250 && document.visibilityState === 'visible') { frames.push(dt); spent += dt; }
    if (spent >= 2000) {
      frames.sort((a, b) => a - b);
      const med = frames[frames.length >> 1];
      api.janelas.push(Math.round(med)); if (api.janelas.length > 6) api.janelas.shift();
      bad = med > 40 ? bad + 1 : 0;
      frames = []; spent = 0;
      if (bad >= 2) { on('fps'); removeEventListener('scroll', onScroll); return; }
    }
    if (performance.now() < until) raf = requestAnimationFrame(tick);
    else last = 0;
  };
  const watch = (ms) => { until = Math.max(until, performance.now() + ms); if (!raf) raf = requestAnimationFrame(tick); };
  const onScroll = () => watch(300);
  addEventListener('load', () => setTimeout(() => watch(4200), 2600), { once: true });   // depois da entrada da página
  addEventListener('scroll', onScroll, { passive: true });
})();
