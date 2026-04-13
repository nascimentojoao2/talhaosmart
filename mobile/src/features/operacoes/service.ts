import { API_BASE_URL } from '../../services/api';
import type { ExportacaoOperacional, MissaoOperacional, PlanejamentoOperacional } from './types';

async function requestOperation<TResponse>(path: string, token: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(options.headers as Record<string, string> | undefined)
  };

  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers
    });
  } catch {
    throw new Error('Não foi possível conectar ao backend operacional. Verifique a API local.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'A operação operacional falhou. Tente novamente.');
  }

  return data as TResponse;
}

export async function gerarPlanejamentoOperacional(token: string, talhaoId: number, larguraFaixa: number) {
  return requestOperation<{
    message: string;
    planejamento: PlanejamentoOperacional;
  }>('/operacoes/planejamento', token, {
    method: 'POST',
    body: JSON.stringify({
      talhao_id: talhaoId,
      largura_faixa: larguraFaixa
    })
  });
}

export async function salvarMissaoOperacional(token: string, payload: {
  talhaoId: number;
  larguraFaixa: number;
  nome: string;
}) {
  return requestOperation<{
    message: string;
    missao: MissaoOperacional;
  }>('/operacoes/missoes', token, {
    method: 'POST',
    body: JSON.stringify({
      talhao_id: payload.talhaoId,
      largura_faixa: payload.larguraFaixa,
      nome: payload.nome
    })
  });
}

export async function listarMissoesOperacionais(token: string, talhaoId?: number | null) {
  const searchParams = new URLSearchParams();
  if (talhaoId) {
    searchParams.set('talhao_id', String(talhaoId));
  }

  const query = searchParams.toString();
  return requestOperation<MissaoOperacional[]>(`/operacoes/missoes${query ? `?${query}` : ''}`, token);
}

export async function exportarTalhoesOperacionais(token: string, payload: {
  format: 'geojson' | 'kml';
  talhaoId?: number | null;
}) {
  const searchParams = new URLSearchParams({
    format: payload.format
  });

  if (payload.talhaoId) {
    searchParams.set('talhao_id', String(payload.talhaoId));
  }

  return requestOperation<ExportacaoOperacional>(`/operacoes/talhoes/export?${searchParams.toString()}`, token);
}
