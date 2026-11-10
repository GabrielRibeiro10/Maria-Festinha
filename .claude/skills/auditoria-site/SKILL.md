---
name: auditoria-site
description: Auditoria completa de QUALQUER site antes de entregar ou publicar - desempenho em aparelhos bons, médios e fracos (celular, tablet, PC, monitor), simplificação dos efeitos no modo leve até o aparelho fraco ficar liso, varredura de bugs e erros, teste como cliente (tocar, clicar, rolar, girar a tela), responsividade, iPhone/Safari, regras de segurança do ar e checagem jurídica, corrigindo o que achar e aprendendo a cada site (base de conhecimento própria). Use quando pedirem para revisar o site, tirar bugs, travadas ou lag, deixar mais rápido/fluido, testar em celular fraco ou PC fraco, conferir responsividade, checar o site contra as leis (LGPD, CDC, acessibilidade, direitos autorais), ou "deixar pronto para o cliente".
---

# Auditoria do site (qualquer site)

Objetivo: o site abre e roda liso em **qualquer aparelho** (celular, tablet, PC, monitor; bom, médio e fraco), sem erro,
sem travada, sem nada quebrado na tela, e tudo funciona do jeito que um cliente usaria. Encontrar, **corrigir** e provar
com números e imagens. Não basta listar problemas: corrija, meça de novo e só então dê por resolvido.

A skill serve para qualquer site (HTML/CSS/JS, com ou sem GSAP, three.js, vídeo, canvas...). Nada aqui supõe um site
específico: o passo 0 descobre como o site funciona, e a base `conhecimento/` guarda o que já se aprendeu em sites
anteriores (efeitos, causas de travada, defeitos do Safari, armadilhas do próprio teste). **Leia a base antes de
mexer e grave nela o que aprender (seção "Aprendizado").**

## Antes de começar

1. Leia `conhecimento/README.md` e `conhecimento/indice.md`. Depois do passo 0, leia as fichas de `efeitos.md` dos
   efeitos que o site usa e as entradas de `causas.md`, `safari-iphone.md` e `ambiente-de-teste.md` que se aplicam.
2. Diga ao usuário onde está a skill que está usando (caminho) e se a base é a principal ou uma cópia (ver
   "Onde a skill mora").
3. Suba um servidor local na raiz do site, se não houver um:

```bash
curl -s -o /dev/null localhost:8123 || (nohup python3 -m http.server 8123 >/dev/null 2>&1 &)
```

Scripts em `.claude/skills/auditoria-site/scripts/` (Playwright, já instalado no ambiente). Rode **a partir da raiz do
site**. Todos aceitam `--base=` (padrão `http://localhost:8123`) e `--classe-leve=` (nome da classe de modo leve, se o
passo 0 disser que é fora do padrão). Aparelhos: `celular-bom`, `celular-medio`, `celular-fraco`, `celular-deitado`,
`tablet-bom`, `tablet-fraco`, `pc-bom`, `pc-medio`, `pc-fraco`, `monitor-grande` (fraco = processador 6x mais lento,
médio = 3x). Comandos longos: rode em segundo plano ou com timeout alto. **Não rode duas medições de desempenho ao
mesmo tempo**: uma atrapalha a outra.

## Metas

| Aparelho | Quadro médio por seção | Travadas longas (> 50 ms) na rolagem inteira | Página pulando (CLS) |
|---|---|---|---|
| bom e médio | ≤ ~22 ms | poucas, nenhuma > 150 ms fora do carregamento | < 0,05 |
| fraco | ≤ ~35 ms | soma ≤ 1 s | < 0,05 |

E, em todos: **nenhum efeito de placa de vídeo de risco ALTO ligado no modo leve** (`pesados.js`). O `desempenho.js`
termina cada aparelho com `META ok` ou `META NÃO`. **Aparelho fraco com `META NÃO` não é pendência para o dono
decidir: é trabalho da auditoria (passos 3 e 3b).**

## Modo leve (ler antes de mexer)

- Sites com efeitos pesados devem ter um **modo leve**: uma classe no `<html>` ligada antes da primeira pintura quando
  o aparelho é fraco (sem placa de vídeo, pouca memória/núcleos, economia de dados, bateria baixa) e, durante o uso,
  quando a fluidez cai. No modo leve tudo que pesa desliga ou fica parado; o visual de quem tem aparelho bom não muda.
- Cada site faz isso do seu jeito (nome da classe, pistas, se aceita `?leve=1`). O passo 0 descobre; os scripts forçam
  o modo **fingindo o aparelho** (as mesmas pistas que os sites usam), então funcionam em qualquer site.
- **Todo efeito** precisa: checar o modo leve ao começar, **parar se o modo leve ligar no meio do uso** (evento do site)
  e respeitar `prefers-reduced-motion`.
- **Confira a detecção, não só os efeitos:** o teste força o modo leve, então não prova que ele liga num celular de
  verdade. Leia o código que liga a classe e compare com a ficha `modo-leve` de `conhecimento/efeitos.md` (pistas
  que pegam celular atual, engasgos além da mediana, lembrar a decisão, `?leve=info` para o dono conferir no aparelho).
  Entregue ao dono o link `?leve=info` para ele abrir no próprio celular.
- **Limite do teste:** o navegador de teste não tem placa de vídeo. Os tempos refletem o processador, mas não o custo
  de vidro fosco, desfoque, máscara e mistura de cores, que são os que travam um celular fraco de verdade. Por isso o
  `pesados.js` é obrigatório. E WebGL/3D sai exagerado aqui (ver `conhecimento/ambiente-de-teste.md`).

## Passo a passo

0. **Descobrir o site:** `node .claude/skills/auditoria-site/scripts/descobrir.js`
   Mostra páginas, hospedagem, 404, **classe do modo leve** (ou que não existe), se `?leve=1` funciona e a lista de
   **efeitos** que o site usa. Efeito marcado **NOVO** não tem ficha na base: meça-o nos passos 2/2b, decida como ele
   fica no modo leve (passo 3b) e **grave a ficha** em `conhecimento/efeitos.md`. Site **sem modo leve** e com efeitos
   pesados: proponha ao dono criar um (3b.5).

1. **Erros e rede** (todas as páginas `*.html`): `node .claude/skills/auditoria-site/scripts/erros.js`
   Tem que sair "sem erros, falhas ou rolagem lateral". Vídeo em `ERR_ABORTED` é download em pedaços (já ignorado).
   Olhe também o peso: arquivo grande demais no celular é problema mesmo sem erro.

2. **Desempenho por seção**, detecção automática (o teste cai no modo leve sozinho, como um aparelho fraco):
   `node .claude/skills/auditoria-site/scripts/desempenho.js`
   e o modo normal nos aparelhos médios: `... desempenho.js --modo=normal --aparelhos=celular-medio,pc-medio`
   (se o site tiver WebGL, esconda o canvas para medir o resto: `--css="canvas.x{display:none!important}"`).
   Confira em cada resultado o modo em que o site ficou (linha `==`): o teste pode cair no leve no meio.

2b. **Efeitos de placa de vídeo:** `node .claude/skills/auditoria-site/scripts/pesados.js` e `... --largura=1366`.
   Leia a lista **inteira** (não corte com `head`: os pequenos vêm no fim e também contam). Meta: nenhuma linha
   `!! LEVE: liga` com risco **ALTO** (vidro fosco em algo que rola com a página: troque por fundo semitransparente,
   para todo mundo, o visual fica igual). Risco médio ligado no modo leve em área grande que se mexe: desligue no modo
   leve. Efeito parado só custa na primeira pintura.

3. **Achar a causa** de cada seção marcada `!!`/`~` ou aparelho com `META NÃO`:
   `node .claude/skills/auditoria-site/scripts/causas.js --secao=#id --aparelho=celular-fraco`
   Compare com `conhecimento/causas.md` (sintoma → causa → correção). **Confirme a causa** antes de mexer: desligue a
   suspeita (`desempenho.js --css="..."`, ou bloqueando um arquivo) e meça de novo. Se o rastro mostrar
   `getBoundingClientRect`/`offsetHeight`/`scrollTo` caros, procure quem lê medidas depois que algo escreveu estilos
   (perfil de JS com chamadores: ver `causas.md`).

3b. **Aparelho fraco continua fora da meta: simplificar no modo leve (faça, não pergunte).**
   Se depois do passo 3 algum aparelho fraco ainda está com `META NÃO` e não há uma causa única para corrigir, o peso
   vem do conjunto de efeitos. Simplifique os efeitos **só no modo leve**, sem pedir licença, até bater a meta.
   1. Pegue a lista de efeitos do passo 0 e a ficha de cada um em `efeitos.md` (ela diz como medir e como fica no
      modo leve).
   2. Meça cada um desligado no aparelho fraco (`--css` para CSS; para JS, uma flag temporária ou bloqueando o
      arquivo) e todos de uma vez, para saber o teto de ganho. Mexa primeiro no que mais pesa.
   3. No modo leve, troque cada efeito pela versão parada mais próxima do visual final, nesta ordem (do menos
      perceptível ao mais):
      - animação presa à rolagem (`scrub`) → estado final direto, ou entrada simples só com `opacity`/`transform`
        disparada uma vez;
      - parallax → posição fixa;
      - letras/palavras animadas uma a uma → texto inteiro de uma vez;
      - brilhos, partículas, neon, máscaras, desfoques, mistura de cores, animações infinitas → parados ou desligados;
      - sequência de quadros em canvas → um quadro fixo (ou o vídeo/pôster que o site já usa no celular), sem baixar os
        outros quadros;
      - rolagem suave (Lenis) → rolagem nativa;
      - 3D/WebGL → versão desenhada/imagem parada.
      Pare quando o aparelho fraco bater a meta. Não mexa no que não fez diferença na medição.
   4. Cada efeito simplificado: checa o modo leve ao começar **e** para se ele ligar no meio do uso; respeita
      `prefers-reduced-motion`.
   5. **Pergunte antes** só se: a única saída for mudar o visual também para aparelhos bons; for remover conteúdo (texto,
      foto, seção, botão) e não só movimento; ou o site **não tiver modo leve** (proponha criar um: classe no `<html>`
      ligada no `<head>` antes da primeira pintura, pistas de aparelho fraco, queda de fluidez durante o uso, evento
      para os efeitos pararem; o modelo está em `conhecimento/efeitos.md`, ficha "modo-leve").
   6. Mostre no relatório, por aparelho fraco, números antes/depois e o que ficou parado no modo leve, em linguagem
      simples ("no celular fraco, as letras do título aparecem inteiras em vez de uma a uma").

4. **Teste como cliente** (tocar/clicar em tudo, links internos, rolar gravando, girar a tela, voltar/avançar):
   `node .claude/skills/auditoria-site/scripts/cliente.js --fotos=<scratchpad>/cliente`
   `node .claude/skills/auditoria-site/scripts/montagem.js <scratchpad>/cliente`
   **Olhe as pranchas** (Read nas imagens): animação pela metade, elemento sumido, sobreposto, piscando, texto por cima
   de texto, faixa de cor errada, emenda entre seções. Repita com `--aparelhos=celular-fraco,pc-fraco`. Aviso do script
   que pareça falso: confirme no navegador antes de descartar (ver `ambiente-de-teste.md`).

5. **Responsividade** (15 tamanhos de 320 a 2560 px, celular deitado incluso, todas as páginas):
   `node .claude/skills/auditoria-site/scripts/responsivo.js --fotos=<scratchpad>/resp`
   Tem que sair "responsividade ok". Olhe algumas fotos (320, 390, 768, 1366, 2560).

5b. **Todos os iPhones e iPads (Safari) — obrigatório antes de entregar.** O Chrome do teste não mostra os defeitos
   do Safari, e no iPhone todo navegador usa o Safari por baixo. `iphone.js` abre o site no motor do Safari em todos os
   iPhones (6 ao 17) em pé e deitado e nos iPads, e confere sozinho: erros, rolagem lateral e **todo canvas/vídeo
   grande aparecendo com conteúdo** (não em branco), além das checagens de efeitos conhecidos.
   `PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-webkit node .claude/skills/auditoria-site/scripts/iphone.js --deitado --fotos=<scratchpad>/iphone`
   `PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-webkit node .claude/skills/auditoria-site/scripts/iphone.js --grupo=ipads --fotos=<scratchpad>/iphone`
   Tem que terminar com "ok em todos". Efeito novo em 3D, canvas ou vídeo com defeito próprio: acrescente a checagem no
   `iphone.js` e a entrada em `safari-iphone.md`. Instalação do WebKit na 1ª vez da sessão (os três comandos, inclusive
   o `install-deps`): `conhecimento/ambiente-de-teste.md`. Peça ao dono para abrir num iPhone de verdade antes de
   entregar (o simulador não tem a placa de vídeo nem o limite de memória do iPhone).

5c. **Como no ar: regras de segurança + página 404 — obrigatório antes de publicar.**
   `PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-webkit node .claude/skills/auditoria-site/scripts/producao.js --fotos=<scratchpad>/producao`
   Abre cada página no PC, no celular e no iPhone **com as regras do ar** (CSP do `vercel.json`) e acusa bloqueios;
   confere se todo `<script>` executável colado na página tem o hash liberado; testa a 404. Tem que terminar com "ok".
   Outra hospedagem (sem `vercel.json`): o script avisa; confira as regras do servidor real.

5d. **Auditoria jurídica** (depois das etapas técnicas), com a skill `juridico` (`.claude/skills/juridico/`):
   leia `CHECKLIST.md` inteiro, classifique o site, aplique só os blocos que valem, cheque no código e no site
   publicado, abra o artigo em `leis/` só em caso de dúvida e escreva o relatório no formato do checklist, deixando
   claro que é checagem técnica, não parecer jurídico.

6. **Corrigir, medir de novo, comparar** (antes/depois com números, mesmo aparelho), rodar de novo 1, 4 e 5 para
   garantir que nada quebrou, e só então fazer commit (regras de git da sessão). Antes de publicar, teste na prévia da
   hospedagem quando houver (deploy de branch).

7. **Aprender** (obrigatório, seção abaixo) e **relatar**.

## Aprendizado (obrigatório em toda auditoria)

A skill aprende junto com o dono. **Grave automaticamente** na base `conhecimento/` tudo que for reutilizável em
outro site, e conte no relatório o que gravou.

O que gravar:
- **Efeito novo** (marcado NOVO no passo 0, ou que você criou no site): ficha em `efeitos.md` com o marcador
  `<!-- efeito: id -->` (o mesmo id do `descobrir.js`; efeito que o script ainda não detecta: acrescente a detecção
  em `NOMES`/`inventario` do `descobrir.js`).
- **Causa de travada** confirmada por medição: entrada em `causas.md`.
- **Defeito do Safari/iPhone**: entrada em `safari-iphone.md` (e a checagem no `iphone.js`).
- **Armadilha do teste** (alarme falso, dependência faltando, medição enganosa): entrada em `ambiente-de-teste.md`.
- Melhoria num script que serviria para todo site: faça no script e anote em `ambiente-de-teste.md`.

Como gravar:
1. Leia o arquivo antes; se já existe entrada para o mesmo assunto, **atualize** em vez de duplicar.
2. Cada entrada tem: título e data; onde se aplica; sintoma (o que a pessoa sente ou o que o teste mostra); causa;
   como medir/confirmar; correção ou como fica no modo leve; números antes/depois; limitações. Marque
   `confirmado (medido)` ou `observação (não medida)`.
3. Escreva de forma **genérica**: o caso concreto vira regra para qualquer site. Pode citar o site como exemplo
   ("visto em: portfólio"), mas sem dados pessoais, senhas, chaves ou dados de clientes.
4. Atualize `conhecimento/indice.md`.
5. Não grave alarme falso como problema (grave como armadilha do teste), nem regra tirada de um palpite.
6. Não reescreva as regras centrais deste SKILL.md por causa de um único site; se uma regra daqui se mostrar errada,
   anote em `ambiente-de-teste.md` e avise o dono.

No relatório, seção **"Aprendizado"**: o que foi gravado (arquivo e título) ou "nenhum aprendizado novo", e onde fica
a base (principal ou cópia).

## Onde a skill mora

- A **versão principal** (scripts + base `conhecimento/`) fica no repositório do portfólio:
  `Portfolio-Gabriel-B/.claude/skills/auditoria-site/`.
- Ao auditar outro site, copie a skill para o repositório dele (`.claude/skills/auditoria-site/`) se não estiver lá ou
  estiver mais velha que a principal. Ao terminar, **leve o que foi aprendido de volta para a principal** (mesmos
  arquivos de `conhecimento/` e scripts) e diga ao dono que fez isso.
- `.claude/` não vai para o ar (confira o `.vercelignore` do site).

## Regras

- Não mude o visual sem necessidade: a correção deve ficar igual na tela para quem tem aparelho bom (compare fotos).
- Nunca resolva desligando a animação para todo mundo; desligue só no modo leve / `prefers-reduced-motion`, ou troque
  por uma técnica barata com o mesmo resultado.
- Toda correção é **medida de novo** com o mesmo aparelho e mostrada em números.
- Aparelho fraco fora da meta é trabalho da auditoria (3b), não pendência. Só vira pergunta nos casos do 3b.5.
- Não declare o site pronto sem o passo 5b (iPhone/Safari) nem sem `pesados.js`; diga no relatório o que depende de
  placa de vídeo.
- Efeito novo criado no site: antes de publicar, rode `pesados.js`, decida como ele fica no modo leve e grave a ficha.
- Relatório final em linguagem simples para o dono: o que estava errado (sintoma que a pessoa sentiria), o que foi
  feito, números antes/depois, o que foi conferido (aparelhos, tamanhos, testes), o que ficou parado no modo leve, o
  que foi aprendido e o que ainda depende de um aparelho de verdade (WebGL, vídeos, iOS Safari).
