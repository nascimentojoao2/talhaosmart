export type UserRow = {
  id: number;
  nome: string;
  email: string;
  senha_hash: string | null;
  email_verificado: number;
  verification_code: string | null;
  reset_code: string | null;
  auth_provider: string;
  google_id: string | null;
  created_at: string;
};

export type PropriedadeRow = {
  id: number;
  user_id: number;
  nome: string;
  descricao: string | null;
  created_at: string;
  total_talhoes?: number;
};

export type TalhaoRow = {
  id: number;
  user_id: number;
  propriedade_id: number;
  nome: string;
  area: number;
  geojson: string;
  created_at: string;
  propriedade_nome?: string;
};

export type RegistroRow = {
  id: number;
  talhao_id: number;
  descricao: string;
  audio_url: string | null;
  created_at: string;
  talhao_nome?: string;
  propriedade_nome?: string;
};

export type MissaoOperacionalRow = {
  id: number;
  user_id: number;
  talhao_id: number;
  nome: string;
  tipo: string;
  largura_faixa: number;
  orientacao_graus: number;
  area_cobertura: number;
  rota_geojson: string;
  estatisticas_json: string;
  created_at: string;
  talhao_nome?: string;
  propriedade_nome?: string;
};
