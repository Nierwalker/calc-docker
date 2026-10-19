// API de Calculadora simples em Node.js + Express
// Rotas: /soma, /subtracao, /multiplicacao, /divisao  (parâmetros ?a=NUM&b=NUM)
// Com Redis (variável REDIS_URL): guarda resultados em cache e o histórico das contas

const express = require("express");
const { createClient } = require("redis");

const app = express();
const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL;
const CACHE_TTL = 60; // segundos que um resultado fica no cache

const operacoes = {
  soma: (a, b) => a + b,
  subtracao: (a, b) => a - b,
  multiplicacao: (a, b) => a * b,
  divisao: (a, b) => {
    if (b === 0) throw new Error("Divisão por zero não é permitida");
    return a / b;
  },
};

// Sem REDIS_URL a API funciona sozinha, só sem cache e sem histórico
let redis = null;
if (REDIS_URL) {
  // disableOfflineQueue: se o Redis cair, os comandos falham na hora
  // em vez de ficarem presos esperando (a API continua respondendo)
  redis = createClient({ url: REDIS_URL, disableOfflineQueue: true });
  redis.on("error", (e) => console.error("Redis:", e.message));
  redis.connect().catch(() => {});
}

// Executa um comando no Redis sem derrubar a requisição se ele estiver fora
async function noRedis(comando) {
  if (!redis || !redis.isReady) return null;
  try {
    return await comando(redis);
  } catch (e) {
    console.error("Redis:", e.message);
    return null;
  }
}

// Página inicial com instruções de uso
app.get("/", (req, res) => {
  res.json({
    app: "Calculadora API",
    uso: "/<operacao>?a=NUM&b=NUM",
    operacoes: Object.keys(operacoes),
    exemplo: "/soma?a=2&b=3",
    historico: "/historico",
  });
});

// Endpoint usado pelo HEALTHCHECK do Docker
app.get("/health", (req, res) =>
  res.json({ status: "ok", redis: redis ? (redis.isReady ? "conectado" : "desconectado") : "desativado" })
);

// Últimas 10 contas feitas (fica salvo no volume do Redis)
app.get("/historico", async (req, res) => {
  const itens = await noRedis((r) => r.lRange("historico", 0, 9));
  res.json({ historico: (itens || []).map((i) => JSON.parse(i)) });
});

// Rota genérica para todas as operações
app.get("/:operacao", async (req, res) => {
  const fn = operacoes[req.params.operacao];
  if (!fn) return res.status(404).json({ erro: "Operação inválida" });

  const a = Number(req.query.a);
  const b = Number(req.query.b);
  if (Number.isNaN(a) || Number.isNaN(b) || req.query.a === undefined || req.query.b === undefined) {
    return res.status(400).json({ erro: "Informe a e b numéricos. Ex: ?a=2&b=3" });
  }

  let resultado;
  try {
    resultado = fn(a, b);
  } catch (e) {
    return res.status(400).json({ erro: e.message });
  }

  const chave = `calc:${req.params.operacao}:${a}:${b}`;
  const emCache = await noRedis((r) => r.get(chave));
  const resposta = { operacao: req.params.operacao, a, b, resultado, cache: emCache !== null };

  await noRedis((r) =>
    r
      .multi()
      .set(chave, String(resultado), { EX: CACHE_TTL })
      .lPush("historico", JSON.stringify({ operacao: resposta.operacao, a, b, resultado, em: new Date().toISOString() }))
      .lTrim("historico", 0, 9)
      .exec()
  );

  res.json(resposta);
});

app.listen(PORT, () => console.log(`Calculadora rodando na porta ${PORT}`));
