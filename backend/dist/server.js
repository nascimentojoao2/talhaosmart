"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
exports.startServer = startServer;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
const db_1 = require("./db");
const auth_1 = require("./auth");
const validation_1 = require("./features/auth/validation");
const routes_1 = require("./features/operacoes/routes");
const utils_1 = require("./utils");
exports.app = (0, express_1.default)();
const PORT = Number(process.env.PORT || 3000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
exports.app.use((0, cors_1.default)({ origin: CORS_ORIGIN, credentials: true }));
exports.app.use(express_1.default.json({ limit: '8mb' }));
const uploadDir = path_1.default.join(process.cwd(), 'uploads');
if (!fs_1.default.existsSync(uploadDir))
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
exports.app.use('/uploads', express_1.default.static(uploadDir));
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname || '') || '.bin';
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    }
});
const upload = (0, multer_1.default)({ storage });
function parseId(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function normalizeOptionalText(value) {
    const normalized = normalizeText(value);
    return normalized.length ? normalized : null;
}
function parseArea(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
function isPolygonGeojson(value) {
    return (value &&
        value.type === 'Polygon' &&
        Array.isArray(value.coordinates) &&
        Array.isArray(value.coordinates[0]) &&
        value.coordinates[0].length >= 4);
}
function serializeTalhao(row) {
    return {
        ...row,
        geojson: JSON.parse(row.geojson)
    };
}
function getPropriedadeById(propriedadeId, userId) {
    return db_1.db.prepare('SELECT * FROM propriedades WHERE id = ? AND user_id = ?').get(propriedadeId, userId);
}
function getTalhaoById(talhaoId, userId) {
    return db_1.db.prepare(`
    SELECT t.*, p.nome as propriedade_nome
    FROM talhoes t
    INNER JOIN propriedades p ON p.id = t.propriedade_id
    WHERE t.id = ? AND t.user_id = ?
  `).get(talhaoId, userId);
}
function requireAuthUserId(req, res) {
    if (!req.userId) {
        res.status(401).json({ message: 'Token inválido.' });
        return null;
    }
    return req.userId;
}
exports.app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok' }));
exports.app.get('/api/v1/auth/providers', (_req, res) => {
    return res.json((0, validation_1.getAuthProvidersStatus)());
});
exports.app.post('/api/v1/auth/register', (req, res) => {
    const nome = normalizeText(req.body?.nome);
    const email = (0, validation_1.normalizeEmail)(req.body?.email);
    const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
    const nomeError = (0, validation_1.validateNome)(nome);
    if (nomeError)
        return res.status(400).json({ message: nomeError });
    const emailError = (0, validation_1.validateEmail)(email);
    if (emailError)
        return res.status(400).json({ message: emailError });
    const senhaError = (0, validation_1.validatePassword)(senha);
    if (senhaError)
        return res.status(400).json({ message: senhaError });
    const exists = db_1.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (exists) {
        const providerHint = exists.auth_provider === 'google'
            ? 'Já existe uma conta com este email vinculada ao Google.'
            : 'Email já cadastrado.';
        return res.status(409).json({ message: providerHint });
    }
    const verificationCode = (0, utils_1.code6)();
    const result = db_1.db.prepare(`
    INSERT INTO users (nome, email, senha_hash, email_verificado, verification_code, auth_provider)
    VALUES (?, ?, ?, 0, ?, 'local')
  `).run(nome, email, (0, auth_1.hashPassword)(senha), verificationCode);
    console.log(`[TalhaoSmart] Código de verificação para ${email}: ${verificationCode}`);
    return res.status(201).json({ message: 'Cadastro realizado. Código gerado no terminal do backend.', userId: result.lastInsertRowid });
});
exports.app.post('/api/v1/auth/verify-email', (req, res) => {
    const email = (0, validation_1.normalizeEmail)(req.body?.email);
    const codigo = (0, validation_1.normalizeVerificationCode)(req.body?.codigo);
    const emailError = (0, validation_1.validateEmail)(email);
    if (emailError)
        return res.status(400).json({ message: emailError });
    const codeError = (0, validation_1.validateVerificationCode)(codigo);
    if (codeError)
        return res.status(400).json({ message: codeError });
    const user = db_1.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user)
        return res.status(404).json({ message: 'Usuário não encontrado.' });
    if (user.email_verificado)
        return res.status(400).json({ message: 'Email já verificado.' });
    if (user.verification_code !== codigo)
        return res.status(400).json({ message: 'Código inválido.' });
    db_1.db.prepare('UPDATE users SET email_verificado = 1, verification_code = NULL WHERE id = ?').run(user.id);
    const token = (0, auth_1.signToken)(user.id);
    return res.json({
        token,
        user: { id: user.id, nome: user.nome, email: user.email, email_verificado: true, auth_provider: user.auth_provider }
    });
});
exports.app.post('/api/v1/auth/resend-verification-code', (req, res) => {
    const email = (0, validation_1.normalizeEmail)(req.body?.email);
    const emailError = (0, validation_1.validateEmail)(email);
    if (emailError)
        return res.status(400).json({ message: emailError });
    const user = db_1.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user)
        return res.status(404).json({ message: 'Usuário não encontrado.' });
    if (user.email_verificado)
        return res.status(400).json({ message: 'Este email já foi verificado.' });
    const verificationCode = (0, utils_1.code6)();
    db_1.db.prepare('UPDATE users SET verification_code = ? WHERE id = ?').run(verificationCode, user.id);
    console.log(`[TalhaoSmart] Novo código de verificação para ${email}: ${verificationCode}`);
    return res.json({ message: 'Novo código gerado no terminal do backend.' });
});
exports.app.post('/api/v1/auth/login', (req, res) => {
    const email = (0, validation_1.normalizeEmail)(req.body?.email);
    const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
    const emailError = (0, validation_1.validateEmail)(email);
    if (emailError)
        return res.status(400).json({ message: emailError });
    if (!senha.trim())
        return res.status(400).json({ message: 'Informe sua senha.' });
    const user = db_1.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (user?.auth_provider === 'google' && !user?.senha_hash) {
        return res.status(400).json({ message: 'Esta conta foi criada com Google. Conclua o login social quando ele estiver habilitado.' });
    }
    if (!user || !user.senha_hash || !(0, auth_1.comparePassword)(senha, user.senha_hash)) {
        return res.status(401).json({ message: 'Credenciais inválidas.' });
    }
    if (!user.email_verificado) {
        return res.status(403).json({ message: 'Email ainda não verificado.' });
    }
    const token = (0, auth_1.signToken)(user.id);
    return res.json({
        token,
        user: { id: user.id, nome: user.nome, email: user.email, email_verificado: !!user.email_verificado, auth_provider: user.auth_provider }
    });
});
exports.app.post('/api/v1/auth/forgot-password', (req, res) => {
    const email = (0, validation_1.normalizeEmail)(req.body?.email);
    const emailError = (0, validation_1.validateEmail)(email);
    if (emailError)
        return res.status(400).json({ message: emailError });
    const user = db_1.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user)
        return res.status(404).json({ message: 'Usuário não encontrado.' });
    if (user.auth_provider === 'google' && !user.senha_hash) {
        return res.status(400).json({ message: 'Esta conta usa login com Google e ainda não possui recuperação por senha local.' });
    }
    const resetCode = (0, utils_1.code6)();
    db_1.db.prepare('UPDATE users SET reset_code = ? WHERE id = ?').run(resetCode, user.id);
    console.log(`[TalhaoSmart] Código de reset para ${email}: ${resetCode}`);
    return res.json({ message: 'Código de recuperação gerado no terminal do backend.' });
});
exports.app.post('/api/v1/auth/reset-password', (req, res) => {
    const email = (0, validation_1.normalizeEmail)(req.body?.email);
    const codigo = (0, validation_1.normalizeVerificationCode)(req.body?.codigo);
    const novaSenha = typeof req.body?.novaSenha === 'string' ? req.body.novaSenha : '';
    const emailError = (0, validation_1.validateEmail)(email);
    if (emailError)
        return res.status(400).json({ message: emailError });
    const codeError = (0, validation_1.validateVerificationCode)(codigo);
    if (codeError)
        return res.status(400).json({ message: codeError });
    const senhaError = (0, validation_1.validatePassword)(novaSenha, 'uma nova senha');
    if (senhaError)
        return res.status(400).json({ message: senhaError });
    const user = db_1.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user)
        return res.status(404).json({ message: 'Usuário não encontrado.' });
    if (user.reset_code !== codigo)
        return res.status(400).json({ message: 'Código inválido.' });
    db_1.db.prepare('UPDATE users SET senha_hash = ?, reset_code = NULL, email_verificado = 1 WHERE id = ?').run((0, auth_1.hashPassword)(novaSenha), user.id);
    return res.json({ message: 'Senha redefinida com sucesso.' });
});
exports.app.post('/api/v1/auth/google', (_req, res) => {
    const providers = (0, validation_1.getAuthProvidersStatus)();
    if (!providers.google.configured) {
        return res.status(503).json({ message: providers.google.message });
    }
    return res.status(501).json({ message: providers.google.message });
});
exports.app.get('/api/v1/auth/me', auth_1.authMiddleware, (req, res) => {
    const user = db_1.db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    if (!user)
        return res.status(404).json({ message: 'Usuário não encontrado.' });
    return res.json({ id: user.id, nome: user.nome, email: user.email, email_verificado: !!user.email_verificado, auth_provider: user.auth_provider });
});
exports.app.get('/api/v1/propriedades', auth_1.authMiddleware, (req, res) => {
    const userId = requireAuthUserId(req, res);
    if (!userId)
        return;
    const propriedades = db_1.db.prepare(`
    SELECT
      p.*,
      COUNT(t.id) as total_talhoes
    FROM propriedades p
    LEFT JOIN talhoes t ON t.propriedade_id = p.id
    WHERE p.user_id = ?
    GROUP BY p.id
    ORDER BY p.id DESC
  `).all(userId);
    return res.json(propriedades);
});
exports.app.post('/api/v1/propriedades', auth_1.authMiddleware, (req, res) => {
    const userId = requireAuthUserId(req, res);
    if (!userId)
        return;
    const nome = normalizeText(req.body?.nome);
    const descricao = normalizeOptionalText(req.body?.descricao);
    if (!nome) {
        return res.status(400).json({ message: 'Informe o nome da propriedade.' });
    }
    const result = db_1.db.prepare('INSERT INTO propriedades (user_id, nome, descricao) VALUES (?, ?, ?)').run(userId, nome, descricao);
    const propriedade = db_1.db.prepare('SELECT * FROM propriedades WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json({
        message: 'Propriedade criada com sucesso.',
        propriedade: { ...propriedade, total_talhoes: 0 }
    });
});
exports.app.put('/api/v1/propriedades/:id', auth_1.authMiddleware, (req, res) => {
    const userId = requireAuthUserId(req, res);
    if (!userId)
        return;
    const propriedadeId = parseId(req.params.id);
    if (!propriedadeId)
        return res.status(400).json({ message: 'Propriedade inválida.' });
    const propriedade = getPropriedadeById(propriedadeId, userId);
    if (!propriedade)
        return res.status(404).json({ message: 'Propriedade não encontrada.' });
    const nome = normalizeText(req.body?.nome);
    const descricao = normalizeOptionalText(req.body?.descricao);
    if (!nome) {
        return res.status(400).json({ message: 'Informe o nome da propriedade.' });
    }
    db_1.db.prepare('UPDATE propriedades SET nome = ?, descricao = ? WHERE id = ?').run(nome, descricao, propriedadeId);
    const updated = db_1.db.prepare(`
    SELECT p.*, COUNT(t.id) as total_talhoes
    FROM propriedades p
    LEFT JOIN talhoes t ON t.propriedade_id = p.id
    WHERE p.id = ?
    GROUP BY p.id
  `).get(propriedadeId);
    return res.json({
        message: 'Propriedade atualizada com sucesso.',
        propriedade: updated
    });
});
exports.app.delete('/api/v1/propriedades/:id', auth_1.authMiddleware, (req, res) => {
    const userId = requireAuthUserId(req, res);
    if (!userId)
        return;
    const propriedadeId = parseId(req.params.id);
    if (!propriedadeId)
        return res.status(400).json({ message: 'Propriedade inválida.' });
    const propriedade = getPropriedadeById(propriedadeId, userId);
    if (!propriedade)
        return res.status(404).json({ message: 'Propriedade não encontrada.' });
    const totalTalhoes = db_1.db.prepare('SELECT COUNT(*) as total FROM talhoes WHERE propriedade_id = ?').get(propriedadeId);
    db_1.db.prepare('DELETE FROM propriedades WHERE id = ?').run(propriedadeId);
    return res.json({
        message: totalTalhoes.total > 0
            ? `Propriedade removida com sucesso. ${totalTalhoes.total} talhão(ões) vinculado(s) também foram excluídos.`
            : 'Propriedade removida com sucesso.'
    });
});
exports.app.get('/api/v1/talhoes', auth_1.authMiddleware, (req, res) => {
    const userId = requireAuthUserId(req, res);
    if (!userId)
        return;
    const talhoes = db_1.db.prepare(`
    SELECT t.*, p.nome as propriedade_nome
    FROM talhoes t
    INNER JOIN propriedades p ON p.id = t.propriedade_id
    WHERE t.user_id = ?
    ORDER BY t.id DESC
  `).all(userId);
    return res.json(talhoes.map(serializeTalhao));
});
exports.app.get('/api/v1/talhoes/:id', auth_1.authMiddleware, (req, res) => {
    const userId = requireAuthUserId(req, res);
    if (!userId)
        return;
    const talhaoId = parseId(req.params.id);
    if (!talhaoId)
        return res.status(400).json({ message: 'Talhão inválido.' });
    const talhao = getTalhaoById(talhaoId, userId);
    if (!talhao)
        return res.status(404).json({ message: 'Talhão não encontrado.' });
    return res.json(serializeTalhao(talhao));
});
exports.app.post('/api/v1/talhoes', auth_1.authMiddleware, (req, res) => {
    const userId = requireAuthUserId(req, res);
    if (!userId)
        return;
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
    const result = db_1.db.prepare(`
    INSERT INTO talhoes (user_id, propriedade_id, nome, area, geojson)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, propriedadeId, nome, areaNumber, JSON.stringify(geojson));
    const talhao = getTalhaoById(Number(result.lastInsertRowid), userId);
    return res.status(201).json({
        message: 'Talhão criado com sucesso.',
        talhao: serializeTalhao(talhao)
    });
});
exports.app.put('/api/v1/talhoes/:id', auth_1.authMiddleware, (req, res) => {
    const userId = requireAuthUserId(req, res);
    if (!userId)
        return;
    const talhaoId = parseId(req.params.id);
    if (!talhaoId)
        return res.status(400).json({ message: 'Talhão inválido.' });
    const existing = getTalhaoById(talhaoId, userId);
    if (!existing)
        return res.status(404).json({ message: 'Talhão não encontrado.' });
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
    db_1.db.prepare(`
    UPDATE talhoes
    SET propriedade_id = ?, nome = ?, area = ?, geojson = ?
    WHERE id = ?
  `).run(propriedadeId, nome, areaNumber, JSON.stringify(geojson), talhaoId);
    const talhao = getTalhaoById(talhaoId, userId);
    return res.json({
        message: 'Talhão atualizado com sucesso.',
        talhao: serializeTalhao(talhao)
    });
});
exports.app.delete('/api/v1/talhoes/:id', auth_1.authMiddleware, (req, res) => {
    const userId = requireAuthUserId(req, res);
    if (!userId)
        return;
    const talhaoId = parseId(req.params.id);
    if (!talhaoId)
        return res.status(400).json({ message: 'Talhão inválido.' });
    const existing = getTalhaoById(talhaoId, userId);
    if (!existing)
        return res.status(404).json({ message: 'Talhão não encontrado.' });
    db_1.db.prepare('DELETE FROM talhoes WHERE id = ?').run(talhaoId);
    return res.json({ message: `Talhão "${existing.nome}" removido com sucesso.` });
});
exports.app.get('/api/v1/registros', auth_1.authMiddleware, (req, res) => {
    const userId = requireAuthUserId(req, res);
    if (!userId)
        return;
    const rows = db_1.db.prepare(`
    SELECT r.*, t.nome as talhao_nome, p.nome as propriedade_nome
    FROM registros r
    INNER JOIN talhoes t ON t.id = r.talhao_id
    INNER JOIN propriedades p ON p.id = t.propriedade_id
    WHERE t.user_id = ?
    ORDER BY r.id DESC
  `).all(userId);
    return res.json(rows);
});
exports.app.post('/api/v1/registros', auth_1.authMiddleware, upload.single('audio'), (req, res) => {
    const userId = requireAuthUserId(req, res);
    if (!userId)
        return;
    const { talhao_id, descricao } = req.body || {};
    const talhao = getTalhaoById(Number(talhao_id), userId);
    if (!talhao)
        return res.status(404).json({ message: 'Talhão não encontrado.' });
    if (!normalizeText(descricao))
        return res.status(400).json({ message: 'Informe a descrição do registro.' });
    const audioUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const result = db_1.db.prepare('INSERT INTO registros (talhao_id, descricao, audio_url) VALUES (?, ?, ?)').run(talhao_id, normalizeText(descricao), audioUrl);
    const registro = db_1.db.prepare('SELECT * FROM registros WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json({
        message: 'Registro salvo com sucesso.',
        registro
    });
});
exports.app.get('/health', (_req, res) => {
    res.json({ ok: true, message: 'Backend funcionando' });
});
(0, routes_1.registerOperationalRoutes)(exports.app);
function startServer(port = PORT, host = '0.0.0.0') {
    return exports.app.listen(port, host, () => {
        console.log(`Servidor rodando em http://${host}:${port}`);
    });
}
if (require.main === module) {
    startServer();
}
