// API de Calculadora simples em Node.js + Express
// Rotas: /soma, /subtracao, /multiplicacao, /divisao  (parâmetros ?a=NUM&b=NUM)

const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

const operacoes = {
  soma: (a, b) => a + b,
  subtracao: (a, b) => a - b,
  multiplicacao: (a, b) => a * b,
  divisao: (a, b) => {
    if (b === 0) throw new Error("Divisão por zero não é permitida");
    return a / b;
  },
};

// Página inicial com instruções de uso
app.get("/", (req, res) => {
  res.json({
    app: "Calculadora API",
    uso: "/<operacao>?a=NUM&b=NUM",
    operacoes: Object.keys(operacoes),
    exemplo: "/soma?a=2&b=3",
  });
});

// Endpoint usado pelo HEALTHCHECK do Docker
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Rota genérica para todas as operações
app.get("/:operacao", (req, res) => {
  const fn = operacoes[req.params.operacao];
  if (!fn) return res.status(404).json({ erro: "Operação inválida" });

  const a = Number(req.query.a);
  const b = Number(req.query.b);
  if (Number.isNaN(a) || Number.isNaN(b) || req.query.a === undefined || req.query.b === undefined) {
    return res.status(400).json({ erro: "Informe a e b numéricos. Ex: ?a=2&b=3" });
  }

  try {
    res.json({ operacao: req.params.operacao, a, b, resultado: fn(a, b) });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

app.listen(PORT, () => console.log(`Calculadora rodando na porta ${PORT}`));
