(function () {
  'use strict';

  document.documentElement.classList.remove('no-js');

  /* ---------- Recarregar (F5) sempre volta ao topo ----------
     Sem isso o navegador restaura a posição anterior e as animações de
     entrada (cabeçalho, hero, títulos) aparecem já terminadas ou pela metade. */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  // quem já começou a rolar antes deste arquivo carregar (internet lenta) não volta
  // para o topo: era um "reset" no começo da Hero (o <head> marca window.__rolou)
  if (!window.__rolou) window.scrollTo(0, 0);
  // Safari/iOS às vezes ignora o 'manual': zera também ao sair da página
  window.addEventListener('pagehide', function () { window.scrollTo(0, 0); });

  var WHATSAPP = '5512991674881';
  // zoom de pinça (celular ou touchpad): a tela "encolhe" (no Safari o innerWidth muda),
  // mas o layout da página é o mesmo. Nada deve ser recalculado nem rolado sozinho.
  function zoomed() { return !!window.visualViewport && window.visualViewport.scale > 1.01; }
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Modo leve (economia de energia / aparelho fraco) ----------
     Liga sozinho quando: o navegador pede economia de dados; o aparelho tem
     pouca memória/núcleos; a bateria está baixa e fora da tomada; ou a tela
     está rodando abaixo de ~40 FPS (economia de energia do iPhone/Android e
     notebooks na bateria limitam a 30 FPS). O design não muda: só os efeitos
     contínuos ficam mais baratos (brilhos, neon, mistura de frames, desfoques). */
  var perf = { lite: false };
  function goLite(reason) {
    if (perf.lite) return;
    perf.lite = true;
    document.documentElement.classList.add('lite');
    document.documentElement.setAttribute('data-lite', reason);
    window.dispatchEvent(new Event('litechange'));
  }
  (function () {
    var nav = navigator;
    if (nav.connection && nav.connection.saveData) goLite('economia-de-dados');
    if ((nav.deviceMemory && nav.deviceMemory <= 2) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2)) goLite('aparelho-fraco');
    // Sem placa de vídeo (driver genérico do Windows, área de trabalho remota, máquina
    // virtual): o navegador desenha tudo no processador e os efeitos contínuos (brilhos
    // piscando, desfoques) travam a rolagem, mesmo com a página a 60 FPS parada.
    try {
      var gl = document.createElement('canvas').getContext('webgl');
      if (!gl) goLite('sem-placa-de-video');
      else {
        var info = gl.getExtension('WEBGL_debug_renderer_info');
        var gpu = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
        if (/basic render|swiftshader|llvmpipe|software|softpipe/i.test(gpu)) goLite('sem-placa-de-video');
        var lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
    } catch (e) {}
    if (nav.getBattery) nav.getBattery().then(function (bat) {
      var check = function () { if (!bat.charging && bat.level <= 0.2) goLite('bateria-baixa'); };
      check();
      bat.addEventListener('levelchange', check);
      bat.addEventListener('chargingchange', check);
    }).catch(function () {});
    // mede a taxa de quadros com a página parada (mediana de 60 quadros)
    function sampleFps() {
      if (perf.lite || document.hidden) return;
      var d = [], prev = 0;
      requestAnimationFrame(function f(t) {
        if (prev) d.push(t - prev);
        prev = t;
        if (d.length < 60) return requestAnimationFrame(f);
        d.sort(function (x, y) { return x - y; });
        if (d[30] > 25) goLite('fps-baixo');   // mediana > 25 ms = menos de 40 FPS
      });
    }
    window.addEventListener('load', function () { setTimeout(sampleFps, 1500); setTimeout(sampleFps, 15000); });
    // Mede também ROLANDO: parado, quase todo aparelho faz 60 FPS e o celular fraco passava
    // batido; a travada aparece na rolagem. Junta até 3 amostras de 90 quadros com a página
    // em movimento; se a mediana de uma delas passar de 25 ms (menos de 40 FPS), modo leve.
    (function () {
      var d = [], prev = 0, lastMove = 0, lastY = window.scrollY, samples = 0, running = false;
      function frame(t) {
        if (perf.lite || document.hidden) { running = false; prev = 0; return; }
        var y = window.scrollY;
        if (y !== lastY) { lastY = y; lastMove = t; }
        if (prev && t - lastMove < 120) d.push(t - prev);   // só quadros com a página andando
        prev = t;
        if (d.length >= 90) {
          d.sort(function (a, b) { return a - b; });
          if (d[45] > 25) goLite('rolagem-lenta');
          d = []; samples++;
        }
        if (t - lastMove > 400 || samples >= 3) { running = false; prev = 0; return; }   // parou de rolar
        requestAnimationFrame(frame);
      }
      function onScroll() {
        if (running || perf.lite || samples >= 3) return;
        running = true; lastMove = performance.now();
        requestAnimationFrame(frame);
      }
      window.addEventListener('scroll', onScroll, { passive: true });
    })();
    // aba em segundo plano: pausa as animações CSS contínuas
    document.addEventListener('visibilitychange', function () {
      document.documentElement.classList.toggle('is-hidden', document.hidden);
    });
  })();

  /* ---------- Scroll suave: Lenis + GSAP ScrollTrigger ----------
     Lenis move o scroll nativo da janela com inércia; o ticker do GSAP
     comanda o raf do Lenis, e cada passo do Lenis atualiza o ScrollTrigger,
     então tudo anda no mesmo frame. No toque (celular) o scroll é o nativo. */
  var gsap = window.gsap;
  var ST = window.ScrollTrigger;
  var lenis = null;
  if (gsap && ST) {
    gsap.registerPlugin(ST);
    ST.clearScrollMemory('manual');   // ScrollTrigger também não restaura posição
    ST.config({ ignoreMobileResize: true });
    document.documentElement.classList.add('gsap-on');
    if (window.Lenis && !reduceMotion) {
      lenis = new window.Lenis({
        lerp: 0.07,           // inércia: ~1,4 s de deslize após soltar a roda. Menor = desliza mais
        smoothWheel: true,
        wheelMultiplier: 1,
        anchors: true,        // links #secao deslizam (respeita scroll-padding-top)
        autoRaf: false
      });
      lenis.on('scroll', ST.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    }
  }

  /* ---------- Texto dobrando (FoldText) ----------
     Cada letra vira um <span> que "desdobra" a partir da borda de cima
     (rotateX -90° → 0°, dobradiça no topo, perspectiva 700px), com sombra
     de vinco (brilho 45% → 100%) e letras em cascata. Palavras não quebram. */
  var FOLD = { duration: 0.42, stagger: 0.016, ease: 'power3.out', perspective: 700, crease: 0.55 };
  var foldOn = !!(gsap && ST && !reduceMotion);
  if (!foldOn) document.documentElement.classList.add('fold-skip');

  function splitChars(el) {
    if (el.dataset.split) return el.querySelectorAll('.fold-char');
    el._foldHTML = el.innerHTML;
    el.dataset.split = '1';
    el.classList.add('is-split');
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var nodes = [];
    var idx = 0;   // posição da letra (--i no CSS: onda de cor do "Sua Festa" no hero)
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        var word = document.createElement('span');
        word.className = 'fold-word';
        word.setAttribute('aria-hidden', 'true');
        Array.from(part).forEach(function (ch) {
          var c = document.createElement('span');
          c.className = 'fold-char';
          c.textContent = ch;
          c.style.setProperty('--i', idx++);
          word.appendChild(c);
        });
        frag.appendChild(word);
      });
      node.parentNode.replaceChild(frag, node);
    });
    // um só invólucro: em títulos flex (com as linhas laterais) o texto continua quebrando linha
    if (getComputedStyle(el).display.indexOf('flex') !== -1) {
      var inner = document.createElement('span');
      inner.className = 'fold-inner';
      while (el.firstChild) inner.appendChild(el.firstChild);
      el.appendChild(inner);
    }
    return el.querySelectorAll('.fold-char');
  }

  // depois da dobra, devolve o texto original: letras soltas perdem o kerning da fonte
  function unsplit(el) {
    if (!el._foldHTML) return;
    el.innerHTML = el._foldHTML;
    el._foldHTML = null;
    el.classList.remove('is-split');
    el.removeAttribute('data-split');
    el.removeAttribute('aria-label');
  }

  var foldFrom = { rotationX: -90, transformPerspective: FOLD.perspective, autoAlpha: 0, filter: 'brightness(' + (1 - FOLD.crease) + ')' };
  function foldTo(extra) {
    return Object.assign({ rotationX: 0, autoAlpha: 1, filter: 'brightness(1)', duration: FOLD.duration, stagger: FOLD.stagger, ease: FOLD.ease }, extra);
  }


  /* ---------- Brilhos dourados (confete, corações e bokeh) ----------
     Cada grupo de brilhos é UM elemento, e cada brilho é um dos fundos dele (vários
     background-image, cada um com posição e tamanho). Com um <span> por brilho (~300,
     cada um com transform, filtro e sombra), o navegador comparava cada brilho com tudo
     que fica por cima a cada quadro, e as faixas "Vamos celebrar juntos?" e do FAQ
     travavam ao rolar. O brilho em volta das bolinhas vai no próprio degradê; o coração
     é uma imagem SVG com o dourado, o brilho e o giro já desenhados (6 ângulos prontos,
     que o navegador desenha uma vez e reaproveita). */
  var HEARTS = [-35, -20, -6, 8, 22, 35].map(function (deg) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 44 42">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e2a6"/>' +
      '<stop offset=".45" stop-color="#d4a94f"/><stop offset=".75" stop-color="#b8862f"/><stop offset="1" stop-color="#f1d58c"/></linearGradient>' +
      '<filter id="f" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="0" stdDeviation="2.4" flood-color="#f0cd78" flood-opacity=".7"/></filter></defs>' +
      '<path transform="rotate(' + deg + ' 16 15)" filter="url(#f)" fill="url(#g)" d="M16 29S2 20 2 10a7 7 0 0114-2 7 7 0 0114 2c0 10-14 19-14 19z"/></svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  });

  function rand(min, max) { return Math.random() * (max - min) + min; }

  // Os brilhos piscam em grupos: cada grupo é uma camada com uma animação só, e os
  // brilhos dentro dele ficam parados. Com uma animação por brilho (160 no FAQ) o
  // navegador recalculava todas as camadas a cada quadro da rolagem e o FAQ travava.
  // Os brilhos de cada grupo são sorteados pela faixa toda, então o piscar segue espalhado.
  var SPARKLE_GROUPS = 4, SPARKLE_DRIFT = 1;   // 1 dos 4 grupos também flutua (só no computador)

  document.querySelectorAll('.sparkle-field').forEach(function (field) {
    var total = parseInt(field.getAttribute('data-sparkles'), 10) || 80;
    if (window.innerWidth < 640) total = Math.round(total * 0.2);   // celular: menos brilhos
    // Faixa alta no computador (FAQ): brilhos só nas laterais, ao lado da coluna das
    // perguntas (atrás dos cards quase não apareciam). Cada grupo vira uma camada estreita
    // em vez de uma do tamanho da faixa inteira (~1600 x 2000 px), que pesava ao rolar.
    var sides = window.innerWidth >= 900 && field.parentElement.offsetHeight > window.innerHeight * 1.2;
    if (sides) total = Math.round(total * 0.5);
    var groups = [];
    for (var g = 0; g < SPARKLE_GROUPS; g++) {
      var group = document.createElement('span');
      group.className = 'sparkle-group';
      if (sides) group.style[g % 2 ? 'left' : 'right'] = '78%';
      if (!reduceMotion && window.innerWidth >= 640 && g < SPARKLE_DRIFT) group.className += ' floaty';   // celular: sem deriva
      group.style.setProperty('--d', rand(2.4, 4.6).toFixed(2) + 's');
      group.style.setProperty('--delay', (-g * 0.8 - rand(0, 0.6)).toFixed(2) + 's');   // fases espalhadas
      group.style.setProperty('--fd', rand(10, 20).toFixed(1) + 's');
      group.style.setProperty('--dx', rand(-20, 20).toFixed(0) + 'px');
      group.style.setProperty('--dy', rand(-40, 10).toFixed(0) + 'px');
      groups.push({ el: group, img: [], pos: [], size: [] });
    }

    for (var i = 0; i < total; i++) {
      var roll = Math.random(), img, box;
      var k = rand(0.8, 1.1);   // variação de tamanho
      if (roll < 0.22) {
        // coração: a imagem tem margem para o brilho (viewBox 44 em vez de 32)
        img = HEARTS[Math.floor(Math.random() * HEARTS.length)];
        box = rand(8, 22) * 1.375 * k;
      } else if (roll < 0.34) {
        // bokeh: bolha clara de bordas esfumadas
        box = rand(14, 38) * k;
        img = 'radial-gradient(circle, rgba(255,255,255,.85) 0%, rgba(255,240,210,.3) 42%, rgba(255,240,210,.08) 58%, transparent 72%)';
      } else {
        // bolinha dourada com brilho em volta (antes: box-shadow 0 0 6px)
        var r = rand(1, 4.5) * k;
        box = r * 2 + 12;
        img = 'radial-gradient(circle closest-side, #fff7dc 0, #e7c26a ' + (r * 0.45).toFixed(1) + 'px, #b98a33 ' + r.toFixed(1) +
          'px, rgba(240,205,120,.55) ' + (r + 0.8).toFixed(1) + 'px, rgba(240,205,120,0) 100%)';
      }
      var gr = groups[Math.floor(Math.random() * SPARKLE_GROUPS)];
      gr.img.push(img);
      gr.pos.push(rand(0, 100).toFixed(2) + '% ' + rand(0, 100).toFixed(2) + '%');
      gr.size.push(box.toFixed(1) + 'px ' + box.toFixed(1) + 'px');
    }
    var frag = document.createDocumentFragment();
    groups.forEach(function (gr) {
      if (!gr.img.length) return;
      gr.el.style.backgroundImage = gr.img.join(',');
      gr.el.style.backgroundPosition = gr.pos.join(',');
      gr.el.style.backgroundSize = gr.size.join(',');
      frag.appendChild(gr.el);
    });
    field.appendChild(frag);
  });

  /* ---------- Borda neon nas fotos do hero ----------
     Versão em JS puro do componente "Neon Border" (Originkit), mesmos valores:
     cor #CC9149, espessura 6, arco de 50%, brilho 100, movimento contínuo,
     velocidade 16. Dois arcos opostos percorrem o contorno deslizando de canto
     a canto; cada arco é um conic-gradient recalculado a cada quadro (--arc)
     numa faixa recortada por máscara, mais 3 camadas de brilho desfocado.
     A opacidade do .neon é controlada pela timeline do hero (some na troca). */
  var NEON = { color: '#CC9149', thickness: 2.5, borderSize: 50, glow: 100, speed: 18 };  // linha 2.5px (mais fina); velocidade 18: volta em ~6,7 s
  // A 3ª camada do original (desfoque de 57px, 18%) repintada a cada quadro
  // custava ~35 ms/quadro; virou a aura fixa .neon (box-shadow no CSS).
  var NEON_GLOW = [
    { blur: 8, opacity: 0.5, reach: 0.3 },
    { blur: 15, opacity: 0.3, reach: 0.6 }
  ];
  var NEON_REACH = 14, NEON_SAMPLES = 24;  // brilho mais contido (original: 36)

  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')';
  }
  function perimeterPoint(u, w, h) {
    var d = (((u % 1) + 1) % 1) * 2 * (w + h);
    if (d < w) return [d, 0];
    if (d < w + h) return [w, d - w];
    if (d < w * 2 + h) return [w - (d - w - h), h];
    return [0, h - (d - w * 2 - h)];
  }
  function perimeterAngle(u, w, h) {
    var p = perimeterPoint(u, w, h);
    return Math.atan2(p[0] - w / 2, h / 2 - p[1]) * 180 / Math.PI;
  }
  function cornerLap(k, w, h) {
    var per = 2 * (w + h), at = [0, w / per, (w + h) / per, (w * 2 + h) / per];
    return Math.floor(k / 4) + at[((k % 4) + 4) % 4];
  }
  function buildArc(lap, w, h) {
    var len = NEON.borderSize, span = Math.max(0.015, (len / 100) * 0.5), solid = len / 100;
    var stops = [], base = 0, prev = 0, acc = 0;
    for (var i = 0; i <= NEON_SAMPLES; i++) {
      var f = i / NEON_SAMPLES, ang = perimeterAngle(lap + (f - 0.5) * span, w, h);
      if (i === 0) base = ang;
      else { var d = ang - prev; while (d > 180) d -= 360; while (d < -180) d += 360; acc += d; }
      prev = ang;
      var t = Math.abs(f - 0.5) * 2, k = t <= solid ? 1 : 1 - (t - solid) / (1 - solid);
      stops.push(rgba(NEON.color, k * k * (3 - 2 * k)) + ' ' + acc.toFixed(2) + 'deg');
    }
    stops.push(rgba(NEON.color, 0) + ' ' + acc.toFixed(2) + 'deg', rgba(NEON.color, 0) + ' 360deg');
    return 'conic-gradient(from ' + base.toFixed(2) + 'deg at 50% 50%, ' + stops.join(', ') + ')';
  }
  function bezier(x1, y1, x2, y2) {     // cubic-bezier(.65, 0, .35, 1) do original
    var b = function (a, c, t) { var u = 1 - t; return 3 * u * u * t * a + 3 * u * t * t * c + t * t * t; };
    return function (x) {
      var s = x;
      for (var i = 0; i < 8; i++) {
        var u = 1 - s, dx = 3 * u * u * x1 + 6 * u * s * (x2 - x1) + 3 * s * s * (1 - x2);
        if (Math.abs(dx) < 1e-6) break;
        s = Math.max(0, Math.min(1, s - (b(x1, x2, s) - x) / dx));
      }
      return b(y1, y2, s);
    };
  }
  var glide = bezier(0.65, 0, 0.35, 1);

  function buildNeon(photo) {
    var thick = NEON.thickness, amount = NEON.glow / 100;
    var radius = parseFloat(getComputedStyle(photo).borderTopLeftRadius) || 0;
    var neon = document.createElement('div');
    neon.className = 'neon';
    neon.setAttribute('aria-hidden', 'true');
    var band = function (r, offset) {
      var el = document.createElement('div');
      el.className = 'neon-band';
      el.style.cssText = 'inset:' + (offset - r) + 'px;padding:' + r + 'px;border-radius:' + (radius + r) + 'px';
      return el;
    };
    var groups = [0, 0.5].map(function () {
      var g = document.createElement('div');
      g.className = 'neon-group';
      // celular: só a linha e a aura fixa; as camadas desfocadas repintadas a cada quadro pesam
      if (window.innerWidth > 640) NEON_GLOW.forEach(function (l) {
        var r = thick + amount * NEON_REACH * l.reach;
        var glowOuter = Math.ceil(r + l.blur * 2 + 4);   // área só do tamanho do brilho
        var gl = document.createElement('div');
        gl.className = 'neon-glow';
        gl.style.cssText = 'inset:' + (-glowOuter) + 'px;padding:' + glowOuter + 'px;border-radius:' + (radius + glowOuter) +
          'px;opacity:' + l.opacity + ';filter:blur(' + l.blur + 'px)';
        gl.appendChild(band(r, glowOuter));
        g.appendChild(gl);
      });
      g.appendChild(band(thick, 0));
      g.appendChild(band(thick, 0));
      neon.appendChild(g);
      return g;
    });
    photo.appendChild(neon);
    return { el: neon, photo: photo, groups: groups };
  }

  function runNeons(list) {
    document.documentElement.classList.add('neon-on');
    var cycle = 30 + (4 - 30) * (NEON.speed - 1) / 19;   // segundos por volta
    var beat = cycle / 4, stepT = 0, corner = 0, last = performance.now();
    var neonStep = window.innerWidth <= 640 ? 30 : 0;
    // tamanho das fotos medido só quando a tela muda, não a cada quadro (0 = foto oculta)
    function measure() {
      list.forEach(function (n) { n.w = n.photo.offsetParent ? n.photo.offsetWidth : 0; n.h = n.photo.offsetHeight; });
    }
    measure();
    window.addEventListener('resize', measure);
    // fora da tela (depois de passar da Hero) não calcula nada
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { e.target._neonOn = e.isIntersecting; });
        // de volta à tela: mede de novo (com o hero escondido, .is-away, a medida pode ter vindo zerada)
        if (entries.some(function (e) { return e.isIntersecting; })) measure();
      });
      list.forEach(function (n) { n.photo._neonOn = true; io.observe(n.photo); });
    }
    function paint(now) {
      requestAnimationFrame(paint);
      if (now - last < (perf.lite ? 66 : neonStep)) return;   // modo leve: ~15 quadros por segundo; celular: ~30
      var dt = Math.min(perf.lite ? 0.1 : 0.05, Math.max(0, (now - last) / 1000));
      last = now;
      stepT += dt / beat;
      while (stepT >= 1) { stepT -= 1; corner += 1; }
      list.forEach(function (n) {
        // só desenha foto visível (economiza bateria durante o resto do site)
        // lê só o estilo inline que o GSAP escreve (sem forçar recálculo de layout)
        var op = n.el.style.opacity;
        if (!n.w || n.photo._neonOn === false || (op !== '' && +op < 0.01)) return;
        var w = n.w, h = n.h;
        var from = cornerLap(corner, w, h), to = cornerLap(corner + 1, w, h);
        var lap = from + (to - from) * glide(stepT);
        n.groups[0].style.setProperty('--arc', buildArc(lap, w, h));
        n.groups[1].style.setProperty('--arc', buildArc(lap + 0.5, w, h));
      });
    }
    requestAnimationFrame(paint);
  }

  /* ---------- Hero: frames do vídeo controlados pelo scroll ---------- */
  (function () {
    var hero = document.getElementById('hero');
    var canvas = hero && hero.querySelector('.hero-canvas');
    if (!canvas) return;

    // celular em pé ou deitado (tela baixa): o fundo é o vídeo vertical em loop, que não
    // depende do scroll; o motor de frames abaixo não roda (nem baixa os frames do
    // computador). A troca dos painéis (sequência mais abaixo) é a mesma do computador.
    // (o <head> já ligou .hero-vid com a mesma consulta)
    var mobile = window.matchMedia('(max-width: 640px), (orientation: landscape) and (max-height: 500px)').matches;
    if (mobile) heroVideo();

    function heroVideo() {
      document.documentElement.classList.add('hero-vid');
      canvas.remove();

      // vídeo: mudo + playsinline (exigência do iPhone para tocar sozinho), loop nativo.
      // Com "reduzir movimento" fica parado no 1º quadro.
      var video = hero.querySelector('.hero-video');
      if (video) {
        video.muted = video.defaultMuted = true;
        video.playsInline = true;
        video.setAttribute('muted', '');
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.poster = video.getAttribute('data-poster');
        video.preload = reduceMotion ? 'metadata' : 'auto';
        video.src = video.getAttribute('data-src');
        if (!reduceMotion) {
          var onScreen = true;
          var play = function () {
            if (!onScreen || document.hidden) return;
            var p = video.play();
            if (p && p.catch) p.catch(function () {});
          };
          video.autoplay = true;
          play();
          // fora da tela o vídeo pausa: sem decodificar enquanto a pessoa lê o resto da página
          if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (e) {
              onScreen = e[0].isIntersecting;
              if (onScreen) play(); else video.pause();
            }).observe(hero);
          }
          document.addEventListener('visibilitychange', play);
          // modo economia do iPhone bloqueia o autoplay: o 1º toque na página inicia o vídeo
          window.addEventListener('touchstart', play, { once: true, passive: true });
        }
      }
    }

    var total = parseInt(canvas.getAttribute('data-frames'), 10);
    var base = canvas.getAttribute('data-src');
    var size = (canvas.getAttribute('data-size') || '1920x1080').split('x');
    var NW = +size[0], NH = +size[1];   // tamanho dos arquivos de frame
    // canvas opaco (sem mistura com o fundo): desenho mais barato. Sem "desynchronized":
    // o frame precisa chegar à tela no mesmo quadro que os textos da Hero.
    var ctx = canvas.getContext('2d', { alpha: false });

    /* Motor de reprodução
       - Os frames foram interpolados (8× no celular, 4× no computador): cada frame
         cobre só ~5 px de rolagem e as pétalas andam poucos pixels de um para o
         outro. Por isso cada quadro mostra UM frame inteiro, sem misturar dois:
         a mistura deixava as pétalas meio transparentes ("sumindo") a cada passo.
       - files[i]: WebP comprimido (Blob). Ao abrir, só o começo da Hero inteiro, o
         último frame e 1 a cada 16 (~68 frames, ~3 MB dos 21 MB). O resto (1 a cada
         8, 4, 2 e todos) só depois que a pessoa começa a rolar a Hero: quem abre e
         sai, ou lê sem rolar, não baixa tudo. Com parte baixada a animação já anda e
         vai ficando mais fina sozinha; o que o scroll vai mostrar em seguida é sempre
         pedido na hora, com prioridade (plano abaixo).
       - frames[i]: ImageBitmap decodificado fora da thread principal, já recortado
         e no tamanho exato do canvas: desenhar vira uma cópia, sem redimensionar.
       - Só decodifica o que vai aparecer: o caminho entre a posição atual e onde o
         scroll vai parar (o Lenis informa o destino do deslize; no toque, projeta a
         velocidade). Rolando rápido, pega 1 a cada 2, 4, 8… frames do caminho (a
         tela só mostra 60 por segundo); ao desacelerar, completa os que faltam.
       - Se o frame exato ainda não está pronto, mostra o pronto mais próximo:
         nunca congela esperando.
       - Roda no ticker do GSAP, logo depois do Lenis e do ScrollTrigger: vídeo e
         textos andam no mesmo quadro do scroll. */
    var files = new Array(total), frames = new Array(total), inPlan = new Uint8Array(total);
    var MAXB = mobile ? 44 : 40;     // frames decodificados guardados (~2 MB cada no celular, ~6 MB no computador)
    var MAXD = mobile ? 3 : 4;       // decodificações ao mesmo tempo
    var MAXF = 6;                    // downloads ao mesmo tempo
    var LOOK = mobile ? 0.3 : 0.2;   // s de movimento projetados à frente
    // amortecimento leve (s): só arredonda saltos (teclado, barra de rolagem, toque).
    // O deslize em si é o do Lenis no computador e o do próprio aparelho no celular.
    var TAU = mobile ? 0.06 : 0.03;
    var bitmaps = typeof createImageBitmap === 'function' && typeof fetch === 'function';
    var resizeOK = true;             // createImageBitmap aceita recorte + tamanho final
    var target = 0, pos = 0, vel = 0, lastGoal = 0, last = 0;
    var cw = 0, ch = 0, crop = null, gen = 0;
    var decoding = 0, fetching = 0, held = 0;
    var plan = [], planA = -1, planB = -1, planStep = 0;
    var shown = -1, painted = false;
    var trig = null;                 // ScrollTrigger da Hero: converte o destino do Lenis em frame

    function src(i) { return base + String(i + 1).padStart(4, '0') + '.webp'; }

    // ordem dos downloads: começo da Hero inteiro, o último frame, depois do grosso para o fino.
    // Ao abrir a fila vai só até "limit" (1 a cada 16); fillAll() libera o resto ao rolar.
    var order = [], queued = new Uint8Array(total), nextOrder = 0;
    function enqueue(i) { if (i >= 0 && i < total && !queued[i]) { queued[i] = 1; order.push(i); } }
    for (var i = 0; i < 40; i++) enqueue(i);
    enqueue(total - 1);
    for (var j0 = 0; j0 < total; j0 += 16) enqueue(j0);
    var limit = order.length;
    [8, 4, 2, 1].forEach(function (s) { for (var j = 0; j < total; j += s) enqueue(j); });
    function fillAll() {
      if (mobile || limit === order.length) return;   // celular: o fundo é o vídeo, nada de frames
      limit = order.length;
      pump();
    }

    // baixa o arquivo (só o WebP comprimido fica guardado)
    function fetchFile(i, urgent) {
      if (files[i] !== undefined) return;
      files[i] = 'loading';
      fetching++;
      fetch(src(i), { priority: urgent ? 'high' : 'low' }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.blob();
      }).then(function (b) { files[i] = b; }, function () { files[i] = null; })
        .then(function () { fetching--; pump(); });
    }

    function ready(i) {
      var f = frames[i];
      return !!f && typeof f === 'object' && (f.close ? f.width > 0 : !!f.ready);
    }

    // decodifica o frame i já recortado e no tamanho do canvas
    function decode(i) {
      var g = gen;
      frames[i] = 'busy';
      decoding++;
      var job = resizeOK && crop
        ? createImageBitmap(files[i], crop.x, crop.y, crop.w, crop.h, { resizeWidth: cw, resizeHeight: ch, resizeQuality: 'high' })
        : createImageBitmap(files[i]);
      job.then(function (bmp) {
        decoding--;
        if (g === gen && frames[i] === 'busy') { frames[i] = bmp; held++; evict(); }
        else bmp.close();   // o canvas mudou de tamanho enquanto decodificava
        pump();
      }, function () {
        decoding--;
        if (g === gen && frames[i] === 'busy') frames[i] = undefined;
        // navegador sem recorte/tamanho no createImageBitmap: decodifica inteiro; se nem assim, <img>
        if (resizeOK) resizeOK = false; else bitmaps = false;
        pump();
      });
    }

    // navegador sem createImageBitmap: <img> decodificada pelo próprio navegador
    function legacy(i) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () { img.ready = true; };
      img.src = src(i);
      frames[i] = img;
    }

    // guarda no máximo MAXB frames decodificados: solta primeiro os fora do plano e mais longe
    function evict() {
      while (held > MAXB) {
        var worst = -1, wd = -1;
        for (var j = 0; j < total; j++) {
          if (!ready(j) || !frames[j].close) continue;
          var d = Math.abs(j - pos) + (inPlan[j] ? 0 : total);
          if (d > wd) { wd = d; worst = j; }
        }
        if (worst < 0) break;
        frames[worst].close();
        frames[worst] = undefined;
        held--;
      }
    }

    // põe para baixar/decodificar o que o plano pede e, com folga, o resto
    function pump() {
      var k, i;
      if (bitmaps) for (k = 0; k < plan.length && fetching < MAXF * 2; k++) {
        i = plan[k];
        if (files[i] === undefined && !frames[i]) fetchFile(i, true);
      }
      for (k = 0; k < plan.length && decoding < MAXD; k++) {
        i = plan[k];
        if (frames[i]) continue;
        if (!bitmaps) legacy(i);
        else if (files[i] instanceof Blob) decode(i);
      }
      while (bitmaps && fetching < MAXF && nextOrder < limit) fetchFile(order[nextOrder++], false);
    }

    // plano: frames que vão aparecer até o scroll parar, em ordem de prioridade
    function makePlan(goal) {
      var a = Math.max(0, Math.min(total - 1, Math.floor(pos)));
      var dest = goal + vel * LOOK;
      if (lenis && trig && !mobile && trig.end > trig.start) {
        var glideTo = (lenis.targetScroll - trig.start) / (trig.end - trig.start) * (total - 1);
        if (Math.abs(glideTo - goal) > Math.abs(dest - goal)) dest = glideTo;
      }
      var b = Math.round(Math.max(0, Math.min(total - 1, dest)));
      var dir = b >= a ? 1 : -1, step = 1;
      // caminho longo ou rolagem rápida (mais de 1 frame por quadro da tela): 1 a cada 2, 4, 8…
      // (sempre os mesmos múltiplos, que continuam valendo quando o passo diminui)
      while (Math.abs(b - a) / step > MAXB - 16 || Math.abs(vel) / 60 >= step * 2) step *= 2;
      if (a === planA && b === planB && step === planStep) return;
      planA = a; planB = b; planStep = step;
      for (var k = 0; k < plan.length; k++) inPlan[plan[k]] = 0;
      plan.length = 0;
      var add = function (i) { if (i >= 0 && i < total && !inPlan[i]) { inPlan[i] = 1; plan.push(i); } };
      add(a); add(a + 1);
      for (var j = a; j !== b; j += dir) if (j % step === 0) add(j);
      add(b); add(b + 1);
      // vizinhos: voltar ou seguir rolando sem engasgar
      for (k = 1; k <= 6; k++) { add(b + dir * k); if (k <= 4) add(a - dir * k); }
      pump();
    }

    function draw(f) {
      if (f.width === cw && f.height === ch) { ctx.drawImage(f, 0, 0); return; }
      // frame sem recorte (navegador sem resize no createImageBitmap, ou <img>): object-fit: cover
      var nw = f.naturalWidth || f.width, nh = f.naturalHeight || f.height;
      var sc = Math.max(cw / nw, ch / nh), w = nw * sc, h = nh * sc;
      ctx.drawImage(f, (cw - w) / 2, (ch - h) / 2, w, h);
    }

    // mostra o frame da posição, inteiro. Se ele ainda não está pronto, mostra o pronto
    // mais perto dele entre o que já está na tela e ele: nunca passa do alvo nem se
    // afasta dele. (Antes valia o mais próximo de qualquer lado: ao parar de rolar
    // aparecia 1 frame à frente e depois voltava, uma tremidinha para trás.)
    function paint() {
      var a = Math.max(0, Math.min(total - 1, Math.round(pos))), f = -1, d;
      if (shown < 0) {
        for (d = 0; d < total && f < 0; d++) f = ready(a + d) ? a + d : ready(a - d) ? a - d : -1;
      } else {
        var back = a > shown ? 1 : -1;   // do alvo de volta até o frame da tela
        for (d = a; d !== shown && f < 0; d -= back) if (ready(d)) f = d;
      }
      if (f < 0 || f === shown) return;
      draw(frames[f]);
      shown = f;
      if (!painted) { painted = true; canvas.style.opacity = 1; }
    }

    function tick() {
      var now = performance.now();
      var dt = Math.min(0.1, Math.max(0.001, (now - last) / 1000));
      last = now;
      if (!cw) return;
      var goal = target * (total - 1);
      // velocidade do scroll em frames/s (suavizada): projeta o caminho à frente
      vel += ((goal - lastGoal) / dt - vel) * Math.min(1, dt * 10);
      lastGoal = goal;
      pos += (goal - pos) * (1 - Math.exp(-dt / TAU));
      if (Math.abs(goal - pos) < 0.002) pos = goal;
      makePlan(goal);
      paint();
    }

    function setProgress(p) {
      target = p;
      // rolando dentro da Hero: agora vale baixar o resto dos frames. Quem pula direto
      // para depois dela (link do menu) não dispara; se voltar, o plano pede o que precisar
      if (p > 0 && p < 1) fillAll();
    }

    function resize() {
      var w0 = canvas.clientWidth, h0 = canvas.clientHeight;
      if (!w0 || !h0) return;
      // resolução do canvas: a da tela, mas nunca com mais pixels que os frames têm
      // (acima disso só gasta memória e decodificação, sem ganhar nitidez)
      var dpr = Math.min(window.devicePixelRatio || 1, 1 / Math.max(w0 / NW, h0 / NH));
      if (perf.lite) dpr = Math.min(dpr, 1);
      var w = Math.round(w0 * dpr), h = Math.round(h0 * dpr);
      if (w === cw && h === ch) return;
      // mudar o tamanho apaga o canvas: guarda a imagem da tela para redesenhá-la no
      // tamanho novo até o frame certo decodificar. Sem isso o canvas ficava preto (ou
      // mostrava o 1º frame, que é o fundo do CSS) por um instante e parecia que o vídeo
      // resetava. Acontece sozinho ~2 s depois de abrir, quando o modo leve baixa a resolução.
      var keep = null;
      if (painted) {
        keep = document.createElement('canvas');
        keep.width = cw; keep.height = ch;
        keep.getContext('2d').drawImage(canvas, 0, 0);
      }
      canvas.width = cw = w;
      canvas.height = ch = h;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';   // redefinido após mudar o tamanho
      // recorte do frame equivalente a object-fit: cover
      var sc = Math.max(cw / NW, ch / NH);
      var cropW = Math.min(NW, Math.round(cw / sc)), cropH = Math.min(NH, Math.round(ch / sc));
      crop = { x: (NW - cropW) >> 1, y: (NH - cropH) >> 1, w: cropW, h: cropH };
      // frames decodificados no tamanho antigo: descarta e decodifica de novo
      gen++;
      for (var j = 0; j < total; j++) {
        var f = frames[j];
        if (f === 'busy' || (f && f.close)) { if (f.close) f.close(); frames[j] = undefined; }
      }
      held = 0; shown = -1; planA = -1;
      if (keep) draw(keep);
    }

    // sem GSAP (falha ao carregar): calcula o progresso pelo scroll nativo
    function onScroll() {
      var range = hero.offsetHeight - window.innerHeight;
      var y = window.scrollY - hero.offsetTop;
      setProgress(range > 0 ? Math.min(1, Math.max(0, y / range)) : 0);
      fabFor({ progress: range > 0 ? target : (y > 0 ? 1 : 0) });   // Hero do tamanho da tela: WhatsApp ao começar a rolar
    }

    canvas.style.opacity = 0;   // até o 1º frame: mostra o fundo do CSS (evita flash preto do canvas opaco)
    // desenha no mesmo tick do Lenis/ScrollTrigger: sem atraso entre scroll e frame
    // (celular: o vídeo faz o fundo, nada de frames)
    if (!mobile) {
      if (gsap) gsap.ticker.add(tick);
      else (function loop() { tick(); requestAnimationFrame(loop); })();
    }

    // mapa do painel final: só carrega quando a sequência se aproxima dele
    // Google Maps real em todo computador (inclusive notebook com tela touch ou zoom).
    // Em iPhone/iPad/Android o iframe atrapalhava o layout; fica o mapa ilustrado,
    // e tocar nele abre o Google Maps.
    var mapFrame = hero.querySelector('.hero-map iframe');
    var handheld = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);   // iPad se identifica como Mac
    if (mapFrame && handheld) {
      mapFrame.remove(); mapFrame = null;
    }
    function loadMap() {
      if (!mapFrame || mapFrame.src) return;
      mapFrame.src = mapFrame.getAttribute('data-src');
    }
    var fab = document.querySelector('.wa-float');
    function fabFor(self) { if (fab) fab.classList.toggle('is-hidden', self.progress < 1); }
    function onUpdate(self) {
      setProgress(self.progress);
      if (self.progress > 0.4) loadMap();
      // o hero já tem o botão de orçamento: WhatsApp flutuante só depois da sequência.
      // Aqui (e não no onToggle): pulando direto para depois da Hero, o onToggle não dispara
      fabFor(self);
    }

    /* Assistência de rolagem nos painéis da Hero
       Só age DEPOIS da troca de foto e letras: se a pessoa já passou do ponto em que
       o painel novo começa a entrar (um pouquinho além dele) e para no meio da
       entrada, a página completa sozinha até o painel novo inteiro. Subindo, o mesmo
       ao contrário (passou do ponto de troca para cima: volta ao painel anterior
       inteiro). Antes do ponto de troca nada acontece: a pessoa rola no próprio ritmo.
       O vídeo do fundo só acompanha o scroll, como sempre.
       - Roda do mouse: assim que a roda para, o deslize do Lenis é redirecionado ao
         painel no mesmo embalo (sem parar e recomeçar).
       - Toque e teclado: espera o embalo do dedo acabar e desliza com aceleração suave.
       - Qualquer toque ou roda durante o deslize devolve o controle na hora. */
    function snapPanels(seq, swaps) {
      // trechos de troca (tempo da timeline): do 1º elemento que sai ao último que termina
      // de entrar; "swap" é o ponto em que o painel novo começa a entrar
      function zone(from, to, swap) {
        var a = Infinity, b = 0;
        seq.getChildren(false, true, true).forEach(function (t) {
          var s = t.startTime();
          if (s >= from && s < to) { a = Math.min(a, s); b = Math.max(b, s + t.totalDuration()); }
        });
        return [a, b, swap];
      }
      var zones = [zone(1, 5, swaps[0]), zone(5, 7.5, swaps[1])];   // painel 1 → 2 e 2 → 3 (posições da timeline abaixo)
      var PAST = 0.05;   // "um frame depois" do ponto de troca (tempo da timeline, ~10 px de rolagem)
      var pending = false, touching = false, snapping = false, mode = '';
      var lastInput = 0, lastScroll = 0, lastY = window.scrollY, dir = 1;
      var easeInOut = function (x) { return -(Math.cos(Math.PI * x) - 1) / 2; };

      function snapFor(y) {
        if (!trig || trig.end <= trig.start) return null;
        var D = seq.duration(), span = trig.end - trig.start, t = (y - trig.start) / span * D;
        for (var z = 0; z < zones.length; z++) {
          var a = zones[z][0], b = zones[z][1], swap = zones[z][2];
          if (t <= a || t >= b) continue;
          var to;
          if (dir > 0 && t >= swap + PAST) to = b + 0.12;        // desceu além da troca: completa o painel novo
          else if (dir < 0 && t <= swap - PAST) to = a - 0.12;   // subiu além da troca: volta ao painel anterior
          else return null;                                      // antes da troca: não interfere
          to = Math.max(0, Math.min(D, to));   // (± 0,12: um pouco dentro do painel completo)
          return trig.start + to / D * span;
        }
        return null;
      }

      // pinça com dois dedos (zoom) não é rolagem: até tirar os dedos, a assistência não age
      var pinching = false;
      function input(kind) {
        mode = kind; pending = true; snapping = false;
        lastInput = performance.now();
      }
      window.addEventListener('wheel', function (e) {
        if (e.ctrlKey) { pending = false; return; }   // pinça no touchpad = zoom
        input('wheel');
      }, { passive: true });
      window.addEventListener('touchstart', function (e) {
        touching = true;
        if (e.touches && e.touches.length > 1) pinching = true;
        if (pinching) { pending = false; return; }
        input('touch');
      }, { passive: true });
      window.addEventListener('touchend', function (e) {
        if (!e.touches || !e.touches.length) { touching = false; pinching = false; }
        lastInput = performance.now();
      }, { passive: true });
      window.addEventListener('touchcancel', function () { touching = false; pinching = false; }, { passive: true });
      window.addEventListener('gesturestart', function () { pinching = true; pending = false; });   // Safari
      window.addEventListener('keydown', function (e) {
        if (/^(Arrow(Up|Down)|Page(Up|Down)|Home|End| )$/.test(e.key)) input('key');
      });
      window.addEventListener('scroll', function () {
        var y = window.scrollY;
        if (y !== lastY) dir = y > lastY ? 1 : -1;
        lastY = y;
        lastScroll = performance.now();
      }, { passive: true });

      gsap.ticker.add(function () {
        if (!pending || touching || snapping) return;
        if (pinching || zoomed()) { pending = false; return; }
        var now = performance.now();
        if (now - lastInput < 140) return;                         // ainda girando a roda / apertando tecla
        if (mode !== 'wheel' && now - lastScroll < 120) return;   // toque: espera o embalo do dedo acabar
        pending = false;
        var y = mode === 'wheel' && lenis ? lenis.targetScroll : window.scrollY;
        var to = snapFor(y);
        if (to === null || Math.abs(to - y) < 2) return;
        snapping = true;
        var done = function () { snapping = false; };
        if (lenis && mode === 'wheel' && lenis.isScrolling === 'smooth') {
          lenis.scrollTo(to, { programmatic: false, lerp: 0.07, onComplete: done });
        } else if (lenis) {
          lenis.scrollTo(to, { duration: 0.9, easing: easeInOut, onComplete: done });
        } else {
          window.scrollTo({ top: to, behavior: 'smooth' });
          setTimeout(done, 900);
        }
      });
    }

    /* Guia de rolagem da Hero (para quem não conhece o efeito)
       - Pontos 1, 2 e 3 na lateral: mostram em qual painel a pessoa está; clicar leva
         direto ao painel (no computador, o nome dele aparece ao lado).
       - Aviso embaixo, com o mouse (ou o dedo, no celular) animado: Role para ver
         mais / 1 de 3. Clicar leva ao próximo painel; no último, aos Serviços.
         Parado no começo por uns segundos, o aviso pulsa para chamar atenção.
       Os dois ficam dentro da Hero presa: o resto da página os cobre ao subir. */
    function heroGuide(seq, swaps) {
      var sticky = hero.querySelector('.hero-sticky');
      var wrap = hero.querySelector('.feature-wrap');
      if (!sticky || !wrap) return;
      var touch = matchMedia('(hover: none) and (pointer: coarse)').matches;
      var names = ['Sua festa', 'Momentos', 'Orçamento'];
      var easeInOut = function (x) { return -(Math.cos(Math.PI * x) - 1) / 2; };
      // tempo da timeline em que cada painel está inteiro na tela (fim da entrada dele)
      function endOf(from, to) {
        var b = 0;
        seq.getChildren(false, true, true).forEach(function (t) {
          var s = t.startTime();
          if (s >= from && s < to) b = Math.max(b, s + t.totalDuration());
        });
        return b + 0.12;
      }
      var rest = [0, endOf(swaps[0], 5), endOf(swaps[1], 7.5)];

      var nav = document.createElement('nav');
      nav.className = 'hero-guide';
      nav.setAttribute('aria-label', 'Partes do início do site');
      nav.innerHTML = '<span class="hg-track" aria-hidden="true"><span class="hg-fill"></span></span>' +
        names.map(function (n, i) {
          return '<button type="button" class="hg-dot" data-i="' + i + '" aria-label="' + (i + 1) + ' de 3: ' + n + '">' +
            '<span class="hg-label" aria-hidden="true">' + n + '</span></button>';
        }).join('');
      sticky.appendChild(nav);

      var next = document.createElement('button');
      next.type = 'button';
      next.className = 'hero-next';
      next.innerHTML = '<span class="hn-icon ' + (touch ? 'hn-swipe' : 'hn-mouse') + '" aria-hidden="true"><i></i></span>' +
        '<span class="hn-text"></span><span class="hn-step"></span>' +
        '<svg class="hn-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
      wrap.insertBefore(next, wrap.firstChild);
      var text = next.querySelector('.hn-text'), step = next.querySelector('.hn-step');
      var fill = nav.querySelector('.hg-fill'), dots = nav.querySelectorAll('.hg-dot');

      function yAt(t) { return trig.start + t / seq.duration() * (trig.end - trig.start); }
      function go(y) {
        if (lenis) lenis.scrollTo(y, { duration: 1.2, easing: easeInOut });
        else window.scrollTo({ top: y, behavior: 'smooth' });
      }
      function goPanel(i) {
        if (i > 2) go(document.getElementById('servicos') || yAt(seq.duration()) + window.innerHeight);
        else go(yAt(rest[i]));
      }
      var cur = -1;
      Array.prototype.forEach.call(dots, function (d, i) { d.addEventListener('click', function () { goPanel(i); }); });
      next.addEventListener('click', function () { goPanel(cur + 1); });

      // parado no começo: o aviso pulsa até a pessoa rolar
      var nudge = setTimeout(function () { if (window.scrollY < 10) next.classList.add('is-nudge'); }, 3500);
      var lastFill = -1;
      gsap.ticker.add(function () {
        if (!trig || sticky.classList.contains('is-away')) return;
        var p = trig.progress, t = p * seq.duration();
        if (p > 0.002 && nudge) { clearTimeout(nudge); nudge = 0; next.classList.remove('is-nudge'); }
        var f = Math.round(p * 1000) / 1000;
        if (f !== lastFill) { lastFill = f; fill.style.transform = 'scaleY(' + f + ')'; }
        var i = t < swaps[0] ? 0 : t < swaps[1] ? 1 : 2;
        if (i === cur) return;
        cur = i;
        Array.prototype.forEach.call(dots, function (d, k) {
          d.classList.toggle('is-on', k === i);
          d.classList.toggle('is-done', k < i);
          if (k === i) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
        });
        text.textContent = i < 2 ? (touch ? 'Deslize para ver mais' : 'Role para ver mais') : 'Ver os serviços';
        step.textContent = (i + 1) + ' de 3';
        next.setAttribute('aria-label', i < 2 ? 'Ir para a parte ' + (i + 2) + ' de 3: ' + names[i + 1] : 'Ir para os serviços');
      });
    }

    if (gsap && ST && !reduceMotion) {
      /* Sequência narrativa: o hero fica fixo (sticky) e o scroll (scrub) conduz
         vídeo e textos juntos. Painel 1 sai, painel 2 entra e sai, painel final
         (orçamento) entra e fica um trecho parado antes de liberar a página.
         Rolar para cima reverte tudo. A Hero fica presa por CSS (sticky). */
      document.documentElement.classList.add('hero-seq');
      var neon1 = buildNeon(hero.querySelector('[data-panel="1"] .hero-photo'));
      var neon2 = buildNeon(hero.querySelector('[data-panel="2"] .hero-photo'));
      var neon3 = buildNeon(hero.querySelector('.hero-map'));
      runNeons([neon1, neon2, neon3]);
      // (títulos da Hero continuam separados: a sequência de rolagem anima as linhas deles)
      gsap.fromTo(splitChars(hero.querySelector('[data-panel="1"] .hero-title')), foldFrom, foldTo({ delay: 0.3, clearProps: 'transform,filter' }));
      var parts = function (n) {
        var p = '[data-panel="' + n + '"] ';
        return hero.querySelectorAll(p + '.hero-title > span, ' + p + '.hero-title ~ *');
      };
      var out = { autoAlpha: 0, y: -48, duration: 1, stagger: 0.1, ease: 'power2.in' };
      var from = { autoAlpha: 0, y: 48 };
      var into = { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.12, ease: 'power2.out' };
      var seq = gsap.timeline({
        defaults: { overwrite: 'auto' },
        scrollTrigger: {
          // celular: scroll nativo -> scrub com 0,2 s de suavização (perto do
          // amortecimento do canvas: textos e vídeo andam juntos); computador: o Lenis já suaviza
          // fim: a Hero tem 1 tela a mais para o resto da página (.page-rest) subir por cima
          // dela; a sequência termina quando o topo dele aparece embaixo da tela
          trigger: hero, start: 'top top', endTrigger: '.page-rest', end: 'top bottom',
          scrub: mobile ? 0.2 : true, onUpdate: onUpdate
        }
      })
        .to(parts(1), out, 1.4)
        .fromTo(parts(2), from, into, 2.7)
        .fromTo(splitChars(hero.querySelector('[data-panel="2"] .hero-title')), foldFrom, foldTo({ duration: 0.6, stagger: 0.03 }), 2.75)
        .to(parts(2), out, 5.2)
        // fotos do celular: leve zoom que assenta ao entrar e cresce ao sair
        .to('[data-panel="1"] .hero-photo img', { scale: 1.1, duration: 1.2, ease: 'power1.in' }, 1.4)
        .fromTo('[data-panel="2"] .hero-photo img', { scale: 1.18 }, { scale: 1, duration: 1.5, ease: 'power2.out' }, 2.7)
        .to('[data-panel="2"] .hero-photo img', { scale: 1.1, duration: 1.2, ease: 'power1.in' }, 5.2)
        // neon: enfraquece enquanto a foto sai e ganha força quando a nova chega
        .to(neon1.el, { opacity: 0, duration: 0.8, ease: 'power2.in' }, 1.3)
        .fromTo(neon2.el, { opacity: 0 }, { opacity: 1, duration: 1.3, ease: 'power2.in' }, 3.0)
        .to(neon2.el, { opacity: 0, duration: 0.8, ease: 'power2.in' }, 5.1)
        .fromTo(parts(3), from, into, 6.5)
        // mapa do painel final: mesmo zoom de entrada e neon das fotos
        .fromTo('.hero-map .map-art', { scale: 1.18 }, { scale: 1, duration: 1.5, ease: 'power2.out' }, 6.5)
        .fromTo(neon3.el, { opacity: 0 }, { opacity: 1, duration: 1.3, ease: 'power2.in' }, 6.8)
        .fromTo(splitChars(hero.querySelector('[data-panel="3"] .hero-title')), foldFrom, foldTo({ duration: 0.6, stagger: 0.03 }), 6.55)
        .to({}, { duration: 1.6 });   // orçamento todo visível antes de soltar a página
      // aplica já o estado inicial (painéis 2 e 3 escondidos) antes da 1ª rolagem;
      // com scrub suavizado o GSAP só renderizava depois de rolar
      seq.progress(1).progress(0);
      document.documentElement.classList.remove('hero-pre');   // estado inicial aplicado: painéis 2 e 3 por conta do GSAP
      trig = seq.scrollTrigger;
      fabFor(trig);
      snapPanels(seq, [2.7, 6.5]);   // início da entrada dos painéis 2 e 3 na timeline acima
      heroGuide(seq, [2.7, 6.5]);
    } else if (ST) {
      // sem a sequência (o <head> já tinha ligado .hero-seq): volta ao painel final
      document.documentElement.classList.remove('hero-seq', 'hero-pre');
      loadMap();   // sem a sequência, o painel final aparece desde o início
      // onRefresh: já no topo da página (antes de rolar) o WhatsApp fica escondido, senão
      // cobria a barra de diferenciais no celular com "reduzir movimento" ligado
      trig = ST.create({ trigger: hero, start: 'top top', end: 'bottom bottom', onUpdate: onUpdate, onRefresh: fabFor });
    } else {
      document.documentElement.classList.remove('hero-seq', 'hero-pre');
      loadMap();
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
    window.addEventListener('resize', resize);
    window.addEventListener('litechange', resize);
    window.addEventListener('load', function () {
      // mapa real do computador: carrega logo depois da página, sem esperar o scroll.
      // (loading="lazy" saiu: o Chrome adiava o mapa escondido dentro da Hero presa)
      setTimeout(loadMap, 1500);
      // meio-termo dos frames: quem fica uns segundos no site já tem tudo quando começar
      // a rolar (sem "pulinhos"); quem abre e sai logo não baixa os ~21 MB. Não roda com
      // economia de dados ou internet 2G, nem com a aba escondida (espera ela voltar).
      // No celular o fundo é o vídeo: nada de frames.
      var conn = navigator.connection;
      if (mobile || (conn && (conn.saveData || /2g/.test(conn.effectiveType || '')))) return;
      setTimeout(function later() {
        if (document.hidden) {
          document.addEventListener('visibilitychange', function back() {
            if (document.hidden) return;
            document.removeEventListener('visibilitychange', back);
            later();
          });
          return;
        }
        fillAll();
      }, 4500);
    });
    resize();
  })();

  /* ---------- Menu mobile ---------- */
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('menu');

  function closeMenu() {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menu');
  }

  toggle.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  });
  nav.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeMenu); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  // tocar fora do menu (inclusive para rolar a página) fecha; antes ele ficava aberto por cima do site
  document.addEventListener('pointerdown', function (e) {
    if (nav.classList.contains('open') && !nav.contains(e.target) && !toggle.contains(e.target)) closeMenu();
  });

  /* Links #secao: o Lenis calcula o destino na hora do clique, mas no caminho a página
     pode mudar um pouco (títulos virando letras ao entrar na tela). No celular o FAQ
     parava com o título cortado no topo. Quando o deslize termina, confere onde a seção
     ficou e, se precisar, completa com um deslize curto. */
  if (lenis) {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || a.classList.contains('feature-link')) return;   // esses têm o próprio controle
      var el = document.getElementById(a.getAttribute('href').slice(1));
      if (!el) return;
      var tries = 0;
      var settle = function () {
        if (lenis.isScrolling && ++tries < 40) { setTimeout(settle, 150); return; }
        var pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
        var off = el.getBoundingClientRect().top - pad;
        if (Math.abs(off) > 4 && !zoomed()) lenis.scrollTo(window.scrollY + off, { duration: 0.45 });
      };
      setTimeout(settle, 200);   // dá tempo de o deslize do Lenis começar
    });
  }

  /* ---------- Entradas pela posição real na tela ----------
     Cards e títulos aparecem quando o topo deles chega a 98% da altura da tela
     (ou quando já passaram, em saltos por link). Isso lê a posição real de cada
     elemento, sem depender das contas do ScrollTrigger: se elas ficarem erradas
     (no iPhone isso deixava títulos e cards invisíveis), nada some. */
  var seen = [], seenDirty = false;
  function sweep() {
    // a lista mistura tipos (cards, títulos...): ordena pela posição no documento para o "stop" valer
    if (seenDirty) {
      seenDirty = false;
      seen.sort(function (a, b) { return a.el === b.el ? 0 : (a.el.compareDocumentPosition(b.el) & 4) ? -1 : 1; });
    }
    var vh = window.innerHeight, far = vh * 2.98, n = 0, stop = false;
    seen = seen.filter(function (it) {
      if (stop) return true;
      var top = it.el.getBoundingClientRect().top;
      // em ordem do documento: um elemento 2 telas abaixo -> os seguintes também estão (não mede o resto)
      if (top > far) { stop = true; return true; }
      if (top > vh * it.at) return true;
      it.fn(it.el, Math.min(n++ * 0.05, 0.2));   // vários de uma vez entram em cascata
      return false;
    });
  }
  // Com o Lenis, a leitura roda no começo do quadro do GSAP (prioritária), antes de o
  // ScrollTrigger e as outras animações escreverem estilos: a página ainda está calculada e
  // o getBoundingClientRect sai quase de graça. Num requestAnimationFrame comum ela rodava
  // depois dessas escritas e forçava o navegador a recalcular a página inteira a cada quadro.
  var sweepQueued = false;
  if (lenis) gsap.ticker.add(function () { if (sweepQueued) { sweepQueued = false; sweep(); } }, false, true);
  function queueSweep() {
    if (sweepQueued) return;
    sweepQueued = true;
    if (!lenis) requestAnimationFrame(function () { sweepQueued = false; sweep(); });
  }
  // at: fração da altura da tela que o topo do elemento precisa passar (padrão 98%)
  function whenSeen(el, fn, at) { seen.push({ el: el, fn: fn, at: at || 0.98 }); seenDirty = true; queueSweep(); }
  window.addEventListener('scroll', queueSweep, { passive: true });
  window.addEventListener('resize', queueSweep);

  /* ---------- Montagem em pedaços ----------
     O que fica mais abaixo na página (entradas dos cards, passos, Quem Somos, flores,
     arcos, títulos, carrosséis...) é montado logo depois, um pedaço por vez, cada um
     numa tarefa curta. Antes era tudo numa tarefa só de ~0,8 a 1,1 s no celular básico,
     em que a tela não respondia ao toque. O que aparece logo de cara (hero, cabeçalho,
     menu, cortinas, brilhos, contagem do Desde 2014) continua montando na hora. */
  var laterQueue = [];
  function later(fn) { laterQueue.push(fn); }
  function runLater() {
    var fn = laterQueue.shift();
    if (!fn) return;
    try { fn(); } catch (e) { setTimeout(function () { throw e; }); }   // um pedaço com erro não trava os outros
    if (laterQueue.length) setTimeout(runLater, 0);
  }

  /* Recalcula o ScrollTrigger quando a página muda de tamanho depois do cálculo
     inicial (fontes do Google, imagens, girar a tela...). Posição desatualizada
     fazia a Hero soltar na hora errada e seções passarem por cima dela. */
  if (ST) {
    var lastH = 0, refreshTimer = 0;
    var refreshSoon = function () { clearTimeout(refreshTimer); refreshTimer = setTimeout(function () { ST.refresh(); }, 250); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refreshSoon);
    window.addEventListener('orientationchange', refreshSoon);
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () {
        var h = document.body.scrollHeight;
        if (Math.abs(h - lastH) > 2) { lastH = h; refreshSoon(); }
      }).observe(document.body);
    }
  }

  /* ---------- Animação de entrada ---------- */
  // abre a cortina branca de uma foto de card quando a foto já chegou
  function openCurtain(box, delay) {
    var curtain = box.querySelector('.photo-curtain');
    var img = box.querySelector('img');
    var go = function () { gsap.to(curtain, { yPercent: 100, duration: 0.45, delay: delay, ease: 'power3.inOut' }); };
    if (!img || img.complete) go();
    else { img.addEventListener('load', go, { once: true }); img.addEventListener('error', go, { once: true }); }
  }
  function done(el) {
    // devolve o elemento ao CSS normal (hover dos cards volta a funcionar)
    el.classList.remove('reveal');
    el.style.opacity = el.style.transform = el.style.transition = '';
  }
  if (gsap && ST && !reduceMotion) {
    var show = function (el, delay) {
      gsap.to(el, {
        opacity: 1, y: 0, duration: 0.6, delay: delay, ease: 'power3.out', overwrite: true,
        onComplete: function () { done(el); }
      });
    };
    document.querySelectorAll('.reveal').forEach(function (el) { whenSeen(el, show); });

    // cortina branca das fotos dos cards (Serviços, Celebrações, Destaques): cobre a foto
    // desde a 1ª pintura (CSS) e desce saindo por baixo quando a foto aparece na tela e
    // já baixou. Celular fraco ou internet lenta: fica o branco até a foto chegar, em vez
    // do fundo roxo listrado. IntersectionObserver (e não whenSeen): no celular os cards
    // viram carrossel horizontal e cada foto só abre quando é arrastada para a tela.
    var cardCurtains = document.querySelectorAll('.photo > .photo-curtain');
    if ('IntersectionObserver' in window) {
      document.documentElement.classList.add('curtain-on');
      var curtainIO = new IntersectionObserver(function (entries) {
        var n = 0;
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          curtainIO.unobserve(e.target);
          openCurtain(e.target, 0.05 + Math.min(n++ * 0.05, 0.2));
        });
      }, { threshold: 0.2 });
      cardCurtains.forEach(function (c) { curtainIO.observe(c.parentElement); });
    } else {
      cardCurtains.forEach(function (c) { c.remove(); });
    }
  } else {
    document.querySelectorAll('.reveal').forEach(done);
    document.querySelectorAll('.photo-curtain').forEach(function (c) { c.remove(); });
  }

  /* ---------- AnimatedContent (React Bits, versão sem React) ----------
     Elementos com [data-ac] entram ao rolar: sobem `distance` px, aparecem e, com
     stagger, cada filho direto entra em sequência. As opções seguem as props do
     componente, em data-ac-*: data-ac-distance="100", data-ac-direction="horizontal",
     data-ac-stagger="0.08", data-ac-blur="6", data-ac-scale="0.9", data-ac-wipe="up"...
     O disparo usa whenSeen (posição real na tela) em vez do ScrollTrigger: no iPhone
     as contas dele deixavam coisas invisíveis. Sem GSAP ou com "reduzir movimento",
     o conteúdo só aparece. */
  var AC_WIPES = {
    up: 'linear-gradient(to top, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))',
    down: 'linear-gradient(to bottom, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))',
    left: 'linear-gradient(to left, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))',
    right: 'linear-gradient(to right, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))',
    center: 'radial-gradient(farthest-corner at 50% 50%, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))'
  };
  var AC_DEFAULTS = {
    distance: 100, direction: 'vertical', reverse: false, duration: 0.8, ease: 'power3.out',
    initialOpacity: 0, animateOpacity: true, scale: 1, blur: 0, rotate: 0, tilt: 0, wipe: 'none',
    threshold: 0.1, delay: 0, stagger: 0, staggerFrom: 'start'
  };
  function acOptions(el) {
    var o = {};
    Object.keys(AC_DEFAULTS).forEach(function (k) {
      var raw = el.getAttribute('data-ac-' + k.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }));
      var def = AC_DEFAULTS[k];
      if (raw === null) o[k] = def;
      else if (typeof def === 'number') o[k] = parseFloat(raw);
      else if (typeof def === 'boolean') o[k] = raw !== 'false';
      else o[k] = raw;
    });
    // cards em carrossel horizontal (celular): entram de lado, acompanhando o arraste
    if (el.hasAttribute('data-ac-carousel') && window.matchMedia('(max-width: 640px)').matches) o.direction = 'horizontal';
    return o;
  }
  function animatedContent(el) {
    var o = acOptions(el);
    var targets = o.stagger > 0 && el.children.length ? Array.prototype.slice.call(el.children) : [el];
    var horizontal = o.direction === 'horizontal';
    var axis = horizontal ? 'x' : 'y';
    var sign = o.reverse ? -1 : 1;
    var mask = AC_WIPES[o.wipe];

    var from = { scale: o.scale, opacity: o.animateOpacity ? o.initialOpacity : 1 };
    var to = { scale: 1, opacity: 1, duration: o.duration, ease: o.ease };
    from[axis] = o.distance * sign; to[axis] = 0;
    if (o.blur > 0) { from.filter = 'blur(' + o.blur + 'px)'; to.filter = 'blur(0px)'; }
    if (o.rotate) { from.rotation = o.rotate * sign; to.rotation = 0; }
    if (o.tilt) {
      var tiltAxis = horizontal ? 'rotationY' : 'rotationX';
      from[tiltAxis] = horizontal ? -o.tilt * sign : o.tilt * sign; to[tiltAxis] = 0;
      from.transformPerspective = to.transformPerspective = 900;
    }
    if (mask) {
      gsap.set(targets, { maskImage: mask, webkitMaskImage: mask });
      from['--ac-wipe'] = 0; to['--ac-wipe'] = 1;
    }
    if (o.stagger > 0) to.stagger = { each: o.stagger, from: o.staggerFrom };
    // ao terminar, devolve o elemento ao CSS normal (hover dos cards volta a funcionar)
    to.onComplete = function () {
      gsap.set(targets, { clearProps: mask ? 'filter,transform,maskImage,webkitMaskImage' : 'filter,transform' });
    };

    gsap.set(targets, from);
    gsap.set(el, { visibility: 'visible' });
    whenSeen(el, function () {
      to.delay = Math.max(o.delay, 0);
      gsap.to(targets, to);
    }, 1 - o.threshold);
  }
  // Avaliações no computador: o quebra-cabeça (abaixo) faz a entrada no lugar do AnimatedContent
  var puzzleOn = !!(gsap && ST && !reduceMotion && window.matchMedia('(min-width: 961px)').matches);
  /* Avaliações no celular (carrossel, até 640px): só a 1ª entra, na diagonal, vindo da
     direita e um pouco de baixo, girada, e assenta; as outras ficam paradas no lugar e
     o carrossel funciona normal. Anima o card de dentro (não a vaga do carrossel, que
     guarda o encaixe), dentro da folga do carrossel (26px embaixo) para não ser cortado,
     e por cima da beirada do 2º card enquanto entra. */
  function reviewsFirstIn(el) {
    if (!el.hasAttribute('data-puzzle') || !gsap || reduceMotion || !window.matchMedia('(max-width: 640px)').matches) return false;
    var slot = el.firstElementChild, card = slot && slot.firstElementChild;
    el.style.visibility = 'visible';
    if (!card) return true;
    gsap.set(slot, { position: 'relative', zIndex: 2 });
    gsap.set(card, { xPercent: 62, y: 16, rotation: 3, autoAlpha: 0 });
    whenSeen(el, function () {
      gsap.to(card, { xPercent: 0, y: 0, rotation: 0, autoAlpha: 1, duration: 0.9, ease: 'power3.out',
        onComplete: function () { gsap.set(card, { clearProps: 'transform,opacity,visibility' }); gsap.set(slot, { clearProps: 'position,zIndex' }); } });
    }, 0.85);
    return true;
  }

  later(function () {
    document.querySelectorAll('[data-ac]').forEach(function (el) {
      if (puzzleOn && el.hasAttribute('data-puzzle')) { el.style.visibility = 'visible'; return; }
      if (reviewsFirstIn(el)) return;
      if (gsap && !reduceMotion) animatedContent(el);
      else el.style.visibility = 'visible';
    });
  });

  /* ---------- Avaliações em quebra-cabeça (só computador, acima de 960px) ----------
     Cada card começa fora do lugar, do lado em que ele encaixa: a coluna da esquerda
     vem da esquerda, a da direita da direita, a do meio de cima ou de baixo; a linha
     de cima desce e a de baixo sobe. Chegam girados, menores e desfocados e se
     encaixam todos juntos (com pequenas diferenças de tempo), amarrados à rolagem:
     rolar para cima desmonta. Quando a última peça assenta, um brilho dourado passa
     pelos cards. Modo leve: sem o desfoque (o que mais pesa). */
  if (puzzleOn) later(function () {
    var grid = document.querySelector('[data-puzzle]');
    var pieces = grid ? Array.prototype.slice.call(grid.children) : [];
    if (pieces.length < 2) return;
    var cols = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').length);
    var rows = Math.ceil(pieces.length / cols);
    var lag = [0, 0.12, 0.05, 0.16, 0.02, 0.1];   // pequenas diferenças: não entram em fila
    var done = false;
    var tl = gsap.timeline({
      scrollTrigger: {
        // começa quando o grid aparece embaixo e termina quando ele está inteiro na tela:
        // as 6 peças se montam juntas, à vista
        trigger: grid, start: 'top 92%', end: 'bottom 88%', scrub: 1, invalidateOnRefresh: true,
        onUpdate: function (self) {
          var now = self.progress > 0.995;
          if (now !== done) { done = now; grid.classList.toggle('puzzle-done', now); }
        }
      }
    });
    pieces.forEach(function (p, i) {
      var c = i % cols, r = Math.floor(i / cols);
      var dx = c - (cols - 1) / 2;   // -1 esquerda, 0 meio, 1 direita
      var dy = r - (rows - 1) / 2;   // -0,5 em cima, 0,5 embaixo
      // espalhadas mais para os lados que para cima: a linha de cima não invade o título
      var from = {
        xPercent: dx * 85,
        yPercent: dy * 45 + (dx === 0 ? dy * 70 : 0) + 18,
        rotation: (dx !== 0 ? dx : (dy < 0 ? -1 : 1)) * (dy < 0 ? -1 : 1) * (7 + (i % 3) * 2.5),
        scale: 0.84,
        autoAlpha: 0,
        filter: perf.lite ? 'none' : 'blur(10px)'
      };
      var to = { xPercent: 0, yPercent: 0, rotation: 0, scale: 1, autoAlpha: 1, filter: perf.lite ? 'none' : 'blur(0px)',
        duration: 1, ease: 'power2.inOut' };
      tl.fromTo(p, from, to, lag[i % lag.length]);
    });
  });

  /* ---------- CountUp (React Bits, versão sem React, modo "count") ----------
     <span class="count-up" data-count="2014" data-count-from="1990">2014</span>
     O HTML já traz o número final (sem JS fica ele). Opções em data-count-*, como as
     props do componente: from, direction (up/down), duration (s), delay (s),
     easing (easeOut/linear/expo/spring), decimals, separator, prefix, suffix,
     format (standard/compact), replay ("false" desliga o replay ao passar o mouse).
     Usado só no selo "Desde 2014" (hero e Quem Somos) e no 4 de "Sua festa em 4 passos".
     Só começa quando o número está de fato visível: dentro de um card que ainda vai
     entrar, de um painel escondido do hero, de um título com as letras ainda separadas
     (o FoldText troca o HTML do título ao terminar, por isso o número é achado de novo
     pelo data-cu) ou de uma pergunta fechada do FAQ, ele espera. */
  var CU_EASE = {
    linear: function (t) { return t; },
    easeOut: function (t) { return 1 - Math.pow(1 - t, 3); },   // ≈ cubic-bezier(.33, 1, .68, 1)
    expo: function (t) { return t >= 1 ? 1 : (1 - Math.pow(2, -10 * t)) / (1 - Math.pow(2, -10)); },
    spring: (function (overshoot) {
      var log = Math.log(overshoot), zeta = -log / Math.sqrt(Math.PI * Math.PI + log * log);
      var damped = Math.PI / 0.52, natural = damped / Math.sqrt(1 - zeta * zeta);
      var raw = function (t) { return 1 - Math.exp(-zeta * natural * t) * (Math.cos(damped * t) + (zeta * natural / damped) * Math.sin(damped * t)); };
      var residual = 1 - raw(1);
      return function (t) { return t >= 1 ? 1 : raw(t) + residual * t * t * t; };
    })(0.06)
  };
  var CU_UNITS = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  function cuPlaces(n) { var s = String(n); return s.indexOf('.') > -1 && parseInt(s.split('.')[1], 10) !== 0 ? s.split('.')[1].length : 0; }
  function cuFormat(v, o) {
    var size = 1, label = '', digits = o.places;
    if (o.compact) {
      for (var i = 0; i < CU_UNITS.length; i++) if (Math.abs(v) >= CU_UNITS[i][0] * 0.9995) { size = CU_UNITS[i][0]; label = CU_UNITS[i][1]; break; }
      digits = o.decimals != null ? o.decimals : (label ? (Math.abs(v) / size < 100 ? 1 : 0) : o.places);
    }
    var fixed = (Math.abs(v) / size).toFixed(digits), parts = fixed.split('.');
    var int = o.separator ? parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, o.separator) : parts[0];
    var neg = v < 0 && Number(fixed) !== 0;
    return o.prefix + (neg ? '-' : '') + int + (parts[1] ? '.' + parts[1] : '') + label + o.suffix;
  }
  function cuShown(el) {
    if (el.closest('.is-split')) return false;
    if (!el.getClientRects().length) return false;            // <details> fechado, display none
    var r = el.getBoundingClientRect();
    if (r.right <= 0 || r.left >= window.innerWidth) return false;   // card do carrossel ainda fora da tela
    for (var n = el; n && n !== document.body; n = n.parentElement) {
      var cs = getComputedStyle(n);
      if (cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.6) return false;
    }
    return true;
  }
  var cuList = [];
  document.querySelectorAll('.count-up[data-count]').forEach(function (el, i) {
    var d = el.dataset, raw = d.count;
    var to = raw === 'year' ? new Date().getFullYear() : parseFloat(raw);
    var from = d.countFrom != null ? parseFloat(d.countFrom) : 0;
    var down = d.countDirection === 'down';
    var o = {
      id: String(i), start: down ? to : from, end: down ? from : to,
      duration: d.countDuration != null ? Math.max(0, parseFloat(d.countDuration)) : 2,
      delay: parseFloat(d.countDelay) || 0,
      ease: CU_EASE[d.countEasing] || CU_EASE.easeOut,
      decimals: d.countDecimals != null ? parseInt(d.countDecimals, 10) : null,
      separator: d.countSeparator || '', prefix: d.countPrefix || '', suffix: d.countSuffix || '',
      compact: d.countFormat === 'compact', replay: d.countReplay !== 'false',
      running: false, started: false
    };
    o.places = o.decimals != null ? o.decimals : Math.max(cuPlaces(from), cuPlaces(to));
    el.setAttribute('data-cu', o.id);
    el.setAttribute('aria-label', cuFormat(o.end, o));
    el.textContent = cuFormat(reduceMotion ? o.end : o.start, o);
    if (!reduceMotion) cuList.push(o);
  });
  function cuNode(o) { return document.querySelector('[data-cu="' + o.id + '"]'); }
  function cuRun(o, wait) {
    if (o.running) return;
    o.running = o.started = true;
    var t0 = 0;
    var frame = function (now) {
      if (!t0) t0 = now + (wait ? o.delay * 1000 : 0);
      var p = o.duration > 0 ? Math.min(1, Math.max(0, (now - t0) / (o.duration * 1000))) : 1;
      var node = cuNode(o);
      if (node) node.textContent = cuFormat(p >= 1 ? o.end : o.start + (o.end - o.start) * o.ease(p), o);
      if (p < 1) requestAnimationFrame(frame);
      else o.running = false;
    };
    requestAnimationFrame(frame);
  }
  if (cuList.length) {
    // whenSeen (e não IntersectionObserver): um número que passou direto num salto por
    // link também conta, em vez de ficar parado no valor inicial
    var cuWaiting = [], cuPolling = false;
    var cuPoll = function () {
      cuWaiting = cuWaiting.filter(function (o) {
        var node = cuNode(o);
        if (!node || !cuShown(node)) return true;
        cuRun(o, true);
        return false;
      });
      cuPolling = cuWaiting.length > 0;
      if (cuPolling) setTimeout(cuPoll, 150);
    };
    cuList.forEach(function (o) {
      whenSeen(cuNode(o), function () {
        cuWaiting.push(o);
        if (!cuPolling) { cuPolling = true; cuPoll(); }
      }, 1);   // como o useInView do componente: basta aparecer (o ano fica no pé da página)
    });
    // replayOnHover: conta de novo ao passar o mouse (delegado: sobrevive à troca de HTML do FoldText)
    document.addEventListener('pointerover', function (e) {
      var node = e.target.closest && e.target.closest('[data-cu]');
      if (!node) return;
      var o = cuList.filter(function (x) { return x.id === node.getAttribute('data-cu'); })[0];
      if (o && o.replay && o.started && !o.running) cuRun(o, false);
    });
  } else {
    cuList.forEach(function (o) { cuNode(o).textContent = cuFormat(o.end, o); });
  }

  /* ---------- Passos acendendo com o scroll ----------
     Um feixe dourado corre pela linha pontilhada, preenchendo-a, com um ponto de
     luz na ponta. Quando a luz chega num passo, o anel do círculo carrega (um ponto
     de luz gira junto), o ícone acende com um halo, o texto aparece e um lampejo
     se abre em volta do círculo.
     - A partir de 700px (computador, tablet, celular deitado): passos em linha,
       a luz corre na horizontal.
     - Celular em pé: linha do tempo vertical, a luz desce acompanhando a leitura.
     A linha vai do centro do 1º ao centro do último ícone, medida na tela (e
     remedida quando a largura muda ou as fontes carregam), e cada passo acende
     quando a luz chega no centro dele.
     Tudo amarrado ao scroll (rolar para cima apaga); o lampejo é por tempo e só
     na descida. Com "reduzir movimento" fica o desenho estático de sempre. */
  later(function () {
    var list = document.querySelector('.steps');
    if (!list || !gsap || !ST || reduceMotion) return;
    var steps = [].slice.call(list.children).map(function (li) {
      var icon = li.querySelector('.step-icon');
      ['step-glow', 'step-ring', 'step-dot', 'step-burst'].forEach(function (c) {
        var s = document.createElement('span');
        s.className = c;
        s.setAttribute('aria-hidden', 'true');
        icon.appendChild(s);
      });
      return {
        icon: icon, svg: icon.querySelector('svg'), dot: icon.querySelector('.step-dot'),
        glow: icon.querySelector('.step-glow'), burst: icon.querySelector('.step-burst'),
        text: li.querySelectorAll('h3, p')
      };
    });
    var track = document.createElement('li');
    track.className = 'steps-track';
    track.setAttribute('aria-hidden', 'true');
    track.innerHTML = '<span class="steps-fill"></span><span class="steps-spark"></span>';
    list.appendChild(track);
    list.classList.add('steps-lit');
    var fill = track.firstChild, spark = track.lastChild;

    function flash(s) {
      gsap.fromTo(s.burst, { scale: 1, opacity: 0.9 }, { scale: 1.55, opacity: 0, duration: 0.8, ease: 'power2.out' });
    }
    // acende o passo s a partir do tempo "at" da timeline; o anel leva "ring" para carregar
    function light(tl, s, at, ring) {
      tl.fromTo(s.icon, { '--ring': 0 }, { '--ring': 1, duration: ring, ease: 'power1.inOut' }, at)
        .fromTo(s.dot, { opacity: 0 }, { opacity: 1, duration: 0.08 }, at)
        .to(s.dot, { opacity: 0, duration: 0.1 }, at + ring - 0.1)
        .fromTo(s.svg, { opacity: 0.3 }, { opacity: 1, duration: 0.3 }, at + ring * 0.6)
        .fromTo(s.glow, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'power2.out' }, at + ring * 0.6)
        .fromTo(s.text, { opacity: 0.35 }, { opacity: 1, duration: 0.3 }, at + ring * 0.7)
        .call(function () { if (tl.scrollTrigger && tl.scrollTrigger.direction > 0) flash(s); }, null, at + ring);
    }

    var ctx = null, builtW = 0, rebuildTimer = 0;
    // largura do layout (não muda com o zoom de pinça, ao contrário do innerWidth no Safari)
    var layoutW = function () { return document.documentElement.clientWidth; };
    function build() {
      builtW = layoutW();
      if (ctx) ctx.revert();
      var col = window.matchMedia('(max-width: 699px)').matches;
      // centro de cada ícone em relação à lista: a = ao longo da linha, b = na outra direção
      var lr = list.getBoundingClientRect();
      var c = steps.map(function (s) {
        var r = s.icon.getBoundingClientRect(), x = r.left + r.width / 2 - lr.left, y = r.top + r.height / 2 - lr.top;
        return col ? { a: y, b: x } : { a: x, b: y };
      });
      var first = c[0].a, len = c[c.length - 1].a - first;
      if (len <= 0) return;
      track.className = 'steps-track' + (col ? ' is-col' : '');
      track.style.cssText = col
        ? 'top:' + first + 'px;height:' + len + 'px;left:' + (c[0].b - 1) + 'px;width:2px'
        : 'left:' + first + 'px;width:' + len + 'px;top:' + (c[0].b - 1) + 'px;height:2px';
      ctx = gsap.context(function () {
        var tl = gsap.timeline({
          defaults: { ease: 'none' },
          // termina com o último passo ainda bem visível para ser lido: na horizontal, com a
          // fileira no meio da tela; na vertical, com o último passo um pouco abaixo do meio.
          // scrub curto: a luz acompanha a rolagem quase sem atraso
          scrollTrigger: col
            ? { trigger: list, start: 'top 75%', end: 'bottom 68%', scrub: 0.3 }
            : { trigger: list, start: 'top 85%', end: 'center 58%', scrub: 0.3 }
        });
        // o feixe sai do 1º passo (já aceso) e acende os outros ao chegar no centro de cada um
        var lead = 0.4, run = 3;
        light(tl, steps[0], 0, 0.4);
        tl.fromTo(fill, col ? { scaleX: 1, scaleY: 0, transformOrigin: '50% 0%' } : { scaleX: 0, scaleY: 1, transformOrigin: '0% 50%' },
            col ? { scaleY: 1, duration: run } : { scaleX: 1, duration: run }, lead)
          .fromTo(spark, { x: 0, y: 0 }, col ? { y: len, duration: run } : { x: len, duration: run }, lead)
          .fromTo(spark, { opacity: 0 }, { opacity: 1, duration: 0.12 }, lead)
          .to(spark, { opacity: 0, duration: 0.15 }, lead + run - 0.05);
        for (var i = 1; i < steps.length; i++) light(tl, steps[i], lead + run * (c[i].a - first) / len - 0.08, 0.35);
      });
    }
    build();
    // remede quando a largura muda (girar a tela, redimensionar) ou as fontes chegam (o texto quebra diferente)
    window.addEventListener('resize', function () {
      if (zoomed() || layoutW() === builtW) return;   // zoom, ou celular com a barra de endereço mexendo só na altura
      clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(build, 200);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
  });

  /* ---------- Destaques do Quem Somos acendendo com o scroll ----------
     Mesmo efeito dos passos acima, sempre na vertical: a luz desce pela linha
     dourada entre os 3 ícones e cada um acende (anel carregando, brilho, lampejo)
     quando ela chega no centro dele. Reusa o CSS .step-* e .steps-track. */
  later(function () {
    var list = document.querySelector('.about-points');
    if (!list || !gsap || !ST || reduceMotion) return;
    var items = [].slice.call(list.children).map(function (li) {
      var icon = li.querySelector('.about-icon');
      ['step-glow', 'step-ring', 'step-dot', 'step-burst'].forEach(function (c) {
        var s = document.createElement('span');
        s.className = c;
        s.setAttribute('aria-hidden', 'true');
        icon.appendChild(s);
      });
      return {
        icon: icon, svg: icon.querySelector('svg'), dot: icon.querySelector('.step-dot'),
        glow: icon.querySelector('.step-glow'), burst: icon.querySelector('.step-burst'),
        text: li.querySelectorAll('h3, p')
      };
    });
    var track = document.createElement('li');
    track.className = 'steps-track is-col';
    track.setAttribute('aria-hidden', 'true');
    track.innerHTML = '<span class="steps-fill"></span><span class="steps-spark"></span>';
    list.appendChild(track);
    list.classList.add('points-lit');
    var fill = track.firstChild, spark = track.lastChild;

    function light(tl, s, at, ring) {
      tl.fromTo(s.icon, { '--ring': 0 }, { '--ring': 1, duration: ring, ease: 'power1.inOut' }, at)
        .fromTo(s.dot, { opacity: 0 }, { opacity: 1, duration: 0.08 }, at)
        .to(s.dot, { opacity: 0, duration: 0.1 }, at + ring - 0.1)
        .fromTo(s.svg, { opacity: 0.3 }, { opacity: 1, duration: 0.3 }, at + ring * 0.6)
        .fromTo(s.glow, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'power2.out' }, at + ring * 0.6)
        .fromTo(s.text, { opacity: 0.35 }, { opacity: 1, duration: 0.3 }, at + ring * 0.7)
        .call(function () {
          if (tl.scrollTrigger && tl.scrollTrigger.direction > 0) {
            gsap.fromTo(s.burst, { scale: 1, opacity: 0.9 }, { scale: 1.55, opacity: 0, duration: 0.8, ease: 'power2.out' });
          }
        }, null, at + ring);
    }

    var ctx = null, builtW = 0, rebuildTimer = 0;
    function build() {
      builtW = document.documentElement.clientWidth;
      if (ctx) ctx.revert();
      var lr = list.getBoundingClientRect();
      var c = items.map(function (s) {
        var r = s.icon.getBoundingClientRect();
        return { y: r.top + r.height / 2 - lr.top, x: r.left + r.width / 2 - lr.left };
      });
      var first = c[0].y, len = c[c.length - 1].y - first;
      if (len <= 0) return;
      track.style.cssText = 'top:' + first + 'px;height:' + len + 'px;left:' + (c[0].x - 1) + 'px;width:2px';
      ctx = gsap.context(function () {
        var tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: { trigger: list, start: 'top 80%', end: 'bottom 62%', scrub: 0.6 }
        });
        var lead = 0.4, run = 3;
        light(tl, items[0], 0, 0.4);
        tl.fromTo(fill, { scaleX: 1, scaleY: 0, transformOrigin: '50% 0%' }, { scaleY: 1, duration: run }, lead)
          .fromTo(spark, { x: 0, y: 0 }, { y: len, duration: run }, lead)
          .fromTo(spark, { opacity: 0 }, { opacity: 1, duration: 0.12 }, lead)
          .to(spark, { opacity: 0, duration: 0.15 }, lead + run - 0.05);
        for (var i = 1; i < items.length; i++) light(tl, items[i], lead + run * (c[i].y - first) / len - 0.08, 0.35);
      });
    }
    build();
    window.addEventListener('resize', function () {
      if (zoomed() || document.documentElement.clientWidth === builtW) return;
      clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(build, 200);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
  });

  /* ---------- Flores desabrochando com o scroll ----------
     Começam fechadas no canto (invisíveis, pequenas e giradas) e se abrem
     conforme a seção entra na tela: o buquê cresce a partir do canto e
     "desenrola" a rotação. Sem recorte: só o PNG transparente aparece.
     scrub amarra o progresso ao scroll: rolar para cima fecha de novo. */
  if (gsap && ST && !reduceMotion) later(function () {
    document.querySelectorAll('.bloom').forEach(function (el) {
      var img = el.querySelector('img');
      var o = el.getAttribute('data-origin');
      var dir = o.indexOf('100%') === 0 ? -1 : 1;   // lado direito gira ao contrário
      gsap.set([el, img], { transformOrigin: o });
      gsap.timeline({
        scrollTrigger: { trigger: el.parentElement, start: 'top 92%', end: 'center 50%', scrub: 1 }
      })
        .fromTo(el,
          { scale: 0.2, rotation: -15 * dir, autoAlpha: 0 },
          { scale: 1, rotation: 0, autoAlpha: 1, ease: 'power2.out', duration: 1 })
        .fromTo(img,
          { rotation: 20 * dir, scale: 0.8 },
          { rotation: 0, scale: 1, ease: 'back.out(1.4)', duration: 1 }, 0);
    });
  });

  /* ---------- Borda curva na troca de seção ----------
     A seção nova sobe com o topo em arco (bordas mais baixas que o meio) e o arco
     vai se achatando até virar reta quando ela chega no alto da tela. O resto da
     página faz isso por cima da Hero parada; as faixas lilás, por cima do conteúdo
     claro. Amarrado ao scroll: rolar para cima curva de novo. */
  // computador (sequência) e celular (vídeo): nos dois a Hero fica presa enquanto o resto sobe
  if (gsap && ST && !reduceMotion && /\bhero-(seq|vid)\b/.test(document.documentElement.className)) later(function () {
    [
      // [elemento, altura do arco (fração da largura, máximo em px), onde fica reto]
      ['.page-rest', 0.18, 240, 'top 6%'],
      ['.promo-band', 0.12, 150, 'top 35%'],
      ['.final-cta', 0.12, 150, 'top 35%']
    ].forEach(function (c) {
      var el = document.querySelector(c[0]);
      if (!el) return;
      // o arco vai num fundo à parte (nas faixas lilás, com brilhos e fitas dentro):
      // mudar o arco da seção inteira repintava tudo a cada quadro (o .page-rest tem
      // ~8000 px e travava a troca da Hero para os Serviços). As flores ficam fora
      // dele e não são cortadas pelo arco enquanto desabrocham
      var shape = document.createElement('div');
      shape.className = 'curve-bg curve-top';
      shape.setAttribute('aria-hidden', 'true');
      // Faixa alta (FAQ): os brilhos ficam fora do recorte do arco e começam abaixo dele.
      // Dentro do arco, a camada dos brilhos (do tamanho da faixa, ~2000 px) era recortada
      // de novo a cada quadro e a faixa travava ao rolar.
      var tall = el.offsetHeight > window.innerHeight * 1.2;
      el.querySelectorAll(':scope > .sparkle-field, :scope > .ribbon').forEach(function (d) {
        if (tall && d.classList.contains('sparkle-field')) { d.style.top = c[2] + 'px'; return; }
        shape.appendChild(d);
      });
      el.insertBefore(shape, el.firstChild);
      var edge = document.createElement('div');   // sombra e fio do arco (ver .curve-edge no CSS)
      edge.className = 'curve-edge curve-top';
      edge.setAttribute('aria-hidden', 'true');
      el.insertBefore(edge, shape.nextSibling);
      el.classList.add('curve-band');
      // --curve só no fundo e na borda: na seção, a variável (herdada) fazia o navegador
      // recalcular o estilo de tudo que há dentro dela a cada quadro do scroll
      gsap.fromTo([shape, edge],
        { '--curve': function () { return Math.min(window.innerWidth * c[1], c[2]) + 'px'; } },
        { '--curve': '0px', ease: 'none',
          scrollTrigger: { trigger: el, start: 'top bottom', end: c[3], scrub: true, invalidateOnRefresh: true } });
    });
  });

  /* ---------- Balão dourado em Celebrações ----------
     Aparece aos poucos embaixo, sobe em zigue-zague acompanhando o scroll e
     some perto do topo da seção. scrub: rolar para cima traz o balão de volta. */
  var balloon = document.querySelector('.balloon');
  if (balloon && gsap && ST && !reduceMotion) later(function () {
    var sec = balloon.parentElement;
    var rise = function (f) { return function () { return -sec.offsetHeight * f; }; };
    var step = { duration: 1, ease: 'sine.inOut' };
    gsap.timeline({
      scrollTrigger: { trigger: sec, start: 'top 75%', end: 'bottom 35%', scrub: 1.2, invalidateOnRefresh: true }
    })
      .fromTo(balloon, { autoAlpha: 0, y: 60, x: 0, rotation: -4 },
        { autoAlpha: 1, y: rise(0.14), x: 30, rotation: 5, duration: 1, ease: 'sine.out' })
      .to(balloon, Object.assign({ y: rise(0.32), x: -4, rotation: -5 }, step))
      .to(balloon, Object.assign({ y: rise(0.5), x: 34, rotation: 5 }, step))
      .to(balloon, Object.assign({ y: rise(0.68), x: 0, rotation: -4 }, step))
      .to(balloon, Object.assign({ y: rise(0.86), x: 28, rotation: 4, autoAlpha: 0 }, step));
  });

  /* ---------- Entrada do cabeçalho e da barra de diferenciais ----------
     Ao abrir o site, a barra do cabeçalho e a barra de diferenciais do hero
     desdobram a partir da borda de cima, e os textos delas desdobram letra a
     letra com o mesmo efeito dos títulos. */
  if (foldOn) {
    var bars = [document.querySelector('.header-bar'), document.querySelector('.feature-bar')];
    var barFrom = { rotationX: -70, transformPerspective: 900, transformOrigin: '50% 0%', autoAlpha: 0, filter: 'brightness(' + (1 - FOLD.crease) + ')' };
    var barTo = { rotationX: 0, autoAlpha: 1, filter: 'brightness(1)', duration: 0.9, ease: FOLD.ease, clearProps: 'transform,filter' };
    gsap.fromTo(bars[0], barFrom, Object.assign({ delay: 0.05 }, barTo));
    gsap.fromTo(bars[1], barFrom, Object.assign({ delay: 0.45 }, barTo));
    var charsOf = function (sel) {
      var list = [];
      document.querySelectorAll(sel).forEach(function (el) {
        // só o que está à vista: no celular os links do menu fechado (invisível) e as
        // descrições da barra (escondidas) eram divididos em letras e animados à toa,
        // ~0,3 s de processador no celular básico antes da página responder
        if (!el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') return;
        list.push.apply(list, splitChars(el));
      });
      return list;
    };
    var unsplitAll = function (sel) { return function () { document.querySelectorAll(sel).forEach(unsplit); }; };
    gsap.fromTo(document.querySelectorAll('.header-bar .brand-logo, .menu-toggle'),
      { autoAlpha: 0, scale: 0.6, rotation: -12, transition: 'none' },   // sem a transição de hover do CSS no meio
      { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.8, delay: 0.25, ease: 'back.out(1.7)', clearProps: 'transform,transition' });
    gsap.fromTo(charsOf('.main-nav a, .header-cta'), foldFrom,
      foldTo({ delay: 0.3, stagger: 0.012, clearProps: 'transform,filter', onComplete: unsplitAll('.main-nav a, .header-cta') }));
    gsap.fromTo(charsOf('.hero-copy .eyebrow'), foldFrom,
      foldTo({ delay: 0.5, stagger: 0.02, clearProps: 'transform,filter', onComplete: function () { unsplitAll('.hero-copy .eyebrow')(); document.querySelector('.hero-copy .eyebrow').classList.add('fold-shown'); } }));
    gsap.fromTo(charsOf('.feature-bar strong, .feature-bar div > span'), foldFrom,
      foldTo({ delay: 0.7, stagger: 0.012, clearProps: 'transform,filter', onComplete: unsplitAll('.feature-bar strong, .feature-bar div > span') }));
  }

  if (foldOn) later(function () {
    document.querySelectorAll(
      '.section-title h2, .promo-band h2, .promo-gold, .final-inner h2, .final-script, ' +
      '.service-card h3, .celebration-card h3, .venue-card h3, .steps h3, .site-footer h2'
    ).forEach(function (el) {
      // O título fica invisível inteiro e só vira letras quando chega na tela: dividir os
      // ~30 títulos já no carregamento deixava ~630 letras giradas em 3D na página, que
      // pesavam o carregamento e a rolagem no celular. (Só visibility: a opacidade dos
      // títulos dos passos é animada pela linha que acende.)
      el.style.visibility = 'hidden';
      whenSeen(el, function (e, delay) {
        el.style.visibility = '';
        // card do carrossel do celular ainda fora da tela (para o lado): aparece pronto,
        // sem animar letra por letra onde ninguém vê
        var r = el.getBoundingClientRect();
        if (r.right <= 0 || r.left >= window.innerWidth) return;
        var chars = splitChars(el);
        gsap.set(chars, foldFrom);
        var to = foldTo({ delay: delay, clearProps: 'transform,filter', onComplete: function () { unsplit(el); } });
        if (perf.lite) { delete to.filter; gsap.set(chars, { filter: 'none' }); }
        gsap.to(chars, to);
      });
    });
  });

  /* ---------- ScrollFloat (Quem Somos) ----------
     Versão sem React do ScrollFloat do React Bits, efeito "float": cada letra sobe
     esticada (scaleY 2.3) de dentro da própria palavra e assenta, uma depois da outra.
     Quando o título chega na tela, a etiqueta, o título e os dois parágrafos se
     escrevem sozinhos, em sequência (os pontos, parceiros e botões aparecem
     normais). Toca uma vez só, sem depender do scroll. O texto original fica num
     .sr-only para leitores de tela; sem GSAP ou com "reduzir movimento" tudo aparece normal. */
  later(function () {
    if (!gsap || !ST || reduceMotion) return;
    // letra a letra, em ordem de leitura: cada letra dura pouco perto do intervalo entre
    // elas, então só umas poucas estão subindo ao mesmo tempo
    var SF = { total: 3, duration: 0.35, stretch: 2.3, distance: 120, ease: 'back.out(1.6)' };   // total: segundos do texto todo
    var all = [];

    function floatText(el) {
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      var nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      // pedaços de texto separados por espaço: "@flordelotus.ilhabela" + <small> não grudam
      var plain = nodes.map(function (n) { return n.textContent; }).join(' ').replace(/\s+/g, ' ').trim();
      if (!plain) return;
      nodes.forEach(function (node) {
        if (!node.textContent.trim()) return;
        var wrap = document.createElement('span');
        wrap.className = 'sf-text';
        wrap.setAttribute('aria-hidden', 'true');
        node.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { wrap.appendChild(document.createTextNode(' ')); return; }
          var word = document.createElement('span');
          word.className = 'sf-word';
          Array.from(part).forEach(function (ch) {
            var c = document.createElement('span');
            c.className = 'sf-char';
            c.textContent = ch;
            word.appendChild(c);
          });
          wrap.appendChild(word);
        });
        node.parentNode.replaceChild(wrap, node);
      });
      var sr = document.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = plain;
      el.insertBefore(sr, el.firstChild);

      var chars = el.querySelectorAll('.sf-char');
      // estado inicial em todas as letras já: o fromTo com stagger só aplicava nas
      // primeiras, e as letras de mais adiante apareciam antes da vez delas
      // (sem will-change: eram ~300 camadas presas desde o carregamento, pesando a rolagem
      // da página toda; o GSAP já põe cada letra numa camada só enquanto ela anima)
      gsap.set(chars, { opacity: 0, yPercent: SF.distance, scaleY: SF.stretch, scaleX: Math.pow(SF.stretch, -0.43), transformOrigin: '50% 0%' });
      all.push.apply(all, chars);
    }

    var title = document.querySelector('#quem-somos .about-title');
    if (!title) return;
    document.querySelectorAll('#quem-somos .about-title, #quem-somos .about-copy > p').forEach(floatText);
    whenSeen(title, function () {
      gsap.to(all, { duration: SF.duration, stagger: (SF.total - SF.duration) / Math.max(all.length - 1, 1), ease: SF.ease, opacity: 1, yPercent: 0, scaleY: 1, scaleX: 1 });
    }, 0.85);
  });

  /* ---------- Quem Somos: fotos e selo ----------
     Ao chegar na tela: a foto grande sobe e a imagem dentro dela desfaz um zoom;
     a foto pequena chega na diagonal (do canto de baixo à direita) endireitando;
     o selo dourado sobe de baixo até o lugar dele. Depois, ao rolar, a foto
     pequena e o selo andam um pouco mais rápido que a grande (profundidade).
     Disparo pelo whenSeen, como o AnimatedContent. Sem GSAP ou com "reduzir
     movimento" tudo fica parado no lugar. */
  later(function () {
    var media = document.querySelector('#quem-somos .about-media');
    if (!media || !gsap || !ST || reduceMotion) return;
    var main = media.querySelector('.about-photo-main');
    var detail = media.querySelector('.about-photo-detail');
    var seal = media.querySelector('.about-seal');
    var mainImg = main.querySelector('img');

    gsap.set(main, { autoAlpha: 0, y: 60, scale: 0.94 });
    gsap.set(mainImg, { scale: 1.25 });
    gsap.set(detail, { autoAlpha: 0, xPercent: 55, yPercent: 55, rotation: 8 });
    gsap.set(seal, { autoAlpha: 0, y: 220 });

    whenSeen(media, function () {
      gsap.timeline()
        .to(main, { autoAlpha: 1, y: 0, scale: 1, duration: 1, ease: 'power3.out' })
        .to(mainImg, { scale: 1, duration: 1.6, ease: 'power2.out' }, 0)
        .to(detail, { autoAlpha: 1, xPercent: 0, yPercent: 0, rotation: 0, duration: 1.1, ease: 'power3.out' }, 0.35)
        .to(seal, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'back.out(1.5)' }, 0.55);
    }, 0.85);

    // profundidade ao rolar: propriedades diferentes das da entrada (y do detalhe, yPercent do selo)
    gsap.timeline({ scrollTrigger: { trigger: media, start: 'top bottom', end: 'bottom top', scrub: 1 } })
      .fromTo(detail, { y: 40 }, { y: -40, ease: 'none' }, 0)
      .fromTo(seal, { yPercent: 40 }, { yPercent: -40, ease: 'none' }, 0);
  });

  /* ---------- Brilhos só animam quando a seção está na tela ---------- */
  if (ST) {
    document.querySelectorAll('.sparkle-field').forEach(function (field) {
      // começa pausado: o onToggle só dispara na 1ª entrada na tela
      var st = ST.create({
        trigger: field.parentElement, start: 'top bottom', end: 'bottom top',
        onToggle: function (self) { field.classList.toggle('off', !self.isActive); }
      });
      field.classList.toggle('off', !st.isActive);
    });
  }

  /* ---------- Hero fora da tela sai da conta do navegador ----------
     Depois de passar do hero, as camadas dele (fotos com neon, mapa, canvas) seguiam
     na conta: com os brilhos do FAQ animando, o navegador recalculava todas elas a
     cada quadro e o FAQ travava. Longe da tela o hero ganha .is-away
     (content-visibility: hidden) e volta meia tela antes de reaparecer. */
  (function () {
    var sticky = document.querySelector('.hero-sticky');
    if (!sticky || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (entries) {
      sticky.classList.toggle('is-away', !entries[0].isIntersecting);
    }, { rootMargin: '50% 0px' }).observe(sticky);
  })();

  window.addEventListener('load', function () { if (ST) ST.refresh(); });

  /* ---------- Carrosséis do celular: setas e bolinhas ----------
     No celular os cards viram carrossel horizontal (.grid-3/.grid-4 até 640px) e nem
     todo mundo percebe que dá para arrastar. Embaixo de cada carrossel entram setas
     (anterior/próximo) e bolinhas mostrando em qual card você está. No computador e
     no tablet o CSS esconde. As contas usam offsetLeft (e não getBoundingClientRect)
     porque o AnimatedContent ainda pode estar empurrando os cards com transform. */
  later(function () {
  function centerCard(grid, slot, smooth) {
    var left = slot.offsetLeft + slot.offsetWidth / 2 - grid.clientWidth / 2;
    grid.scrollTo({ left: left, behavior: smooth && !reduceMotion ? 'smooth' : 'auto' });
  }
  var CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  document.querySelectorAll('[data-ac-carousel]').forEach(function (grid) {
    var slots = Array.prototype.slice.call(grid.children);
    if (slots.length < 2) return;
    // carrossel sem link/botão dentro (ex.: Celebrações): enquanto ele rola para o lado, vira
    // uma parada do Tab com nome, para quem usa teclado conseguir rolar com as setas
    if (!grid.querySelector('a, button, input, [tabindex]')) {
      var sec = grid.closest('section'), h = sec && sec.querySelector('h2');
      grid.setAttribute('aria-label', (h ? h.textContent.trim() : 'Carrossel') + ' (role para o lado)');
      var focusable = function () {
        if (grid.scrollWidth > grid.clientWidth + 1) { grid.tabIndex = 0; grid.setAttribute('role', 'region'); }
        else { grid.removeAttribute('tabindex'); grid.removeAttribute('role'); }
      };
      focusable();
      window.addEventListener('resize', focusable);
    }
    var nav = document.createElement('div');
    nav.className = 'carousel-nav';
    nav.innerHTML =
      '<button type="button" class="carousel-arrow" aria-label="Card anterior">' + CHEVRON + '</button>' +
      '<span class="carousel-dots" aria-hidden="true">' + slots.map(function () { return '<i class="carousel-dot"></i>'; }).join('') + '</span>' +
      '<button type="button" class="carousel-arrow carousel-next" aria-label="Próximo card">' + CHEVRON + '</button>';
    grid.parentNode.insertBefore(nav, grid.nextSibling);
    var prev = nav.firstChild, next = nav.lastChild;
    var dots = nav.querySelectorAll('.carousel-dot');
    var current = -1, queued = false;
    function update() {
      queued = false;
      var mid = grid.scrollLeft + grid.clientWidth / 2, best = 0, bestD = Infinity;
      slots.forEach(function (s, i) {
        var d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - mid);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best === current) return;
      if (current >= 0) dots[current].classList.remove('is-on');
      dots[best].classList.add('is-on');
      current = best;
      prev.disabled = best === 0;
      next.disabled = best === slots.length - 1;
    }
    function queue() { if (!queued) { queued = true; requestAnimationFrame(update); } }
    grid.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    prev.addEventListener('click', function () { centerCard(grid, slots[Math.max(current - 1, 0)], true); });
    next.addEventListener('click', function () { centerCard(grid, slots[Math.min(current + 1, slots.length - 1)], true); });
    update();
  });

  /* ---------- Barra do hero → card do serviço ----------
     Decoração, Recreação infantil, Buffet de Pizza e Espaço levam ao card do serviço. O
     deslize é feito aqui e não pelas âncoras do Lenis: antes de entrar, o card
     ainda está 100px abaixo (AnimatedContent) e o Lenis parava 100px depois.
     A posição vem do offsetTop, que não conta o transform. No celular o
     carrossel já gira até o card e, quando ele aparece, ganha um aro dourado. */
  document.querySelectorAll('.feature-link').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var slot = document.querySelector(link.getAttribute('href'));
      if (!slot) return;
      e.preventDefault();
      e.stopPropagation();   // o clique não chega no Lenis (window)
      var y = 0;
      for (var el = slot; el; el = el.offsetParent) y += el.offsetTop;
      y -= parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      if (lenis) lenis.scrollTo(y);
      else window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
      if (slot.parentElement.scrollWidth > slot.parentElement.clientWidth) centerCard(slot.parentElement, slot, false);
      slot.classList.remove('is-pointed');
      if (!('IntersectionObserver' in window)) return;
      var io = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        slot.classList.add('is-pointed');
        setTimeout(function () { slot.classList.remove('is-pointed'); }, 2000);
      }, { threshold: 0.6 });
      io.observe(slot);
    });
  });
  });

  /* ---------- Cabeçalho do celular ganha fundo depois do hero ----------
     Sobre o hero o menu e o "Orçamento" ficam soltos, sem barra. Quando o resto da
     página passa por baixo deles, entra um fundo claro atrás (.is-solid no CSS);
     sem ele o texto das seções ficava embaixo dos botões. */
  (function () {
    var header = document.querySelector('.site-header');
    var rest = document.querySelector('.page-rest');
    if (!header || !rest) return;
    var queued = false;
    function check() {
      queued = false;
      header.classList.toggle('is-solid', rest.getBoundingClientRect().top < header.offsetHeight);
    }
    // com o Lenis, lê no começo do quadro do GSAP (antes das escritas), como as entradas acima
    if (lenis) gsap.ticker.add(function () { if (queued) check(); }, false, true);
    function queue() { if (!queued) { queued = true; if (!lenis) requestAnimationFrame(check); } }
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    check();
  })();

  /* ---------- Formulário → WhatsApp ---------- */
  var form = document.getElementById('waForm');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var nome = form.nome.value.trim();
    var festa = form.festa.value.trim();
    // só espaços passava pelo "required" e a mensagem saía "Meu nome é ."
    if (!nome) { form.nome.value = ''; form.reportValidity(); return; }
    var msg = 'Olá, Maria Festinha! Meu nome é ' + nome + '.';
    if (festa) msg += ' Gostaria de um orçamento para: ' + festa + '.';
    else msg += ' Gostaria de um orçamento.';
    window.open('https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  });

  /* ---------- Botão especular: brilho na borda que segue o mouse ----------
     Baseado num componente React (SpecularButton); aqui só o efeito visual,
     recriado em CSS vars + mousemove. Some fora de um raio de 250px do botão
     e em toque/"reduzir movimento" (fica só a borda normal do btn-outline). */
  later(function () {
    if (reduceMotion) return;
    var els = document.querySelectorAll('.btn-specular');
    if (!els.length || matchMedia('(pointer: coarse)').matches) return;

    var PROXIMITY = 250;
    var raf = null, mx = 0, my = 0;

    function update() {
      raf = null;
      els.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        var dist = Math.hypot(mx - cx, my - cy);
        if (dist > PROXIMITY) { el.style.setProperty('--spec-op', 0); return; }
        var px = ((mx - r.left) / r.width) * 100;
        var py = ((my - r.top) / r.height) * 100;
        var angle = Math.atan2(my - cy, mx - cx) * 180 / Math.PI + 90;
        el.style.setProperty('--spec-angle', angle + 'deg');
        el.style.setProperty('--spec-x', px + '%');
        el.style.setProperty('--spec-y', py + '%');
        el.style.setProperty('--spec-op', 1 - dist / PROXIMITY);
      });
    }

    window.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      if (!raf) raf = requestAnimationFrame(update);
    }, { passive: true });
  });

  /* ---------- WhatsApp flutuante some sobre as perguntas e o formulário ----------
     No celular e no tablet o botão fica em cima do "+" das perguntas do FAQ e do
     "Enviar pelo WhatsApp" do formulário do rodapé. Enquanto um deles está na tela e o
     botão cai sobre ele, o botão se esconde (os dois já levam ao WhatsApp). No
     computador largo não há sobreposição. */
  (function () {
    var fabBtn = document.querySelector('.wa-float');
    var targets = [document.querySelector('.faq'), document.getElementById('waForm')].filter(Boolean);
    if (!fabBtn || !targets.length || !('IntersectionObserver' in window)) return;
    var onScreen = [];
    function check() {
      // borda esquerda do botão pelo CSS (offsetWidth ignora a escala de quando está escondido)
      var fabLeft = window.innerWidth - (parseFloat(getComputedStyle(fabBtn).right) || 0) - fabBtn.offsetWidth;
      var over = onScreen.some(function (el) { return el.getBoundingClientRect().right > fabLeft - 8; });
      fabBtn.classList.toggle('over-faq', over);
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var i = onScreen.indexOf(e.target);
        if (e.isIntersecting && i < 0) onScreen.push(e.target);
        if (!e.isIntersecting && i >= 0) onScreen.splice(i, 1);
      });
      check();
    });
    targets.forEach(function (el) { io.observe(el); });
    window.addEventListener('resize', check);
  })();

  /* ---------- Fundo do FAQ não muda ao abrir uma pergunta ----------
     A faixa cresce quando uma pergunta abre. O degradê (em % da altura) e os brilhos
     (em % da camada) esticavam junto e o fundo mudava de desenho. Aqui eles ficam presos
     na altura com tudo fechado (--faq-h, usada no CSS); o que cresce embaixo fica na cor
     final do degradê. Abertas no meio da conta (resize) são descontadas. */
  (function () {
    var band = document.querySelector('.final-cta.has-faq');
    if (!band) return;
    function lock() {
      var h = band.offsetHeight;
      band.querySelectorAll('.faq details[open]').forEach(function (d) {
        h -= d.clientHeight - d.querySelector('summary').offsetHeight;   // clientHeight: sem a borda do card
      });
      band.style.setProperty('--faq-h', h + 'px');
      var field = band.querySelector('.sparkle-field');
      if (field) { field.style.bottom = 'auto'; field.style.height = Math.max(0, h - field.offsetTop) + 'px'; }
    }
    lock();
    later(lock);   // depois do arco (mais acima), que desce os brilhos para baixo dele
    band.addEventListener('toggle', lock, true);
    window.addEventListener('load', lock);
    window.addEventListener('resize', lock);
  })();

  // pedaços de baixo: um por tarefa, depois de tudo que monta na hora
  setTimeout(runLater, 0);

  /* ---------- Ano no rodapé ---------- */
  var yearEl = document.getElementById('year');
  yearEl.textContent = new Date().getFullYear();
})();
