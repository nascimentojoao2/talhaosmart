import type { Express, Request, Response } from 'express';
import { authMiddleware } from '../../auth';
import {
  exportTalhoesOperacionais,
  getMissaoOperacionalById,
  listMissoesOperacionais,
  planMissaoOperacional,
  saveMissaoOperacional
} from './service';

type AuthRequest = Request & {
  userId?: number;
};

function requireAuthUserId(req: AuthRequest, res: Response) {
  if (!req.userId) {
    res.status(401).json({ message: 'Token inválido.' });
    return null;
  }

  return req.userId;
}

function parseId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parsePositiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function registerOperationalRoutes(app: Express) {
  app.get('/api/v1/operacoes/talhoes/export', authMiddleware, (req: AuthRequest, res) => {
    const userId = requireAuthUserId(req, res);
    if (!userId) return;

    const format = req.query.format === 'kml' ? 'kml' : req.query.format === 'geojson' ? 'geojson' : null;
    const talhaoId = req.query.talhao_id ? parseId(req.query.talhao_id) : null;

    if (!format) {
      return res.status(400).json({ message: 'Informe um formato de exportação válido: geojson ou kml.' });
    }

    if (req.query.talhao_id && !talhaoId) {
      return res.status(400).json({ message: 'Talhão inválido para exportação.' });
    }

    const exportacao = exportTalhoesOperacionais(userId, format, talhaoId);
    if (talhaoId && exportacao.total_talhoes === 0) {
      return res.status(404).json({ message: 'Talhão não encontrado para exportação.' });
    }
    return res.json(exportacao);
  });

  app.post('/api/v1/operacoes/planejamento', authMiddleware, (req: AuthRequest, res) => {
    const userId = requireAuthUserId(req, res);
    if (!userId) return;

    const talhaoId = parseId(req.body?.talhao_id);
    const larguraFaixa = parsePositiveNumber(req.body?.largura_faixa);

    if (!talhaoId) {
      return res.status(400).json({ message: 'Selecione um talhão válido para planejar a missão.' });
    }

    if (!larguraFaixa) {
      return res.status(400).json({ message: 'Informe uma largura de faixa válida em metros.' });
    }

    try {
      const { talhao, planejamento } = planMissaoOperacional(userId, talhaoId, larguraFaixa);
      return res.json({
        message: 'Rota operacional gerada com sucesso.',
        talhao,
        planejamento
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível gerar a rota operacional.';
      const status = message.includes('não encontrado') ? 404 : 400;
      return res.status(status).json({ message });
    }
  });

  app.post('/api/v1/operacoes/missoes', authMiddleware, (req: AuthRequest, res) => {
    const userId = requireAuthUserId(req, res);
    if (!userId) return;

    const talhaoId = parseId(req.body?.talhao_id);
    const larguraFaixa = parsePositiveNumber(req.body?.largura_faixa);
    const nome = normalizeText(req.body?.nome);

    if (!talhaoId) {
      return res.status(400).json({ message: 'Selecione um talhão válido para salvar a missão.' });
    }

    if (!larguraFaixa) {
      return res.status(400).json({ message: 'Informe uma largura de faixa válida em metros.' });
    }

    if (!nome) {
      return res.status(400).json({ message: 'Informe um nome para a missão operacional.' });
    }

    try {
      const { missao } = saveMissaoOperacional(userId, talhaoId, nome, larguraFaixa);
      return res.status(201).json({
        message: 'Missão operacional salva com sucesso.',
        missao
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar a missão operacional.';
      const status = message.includes('não encontrado') ? 404 : 400;
      return res.status(status).json({ message });
    }
  });

  app.get('/api/v1/operacoes/missoes', authMiddleware, (req: AuthRequest, res) => {
    const userId = requireAuthUserId(req, res);
    if (!userId) return;

    const talhaoId = req.query.talhao_id ? parseId(req.query.talhao_id) : null;
    if (req.query.talhao_id && !talhaoId) {
      return res.status(400).json({ message: 'Talhão inválido para listar missões.' });
    }

    const missoes = listMissoesOperacionais(userId, talhaoId);
    return res.json(missoes);
  });

  app.get('/api/v1/operacoes/missoes/:id', authMiddleware, (req: AuthRequest, res) => {
    const userId = requireAuthUserId(req, res);
    if (!userId) return;

    const missaoId = parseId(req.params.id);
    if (!missaoId) {
      return res.status(400).json({ message: 'Missão operacional inválida.' });
    }

    const missao = getMissaoOperacionalById(userId, missaoId);
    if (!missao) {
      return res.status(404).json({ message: 'Missão operacional não encontrada.' });
    }

    return res.json(missao);
  });
}
