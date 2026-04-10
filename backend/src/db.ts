import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const configuredPath = process.env.DATABASE_PATH?.trim() || 'talhaosmart.sqlite';
export const dbPath = path.isAbsolute(configuredPath)
  ? configuredPath
  : path.join(process.cwd(), configuredPath);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT,
  email_verificado INTEGER NOT NULL DEFAULT 0,
  verification_code TEXT,
  reset_code TEXT,
  auth_provider TEXT NOT NULL DEFAULT 'local',
  google_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS propriedades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS talhoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  propriedade_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  area REAL NOT NULL,
  geojson TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(propriedade_id) REFERENCES propriedades(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS registros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  talhao_id INTEGER NOT NULL,
  descricao TEXT NOT NULL,
  audio_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(talhao_id) REFERENCES talhoes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS missoes_operacionais (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  talhao_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'pulverizacao',
  largura_faixa REAL NOT NULL,
  orientacao_graus REAL NOT NULL,
  area_cobertura REAL NOT NULL,
  rota_geojson TEXT NOT NULL,
  estatisticas_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(talhao_id) REFERENCES talhoes(id) ON DELETE CASCADE
);
`);

type TableInfoRow = {
  name: string;
};

function hasColumn(tableName: string, columnName: string) {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as TableInfoRow[];
  return rows.some((row) => row.name === columnName);
}

function migrateLegacyTalhoes() {
  if (hasColumn('talhoes', 'propriedade_id')) return;

  db.exec('PRAGMA foreign_keys = OFF');

  try {
    db.exec(`
    BEGIN TRANSACTION;

    INSERT INTO propriedades (user_id, nome, descricao)
    SELECT DISTINCT
      t.user_id,
      'Propriedade migrada',
      'Criada automaticamente para vincular talhões existentes.'
    FROM talhoes t
    WHERE NOT EXISTS (
      SELECT 1
      FROM propriedades p
      WHERE p.user_id = t.user_id
    );

    DROP TABLE IF EXISTS talhoes_new;

    CREATE TABLE talhoes_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      propriedade_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      area REAL NOT NULL,
      geojson TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(propriedade_id) REFERENCES propriedades(id) ON DELETE CASCADE
    );

    INSERT INTO talhoes_new (id, user_id, propriedade_id, nome, area, geojson, created_at)
    SELECT
      t.id,
      t.user_id,
      (
        SELECT p.id
        FROM propriedades p
        WHERE p.user_id = t.user_id
        ORDER BY p.id ASC
        LIMIT 1
      ) AS propriedade_id,
      t.nome,
      t.area,
      t.geojson,
      t.created_at
    FROM talhoes t;

    DROP TABLE talhoes;
    ALTER TABLE talhoes_new RENAME TO talhoes;

    COMMIT;
    `);
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}

function ensureIndexes() {
  db.exec(`
  CREATE INDEX IF NOT EXISTS idx_propriedades_user_id ON propriedades(user_id);
  CREATE INDEX IF NOT EXISTS idx_talhoes_user_id ON talhoes(user_id);
  CREATE INDEX IF NOT EXISTS idx_talhoes_propriedade_id ON talhoes(propriedade_id);
  CREATE INDEX IF NOT EXISTS idx_registros_talhao_id ON registros(talhao_id);
  CREATE INDEX IF NOT EXISTS idx_missoes_operacionais_user_id ON missoes_operacionais(user_id);
  CREATE INDEX IF NOT EXISTS idx_missoes_operacionais_talhao_id ON missoes_operacionais(talhao_id);
  `);
}

migrateLegacyTalhoes();
ensureIndexes();
