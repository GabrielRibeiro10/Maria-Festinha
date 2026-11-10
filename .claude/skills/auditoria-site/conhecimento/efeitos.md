# Efeitos: custo, como medir e como ficam no modo leve

Uma ficha por efeito. O marcador `<!-- efeito: id -->` é o mesmo id que o `descobrir.js` mostra; efeito sem ficha
aparece lá como NOVO. Ficha nova: copie o formato, meça antes de escrever e marque `confirmado (medido)` ou
`observação (não medida)`.

Formato: **Custo** (onde pesa: processador, placa de vídeo, rede) · **Medir** (como confirmar que é ele) · **Modo
leve** (versão parada mais próxima do visual) · **Cuidados** (defeitos conhecidos) · **Visto em**.

---

<!-- efeito: modo-leve -->
## Modo leve (o sistema, não um efeito)
- **O que é:** classe `leve` no `<html>` que desliga/para o que pesa em aparelho fraco. Sem ele, o aparelho fraco roda
  tudo. **Obrigatório em todo site** (SKILL.md, passo 0b).
- **Detecção oficial:** `modelos/modo-leve.js` (cópia universal do `js/desempenho.js` do portfólio). No `<head>`, antes
  do CSS, sem `defer`. Pistas: placa de vídeo sem aceleração ou da lista de placas fracas, teste de processador
  (< 350 = fraco), até 2 núcleos/2 GB (fora do Safari), economia de dados/2G; perfil guardado 30 dias; rede de
  segurança: duas janelas seguidas de 2 s com mediana acima de 40 ms (< 25 fps) liga no meio do uso. Evento
  `leve:liga`; `?leve=1`, `?leve=0`, `?leve=info`.
- **Por que um modelo único (visto: Maria Festinha, o dono reclamou que o leve não ligava no celular):** o site tinha
  detecção própria, no `main.js` (com `defer`, depois da 1ª pintura), só com memória ≤ 2 GB / núcleos ≤ 2 (quase
  nenhum celular atual), "sem placa de vídeo" (todo celular tem), bateria baixa (só Android) e fluidez pela mediana;
  sem teste de processador, sem lista de placas fracas, sem lembrar a decisão. Trocado pelo modelo: o site passou a
  ligar o modo leve antes de desenhar, e os aparelhos fracos simulados ficaram mais leves ainda
  (travadas 0,17-0,22 s, antes 0,3-0,9 s).
- **Testar a detecção:** abrir com `prepararModo(p, 'normal')` (finge placa de vídeo, inclusive
  `failIfMajorPerformanceCaveat`) em celular/PC bom → tem que ficar normal; sem fingir → liga com motivo `gpu`.
  O teste de processador com a lentidão simulada do Chrome dá ~360-380 no "fraco" (perto do limite de 350): o teste
  não reproduz bem um celular fraco real; no aparelho, confira com `?leve=info`. Num PC sem placa de vídeo, a rede de
  segurança liga sozinha ("fps") porque a tela grande é desenhada no processador.
- **Cuidados:** todo efeito confere a classe ao começar e escuta `leve:liga`; mudou um script colado no `<head>`,
  recalcule o hash da CSP.
- **Visto em:** portfólio (original), Maria Festinha (instalado). — confirmado

<!-- efeito: scroll-scrub -->
## Animações presas à rolagem (GSAP ScrollTrigger com `scrub`/`onUpdate`)
- **Custo:** processador, a cada quadro de rolagem, para cada gatilho ativo; escreve estilos e força recálculo se algo
  medir posição depois (ver `causas.md`, layout forçado). Muitas (10+) somadas pesam em aparelho fraco.
- **Medir:** `descobrir.js` conta os gatilhos; perfil de JS mostra o tempo do GSAP (`render`, `_renderCSSTransforms`).
  Para medir o teto: `desempenho.js --js="ScrollTrigger.getAll().forEach(t=>{t.animation&&t.animation.progress(1);t.kill()})"`.
  No Maria Festinha (13 gatilhos), desligar todos rendeu pouco (12,7 → 11,4 s; depois das outras correções,
  1,9 → 1,1 s): ataque primeiro letras, quadros e iframes.
- **Modo leve:** estado final direto (sem `scrub`) ou entrada simples (`opacity`/`transform`) disparada uma vez.
- **Visto em:** portfólio (8), Maria Festinha (13). — confirmado (medido)

<!-- efeito: scroll-pin -->
## Seção presa na tela enquanto rola (ScrollTrigger `pin`)
- **Custo:** processador (recalcula posições); risco de a página pular se o cálculo ficar velho (fontes, imagens).
- **Medir:** CLS no `desempenho.js`; `ScrollTrigger.refresh()` depois de fontes/imagens.
- **Modo leve:** geralmente pode ficar (é estrutura), mas sem animações presas dentro dele.
- **Visto em:** — observação (não medida)

<!-- efeito: rolagem-suave -->
## Rolagem suave (Lenis, Locomotive)
- **Custo:** processador; cada quadro chama `scrollTo` (que aparece caro no perfil, mas é o trabalho normal de mover).
- **Medir:** desligar no modo leve e medir. No Maria Festinha, duas vezes (antes e depois das outras correções),
  tirar o Lenis diminuiu as travadas longas mas **subiu o quadro médio** (~30 → ~40 ms): a rolagem nativa em
  saltos repinta mais por quadro. Não é a primeira coisa a desligar.
- **Modo leve:** manter, salvo se a medição mostrar ganho nos dois números (travadas e quadro médio).
- **Visto em:** portfólio, Maria Festinha. — confirmado (medido)

<!-- efeito: webgl-3d -->
## 3D/WebGL (three.js ou canvas WebGL)
- **Custo:** placa de vídeo e memória; montar a cena pode travar 0,5-1,5 s.
- **Medir:** no teste o custo sai exagerado (sem placa de vídeo, `GLES2::ReadPixels`): esconda o canvas com `--css`
  para medir o resto. O custo real só num aparelho.
- **Modo leve:** versão desenhada/imagem parada; montar a cena só com o navegador parado (`requestIdleCallback`).
- **Cuidados:** Safari pode deixar o canvas em branco (ver `safari-iphone.md`).
- **Visto em:** portfólio (crachá 3D). — confirmado (medido)

<!-- efeito: canvas -->
## Canvas 2D animado
- **Custo:** processador (desenho) e memória (canvas grande × `devicePixelRatio`).
- **Medir:** perfil de JS (função que desenha); `--css` escondendo o canvas **não** para o JS — use uma flag.
- **Modo leve:** menos quadros por segundo, resolução menor, ou imagem parada. **Se o canvas mostra vídeo ou quadros
  presos à rolagem, não para:** ver `sequencia-quadros`.
- **Cuidados:** Safari em branco (ver `safari-iphone.md`).
- **Visto em:** Maria Festinha (abertura). — observação

<!-- efeito: sequencia-quadros -->
## Sequência de quadros trocada pela rolagem (centenas de imagens, GSAP ScrollTrigger)
- **Regra do dono:** é vídeo, **não congela nem some no modo leve**: fica mais leve.
- **Custo:** rede (megabytes: 477 quadros ≈ 11-21 MB no computador) e processador (baixar, decodificar, desenhar a cada
  quadro de rolagem). Pesa mais em tela grande (PC).
- **Medir:** `erros.js` mostra o peso por aparelho; perfil de JS mostra `fetch`/`blob`/`createImageBitmap`; contar
  requisições de quadros com a página parada (~6 s) e depois de rolar.
- **Modo leve (versão leve, andando):** 1 a cada 4 quadros (se os quadros foram interpolados 4×, é o ritmo do vídeo
  original), canvas em 60% da resolução (o navegador amplia), menos quadros na memória (20 em vez de 40) e menos
  decodificações ao mesmo tempo (2 em vez de 4), e **sem pré-download**: só baixa o que a rolagem pede. Se o modo
  ligar no meio, o motor passa a usar esses valores na hora (ler o modo a cada passo, não só ao iniciar).
- **Cuidados:** procure **pré-carregamentos com tempo** ("quem fica X s no site já baixa tudo"): no Maria Festinha
  um `setTimeout` de 4,5 s depois do `load` baixava os 477 quadros mesmo no modo leve.
- **Números (Maria Festinha, computador fraco, modo leve):** congelado 0,2 s de travadas (não vale: o dono quer o vídeo
  andando); andando com 1/4 dos quadros em resolução 1x: 4,5 s; com 1/4 dos quadros em 60%: **0,4-0,5 s** (META ok).
  Tablet e celular fracos: 0,07-0,2 s.
- **Visto em:** Maria Festinha (só no computador e tablet; no celular o site usa um vídeo). — confirmado (medido)

<!-- efeito: video-fundo -->
## Vídeo de fundo ou vídeo dentro do site (autoplay, mudo, em loop)
- **Regra do dono:** **não some nem para no modo leve**: fica mais leve.
- **Custo:** rede e decodificação contínua.
- **Medir:** peso no `erros.js`; conferir que pausa fora da tela (`IntersectionObserver`).
- **Modo leve (versão leve, tocando):** arquivo de resolução menor (ex.: 720p em vez de 960p/1080p), tocar só com a
  seção na tela e pausar fora dela, sem pré-carregar antes de chegar perto. Com economia de dados ligada, pode
  começar pelo pôster e tocar ao chegar na seção.
- **Cuidados:** iPhone exige `muted` + `playsinline`; modo economia bloqueia autoplay (ver `safari-iphone.md`).
  Não esconder com `html.leve video { display: none }` (visto no portfólio, retirado).
- **Números (portfólio, modo leve com os vídeos dos projetos tocando em 720p):** computador fraco 0,11 s, celular fraco
  0,13 s de travadas (META ok).
- **Visto em:** portfólio (vídeos dos projetos), Maria Festinha (vídeo da abertura no celular). — confirmado (medido)

<!-- efeito: iframe-externo -->
## Iframe de outro site (mapa, vídeo, widget)
- **Custo:** rede e processador do outro site; o Google Maps roda o próprio JavaScript **o tempo todo** (aparece como
  `map.js` no perfil de JS, medindo posições a cada quadro). Cookies de terceiros (LGPD, ver skill `juridico` A8).
- **Modo leve:** imagem/mapa ilustrado no lugar do iframe (se o site já tem uma versão para o celular, use a mesma),
  ou carregar só ao clicar, o que também resolve cookies antes do aceite.
- **Números (Maria Festinha, modo leve):** junto com as outras correções, foi o passo que levou os três aparelhos
  fracos à meta (computador fraco 1,3-1,9 s → 0,7-0,9 s).
- **Cuidados:** liberar o endereço no `frame-src` da CSP.
- **Visto em:** Maria Festinha (Google Maps no computador). — observação

<!-- efeito: backdrop-filter -->
## Vidro fosco (`backdrop-filter`)
- **Custo:** placa de vídeo, refeito a cada quadro quando o elemento ou o fundo se mexe. **Pior caso para celular
  fraco**, e o teste não mede (só o `pesados.js` aponta).
- **Modo leve:** fundo semitransparente (`rgba(...)`). Se o elemento rola com a página, troque **para todo mundo**: o
  visual fica quase igual.
- **Cuidados:** leia a lista inteira do `pesados.js`: botões pequenos com vidro fosco aparecem no fim (visto: Maria
  Festinha, `a.btn.btn-outline` continuava com vidro no modo leve; trocado por fundo branco 68% para todo mundo).
- **Vidro fosco atrás de fundo opaco** (cores sem transparência): o desfoque não aparece, mas a placa de vídeo calcula
  mesmo assim. Tire para todo mundo, sem mudar nada na tela (visto: Maria Festinha, barra de diferenciais da abertura,
  risco ALTO no computador). Antes de tirar, confira se todas as camadas do `background` são opacas.
- **Visto em:** portfólio (13 etiquetas travavam celular fraco), Maria Festinha. — confirmado

<!-- efeito: filter-blur -->
## Desfoque (`filter: blur`)
- **Custo:** placa de vídeo; grande e se mexendo é caro.
- **Modo leve:** desligar ou trocar por imagem já desfocada.
- **Visto em:** portfólio, Maria Festinha. — observação

<!-- efeito: mask -->
## Máscara (`mask-image`)
- **Custo:** placa de vídeo; área grande animada é cara.
- **Modo leve:** desligar a animação da máscara ou a máscara. Animação feita por JS (variável CSS mudada a cada
  passo): desenhar cada elemento uma vez quando aparece e não atualizar mais (visto: neon da abertura do Maria
  Festinha).
- **Cuidados:** o `pesados.js` continua listando a máscara depois de parada (ele não distingue parado de animado):
  confira no código que ela não muda mais no modo leve.
- **Visto em:** portfólio, Maria Festinha (faixas de neon da abertura). — confirmado (código)

<!-- efeito: mix-blend -->
## Mistura de cores (`mix-blend-mode`)
- **Custo:** placa de vídeo (obriga a compor camadas juntas).
- **Modo leve:** `normal`, com a cor já ajustada.
- **Visto em:** portfólio, Maria Festinha. — observação

<!-- efeito: animacao-infinita -->
## Animações CSS em loop infinito
- **Custo:** pintura contínua se animam `box-shadow`/`filter`/degradê; barato se só `transform`/`opacity`.
- **Medir:** `document.getAnimations()` com `iterations === Infinity`; `Paint` alto no `causas.js` com a página parada.
- **Modo leve:** parar (`animation: none`) ou deixar só `transform`/`opacity`. Pausar com a aba em segundo plano.
- **Visto em:** portfólio, Maria Festinha. — observação

<!-- efeito: texto-letra-a-letra -->
## Texto quebrado em letras/palavras animadas
- **Custo:** centenas de elementos mudando `style` a cada quadro, cada letra animada vira uma camada (no rastro do
  `causas.js`: `Layerize` alto e `span` de letra no topo da lista "Elementos mudados"). Com giro 3D e `filter` por
  letra é pior. **Foi o maior peso do Maria Festinha**: um parágrafo inteiro letra a letra (~4.600 mudanças de estilo
  em ~35 quadros) mais os títulos que "desdobram".
- **Medir:** `causas.js --secao=#id` (procure `span.*-char` com milhares de mudanças).
- **Modo leve:** texto inteiro de uma vez: não quebrar em letras se o modo leve já está ligado; se ligou depois de
  quebrar, pôr todas as letras no estado final na hora de revelar. Animação de letras dentro de sequência presa à
  rolagem: só opacidade (sem giro 3D nem `filter`). Leitores de tela: `aria-label`/`.sr-only` com o texto inteiro.
- **Números (Maria Festinha, modo leve, travadas somadas):** celular fraco 7,3 s → 1,9 s; computador fraco
  12,7 s → 6,0 s; tablet fraco 6,9 s → 2,8 s (só com esta mudança).
- **Visto em:** portfólio, Maria Festinha. — confirmado (medido)

<!-- efeito: css-3d -->
## 3D em CSS (`preserve-3d`, perspectiva)
- **Custo:** placa de vídeo (camadas 3D).
- **Cuidados:** Safari desenha a face de trás por cima (ver `safari-iphone.md`).
- **Visto em:** portfólio (notebook). — confirmado

<!-- efeito: sticky -->
## Elementos fixos ao rolar (`position: sticky`)
- **Custo:** baixo sozinho; caro se tiver efeitos pesados dentro (eles ficam na tela por mais tempo).
- **Visto em:** portfólio, Maria Festinha. — observação

<!-- efeito: muitas-camadas -->
## Muitas camadas (`will-change` em dezenas de elementos)
- **Custo:** memória da placa de vídeo e tempo de `Commit`/`Layerize` no rastro.
- **Modo leve / correção:** `will-change` só durante a animação, ou só nos elementos que de fato se movem.
- **Visto em:** — observação
