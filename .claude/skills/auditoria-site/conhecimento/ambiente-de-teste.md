# Armadilhas do ambiente de teste

O teste roda num servidor sem placa de vídeo, com Chrome e WebKit do Playwright. Algumas coisas que ele mostra não
são do site; outras ele não consegue mostrar. Antes de corrigir ou descartar um aviso, confira aqui.

## Instalar o WebKit (Safari) na 1ª vez da sessão — 2026-11-10
- **Status:** confirmado
- **Sintoma:** sem as dependências, **toda página trava** no WebKit (`Page crashed`), até o portfólio; uma página
  simples (`data:text/html,...`) abre. Parece defeito do site e não é.
- **Correção:** os três comandos, nesta ordem (fora do repositório):
  ```bash
  PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-webkit node $(node -e "console.log(require.resolve('playwright').replace(/index.js$/,''))")cli.js install webkit
  apt-get update
  PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-webkit node $(node -e "console.log(require.resolve('playwright').replace(/index.js$/,''))")cli.js install-deps webkit
  ```
  O `install-deps` traz os plugins de mídia (GStreamer) que a lista manual de `apt-get` não tinha.

## Sem placa de vídeo: o site cai no modo leve sozinho — 2026-11-10
- **Status:** confirmado
- **Sintoma:** com detecção automática o site fica no modo leve (motivo "gpu"/"sem placa de vídeo"); pedindo o modo
  normal, alguns sites entram no leve **depois** de abrir, pelo medidor de fluidez (motivo "fps").
- **O que fazer:** os scripts forçam o modo fingindo o aparelho (`fingirAparelho` no `comum.js`). Sempre confira o
  modo na linha `==` do `desempenho.js` antes de comparar números. O `descobrir.js` avisa quando isso acontece.

## WebGL sai exagerado no teste — 2026-11-10
- **Status:** confirmado
- **Sintoma:** no modo normal, site com canvas WebGL dá `META NÃO` até no computador bom (visto: portfólio, crachá 3D,
  travadas somando 4,6 s; `GLES2::ReadPixels` no rastro).
- **O que fazer:** medir o resto escondendo o canvas (`--css="canvas.x{display:none!important}"`). O custo real do
  3D só num aparelho.

## Régua do teste: comparar com um site conhecido — 2026-11-10
- **Status:** confirmado
- **Quando:** números ruins demais em tudo. Rode o mesmo `desempenho.js` no portfólio (que passa): se ele também
  piorar, é o servidor de teste (processos em paralelo, máquina lenta), não o site.
- **Referência:** portfólio no computador fraco (modo leve) ≈ 5 travadas, soma ≈ 0,26 s.

## Alarmes falsos conhecidos — 2026-11-10
- **Status:** confirmado
- `producao.js` "script sem hash" em `<script type="application/ld+json">` (dados estruturados): não é executado, a
  CSP não se aplica. O script já ignora tipos que não são JavaScript.
- `responsivo.js` "texto cortado" em `.sr-only`/`.visually-hidden`: texto só para leitores de tela, escondido de
  propósito.
- `cliente.js` "#top parou a nullpx da seção": `href="#top"` sem elemento `id="top"` leva ao topo pela regra do HTML.
  Confira se volta a `scrollY = 0`.
- `cliente.js` "não clicável (Timeout)" em link dentro de card que entra animando: o toque tentou durante a animação.
  Confira com `document.elementFromPoint` no centro do link depois de parado.
- Antes de descartar qualquer aviso, **confirme no navegador** e só então anote aqui.

## Medições
- Não rode duas medições de desempenho ao mesmo tempo (uma rouba processador da outra).
- `pesados.js`: leia a lista inteira; não corte com `head` (itens pequenos de risco ALTO ficam no fim).
- Para achar quem chama uma função cara (ex.: `getBoundingClientRect`), use o perfil de JS do Chrome (CDP
  `Profiler.start/stop`) e some o tempo por chamador (ver `causas.md`).
- O `producao.js` quebrava quando uma página fechava com requisição pendente (sequência de quadros); corrigido com
  `try/catch` no `route`.
- Servidores locais (`python3 -m http.server`) podem cair entre comandos longos: confira com `curl` antes de medir.
