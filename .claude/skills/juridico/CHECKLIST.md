# Checklist jurídico para sites (Brasil)

Leia este arquivo inteiro em toda auditoria. Ele é curto de propósito.
Abra o texto completo em `leis/` **só** quando um item ficar em dúvida, e mesmo assim leia
só o artigo citado (busque por `**Art. N`), nunca a lei inteira.

Isto pega os erros mais comuns; **não é parecer jurídico**. Em caso de dúvida real
(negócio regulado, dados sensíveis, público infantil), recomende ao cliente falar com um advogado.

Textos conferidos em: 2026-11-09 (fonte: github.com/ctresb/leis, texto compilado de normas.leg.br).

---

## 1. Primeiro: classifique o site

Responda antes de checar. Cada resposta liga ou desliga blocos abaixo.

| Pergunta | Se SIM, aplique |
|---|---|
| O site coleta qualquer dado pessoal? (formulário, newsletter, login, WhatsApp com nome, cookies de análise/anúncio, pixel) | Bloco A |
| O site vende ou contrata online? (carrinho, checkout, link de pagamento, assinatura, agendamento pago) | Blocos B e C |
| O site mostra preços? | Bloco C |
| É de empresa com sede ou representação no Brasil? (quase sempre sim) | Bloco D |
| Usa fotos, textos, músicas, fontes ou marcas de terceiros? | Bloco E |
| É direcionado a crianças/adolescentes ou eles provavelmente acessam? (escola, jogo, brinquedo, festa infantil) | Bloco F |
| Tem conteúdo impróprio para menores? (bebida, aposta, conteúdo adulto) | Bloco F, item F3 |

Gravidade: **ALTA** = exigência expressa da lei, risco de multa/processo. **MÉDIA** = exigência que depende do caso ou boa prática apoiada na lei.

---

## Bloco A: Dados pessoais (LGPD + Marco Civil)

| # | Verificar | Como checar no código/site | Lei | Gravidade |
|---|---|---|---|---|
| A1 | Existe **política de privacidade** acessível em todas as páginas (geralmente no rodapé). | Link no rodapé; página existe e abre. | LGPD art. 9º; Marco Civil art. 7º, XI | ALTA |
| A2 | A política diz, de forma clara: **finalidade** de cada coleta, **forma e duração** do tratamento, **quem é o controlador** (nome/CNPJ), **contato**, **com quem compartilha** e **por quê**, e os **direitos do titular**. | Ler a página procurando cada um desses 6 pontos. | LGPD art. 9º, I a VII | ALTA |
| A3 | Indica o **encarregado (DPO)** com nome e contato, de preferência no site. | Procurar "encarregado" / "DPO" na política. (Agentes de pequeno porte podem ter dispensa por regulamento da ANPD: anote como "verificar com o cliente".) | LGPD art. 41, §1º | MÉDIA |
| A4 | Formulários coletam **só o necessário** para a finalidade (sem CPF, data de nascimento etc. "por via das dúvidas"). | Listar campos de cada `<form>` e perguntar se cada um tem uso. | LGPD art. 6º, III (necessidade) | MÉDIA |
| A5 | Perto de cada formulário há **aviso curto + link** para a política (ex.: "Seus dados serão usados para responder seu contato. Veja a Política de Privacidade."). | Inspecionar o HTML de cada formulário. | LGPD art. 9º; Marco Civil art. 7º, VIII | ALTA |
| A6 | Quando a base é **consentimento** (newsletter, marketing): caixa **não pré-marcada**, separada, com **finalidade específica**. Nada de "aceito tudo" genérico. | Procurar `<input type="checkbox" checked>` em formulários de marketing. | LGPD art. 8º, §§1º e 4º; Marco Civil art. 7º, IX | ALTA |
| A7 | O consentimento pode ser **retirado de forma fácil e gratuita** (link "descadastrar", botão para reabrir preferências de cookies). | Existe caminho para desfazer a escolha? | LGPD art. 8º, §5º | ALTA |
| A8 | **Cookies/pixels não essenciais** (Google Analytics, Meta Pixel, Hotjar, anúncios) só carregam **depois** do aceite; existe banner com "Recusar" tão fácil quanto "Aceitar". | No DevTools > Rede, abrir o site sem aceitar: nenhum `google-analytics`, `gtag`, `facebook.net`, `hotjar` pode carregar. | LGPD arts. 7º, I e 8º (base: consentimento); orientação do Guia de Cookies da ANPD | ALTA |
| A9 | Site em **HTTPS**, formulários enviam por HTTPS, sem dados pessoais em URL (`?email=`). | Checar `http://`, `action=` dos forms e links. | LGPD art. 46 | ALTA |
| A10 | Chaves, tokens e senhas **não aparecem** no código público (JS, HTML, repositório). | `grep -riE "api[_-]?key|secret|token|password" ` no build e no repo. | LGPD art. 46 | ALTA |
| A11 | Dados não são passados a terceiros sem informar/consentir (ex.: formulário que manda para ferramenta externa sem constar na política). | Ver para onde cada form envia (`action`, `fetch`). Conferir se o destino está na política. | Marco Civil art. 7º, VII; LGPD art. 9º, V | ALTA |
| A12 | Se o site tem **login/área do cliente** e é empresa com fins econômicos: existe guarda de **registros de acesso por 6 meses** (data, hora, IP). | Perguntar ao cliente / ver backend. | Marco Civil art. 15 | MÉDIA |
| A13 | Existe canal para o titular pedir **acesso, correção ou exclusão** dos dados (e-mail ou formulário citado na política). | Procurar na política. | LGPD art. 18 | ALTA |

## Bloco B: Venda online (CDC + Decreto 7.962/2013)

| # | Verificar | Como checar | Lei | Gravidade |
|---|---|---|---|---|
| B1 | Em **local de destaque**: **nome empresarial e CNPJ** (ou CPF), **endereço físico** e **e-mail/contato**. Rodapé de todas as páginas serve. | Procurar CNPJ e endereço no rodapé. | Decreto 7.962 art. 2º, I e II | ALTA |
| B2 | Cada produto/serviço mostra **características essenciais** (e riscos à saúde/segurança, se houver). | Ver página de produto. | Decreto 7.962 art. 2º, III; CDC art. 31 | ALTA |
| B3 | O preço **discrimina despesas extras** (frete, taxa, seguro) antes de fechar. | Simular uma compra até o fim. | Decreto 7.962 art. 2º, IV | ALTA |
| B4 | Mostra **condições completas**: formas de pagamento, disponibilidade, **prazo de entrega** ou de execução. | Página de produto e checkout. | Decreto 7.962 art. 2º, V | ALTA |
| B5 | Restrições da oferta ("válido até", "estoque limitado", "só para SP") aparecem **claras e visíveis**. | Procurar asteriscos e letras miúdas. | Decreto 7.962 art. 2º, VI | ALTA |
| B6 | **Resumo do pedido** antes de pagar, com cláusulas que limitam direitos em destaque, e possibilidade de **corrigir erros** antes de finalizar. | Fluxo do checkout. | Decreto 7.962 art. 4º, I e II | ALTA |
| B7 | **Confirmação imediata** do pedido (tela + e-mail/WhatsApp) e o **contrato/termos** disponíveis para guardar. | Testar o fim do checkout. | Decreto 7.962 art. 4º, III e IV | ALTA |
| B8 | **Atendimento eletrônico** (e-mail, chat, WhatsApp) para dúvida, reclamação e cancelamento, com resposta em até **5 dias**. | Canal visível no site. | Decreto 7.962 art. 4º, V e parágrafo único | ALTA |
| B9 | **Direito de arrependimento de 7 dias** informado de forma clara, com o **meio para exercer** (de preferência o mesmo canal da compra) e devolução do valor. Não pode haver "não aceitamos devoluções" para compra online. | Termos/página de trocas. Procurar textos que neguem o direito. | CDC art. 49; Decreto 7.962 art. 5º | ALTA |
| B10 | Pagamento e dados do cliente com **mecanismos de segurança eficazes** (gateway confiável, HTTPS, sem guardar cartão no próprio site). | Ver integração de pagamento. | Decreto 7.962 art. 4º, VII | ALTA |
| B11 | **Termos de uso/contrato** em linguagem clara, letra legível (não menor que corpo 12) e cláusulas que limitam direitos **em destaque**. | Página de termos; CSS do texto. | CDC art. 54, §§3º e 4º | MÉDIA |

## Bloco C: Preços

| # | Verificar | Como checar | Lei | Gravidade |
|---|---|---|---|---|
| C1 | **Preço à vista** visível **junto à imagem do produto** ou descrição do serviço, com letra **não menor que 12** (px como referência prática). | Inspecionar o CSS do preço na listagem e na página do produto. | Lei 10.962 art. 2º, III | ALTA |
| C2 | Preço informado com **correção, clareza, precisão e legibilidade** (sem "a partir de" escondendo o valor real). | Leitura da página. | Decreto 5.903 art. 2º; CDC art. 31 | ALTA |
| C3 | Se parcela: mostra **total à vista** e também **valor total parcelado, número e valor das parcelas** (e juros, se houver). | Ver bloco de parcelamento. | Decreto 5.903 art. 3º | ALTA |

## Bloco D: Acessibilidade

| # | Verificar | Como checar | Lei | Gravidade |
|---|---|---|---|---|
| D1 | Site **acessível a pessoas com deficiência**, seguindo as diretrizes internacionais (na prática: WCAG 2.1 nível AA / eMAG). | Rodar Lighthouse/axe; meta: Acessibilidade ≥ 90. | Lei 13.146 art. 63 | ALTA |
| D2 | Imagens com **texto alternativo** (`alt`); decorativas com `alt=""`. | `<img>` sem `alt`. | Lei 13.146 art. 63 | ALTA |
| D3 | **Contraste** de texto suficiente; site **usável só pelo teclado** (Tab, foco visível); botões e links com nome. | Lighthouse/axe; navegar com Tab. | Lei 13.146 art. 63 | ALTA |
| D4 | **Símbolo de acessibilidade em destaque** no site. **Obrigatório:** o símbolo. **Opcional (boa prática):** uma página "Acessibilidade" para onde ele leva. O símbolo sozinho não cumpre a lei se o site não for acessível (D1 a D3). | Procurar o símbolo (geralmente no rodapé ou cabeçalho). | Lei 13.146 art. 63, §1º | ALTA |
| D5 | Vídeos com legenda; animações respeitam `prefers-reduced-motion`. | Ver `<video>` e CSS. | Lei 13.146 art. 63 | MÉDIA |

## Bloco E: Direitos autorais e marcas

| # | Verificar | Como checar | Lei | Gravidade |
|---|---|---|---|---|
| E1 | Toda **foto, ilustração, vídeo, música e texto** de terceiros tem **autorização ou licença** (banco de imagens com licença, foto própria, IA com direitos de uso). | Perguntar a origem de cada imagem; ver licença. | Lei 9.610 arts. 7º e 29 | ALTA |
| E2 | Fotos de terceiros usadas com permissão indicam o **nome do autor** quando a licença exigir. | Ver créditos. | Lei 9.610 art. 79, §1º | MÉDIA |
| E3 | **Fontes** e ícones usados têm licença para web (Google Fonts, licença comprada). | Ver origem das fontes. | Lei 9.610 art. 29 | MÉDIA |
| E4 | O site **não usa marca/logo de outra empresa** de forma que confunda o cliente (ex.: usar logo de concorrente, "parceiro oficial" sem ser). Logos de clientes/parceiros só com autorização. | Ver logos e textos. | Lei 9.279 arts. 129 e 189 | ALTA |
| E5 | Nada de **afirmação falsa sobre concorrente** ou de se passar por outra empresa. | Ler textos comparativos. | Lei 9.279 art. 195, I | ALTA |
| E6 | Depoimentos, números ("+500 clientes"), selos e prêmios são **verdadeiros**. Publicidade não pode induzir a erro, nem por omissão. | Perguntar ao cliente a origem de cada número. | CDC art. 37 | ALTA |

## Bloco F: Crianças e adolescentes

| # | Verificar | Como checar | Lei | Gravidade |
|---|---|---|---|---|
| F1 | Se coleta dados de **crianças** (até 12 anos): **consentimento específico e em destaque de um dos pais/responsável**, e a política diz publicamente que dados coleta e como usa. | Formulários voltados a crianças. | LGPD art. 14, §§1º e 2º | ALTA |
| F2 | **Sem publicidade direcionada por perfil** (pixel de remarketing, perfilamento) para crianças e adolescentes. | Ver scripts de anúncio em sites infantis. | Lei 15.211 (ECA Digital) arts. 22 e 26 | ALTA |
| F3 | Conteúdo **impróprio para menores**: mecanismo de **verificação de idade** eficaz (não basta "tenho 18 anos" sozinho, conforme regulamentação). | Ver entrada do site. | Lei 15.211 art. 9º | ALTA |
| F4 | Site direcionado ou de acesso provável por menores: configurações **mais protetivas por padrão**, informações claras sobre uso dos dados. | Revisão geral. | Lei 15.211 arts. 5º a 8º e 33 | MÉDIA |

---

## 2. Formato do relatório

Para cada item que **falhou**, escreva:

```
[ALTA] B1: Rodapé sem CNPJ e endereço físico.
  Onde: index.html, <footer>
  Lei: Decreto 7.962/2013, art. 2º, I e II
  Como corrigir: incluir "Razão Social Ltda · CNPJ 00.000.000/0001-00 · Rua X, 123, Cidade/UF · contato@..."
```

No fim, um resumo: quantos itens ALTA e MÉDIA falharam, e os blocos que **não se aplicam** (com o motivo).
Nunca invente dados do cliente (CNPJ, endereço, nome do DPO): use marcadores e peça ao cliente.

## 3. Atualização

As leis mudam pouco. Uma vez por ano (ou quando sair norma nova da ANPD ou do Procon), atualize com
`ATUALIZAR.md`. Nunca baixe o repositório inteiro (são ~133 GB e 1,5 milhão de arquivos).
