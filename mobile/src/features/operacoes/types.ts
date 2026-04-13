export type OperacaoLineStringGeoJson = {
  type: 'LineString';
  coordinates: number[][];
};

export type OperacaoPolygonGeoJson = {
  type: 'Polygon';
  coordinates: number[][][];
};

export type OperacaoGeoJsonGeometry = OperacaoLineStringGeoJson | OperacaoPolygonGeoJson;

export type OperacaoGeoJsonFeature<TGeometry extends OperacaoGeoJsonGeometry = OperacaoGeoJsonGeometry> = {
  type: 'Feature';
  properties: Record<string, any>;
  geometry: TGeometry;
};

export type OperacaoGeoJsonFeatureCollection = {
  type: 'FeatureCollection';
  features: OperacaoGeoJsonFeature[];
};

export type MissaoOperacionalEstatisticas = {
  total_faixas: number;
  total_passadas: number;
  comprimento_passadas_m: number;
  distancia_transicao_m: number;
  distancia_total_m: number;
  largura_faixa_configurada_m: number;
  largura_faixa_efetiva_m: number;
};

export type PlanejamentoOperacional = {
  talhao_id: number;
  tipo: 'pulverizacao';
  largura_faixa: number;
  orientacao_graus: number;
  area_cobertura: number;
  rota_geojson: OperacaoGeoJsonFeatureCollection;
  estatisticas: MissaoOperacionalEstatisticas;
};

export type MissaoOperacional = {
  id: number;
  user_id: number;
  talhao_id: number;
  nome: string;
  tipo: string;
  largura_faixa: number;
  orientacao_graus: number;
  area_cobertura: number;
  created_at: string;
  talhao_nome?: string;
  propriedade_nome?: string;
  rota_geojson: OperacaoGeoJsonFeatureCollection;
  estatisticas: MissaoOperacionalEstatisticas;
};

export type PlanejamentoOuMissao = PlanejamentoOperacional | MissaoOperacional;

export type ExportacaoOperacional = {
  filename: string;
  format: 'geojson' | 'kml';
  content_type: string;
  total_talhoes: number;
  talhao_ids: number[];
  content: string;
};
