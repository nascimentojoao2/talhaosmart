const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');

const projectDir = process.cwd();
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'talhaosmart-backend-'));
const dbFile = path.join(tmpDir, 'smoke.sqlite');
const port = String(3100 + Math.floor(Math.random() * 500));
const baseUrl = `http://127.0.0.1:${port}/api/v1`;

let server;

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error(`Servidor não respondeu em ${baseUrl}/health.`);
}

async function request(pathname, { method = 'GET', headers = {}, body, token } = {}) {
  const finalHeaders = { ...headers };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  const response = await fetch(`${baseUrl}${pathname}`, { method, headers: finalHeaders, body });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function readUserByEmail(email) {
  const db = new Database(dbFile, { readonly: true });
  try {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  } finally {
    db.close();
  }
}

function countRows(table) {
  const db = new Database(dbFile, { readonly: true });
  try {
    return db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count;
  } finally {
    db.close();
  }
}

async function run() {
  process.env.PORT = port;
  process.env.DATABASE_PATH = dbFile;
  process.env.JWT_SECRET = 'talhaosmart_smoke_secret';
  process.env.CORS_ORIGIN = '*';

  const { startServer } = require(path.join(projectDir, 'dist/server.js'));
  server = startServer(Number(port), '127.0.0.1');

  await waitForServer();

  const email = `smoke-${Date.now()}@example.com`;
  const password = '123456';
  const newPassword = '654321';

  let result = await request('/auth/providers');
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.local.ready, true);
  assert.equal(typeof result.data.google.configured, 'boolean');

  result = await request('/propriedades');
  assert.equal(result.response.status, 401, JSON.stringify(result.data));

  result = await request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: 'A', email: 'email-invalido', senha: '123' })
  });
  assert.equal(result.response.status, 400, JSON.stringify(result.data));

  result = await request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: 'Smoke Test', email, senha: password })
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.data));

  const registeredUser = readUserByEmail(email);
  assert.ok(registeredUser?.verification_code, 'Código de verificação não foi salvo.');

  result = await request('/auth/resend-verification-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));

  const userWithResentCode = readUserByEmail(email);
  assert.ok(userWithResentCode?.verification_code, 'Código reenviado não foi salvo.');

  result = await request('/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, codigo: userWithResentCode.verification_code })
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  const token = result.data.token;
  assert.ok(token, 'Token não retornado após verificação.');

  result = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha: password })
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));

  result = await request('/auth/me', { token });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.email, email);

  result = await request('/propriedades', {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: 'Fazenda Boa Vista', descricao: 'Área principal do smoke test' })
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.data));
  const propriedadeId = result.data.propriedade.id;
  assert.ok(propriedadeId, 'Propriedade não retornou id.');

  result = await request('/propriedades', { token });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.length, 1);

  result = await request(`/propriedades/${propriedadeId}`, {
    method: 'PUT',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: 'Fazenda Boa Vista Atualizada', descricao: 'Descrição atualizada' })
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));

  const geojson = {
    type: 'Polygon',
    coordinates: [[
      [-46.6301, -23.5501],
      [-46.6295, -23.5501],
      [-46.6295, -23.5495],
      [-46.6301, -23.5495],
      [-46.6301, -23.5501]
    ]]
  };

  result = await request('/talhoes', {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: 'Talhão A', area: 2.5, geojson, propriedade_id: propriedadeId })
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.data));
  const talhaoId = result.data.talhao.id;
  assert.ok(talhaoId, 'Talhão não retornou id.');

  result = await request('/talhoes', { token });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].propriedade_id, propriedadeId);

  result = await request(`/talhoes/${talhaoId}`, {
    method: 'PUT',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: 'Talhão A Editado', area: 3.1, geojson, propriedade_id: propriedadeId })
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));

  result = await request('/operacoes/planejamento', {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ talhao_id: talhaoId, largura_faixa: 18 })
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.planejamento.talhao_id, talhaoId);
  assert.ok(result.data.planejamento.rota_geojson.features.length >= 2, 'Planejamento não retornou rota suficiente.');

  result = await request('/operacoes/missoes', {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ talhao_id: talhaoId, largura_faixa: 18, nome: 'Missão Smoke' })
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.data));
  const missaoId = result.data.missao.id;
  assert.ok(missaoId, 'Missão operacional não retornou id.');

  result = await request(`/operacoes/missoes?talhao_id=${talhaoId}`, { token });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].talhao_id, talhaoId);
  assert.equal(result.data[0].estatisticas.total_passadas > 0, true);

  result = await request(`/operacoes/missoes/${missaoId}`, { token });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.id, missaoId);

  result = await request(`/operacoes/talhoes/export?format=geojson&talhao_id=${talhaoId}`, { token });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.total_talhoes, 1);
  assert.ok(result.data.content.includes('"FeatureCollection"') || result.data.content.includes('"type": "FeatureCollection"'));

  result = await request('/operacoes/talhoes/export?format=kml', { token });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.total_talhoes, 1);
  assert.ok(result.data.content.includes('<kml'));

  const form = new FormData();
  form.append('talhao_id', String(talhaoId));
  form.append('descricao', 'Registro criado no smoke test');

  result = await request('/registros', { method: 'POST', token, body: form });
  assert.equal(result.response.status, 201, JSON.stringify(result.data));

  result = await request('/registros', { token });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].propriedade_nome, 'Fazenda Boa Vista Atualizada');

  result = await request('/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));

  const userWithResetCode = readUserByEmail(email);
  assert.ok(userWithResetCode?.reset_code, 'Código de reset não foi salvo.');

  result = await request('/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, codigo: userWithResetCode.reset_code, novaSenha: newPassword })
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));

  result = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha: newPassword })
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));

  result = await request(`/talhoes/${talhaoId}`, { method: 'DELETE', token });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));

  result = await request(`/propriedades/${propriedadeId}`, { method: 'DELETE', token });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));

  assert.equal(countRows('propriedades'), 0, 'Propriedades não foram removidas.');
  assert.equal(countRows('talhoes'), 0, 'Talhões não foram removidos.');
  assert.equal(countRows('registros'), 0, 'Registros órfãos permaneceram após remover o talhão.');
  assert.equal(countRows('missoes_operacionais'), 0, 'Missões operacionais órfãs permaneceram após remover o talhão.');

  console.log('Smoke test do backend concluído com sucesso.');
}

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });
