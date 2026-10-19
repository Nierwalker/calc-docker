# Atividade — Docker Compose

**Aplicação:** a mesma API de calculadora (imagem `calculadora-api` da atividade passada), agora orquestrada com Docker Compose junto de um Redis e um nginx.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `docker-compose.yml` | Sobe a aplicação: `web` (nginx), `api` (calculadora-api) e `redis` |
| `docker-compose.test.yml` | Sobe `api` + `redis` e um container `tests` que roda os testes automáticos |
| `tests/api.test.js` | 10 testes da API (operações, erros, cache e histórico) |
| `.github/workflows/ci.yml` | GitHub Actions: roda o compose de testes a cada push |
| `.devcontainer/devcontainer.json` | Configura o Codespaces com Docker já instalado |
| `nginx.conf` | Serve a página e repassa `/api/...` para a API |

## O que o compose configura

- **Serviços:** `web` (nginx, página da calculadora), `api` (Node.js, a imagem da atividade passada) e `redis` (cache dos resultados por 60 s e histórico das últimas 10 contas).
- **Redes:** `frontend` (web ↔ api) e `backend` (api ↔ redis). O nginx não tem acesso ao Redis.
- **Volume:** `redis-data`, com o Redis em modo `appendonly`. O histórico continua depois de `docker compose down`.
- **Reinício:** `restart: unless-stopped` nos três serviços. Se o processo cair, o Docker sobe de novo; se você parar à mão, ele fica parado.
- **Ordem de subida:** `depends_on` com `condition: service_healthy`. A API espera o Redis responder e o nginx espera a API.
- **Porta exposta:** só a 8080 (nginx). API e Redis ficam acessíveis apenas dentro das redes do Docker.

## Passo a passo no GitHub Codespaces (tire print destes comandos)

1. Envie esta pasta para um repositório no GitHub.
2. No repositório: **Code → Codespaces → Create codespace on main**. Espere abrir o VS Code no navegador.
3. No terminal do Codespace:

```bash
docker compose up -d --build        # constrói a imagem e sobe os 3 serviços
docker compose ps                   # espere os 3 ficarem (healthy)
docker images calculadora-api       # a imagem da atividade passada
docker network ls                   # redes frontend e backend
docker volume ls                    # volume redis-data
```

4. Teste a aplicação:

```bash
curl "localhost:8080/api/soma?a=2&b=3"      # "cache":false
curl "localhost:8080/api/soma?a=2&b=3"      # "cache":true (veio do Redis)
curl "localhost:8080/api/divisao?a=1&b=0"   # erro de divisão por zero
curl "localhost:8080/api/historico"
```

Para ver a página: aba **PORTS** → porta 8080 → ícone do globo.

5. Prova de que o volume guarda os dados:

```bash
docker compose down
docker compose up -d --wait
curl "localhost:8080/api/historico"         # o histórico continua lá
```

6. Testes automáticos (os mesmos do CI):

```bash
docker compose -f docker-compose.test.yml -p testes up --build --abort-on-container-exit --exit-code-from tests
docker compose -f docker-compose.test.yml -p testes down -v
```

O final da saída deve mostrar `# pass 10` e `# fail 0`.

7. Desligue tudo:

```bash
docker compose down -v
```

8. **Finalize o Codespace** para não gastar horas: em github.com/codespaces → `...` ao lado do codespace → **Stop codespace** (ou **Delete**).

9. Na aba **Actions** do repositório, o workflow **CI** deve aparecer verde. Tire print também.

## Resultados (testado localmente com Docker Desktop)

- `docker compose ps`: `web`, `api` e `redis` com status `(healthy)`.
- Mesma conta duas vezes: a primeira com `"cache":false` e a segunda com `"cache":true`.
- Depois de `down` + `up`, o histórico continuou no volume.
- Simulando uma queda do processo da API, o Docker reiniciou o container sozinho (`RestartCount=1`).
- Compose de testes: 10 testes passaram, 0 falharam.
