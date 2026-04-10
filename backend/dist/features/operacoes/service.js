"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTalhaoOperacionalById = getTalhaoOperacionalById;
exports.listTalhoesOperacionais = listTalhoesOperacionais;
exports.planMissaoOperacional = planMissaoOperacional;
exports.saveMissaoOperacional = saveMissaoOperacional;
exports.listMissoesOperacionais = listMissoesOperacionais;
exports.getMissaoOperacionalById = getMissaoOperacionalById;
exports.exportTalhoesOperacionais = exportTalhoesOperacionais;
const db_1 = require("../../db");
const exporters_1 = require("./exporters");
const geometry_1 = require("./geometry");
function parsePolygonGeoJson(value) {
    return JSON.parse(value);
}
function serializeTalhao(row) {
    return {
        id: row.id,
        nome: row.nome,
        area: row.area,
        propriedade_id: row.propriedade_id,
        propriedade_nome: row.propriedade_nome,
        geojson: parsePolygonGeoJson(row.geojson)
    };
}
function getTalhaoOperacionalById(userId, talhaoId) {
    const row = db_1.db.prepare(`
    SELECT t.*, p.nome as propriedade_nome
    FROM talhoes t
    INNER JOIN propriedades p ON p.id = t.propriedade_id
    WHERE t.id = ? AND t.user_id = ?
  `).get(talhaoId, userId);
    return row ? serializeTalhao(row) : null;
}
function listTalhoesOperacionais(userId, talhaoId) {
    const statement = talhaoId
        ? db_1.db.prepare(`
        SELECT t.*, p.nome as propriedade_nome
        FROM talhoes t
        INNER JOIN propriedades p ON p.id = t.propriedade_id
        WHERE t.user_id = ? AND t.id = ?
        ORDER BY t.id DESC
      `)
        : db_1.db.prepare(`
        SELECT t.*, p.nome as propriedade_nome
        FROM talhoes t
        INNER JOIN propriedades p ON p.id = t.propriedade_id
        WHERE t.user_id = ?
        ORDER BY t.id DESC
      `);
    const rows = talhaoId
        ? statement.all(userId, talhaoId)
        : statement.all(userId);
    return rows.map(serializeTalhao);
}
function serializeMissao(row) {
    return {
        ...row,
        rota_geojson: JSON.parse(row.rota_geojson),
        estatisticas: JSON.parse(row.estatisticas_json)
    };
}
function planMissaoOperacional(userId, talhaoId, larguraFaixa) {
    const talhao = getTalhaoOperacionalById(userId, talhaoId);
    if (!talhao) {
        throw new Error('Talhão não encontrado para gerar a missão operacional.');
    }
    return {
        talhao,
        planejamento: (0, geometry_1.generateSprayMissionPlan)(talhao, larguraFaixa)
    };
}
function saveMissaoOperacional(userId, talhaoId, nome, larguraFaixa) {
    const { talhao, planejamento } = planMissaoOperacional(userId, talhaoId, larguraFaixa);
    const result = db_1.db.prepare(`
    INSERT INTO missoes_operacionais (
      user_id,
      talhao_id,
      nome,
      tipo,
      largura_faixa,
      orientacao_graus,
      area_cobertura,
      rota_geojson,
      estatisticas_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, talhaoId, nome, planejamento.tipo, planejamento.largura_faixa, planejamento.orientacao_graus, planejamento.area_cobertura, JSON.stringify(planejamento.rota_geojson), JSON.stringify(planejamento.estatisticas));
    const row = db_1.db.prepare(`
    SELECT m.*, t.nome as talhao_nome, p.nome as propriedade_nome
    FROM missoes_operacionais m
    INNER JOIN talhoes t ON t.id = m.talhao_id
    INNER JOIN propriedades p ON p.id = t.propriedade_id
    WHERE m.id = ?
  `).get(result.lastInsertRowid);
    return {
        talhao,
        missao: serializeMissao(row)
    };
}
function listMissoesOperacionais(userId, talhaoId) {
    const statement = talhaoId
        ? db_1.db.prepare(`
        SELECT m.*, t.nome as talhao_nome, p.nome as propriedade_nome
        FROM missoes_operacionais m
        INNER JOIN talhoes t ON t.id = m.talhao_id
        INNER JOIN propriedades p ON p.id = t.propriedade_id
        WHERE m.user_id = ? AND m.talhao_id = ?
        ORDER BY m.id DESC
      `)
        : db_1.db.prepare(`
        SELECT m.*, t.nome as talhao_nome, p.nome as propriedade_nome
        FROM missoes_operacionais m
        INNER JOIN talhoes t ON t.id = m.talhao_id
        INNER JOIN propriedades p ON p.id = t.propriedade_id
        WHERE m.user_id = ?
        ORDER BY m.id DESC
      `);
    const rows = talhaoId
        ? statement.all(userId, talhaoId)
        : statement.all(userId);
    return rows.map(serializeMissao);
}
function getMissaoOperacionalById(userId, missaoId) {
    const row = db_1.db.prepare(`
    SELECT m.*, t.nome as talhao_nome, p.nome as propriedade_nome
    FROM missoes_operacionais m
    INNER JOIN talhoes t ON t.id = m.talhao_id
    INNER JOIN propriedades p ON p.id = t.propriedade_id
    WHERE m.id = ? AND m.user_id = ?
  `).get(missaoId, userId);
    return row ? serializeMissao(row) : null;
}
function exportTalhoesOperacionais(userId, format, talhaoId) {
    const talhoes = listTalhoesOperacionais(userId, talhaoId);
    return (0, exporters_1.buildTalhoesExport)(talhoes, format);
}
