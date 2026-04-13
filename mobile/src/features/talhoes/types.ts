export type AuthScreen = 'login' | 'register' | 'verify' | 'forgot' | 'reset' | 'app';

export type AppTab = 'home' | 'talhoes' | 'diario' | 'historico';

export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type PolygonGeoJson = {
  type: 'Polygon';
  coordinates: number[][][];
};

export type User = {
  id: number;
  nome: string;
  email: string;
  email_verificado: boolean;
  auth_provider: string;
};

export type Propriedade = {
  id: number;
  user_id: number;
  nome: string;
  descricao: string | null;
  total_talhoes?: number;
  created_at: string;
};

export type Talhao = {
  id: number;
  nome: string;
  area: number;
  geojson: PolygonGeoJson;
  user_id: number;
  propriedade_id: number;
  propriedade_nome?: string;
  created_at: string;
};

export type Registro = {
  id: number;
  talhao_id: number;
  descricao: string;
  audio_url: string | null;
  talhao_nome?: string;
  propriedade_nome?: string;
  created_at: string;
};
