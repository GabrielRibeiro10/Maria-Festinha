# Segurança — Maria Festinha

## Auditoria de 2026-11-10

### Arquitetura
- Site estático (HTML, CSS e JavaScript puros), hospedado na Vercel. `vercel.json` tem um `buildCommand` que só troca `__V__` pela versão do commit, com `outputDirectory: "."`.
- Sem backend, banco de dados, login, uploads, pagamentos ou IA.
- Bibliotecas no próprio domínio (`js/vendor/`): GSAP 3.15.0 + ScrollTrigger 3.15.0, Lenis 1.3.26. Fontes também locais.
- Terceiros: Google Maps (iframe, só no computador), links para WhatsApp e Instagram.
- Formulário de orçamento: não envia nada a servidor; monta uma mensagem e abre `wa.me` com `encodeURIComponent`.

### Escopo
Aplicável: headers HTTP e CSP, XSS no DOM, formulário, links externos, exposição de arquivos e segredos, dependências.
Não aplicável: banco/RLS, autenticação e sessões, CSRF, SSRF, uploads, pagamentos/webhooks, rate limiting, IA.

### Achados
| Severidade | Achado | Estado |
|---|---|---|
| Baixo | Arquivos do repositório publicados no site: `README.md` (anotações internas de trabalho: origem das fotos, caminhos locais), `vercel.json`, `.gitignore`, `.vercelignore`, todos com status 200. Sem segredos, mas expõe informação interna sem necessidade. Causa: com `buildCommand` e `outputDirectory: "."`, tudo o que não está no `.vercelignore` vira arquivo público. | Corrigido e testado |
| Baixo | CSP com um hash `sha256-Pn11…` que não corresponde a nenhum script do site (hash órfão de versão antiga). Liberava um script desconhecido sem motivo. | Corrigido e testado |
| Informativo | `script-src` usa `'unsafe-hashes'` só para o `onerror="this.hidden=true"` das fotos (hash exato). Aceitável. | Mantido |
| Informativo | `style-src 'unsafe-inline'` (estilos das animações e o `<style>` da privacidade). Não libera scripts. | Mantido |
| Informativo | `Access-Control-Allow-Origin: *` (padrão da Vercel para arquivos estáticos). Sem cookies nem dados privados, sem risco. | Mantido |

Nenhum achado crítico, alto ou médio.

### Correções
- `.vercelignore`: passa a excluir `*.md`, `.gitignore` e `.vercelignore` (além de `.claude`).
- `vercel.json`: `buildCommand` termina com `rm -f vercel.json` (a Vercel já leu a configuração antes do build; os headers continuam valendo); hash órfão removido da CSP.

### Validação
- Deploy de prévia na Vercel (branch `claude/blissful-ride-4wvpn1`): `/README.md`, `/vercel.json`, `/.gitignore`, `/.vercelignore` → 404; `privacidade.html` → 200 com `__V__` substituído e todos os headers de segurança (CSP nova incluída).
- Playwright com a CSP nova (servidor local): `/` no computador e no celular e `/privacidade.html` sem violações de CSP nem erros de JS; formulário no celular abre o WhatsApp e um texto com `<script>` chega como texto na mensagem.
- Hashes da CSP recalculados a partir do HTML: o script inline e o `onerror` conferem. O JSON-LD (`application/ld+json`) não é executado e não precisa de hash.
- `innerHTML` em `js/main.js`: só com textos fixos do próprio código ou o HTML original do elemento; nada vindo do visitante.
- Todos os links `target="_blank"` com `rel="noopener"`.
- `/.env`, `/.git/config`, `/.claude/...` → 404. Nenhum segredo no repositório.
- OSV: nenhuma vulnerabilidade conhecida para gsap 3.15.0 e lenis 1.3.26.
- Semgrep 1.185.0 (`p/javascript`, `p/xss`, `p/secrets`, `p/security-audit`, `p/default`, `--metrics=off`): 1 alerta `missing-integrity` em `privacidade.html:9`, falso positivo (`<link rel="canonical">` não carrega recurso).

### Limitações
- O clique automático no formulário na versão de computador não foi possível (a animação de rolagem tira o botão da área visível no teste); a lógica é a mesma do celular, que foi testada.
- A produção só recebe a correção quando este branch for mesclado no branch principal.
- Configurações da conta e do projeto na Vercel não foram verificadas.

### Recomendações
- Ao mudar um script inline ou um `onerror`, recalcular o hash na CSP e remover hashes que deixarem de ser usados.
- Arquivo novo que não deve ir para o ar (anotações, planilhas, rascunhos): adicionar ao `.vercelignore`.
