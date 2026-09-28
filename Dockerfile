# =========================================================
# Dockerfile otimizado - Calculadora API (Node.js + Express)
# Usa multi-stage build: 1 estágio instala, outro só executa
# =========================================================

# ---------- ESTÁGIO 1: dependências (builder) ----------
# Imagem Alpine: base mínima (~50 MB) em vez da node:22 completa (~1 GB)
FROM node:22-alpine AS builder

# Pasta de trabalho dentro do container
WORKDIR /app

# Copia SÓ os arquivos de dependência primeiro.
# Assim o Docker reaproveita o cache desta camada: se só o código
# mudar, o "npm ci" não roda de novo (build muito mais rápido).
COPY package*.json ./

# npm ci = instalação limpa e reproduzível (usa o package-lock.json)
# --omit=dev = não instala dependências de desenvolvimento
# Limpa o cache do npm para não levar lixo para a camada
RUN npm ci --omit=dev && npm cache clean --force


# ---------- ESTÁGIO 2: execução (runtime) ----------
# Começa de novo numa imagem limpa: nada do estágio 1 vem junto,
# a não ser o que for copiado explicitamente
FROM node:22-alpine

# Modo produção: o Express fica mais rápido e com menos logs de debug
ENV NODE_ENV=production

WORKDIR /app

# Copia apenas as dependências já instaladas do estágio builder.
# --chown=node:node dá a posse dos arquivos ao usuário sem privilégios
COPY --from=builder --chown=node:node /app/node_modules ./node_modules

# Copia só o código necessário (o .dockerignore bloqueia o resto)
COPY --chown=node:node package.json server.js ./

# Segurança: roda como usuário comum "node", não como root
USER node

# Documenta a porta que a aplicação usa
EXPOSE 3000

# O Docker verifica sozinho se a API está respondendo
# (wget já vem no Alpine, não precisa instalar curl)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Forma "exec" (JSON): o node vira o processo principal (PID 1)
# e recebe os sinais de parada corretamente (docker stop)
CMD ["node", "server.js"]
