export type PolygonGeoJson = {
  type: 'Polygon';
  coordinates: number[][][];
};

export type LineStringGeoJson = {
  type: 'LineString';
  coordinates: number[][];
};

export type GeoJsonGeometry = PolygonGeoJson | LineStringGeoJson;

export type GeoJsonFeature<TGeometry extends GeoJsonGeometry = GeoJsonGeometry> = {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: TGeometry;
};

export type GeoJsonFeatureCollection = {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
};

export type TalhaoOperacional = {
  id: number;
  nome: string;
  area: number;
  propriedade_id: number;
  propriedade_nome?: string;
  geojson: PolygonGeoJson;
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

export type MissaoOperacionalPlanejada = {
  talhao_id: number;
  tipo: 'pulverizacao';
  largura_faixa: number;
  orientacao_graus: number;
  area_cobertura: number;
  rota_geojson: GeoJsonFeatureCollection;
  estatisticas: MissaoOperacionalEstatisticas;
};

export type ExportacaoTalhoes = {
  filename: string;
  format: 'geojson' | 'kml';
  content_type: string;
  total_talhoes: number;
  talhao_ids: number[];
  content: string;
};
