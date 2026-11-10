# Causas de travada (sintoma → causa → correção)

Achar a causa: `causas.js --secao=#id --aparelho=celular-fraco` e confirmar desligando a suspeita
(`desempenho.js --css="..."`) antes de mexer no código. Entradas abaixo: confirmadas por medição.

## Tabela rápida

| Sintoma no `causas.js` | Causa | Correção |
|---|---|---|
| `UpdateLayoutTree` alto e um elemento com centenas de filhos mudando `style` a cada quadro | variável CSS (`--x`) mudada no pai de uma seção inteira (herda para todos os filhos) | aplicar o valor direto no elemento que se move (`translate`/`transform`), ou `@property` com `inherits: false` |
| `Layout` alto, elemento mudando `style` a cada quadro | animar `top/left/width/height` | `transform: translate...` + `will-change: transform` |
| `Paint` alto com algo parado na tela | `box-shadow`/`filter`/degradê animado em loop infinito | deixar fixo, ou animar `opacity` de uma camada com a sombra |
| elemento animando em seção que já saiu da tela | loop de `requestAnimationFrame` ou ouvinte de `scroll` global sem limite | `IntersectionObserver`: só anima/escuta perto da tela; parar o loop quando assenta |
| função JS rodando a cada quadro sem nada mudar | `getBoundingClientRect`/medições em loop "por garantia" | rodar só enquanto algo de fato se move; guardar medidas e refazer só no `resize` |
| `getBoundingClientRect`/`offsetHeight` caros no perfil de JS, mesmo medindo poucos elementos | **leitura depois de escrita**: a medição roda depois que animações já escreveram estilos no quadro e obriga o navegador a recalcular a página inteira (ver entrada abaixo) | medir no começo do quadro, antes das escritas |
| travada de 0,5-1,5 s ao chegar numa seção | biblioteca pesada (three.js) montando no meio da rolagem | montar quando o navegador estiver parado depois do carregamento (`requestIdleCallback`) |
| toque não faz nada no celular | bloco grande e invisível por cima (z-index/contexto de empilhamento) | `pointer-events: none` no bloco e `auto` nos filhos; conferir com `cliente.js` |
| tempo bom no teste, mas a seção trava num celular fraco de verdade | vidro fosco (`backdrop-filter`) em etiquetas/cartões que rolam com a página; a placa refaz o desfoque a cada quadro | fundo semitransparente (`rgba(255,255,255,.13)`) no lugar do vidro; achar com `pesados.js` |
| CLS alto (página "pula") só em aparelho fraco | um script muda o layout de uma seção depois de carregar; no fraco o script roda ~2 s depois e empurra o resto | ligar o modo no `<head>` (classe no `<html>` antes da primeira pintura) e dar ao bloco altura natural pelo CSS |
| funciona no teste e quebra no ar (efeito some, fonte não carrega, script não roda) | a CSP do `vercel.json` bloqueia: `<script>` colado na página sem hash, `<style>` na página, arquivo de outro endereço | mover para arquivo `.js`/`.css` do site, ou liberar o hash/endereço; conferir com `producao.js` |
| link quebrado mostra página sem estilo | 404.html com caminho relativo (`css/...`): dentro de pasta ele procura `/pasta/css/...` | caminhos absolutos (`/css/...`, `/img/...`) na 404 |
| 404 (ou página nova) com visual velho depois de atualizar o site | CSS em cache longo (`immutable`) e a página nova sem a marca de versão (`?v=...`) que as outras usam | usar a mesma marca de versão e pôr a página no comando de build que troca a marca (visto: Maria Festinha, `__V__` no `buildCommand`) |
| carrossel do celular: 1º card aparece encostado à esquerda e depois pula para o meio | entrada animada desloca a **vaga** do carrossel (`transform` em quem tem `scroll-snap-align`); o imã (`scroll-snap`) rola o carrossel para acompanhar (`scrollLeft` ≠ 0 antes de aparecer) e, quando a entrada termina, o card fica fora do centro até o imã corrigir | animar o **card de dentro** da vaga, nunca a vaga; conferir que `scrollLeft` fica 0 durante o carregamento (visto: Maria Festinha, Serviços/Celebrações/Destaques, Chrome e Safari) |
| alvo de toque < 24 px | link de texto pequeno | área invisível com `::after { content:""; position:absolute; inset:-3px -4px }` (o elemento precisa ter `position`; não invada o alvo vizinho; não sobrescreva `position: absolute` existente) |
| `Layerize` alto e um `span` de letra no topo de "Elementos mudados" (milhares de mudanças) | texto quebrado em letras animadas (cada letra vira camada) | modo leve: texto inteiro de uma vez (ficha `texto-letra-a-letra`) |
| downloads/peso altos no modo leve sem rolar a página | pré-carregamento com tempo (`setTimeout` depois do `load`) que não olha o modo leve | checar o modo leve dentro da função que libera os downloads (ficha `sequencia-quadros`) |
| aparelho fraco lento em quase todas as seções, e nenhum efeito desligado sozinho muda o resultado | o peso é o **conjunto** de efeitos (muitas animações presas à rolagem, sequência de quadros, etc.) | passo 3b: simplificar no modo leve, efeito por efeito, até bater a meta |

## Leitura de posição depois de escrita (layout forçado) — 2026-11-10
- **Status:** confirmado (medido)
- **Onde se aplica:** sites com GSAP/ScrollTrigger (ou qualquer animação que escreve estilos a cada quadro) e código
  próprio que mede posição (`getBoundingClientRect`, `offsetTop/Height`) a cada quadro: entradas "quando aparece na
  tela", cabeçalho que muda de fundo, barra de progresso.
- **Sintoma:** aparelho fraco engasga em todas as seções; no perfil de JS, `getBoundingClientRect` aparece entre os
  mais caros mesmo medindo só alguns elementos.
- **Causa:** a medição roda num `requestAnimationFrame` registrado depois do ticker do GSAP. Nesse quadro o
  ScrollTrigger e as animações já escreveram estilos; medir obriga o navegador a recalcular a página inteira na hora
  (e de novo para pintar).
- **Como achar:** perfil de JS do Chrome (CDP `Profiler`) durante a rolagem, somando o tempo por chamador de
  `getBoundingClientRect`/`scrollTo` (subir 2-3 níveis na árvore de chamadas mostra a função do site).
- **Correção:** fazer a leitura no começo do quadro, antes das escritas. Com GSAP:
  `gsap.ticker.add(fn, false, true)` (o 3º parâmetro põe na frente) e só marcar a pendência no `scroll`; sem GSAP,
  ler no início do `requestAnimationFrame` e escrever depois. O comportamento fica igual. Corrigir **todas** as
  leituras do quadro: corrigida uma, o custo passa para a próxima (visto: a do cabeçalho).
- **Números (visto em: Maria Festinha, computador fraco):** custo das leituras 806 ms → ~360 ms numa rolagem de
  ~37 s; travadas somadas 10-11,8 s → 8,6 s (o resto era o conjunto de efeitos, 3b).
- **Limitações:** `scrollTo` da rolagem suave (Lenis) também aparece caro, mas é o trabalho normal de mover a
  página; tirar o Lenis não melhorou (medido).

## Aparelho fraco lento em tudo: como achar o que pesa — 2026-11-10
- **Status:** confirmado (medido) — visto em: Maria Festinha
- **Sintoma:** `META NÃO` no fraco, quase todas as seções acima de 35 ms, e desligar suspeitos óbvios (brilhos, neon,
  canvas, Lenis) um a um não muda nada.
- **Caminho que funcionou:**
  1. medir o **teto**: desligar todas as animações presas à rolagem (`--js`) e todas as animações CSS
     (`--css="*,*::before,*::after{animation:none!important;transition:none!important}"`). Se nem assim bate a meta,
     o peso está em outro lugar;
  2. `causas.js` na seção mais lenta: a lista "Elementos mudados" e o tempo por tipo (`Layerize`, `Commit`) apontam
     efeitos que não são "animações de rolagem" (letras, camadas);
  3. perfil de JS com chamadores (scripts de terceiros também aparecem: `map.js` do Google Maps);
  4. contar requisições com a página parada (pré-carregamentos com tempo).
- **Ordem do que mais rendeu (Maria Festinha):** texto letra a letra → sequência de quadros (incluindo o
  pré-carregamento; **sem congelar**: 1/4 dos quadros em 60% da resolução, ver `efeitos.md`) → iframe do mapa.
  Juntos, com o vídeo da abertura andando: computador fraco 12,7 → 0,4-0,5 s, tablet 6,9 → ~0,1-0,2 s, celular
  7,3 → ~0,05-0,2 s. Animações presas à rolagem e Lenis renderam pouco ou pioraram.
