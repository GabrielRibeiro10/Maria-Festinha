# Base de conhecimento da auditoria de sites

O que a skill `auditoria-site` já aprendeu auditando sites. Serve para qualquer site: cada entrada é uma regra
genérica, com o site onde apareceu só como exemplo.

| Arquivo | O que guarda |
|---|---|
| `indice.md` | lista de tudo, para achar rápido |
| `efeitos.md` | uma ficha por efeito (custo, como medir, como fica no modo leve, defeitos conhecidos). O id da ficha é o mesmo que o `descobrir.js` mostra |
| `causas.md` | sintoma de travada → causa → correção, confirmados por medição |
| `safari-iphone.md` | defeitos que só aparecem no Safari/iPhone e como conferir |
| `ambiente-de-teste.md` | armadilhas do próprio teste: alarmes falsos, dependências, medições enganosas |

## Como funciona

1. **Toda auditoria começa lendo** este arquivo e o `indice.md`; depois do `descobrir.js`, as fichas dos efeitos que o
   site usa.
2. **Toda auditoria termina gravando** o que aprendeu (automático, sem pedir licença) e contando no relatório o que
   gravou. Regras de como gravar: seção "Aprendizado" do `SKILL.md`.
3. Entrada nova ou atualizada: data, `confirmado (medido)` ou `observação (não medida)`, e o `indice.md` atualizado.
4. Nunca grave senhas, chaves, dados pessoais ou de clientes.

## Versão principal e cópias

A versão principal fica no repositório do portfólio. Cópias em outros sites são levadas de volta para a principal ao
fim da auditoria, para que tudo que se aprende em um site valha para os outros.
