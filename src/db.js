import pg from 'pg';
import mysql from 'mysql2/promise';
import crypto from 'crypto';

const connectionUri = process.env.DATABASE_URL || process.env.MYSQL_URL || '';
const isPostgres = connectionUri.startsWith('postgres://') || connectionUri.startsWith('postgresql://') || process.env.DB_TYPE === 'postgres';

let pgPool = null;
let mysqlPool = null;

if (isPostgres) {
  pgPool = new pg.Pool({
    connectionString: connectionUri,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  console.log('[DB] Conectado via PostgreSQL');
} else {
  mysqlPool = connectionUri
    ? mysql.createPool(connectionUri)
    : mysql.createPool({
        host: process.env.MYSQLHOST || process.env.DATABASE_HOST || 'localhost',
        port: process.env.MYSQLPORT || process.env.DATABASE_PORT || 3306,
        user: process.env.MYSQLUSER || process.env.DATABASE_USERNAME || 'root',
        password: process.env.MYSQLPASSWORD || process.env.DATABASE_PASSWORD || '',
        database: process.env.MYSQLDATABASE || process.env.DATABASE_NAME || 'railway',
        waitForConnections: true,
        connectionLimit: 20
      });
  console.log('[DB] Conectado via MySQL');
}

export function hashPin(pin) {
  const p = String(pin !== undefined && pin !== null ? pin : '').trim();
  return crypto.createHash('sha256').update(p + '::ficflow').digest('hex');
}

export async function query(sql, params = []) {
  if (isPostgres) {
    let paramIndex = 1;
    const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    const res = await pgPool.query(pgSql, params);
    return res.rows;
  } else {
    const [rows] = await mysqlPool.execute(sql, params);
    return rows;
  }
}

export async function execute(sql, params = []) {
  if (isPostgres) {
    let paramIndex = 1;
    const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    const res = await pgPool.query(pgSql, params);
    return { insertId: res.rows?.[0]?.id || res.rowCount, affectedRows: res.rowCount };
  } else {
    const [result] = await mysqlPool.execute(sql, params);
    return result;
  }
}

export async function getOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows && rows.length ? rows[0] : null;
}

export async function initDb() {
  if (isPostgres && pgPool) {
    try {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS cargos (
          id SERIAL PRIMARY KEY,
          nome VARCHAR(50) NOT NULL UNIQUE,
          cor VARCHAR(20) NOT NULL DEFAULT '#888'
        );

        CREATE TABLE IF NOT EXISTS usuarios (
          id SERIAL PRIMARY KEY,
          nome VARCHAR(100) NOT NULL,
          usuario VARCHAR(50) NOT NULL UNIQUE,
          pin_hash VARCHAR(64) NOT NULL,
          cargo_id INT NOT NULL REFERENCES cargos(id),
          genero VARCHAR(10) DEFAULT 'M',
          level VARCHAR(20) DEFAULT 'employee',
          short VARCHAR(10) DEFAULT 'FUNC',
          teams TEXT,
          idioma VARCHAR(50) DEFAULT NULL,
          ativo SMALLINT NOT NULL DEFAULT 1,
          ultimo_visto TIMESTAMP DEFAULT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS categorias (
          id SERIAL PRIMARY KEY,
          nome VARCHAR(100) NOT NULL UNIQUE,
          cor VARCHAR(20) NOT NULL DEFAULT '#666'
        );

        CREATE TABLE IF NOT EXISTS pipeline_etapas (
          id SERIAL PRIMARY KEY,
          codigo VARCHAR(50) NOT NULL UNIQUE,
          nome VARCHAR(100) NOT NULL,
          ordem INT NOT NULL,
          cargo_id INT REFERENCES cargos(id),
          categoria VARCHAR(100) NULL,
          cor VARCHAR(20) NOT NULL DEFAULT '#666',
          sla_minutos INT DEFAULT 90
        );

        CREATE TABLE IF NOT EXISTS programas (
          id SERIAL PRIMARY KEY,
          nome VARCHAR(255) NOT NULL,
          codigo VARCHAR(50) NOT NULL,
          root VARCHAR(500) DEFAULT '',
          prioridade SMALLINT NOT NULL DEFAULT 2,
          status VARCHAR(50) NOT NULL DEFAULT 'pendente',
          custom_flow TEXT DEFAULT NULL,
          criado_por INT DEFAULT NULL,
          criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          concluido_em TIMESTAMP DEFAULT NULL
        );

        CREATE TABLE IF NOT EXISTS tarefas (
          id SERIAL PRIMARY KEY,
          programa_id INT REFERENCES programas(id) ON DELETE CASCADE,
          titulo VARCHAR(255) NOT NULL,
          cliente VARCHAR(255) NULL,
          idioma VARCHAR(50) NULL,
          nota TEXT NULL,
          categoria_id INT REFERENCES categorias(id),
          etapa_id INT NOT NULL REFERENCES pipeline_etapas(id),
          status SMALLINT NOT NULL DEFAULT 0,
          responsavel_id INT REFERENCES usuarios(id),
          prioridade SMALLINT NOT NULL DEFAULT 2,
          prazo DATE NULL,
          folder VARCHAR(500) DEFAULT NULL,
          programa_nome VARCHAR(255) DEFAULT NULL,
          programa_codigo VARCHAR(50) DEFAULT NULL,
          criado_por INT REFERENCES usuarios(id),
          criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          status_atualizado_em TIMESTAMP DEFAULT NULL,
          seen_at TIMESTAMP DEFAULT NULL,
          arquivado SMALLINT NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS status_historico (
          id SERIAL PRIMARY KEY,
          tarefa_id INT NOT NULL REFERENCES tarefas(id) ON DELETE CASCADE,
          etapa_id INT NOT NULL REFERENCES pipeline_etapas(id),
          status_de SMALLINT NULL,
          status_para SMALLINT NOT NULL,
          usuario_id INT REFERENCES usuarios(id),
          observacao TEXT NULL,
          criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS chat_mensagens (
          id SERIAL PRIMARY KEY,
          usuario_id INT NOT NULL REFERENCES usuarios(id),
          usuario_nome VARCHAR(100) NOT NULL,
          usuario_genero VARCHAR(10) DEFAULT 'M',
          cargo_nome VARCHAR(50) NOT NULL,
          cargo_cor VARCHAR(20) NOT NULL,
          destinatario_id INT REFERENCES usuarios(id),
          destinatario_nome VARCHAR(100) DEFAULT NULL,
          tipo VARCHAR(20) NOT NULL DEFAULT 'chat',
          texto TEXT NOT NULL,
          tarefa_id INT NULL,
          canal VARCHAR(50) DEFAULT 'geral',
          criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS notificacoes (
          id SERIAL PRIMARY KEY,
          usuario_id INT NOT NULL REFERENCES usuarios(id),
          tarefa_id INT REFERENCES tarefas(id) ON DELETE CASCADE,
          texto VARCHAR(500) NOT NULL,
          visto SMALLINT NOT NULL DEFAULT 0,
          criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS atividades (
          id SERIAL PRIMARY KEY,
          usuario_id INT DEFAULT NULL,
          usuario_nome VARCHAR(100) NOT NULL,
          acao VARCHAR(50) NOT NULL,
          entidade VARCHAR(50) NOT NULL,
          entidade_id INT NULL,
          detalhes TEXT NULL,
          criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        INSERT INTO cargos (id, nome, cor) VALUES (1, 'Direção Geral', '#7c5cff') ON CONFLICT (id) DO NOTHING;

        INSERT INTO usuarios (nome, usuario, pin_hash, cargo_id, genero, level, short, teams, ativo) 
        VALUES ('Direção Geral', 'admin', '${hashPin('boss')}', 1, 'M', 'director', 'DIR', '["Direção Geral"]', 1)
        ON CONFLICT (usuario) DO NOTHING;
      `);
      console.log('[DB] Tabelas PostgreSQL inicializadas com sucesso!');
    } catch (e) {
      console.error('[DB] Erro ao inicializar tabelas PostgreSQL:', e.message);
    }
  }
}

export default { query, execute, getOne, hashPin, initDb };