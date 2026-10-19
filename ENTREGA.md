# Atividade 06 — Docker no LabEx

**Aplicação:** API de calculadora em Node.js + Express (soma, subtração, multiplicação e divisão).

---

## 1. Passo a passo no LabEx (tire print destes comandos)

Crie a pasta e os arquivos (`server.js`, `package.json`, `package-lock.json`, `Dockerfile`, `.dockerignore`), ou envie o .zip e descompacte:

```bash
unzip calc-docker.zip && cd calc-docker
```

Construa a imagem:

```bash
docker build -t calculadora .
```

Veja o tamanho da imagem (print importante, prova a otimização):

```bash
docker images calculadora
```

Rode o container:

```bash
docker run -d --name calc -p 3000:3000 calculadora
```

Teste se está funcionando:

```bash
curl "localhost:3000/soma?a=2&b=3"
curl "localhost:3000/divisao?a=10&b=2"
curl "localhost:3000/divisao?a=10&b=0"
docker ps
```

Resultado esperado:

```
{"operacao":"soma","a":2,"b":3,"resultado":5}
{"operacao":"divisao","a":10,"b":2,"resultado":5}
{"erro":"Divisão por zero não é permitida"}
```

No `docker ps`, depois de uns 30 segundos a coluna STATUS mostra `(healthy)`.

Prova de que o container não roda como root:

```bash
docker exec calc whoami     # deve responder: node
```

> **Dica:** se o `package-lock.json` não estiver na pasta, rode `npm install` antes do build (o `npm ci` precisa dele). Se o `npm` não existir no LabEx, troque `npm ci` por `npm install` no Dockerfile.

---

## 2. Explicação das escolhas de otimização

**1. Imagem base Alpine (`node:22-alpine`).** A imagem `node:22` completa passa de 1 GB, porque traz um Debian inteiro com compiladores e ferramentas. A versão Alpine tem cerca de 50 MB e só o necessário para rodar Node. Imagem menor significa download mais rápido, menos espaço em disco e menos vulnerabilidades.

**2. Multi-stage build.** O primeiro estágio (`builder`) instala as dependências. O segundo começa numa imagem limpa e copia apenas a pasta `node_modules` pronta e o código. Assim, cache do npm, arquivos temporários e ferramentas de instalação ficam no estágio descartado e não entram na imagem final.

**3. Cache de camadas.** O `package.json` é copiado e as dependências instaladas antes de copiar o código. Como o Docker guarda cada instrução em cache, quando só o `server.js` muda o `npm ci` não roda de novo e o rebuild leva segundos.

**4. `npm ci --omit=dev` e limpeza de cache.** O `npm ci` faz instalação exata a partir do `package-lock.json` (build reproduzível). O `--omit=dev` deixa de fora dependências de desenvolvimento e o `npm cache clean` remove o cache do npm da camada.

**5. `.dockerignore`.** Impede que `node_modules` local, `.git`, arquivos `.env` e documentação sejam enviados para o build. Isso deixa o build mais rápido e evita vazar arquivos sensíveis para a imagem.

**6. Usuário sem privilégios (`USER node`).** O container roda como o usuário `node` em vez de `root`. Se alguém explorar uma falha na aplicação, o acesso dentro do container fica limitado.

**7. `NODE_ENV=production`.** O Express ativa otimizações de produção (cache de views, menos mensagens de debug).

**8. `HEALTHCHECK`.** O Docker testa a rota `/health` a cada 30 segundos e marca o container como `healthy` ou `unhealthy`, verificando que a aplicação realmente responde. Usa o `wget` que já vem no Alpine, sem instalar o `curl`.

**9. `CMD` em formato JSON (exec form).** O `node` vira o processo principal do container e recebe os sinais de parada do `docker stop`, encerrando de forma limpa.

---

## 3. Resultados

- **Imagem final (Node.js, local):** 61,4 MB, contra mais de 1 GB da imagem `node:22` completa.
- **Container:** status `healthy` e executando como usuário `node` (não root).
- **Testes:** soma retornou 5, multiplicação 20, e a divisão por zero foi tratada com mensagem de erro.

## 4. Execução no LabEx

O ambiente do LabEx estava sem acesso à internet: Docker Hub, espelho da AWS e npm deram timeout. Por isso, a versão Node.js foi construída e validada localmente com Docker Desktop.

No LabEx, adaptei a aplicação para uma versão web estática servida por nginx, usando a imagem `docker/getting-started` que já estava disponível no ambiente (arquivo `Dockerfile-labex`). Mantive o multi-stage build: o estágio 1 valida o HTML e gera uma versão pré-comprimida, e o estágio 2 contém apenas o nginx com os arquivos finais. A imagem ficou com 47 MB, o container ficou `healthy` e a calculadora funcionou no navegador (2 + 3 = 5).
