// Testes da API (rodam no container "tests" do docker-compose.test.yml)
const { test } = require("node:test");
const assert = require("node:assert");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function get(caminho) {
  const resp = await fetch(BASE_URL + caminho);
  return { status: resp.status, corpo: await resp.json() };
}

test("health responde ok e o Redis está conectado", async () => {
  const { status, corpo } = await get("/health");
  assert.strictEqual(status, 200);
  assert.strictEqual(corpo.status, "ok");
  assert.strictEqual(corpo.redis, "conectado");
});

test("soma", async () => {
  const { corpo } = await get("/soma?a=2&b=3");
  assert.strictEqual(corpo.resultado, 5);
});

test("subtração", async () => {
  const { corpo } = await get("/subtracao?a=10&b=4");
  assert.strictEqual(corpo.resultado, 6);
});

test("multiplicação", async () => {
  const { corpo } = await get("/multiplicacao?a=4&b=5");
  assert.strictEqual(corpo.resultado, 20);
});

test("divisão", async () => {
  const { corpo } = await get("/divisao?a=10&b=4");
  assert.strictEqual(corpo.resultado, 2.5);
});

test("divisão por zero retorna erro 400", async () => {
  const { status, corpo } = await get("/divisao?a=1&b=0");
  assert.strictEqual(status, 400);
  assert.match(corpo.erro, /zero/);
});

test("parâmetros inválidos retornam erro 400", async () => {
  const { status } = await get("/soma?a=abc&b=1");
  assert.strictEqual(status, 400);
});

test("operação inexistente retorna 404", async () => {
  const { status } = await get("/potencia?a=2&b=3");
  assert.strictEqual(status, 404);
});

test("segunda chamada igual vem do cache do Redis", async () => {
  const primeira = await get("/multiplicacao?a=7&b=6");
  const segunda = await get("/multiplicacao?a=7&b=6");
  assert.strictEqual(primeira.corpo.cache, false);
  assert.strictEqual(segunda.corpo.cache, true);
});

test("histórico registra a última conta", async () => {
  await get("/soma?a=100&b=1");
  const { corpo } = await get("/historico");
  assert.deepStrictEqual(
    { operacao: corpo.historico[0].operacao, resultado: corpo.historico[0].resultado },
    { operacao: "soma", resultado: 101 }
  );
});
