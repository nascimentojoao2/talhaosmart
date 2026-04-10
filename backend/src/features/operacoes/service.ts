import { db } from '../../db';
import type { MissaoOperacionalRow, TalhaoRow } from '../../types';
import { buildTalhoesExport } from './exporters';
import { generateSprayMissionPlan } from './geometry';
import type {
  ExportacaoTalhoes,
  MissaoOperacionalPlanejada,
  PolygonGeoJson,
  TalhaoOperacional
} from './types';

function parsePolygonGeoJson(value: string) {
  return JSON.parse(value) as PolygonGeoJson;
}

function serializeTalhao(row: TalhaoRow): TalhaoOperacional {
  return {
    id: row.id,
    nome: row.nome,
    area: row.area,
    propriedade_id: row.propriedade_id,
    propriedade_nome: row.propriedade_nome,
    geojson: parsePolygonGeoJson(row.geojson)
  };
}

export function getTalhaoOperacionalById(userId: number, talhaoId: number) {
  const row = db.prepare(`
    SELECT t.*, p.nome as propriedade_nome
    FROM talhoes t
    INNER JOIN propriedades p ON p.id = t.propriedade_id
    WHERE t.id = ? AND t.user_id = ?
  `).get(talhaoId, userId) as TalhaoRow | undefined;

  return row ? serializeTalhao(row) : null;
}

export function listTalhoesOperacionais(userId: number, talhaoId?: number | null) {
  const statement = talhaoId
    ? db.prepare(`
        SELECT t.*, p.nome as propriedade_nome
        FROM talhoes t
        INNER JOIN propriedades p ON p.id = t.propriedade_id
        WHERE t.user_id = ? AND t.id = ?
        ORDER BY t.id DESC
      `)
    : db.prepare(`
        SELECT t.*, p.nome as propriedade_nome
        FROM talhoes t
        INNER JOIN propriedades p ON p.id = t.propriedade_id
        WHERE t.user_id = ?
        ORDER BY t.id DESC
      `);

  const rows = talhaoId
    ? statement.all(userId, talhaoId)
    : statement.all(userId);

  return (rows as TalhaoRow[]).map(serializeTalhao);
}

function serializeMissao(row: MissaoOperacionalRow) {
  return {
    ...row,
    rota_geojson: JSON.parse(row.rota_geojson),
    estatisticas: JSON.parse(row.estatisticas_json)
  };
}

export function planMissaoOperacional(userId: number, talhaoId: number, larguraFaixa: number) {
  const talhao = getTalhaoOperacionalById(userId, talhaoId);
  if (!talhao) {
    throw new Error('Talhão não encontrado para gerar a missão operacional.');
  }

  return {
    talhao,
    planejamento: generateSprayMissionPlan(talhao, larguraFaixa)
  };
}

export function saveMissaoOperacional(userId: number, talhaoId: number, nome: string, larguraFaixa: number) {
  const { talhao, planejamento } = planMissaoOperacional(userId, talhaoId, larguraFaixa);

  const result = db.prepare(`
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
  `).run(
    userId,
    talhaoId,
    nome,
    planejamento.tipo,
    planejamento.largura_faixa,
    planejamento.orientacao_graus,
    planejamento.area_cobertura,
    JSON.stringify(planejamento.rota_geojson),
    JSON.stringify(planejamento.estatisticas)
  );

  const row = db.prepare(`
    SELECT m.*, t.nome as talhao_nome, p.nome as propriedade_nome
    FROM missoes_operacionais m
    INNER JOIN talhoes t ON t.id = m.talhao_id
    INNER JOIN propriedades p ON p.id = t.propriedade_id
    WHERE m.id = ?
  `).get(result.lastInsertRowid) as MissaoOperacionalRow;

  return {
    talhao,
    missao: serializeMissao(row)
  };
}

export function listMissoesOperacionais(userId: number, talhaoId?: number | null) {
  const statement = talhaoId
    ? db.prepare(`
        SELECT m.*, t.nome as talhao_nome, p.nome as propriedade_nome
        FROM missoes_operacionais m
        INNER JOIN talhoes t ON t.id = m.talhao_id
        INNER JOIN propriedades p ON p.id = t.propriedade_id
        WHERE m.user_id = ? AND m.talhao_id = ?
        ORDER BY m.id DESC
      `)
    : db.prepare(`
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

  return (rows as MissaoOperacionalRow[]).map(serializeMissao);
}

export function getMissaoOperacionalById(userId: number, missaoId: number) {
  const row = db.prepare(`
    SELECT m.*, t.nome as talhao_nome, p.nome as propriedade_nome
    FROM missoes_operacionais m
    INNER JOIN talhoes t ON t.id = m.talhao_id
    INNER JOIN propriedades p ON p.id = t.propriedade_id
    WHERE m.id = ? AND m.user_id = ?
  `).get(missaoId, userId) as MissaoOperacionalRow | undefined;

  return row ? serializeMissao(row) : null;
}

export function exportTalhoesOperacionais(userId: number, format: 'geojson' | 'kml', talhaoId?: number | null): ExportacaoTalhoes {
  const talhoes = listTalhoesOperacionais(userId, talhaoId);
  return buildTalhoesExport(talhoes, format);
}
