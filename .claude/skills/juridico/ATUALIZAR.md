# Como atualizar as leis (sem baixar 133 GB)

Baixa só a lista de arquivos (~60 MB) e depois só as leis que importam (~600 KB).

```bash
git clone --depth 1 --filter=blob:none --no-checkout https://github.com/ctresb/leis leis-tmp
cd leis-tmp
for f in \
  federal/leis-ordinarias/2018/lei-13709-2018-08-14.md:lgpd-lei-13709-2018.md \
  federal/leis-ordinarias/2014/lei-12965-2014-04-23.md:marco-civil-lei-12965-2014.md \
  federal/leis-ordinarias/1990/lei-8078-1990-09-11.md:cdc-lei-8078-1990.md \
  federal/decretos/2013/dec-7962-2013-03-15.md:comercio-eletronico-decreto-7962-2013.md \
  federal/leis-ordinarias/2004/lei-10962-2004-10-11.md:precos-lei-10962-2004.md \
  federal/decretos/2006/dec-5903-2006-09-20.md:precos-decreto-5903-2006.md \
  federal/leis-ordinarias/2015/lei-13146-2015-07-06.md:acessibilidade-lei-13146-2015.md \
  federal/leis-ordinarias/1998/lei-9610-1998-02-19.md:direitos-autorais-lei-9610-1998.md \
  federal/leis-ordinarias/1996/lei-9279-1996-05-14.md:marcas-lei-9279-1996.md \
  federal/leis-ordinarias/2025/lei-15211-2025-09-17.md:eca-digital-lei-15211-2025.md
do git show "HEAD:${f%%:*}" > "../leis/${f##*:}"; done
cd .. && rm -rf leis-tmp
```

Depois:
1. Compare com a versão anterior (`git diff` na pasta da skill) para ver o que mudou.
2. Se mudou algum artigo citado no `CHECKLIST.md`, atualize o item e a data "Textos conferidos em".

**Não use** `git ls-tree --long` nem `git checkout` no repositório inteiro: os dois baixam o conteúdo de tudo.

Para achar uma norma nova (ex.: resolução da ANPD sobre cookies):
```bash
git ls-tree -r --name-only HEAD | grep -i anpd | head
```
