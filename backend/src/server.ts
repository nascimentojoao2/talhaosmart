import dotenv from 'dotenv';
dotenv.config();
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { db } from './db';
import { authMiddleware, comparePassword, hashPassword, signToken } from './auth';
import {
  getAuthProvidersStatus,
  normalizeEmail,
  normalizeVerificationCode,
  validateEmail,
  validateNome,
  validatePassword,
  validateVerificationCode
} from './features/auth/validation';
import { registerOperationalRoutes } from './features/operacoes/routes';
import { code6 } from './utils';
import type { PropriedadeRow, RegistroRow, TalhaoRow, UserRow } from './types';

export const app = express();
const PORT = Number(process.env.PORT || 3000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '8mb' }));

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.bin';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({ storage });

type AuthRequest = Request & {
  userId?: number;
};

function parseId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalText(value: unknown) {
  const normalized = normalizeText(value);
  return normalized.length ? normalized : null;
}

function parseArea(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isPolygonGeojson(value: any) {
  return (
    value &&
    value.type === 'Polygon' &&
    Array.isArray(value.coordinates) &&
    Array.isArray(value.coordinates[0]) &&
    value.coordinates[0].length >= 4
  );
}

function serializeTalhao(row: TalhaoRow) {
  return {
    ...row,
    geojson: JSON.parse(row.geojson)
  };
}

function getPropriedadeById(propriedadeId: number, userId: number) {
  return db.prepare('SELECT * FROM propriedades WHERE id = ? AND user_id = ?').get(propriedadeId, userId) as PropriedadeRow | undefined;
}

function getTalhaoById(talhaoId: number, userId: number) {
  return db.prepare(`
    SELECT t.*, p.nome as propriedade_nome
    FROM talhoes t
    INNER JOIN propriedades p ON p.id = t.propriedade_id
    WHERE t.id = ? AND t.user_id = ?
  `).get(talhaoId, userId) as TalhaoRow | undefined;
}

function requireAuthUserId(req: AuthRequest, res: Response) {
  if (!req.userId) {
    res.status(401).json({ message: 'Token inválido.' });
    return null;
  }

  return req.userId;
}

app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/api/v1/auth/providers', (_req, res) => {
  return res.json(getAuthProvidersStatus());
});

app.post('/api/v1/auth/register', (req, res) => {
  const nome = normalizeText(req.body?.nome);
  const email = normalizeEmail(req.body?.email);
  const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';

  const nomeError = validateNome(nome);
  if (nomeError) return res.status(400).json({ message: nomeError });

  const emailError = validateEmail(email);
  if (emailError) return res.status(400).json({ message: emailError });

  const senhaError = validatePassword(senha);
  if (senhaError) return res.status(400).json({ message: senhaError });

  const exists = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
  if (exists) {
    const providerHint = exists.auth_provider === 'google'
      ? 'Já existe uma conta com este email vinculada ao Google.'
      : 'Email já cadastrado.';
    return res.status(409).json({ message: providerHint });
  }

  const verificationCode = code6();
  const result = db.prepare(`
    INSERT INTO users (nome, email, senha_hash, email_verificado, verification_code, auth_provider)
    VALUES (?, ?, ?, 0, ?, 'local')
  `).run(nome, email, hashPassword(senha), verificationCode);

  console.log(`[TalhaoSmart] Código de verificação para ${email}: ${verificationCode}`);
  return res.status(201).json({ message: 'Cadastro realizado. Código gerado no terminal do backend.', userId: result.lastInsertRowid });
});

app.post('/api/v1/auth/verify-email', (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const codigo = normalizeVerificationCode(req.body?.codigo);

  const emailError = validateEmail(email);
  if (emailError) return res.status(400).json({ message: emailError });

  const codeError = validateVerificationCode(codigo);
  if (codeError) return res.status(400).json({ message: codeError });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
  if (user.email_verificado) return res.status(400).json({ message: 'Email já verificado.' });
  if (user.verification_code !== codigo) return res.status(400).json({ message: 'Código inválido.' });

  db.prepare('UPDATE users SET email_verificado = 1, verification_code = NULL WHERE id = ?').run(user.id);
  const token = signToken(user.id);
  return res.json({
    token,
    user: { id: user.id, nome: user.nome, email: user.email, email_verificado: true, auth_provider: user.auth_provider }
  });
});

app.post('/api/v1/auth/resend-verification-code', (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const emailError = validateEmail(email);
  if (emailError) return res.status(400).json({ message: emailError });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
  if (user.email_verificado) return res.status(400).json({ message: 'Este email já foi verificado.' });
  const verificationCode = code6();
  db.prepare('UPDATE users SET verification_code = ? WHERE id = ?').run(verificationCode, user.id);
  console.log(`[TalhaoSmart] Novo código de verificação para ${email}: ${verificationCode}`);
  return res.json({ message: 'Novo código gerado no terminal do backend.' });
});

app.post('/api/v1/auth/login', (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';

  const emailError = validateEmail(email);
  if (emailError) return res.status(400).json({ message: emailError });

  if (!senha.trim()) return res.status(400).json({ message: 'Informe sua senha.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
  if (user?.auth_provider === 'google' && !user?.senha_hash) {
    return res.status(400).json({ message: 'Esta conta foi criada com Google. Conclua o login social quando ele estiver habilitado.' });
  }
  if (!user || !user.senha_hash || !comparePassword(senha, user.senha_hash)) {
    return res.status(401).json({ message: 'Credenciais inválidas.' });
  }
  if (!user.email_verificado) {
    return res.status(403).json({ message: 'Email ainda não verificado.' });
  }
  const token = signToken(user.id);
  return res.json({
    token,
    user: { id: user.id, nome: user.nome, email: user.email, email_verificado: !!user.email_verificado, auth_provider: user.auth_provider }
  });
});

app.post('/api/v1/auth/forgot-password', (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const emailError = validateEmail(email);
  if (emailError) return res.status(400).json({ message: emailError });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
  if (user.auth_provider === 'google' && !user.senha_hash) {
    return res.status(400).json({ message: 'Esta conta usa login com Google e ainda não possui recuperação por senha local.' });
  }
  const resetCode = code6();
  db.prepare('UPDATE users SET reset_code = ? WHERE id = ?').run(resetCode, user.id);
  console.log(`[TalhaoSmart] Código de reset para ${email}: ${resetCode}`);
  return res.json({ message: 'Código de recuperação gerado no terminal do backend.' });
});

app.post('/api/v1/auth/reset-password', (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const codigo = normalizeVerificationCode(req.body?.codigo);
  const novaSenha = typeof req.body?.novaSenha === 'string' ? req.body.novaSenha : '';

  const emailError = validateEmail(email);
  if (emailError) return res.status(400).json({ message: emailError });

  const codeError = validateVerificationCode(codigo);
  if (codeError) return res.status(400).json({ message: codeError });

  const senhaError = validatePassword(novaSenha, 'uma nova senha');
  if (senhaError) return res.status(400).json({ message: senhaError });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
  if (user.reset_code !== codigo) return res.status(400).json({ message: 'Código inválido.' });
  db.prepare('UPDATE users SET senha_hash = ?, reset_code = NULL, email_verificado = 1 WHERE id = ?').run(hashPassword(novaSenha), user.id);
  return res.json({ message: 'Senha redefinida com sucesso.' });
});

app.post('/api/v1/auth/google', (_req, res) => {
  const providers = getAuthProvidersStatus();
  if (!providers.google.configured) {
    return res.status(503).json({ message: providers.google.message });
  }

  return res.status(501).json({ message: providers.google.message });
});

app.get('/api/v1/auth/me', authMiddleware, (req: AuthRequest, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as UserRow | undefined;
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
  return res.json({ id: user.id, nome: user.nome, email: user.email, email_verificado: !!user.email_verificado, auth_provider: user.auth_provider });
});

app.get('/api/v1/propriedades', authMiddleware, (req: AuthRequest, res) => {
  const userId = requireAuthUserId(req, res);
  if (!userId) return;

  const propriedades = db.prepare(`
    SELECT
      p.*,
      COUNT(t.id) as total_talhoes
    FROM propriedades p
    LEFT JOIN talhoes t ON t.propriedade_id = p.id
    WHERE p.user_id = ?
    GROUP BY p.id
    ORDER BY p.id DESC
  `).all(userId) as PropriedadeRow[];

  return res.json(propriedades);
});

app.post('/api/v1/propriedades', authMiddleware, (req: AuthRequest, res) => {
  const userId = requireAuthUserId(req, res);
  if (!userId) return;

  const nome = normalizeText(req.body?.nome);
  const descricao = normalizeOptionalText(req.body?.descricao);

  if (!nome) {
    return res.status(400).json({ message: 'Informe o nome da propriedade.' });
  }

  const result = db.prepare('INSERT INTO propriedades (user_id, nome, descricao) VALUES (?, ?, ?)').run(userId, nome, descricao);
  const propriedade = db.prepare('SELECT * FROM propriedades WHERE id = ?').get(result.lastInsertRowid) as PropriedadeRow;

  return res.status(201).json({
    message: 'Propriedade criada com sucesso.',
    propriedade: { ...propriedade, total_talhoes: 0 }
  });
});

app.put('/api/v1/propriedades/:id', authMiddleware, (req: AuthRequest, res) => {
  const userId = requireAuthUserId(req, res);
  if (!userId) return;

  const propriedadeId = parseId(req.params.id);
  if (!propriedadeId) return res.status(400).json({ message: 'Propriedade inválida.' });

  const propriedade = getPropriedadeById(propriedadeId, userId);
  if (!propriedade) return res.status(404).json({ message: 'Propriedade não encontrada.' });

  const nome = normalizeText(req.body?.nome);
  const descricao = normalizeOptionalText(req.body?.descricao);

  if (!nome) {
    return res.status(400).json({ message: 'Informe o nome da propriedade.' });
  }

  db.prepare('UPDATE propriedades SET nome = ?, descricao = ? WHERE id = ?').run(nome, descricao, propriedadeId);

  const updated = db.prepare(`
    SELECT p.*, COUNT(t.id) as total_talhoes
    FROM propriedades p
    LEFT JOIN talhoes t ON t.propriedade_id = p.id
    WHERE p.id = ?
    GROUP BY p.id
  `).get(propriedadeId) as PropriedadeRow;

  return res.json({
    message: 'Propriedade atualizada com sucesso.',
    propriedade: updated
  });
});

app.delete('/api/v1/propriedades/:id', authMiddleware, (req: AuthRequest, res) => {
  const userId = requireAuthUserId(req, res);
  if (!userId) return;

  const propriedadeId = parseId(req.params.id);
  if (!propriedadeId) return res.status(400).json({ message: 'Propriedade inválida.' });

  const propriedade = getPropriedadeById(propriedadeId, userId);
  if (!propriedade) return res.status(404).json({ message: 'Propriedade não encontrada.' });

  const totalTalhoes = db.prepare('SELECT COUNT(*) as total FROM talhoes WHERE propriedade_id = ?').get(propriedadeId) as { total: number };

  db.prepare('DELETE FROM propriedades WHERE id = ?').run(propriedadeId);

  return res.json({
    message: totalTalhoes.total > 0
      ? `Propriedade removida com sucesso. ${totalTalhoes.total} talhão(ões) vinculado(s) também foram excluídos.`
      : 'Propriedade removida com sucesso.'
  });
});

app.get('/api/v1/talhoes', authMiddleware, (req: AuthRequest, res) => {
  const userId = requireAuthUserId(req, res);
  if (!userId) return;

  const talhoes = db.prepare(`
    SELECT t.*, p.nome as propriedade_nome
    FROM talhoes t
    INNER JOIN propriedades p ON p.id = t.propriedade_id
    WHERE t.user_id = ?
    ORDER BY t.id DESC
  `).all(userId) as TalhaoRow[];

  return res.json(talhoes.map(serializeTalhao));
});

app.get('/api/v1/talhoes/:id', authMiddleware, (req: AuthRequest, res) => {
  const userId = requireAuthUserId(req, res);
  if (!userId) return;

  const talhaoId = parseId(req.params.id);
  if (!talhaoId) return res.status(400).json({ message: 'Talhão inválido.' });

  const talhao = getTalhaoById(talhaoId, userId);
  if (!talhao) return res.status(404).json({ message: 'Talhão não encontrado.' });

  return res.json(serializeTalhao(talhao));
});

app.post('/api/v1/talhoes', authMiddleware, (req: AuthRequest, res) => {
  const userId = requireAuthUserId(req, res);
  if (!userId) return;

  const nome = normalizeText(req.body?.nome);
  const geojson = req.body?.geojson;
  const areaNumber = parseArea(req.body?.area);
  const propriedadeId = parseId(req.body?.propriedade_id);

  if (!propriedadeId) {
    return res.status(400).json({ message: 'Selecione uma propriedade válida para o talhão.' });
  }

  const propriedade = getPropriedadeById(propriedadeId, userId);
  if (!propriedade) {
    return res.status(404).json({ message: 'Propriedade não encontrada para este usuário.' });
  }

  if (!nome) {
    return res.status(400).json({ message: 'Informe o nome do talhão.' });
  }

  if (!areaNumber || !isPolygonGeojson(geojson)) {
    return res.status(400).json({ message: 'Informe uma área válida e desenhe um polígono com pelo menos 3 pontos.' });
  }

  const result = db.prepare(`
    INSERT INTO talhoes (user_id, propriedade_id, nome, area, geojson)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, propriedadeId, nome, areaNumber, JSON.stringify(geojson));

  const talhao = getTalhaoById(Number(result.lastInsertRowid), userId) as TalhaoRow;

  return res.status(201).json({
    message: 'Talhão criado com sucesso.',
    talhao: serializeTalhao(talhao)
  });
});

app.put('/api/v1/talhoes/:id', authMiddleware, (req: AuthRequest, res) => {
  const userId = requireAuthUserId(req, res);
  if (!userId) return;

  const talhaoId = parseId(req.params.id);
  if (!talhaoId) return res.status(400).json({ message: 'Talhão inválido.' });

  const existing = getTalhaoById(talhaoId, userId);
  if (!existing) return res.status(404).json({ message: 'Talhão não encontrado.' });

  const nome = normalizeText(req.body?.nome);
  const geojson = req.body?.geojson;
  const areaNumber = parseArea(req.body?.area);
  const propriedadeId = parseId(req.body?.propriedade_id);

  if (!propriedadeId) {
    return res.status(400).json({ message: 'Selecione uma propriedade válida para o talhão.' });
  }

  const propriedade = getPropriedadeById(propriedadeId, userId);
  if (!propriedade) {
    return res.status(404).json({ message: 'Propriedade não encontrada para este usuário.' });
  }

  if (!nome) {
    return res.status(400).json({ message: 'Informe o nome do talhão.' });
  }

  if (!areaNumber || !isPolygonGeojson(geojson)) {
    return res.status(400).json({ message: 'Informe uma área válida e desenhe um polígono com pelo menos 3 pontos.' });
  }

  db.prepare(`
    UPDATE talhoes
    SET propriedade_id = ?, nome = ?, area = ?, geojson = ?
    WHERE id = ?
  `).run(propriedadeId, nome, areaNumber, JSON.stringify(geojson), talhaoId);

  const talhao = getTalhaoById(talhaoId, userId) as TalhaoRow;

  return res.json({
    message: 'Talhão atualizado com sucesso.',
    talhao: serializeTalhao(talhao)
  });
});

app.delete('/api/v1/talhoes/:id', authMiddleware, (req: AuthRequest, res) => {
  const userId = requireAuthUserId(req, res);
  if (!userId) return;

  const talhaoId = parseId(req.params.id);
  if (!talhaoId) return res.status(400).json({ message: 'Talhão inválido.' });

  const existing = getTalhaoById(talhaoId, userId);
  if (!existing) return res.status(404).json({ message: 'Talhão não encontrado.' });

  db.prepare('DELETE FROM talhoes WHERE id = ?').run(talhaoId);
  return res.json({ message: `Talhão "${existing.nome}" removido com sucesso.` });
});

app.get('/api/v1/registros', authMiddleware, (req: AuthRequest, res) => {
  const userId = requireAuthUserId(req, res);
  if (!userId) return;

  const rows = db.prepare(`
    SELECT r.*, t.nome as talhao_nome, p.nome as propriedade_nome
    FROM registros r
    INNER JOIN talhoes t ON t.id = r.talhao_id
    INNER JOIN propriedades p ON p.id = t.propriedade_id
    WHERE t.user_id = ?
    ORDER BY r.id DESC
  `).all(userId) as RegistroRow[];

  return res.json(rows);
});

app.post('/api/v1/registros', authMiddleware, upload.single('audio'), (req: AuthRequest, res) => {
  const userId = requireAuthUserId(req, res);
  if (!userId) return;

  const { talhao_id, descricao } = req.body || {};
  const talhao = getTalhaoById(Number(talhao_id), userId);
  if (!talhao) return res.status(404).json({ message: 'Talhão não encontrado.' });
  if (!normalizeText(descricao)) return res.status(400).json({ message: 'Informe a descrição do registro.' });

  const audioUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const result = db.prepare('INSERT INTO registros (talhao_id, descricao, audio_url) VALUES (?, ?, ?)').run(talhao_id, normalizeText(descricao), audioUrl);
  const registro = db.prepare('SELECT * FROM registros WHERE id = ?').get(result.lastInsertRowid) as RegistroRow;
  return res.status(201).json({
    message: 'Registro salvo com sucesso.',
    registro
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, message: 'Backend funcionando' });
});

registerOperationalRoutes(app);

export function startServer(port = PORT, host = '0.0.0.0') {
  return app.listen(port, host, () => {
    console.log(`Servidor rodando em http://${host}:${port}`);
  });
}

if (require.main === module) {
  startServer();
}
