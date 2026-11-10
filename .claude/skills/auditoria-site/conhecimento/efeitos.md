# Efeitos: custo, como medir e como ficam no modo leve

Uma ficha por efeito. O marcador `<!-- efeito: id -->` é o mesmo id que o `descobrir.js` mostra; efeito sem ficha
aparece lá como NOVO. Ficha nova: copie o formato, meça antes de escrever e marque `confirmado (medido)` ou
`observação (não medida)`.

Formato: **Custo** (onde pesa: processador, placa de vídeo, rede) · **Medir** (como confirmar que é ele) · **Modo
leve** (versão parada mais próxima do visual) · **Cuidados** (defeitos conhecidos) · **Visto em**.

---

<!-- efeito: modo-leve -->
## Modo leve (o sistema, não um efeito)
- **O que é:** classe no `<html>` que desliga/para o que pesa em aparelho fraco. Sem ele, o aparelho fraco roda tudo.
- **Como criar (modelo):** script pequeno no `<head>`, antes do CSS, que liga a classe antes da primeira pintura com
  estas pistas: sem placa de vídeo (WebGL ausente ou renderizador `swiftshader|llvmpipe|software|basic render`),
  `navigator.deviceMemory <= 2`, `hardwareConcurrency <= 2`, `connection.saveData`; e um medidor de fluidez durante o
  uso (mediana de quadros > 25 ms por alguns segundos, rolando) que liga a classe depois e dispara um evento para os
  efeitos pararem. Registre o motivo (`data-...`) e aceite `?leve=1`/`?leve=0` para teste. Modelos prontos: portfólio
  (`js/desempenho.js`, classe `leve`, evento `gr:leve`) e Maria Festinha (início do `js/main.js`, classe `lite`,
  evento `litechange`).
- **Cuidados:** a classe tem que existir antes da primeira pintura (senão a página pula); todo efeito confere a classe
  ao começar e escuta o evento.
- **Detecção que falha em celular de verdade (visto: Maria Festinha, o dono reclamou que o leve não ligava):**
  - memória ≤ 2 GB / núcleos ≤ 2 quase nunca pega celular atual (os fracos têm 3-4 GB e 8 núcleos; o iPhone nem
    informa a memória); "sem placa de vídeo" nunca pega celular; bateria só existe no Android;
  - medir fluidez só pela **mediana** deixa passar o aparelho que roda liso quase sempre e **engasga de vez em
    quando** (o que a pessoa sente). Use também os engasgos: 10% ou mais dos quadros acima de 40 ms (p90), ou 3+
    quadros acima de 100 ms numa amostra;
  - **lembrar a decisão** (`localStorage`, 30 dias) e ligar a classe no `<head>` na próxima visita; sem isso o
    aparelho precisa travar de novo a cada visita para ser detectado;
  - ter `?leve=1` / `?leve=0` e uma caixinha de diagnóstico (`?leve=info`: modo, motivo, memória, núcleos, placa de
    vídeo e as amostras de quadros) para o dono conferir no próprio celular: o teste não tem celular de verdade.
  - Mudou o script do `<head>`: recalcule o hash na CSP (`producao.js` acusa).
  - Teste (simulado): celular bom continua normal, celular fraco liga e a próxima visita já abre leve; celular
    médio a ~60 FPS continua normal (correto: ele dá conta).
- **Visto em:** portfólio, Maria Festinha. — confirmado

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
- **Modo leve:** menos quadros por segundo, resolução 1x, ou imagem parada.
- **Cuidados:** Safari em branco (ver `safari-iphone.md`).
- **Visto em:** Maria Festinha (abertura). — observação

<!-- efeito: sequencia-quadros -->
## Sequência de quadros trocada pela rolagem (centenas de imagens)
- **Custo:** rede (megabytes: 477 quadros ≈ 11 MB no computador) e processador (baixar, decodificar, desenhar a cada
  quadro de rolagem).
- **Medir:** `erros.js` mostra o peso por aparelho; perfil de JS mostra `fetch`/`blob`/`createImageBitmap`.
- **Modo leve:** um quadro fixo (ou o vídeo/pôster que o site já usa no celular), sem baixar os outros quadros. No
  motor de quadros: parar de desenhar/decodificar depois do 1º quadro pintado, baixar só o 1º ao abrir, e bloquear o
  "baixar todos" **dentro da função que libera os downloads** (não só em quem a chama).
- **Cuidados:** procure **pré-carregamentos com tempo** ("quem fica X s no site já baixa tudo"): no Maria Festinha
  um `setTimeout` de 4,5 s depois do `load` baixava os 477 quadros mesmo no modo leve. Confira contando as requisições
  depois de ~6 s parado.
- **Números (Maria Festinha, computador fraco):** travadas 6,0 s → 1,2 s; peso baixado ~11,6 MB → ~2,3 MB.
- **Visto em:** Maria Festinha (só no computador; no celular o site usa um vídeo). — confirmado (medido)

<!-- efeito: video-fundo -->
## Vídeo de fundo (autoplay, mudo, em loop)
- **Custo:** rede e decodificação contínua.
- **Medir:** peso no `erros.js`; pausar fora da tela (`IntersectionObserver`).
- **Modo leve:** pôster parado (com economia de dados, nem baixar o vídeo).
- **Cuidados:** iPhone exige `muted` + `playsinline`; modo economia bloqueia autoplay (ver `safari-iphone.md`).
- **Visto em:** portfólio, Maria Festinha. — observação

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
