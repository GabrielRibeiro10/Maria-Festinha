# Safari / iPhone

O Chrome do teste não mostra estes defeitos. No iPhone todo navegador (Chrome, Instagram, WhatsApp) usa o Safari por
baixo. Conferir com `iphone.js` (motor do Safari, todos os iPhones e iPads) e, antes de entregar, num iPhone de verdade.

## Canvas ou vídeo aparece em branco, sem erro — 2026-11-10
- **Status:** confirmado (visto em sites anteriores); checagem genérica no `iphone.js`
- **Onde se aplica:** qualquer `<canvas>` (2D ou WebGL) e `<video>` grande.
- **Causa:** o Safari tem limite de memória de canvas e devolve canvas em branco sem erro; vídeo sem `muted` +
  `playsinline` não toca sozinho; modo economia de energia bloqueia autoplay.
- **Como conferir:** o `iphone.js` rola até cada canvas/vídeo grande e mede a foto (lisa demais = em branco).
- **Correção:** canvas no tamanho da tela (não maior), `devicePixelRatio` limitado a 1-2 no iOS, não ler pixels
  (`getImageData`) de canvas grande; vídeo com `muted`, `playsinline`, pôster, e tocar no primeiro toque se o autoplay
  for bloqueado.

## 3D em CSS mostra a face de trás por cima — 2026-11-10
- **Status:** confirmado (medido) — visto em: portfólio (notebook dos Projetos mostrava a tampa cinza no lugar da tela)
- **Onde se aplica:** `transform-style: preserve-3d` com `backface-visibility: hidden` (cartões que viram, tampas,
  cubos).
- **Causa:** o Safari ignora `backface-visibility: hidden` dentro de `preserve-3d` e desenha a face de trás.
- **Correção:** esconder a face de trás com `visibility: hidden` quando o objeto está virado/aberto (não confiar em
  `backface-visibility`). Checagem específica no `iphone.js` (bloco do notebook).

## Foto some de cartão 3D (WebGL) — 2026-11-10
- **Status:** confirmado (medido) — visto em: portfólio (crachá 3D com cartão branco no iPhone 13 Pro Max)
- **Causa:** limite de memória de canvas; `getImageData` em canvas grande falha em branco.
- **Correção:** usar a imagem já pronta (ex.: foto já em P&B em arquivo) em vez de processar pixels; `setPixelRatio`
  até 1 no iOS; se a foto não carregar, cair na versão sem 3D. Checagem específica no `iphone.js` (bloco do crachá).
