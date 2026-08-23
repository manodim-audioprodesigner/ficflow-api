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
    // Converte parâmetros ? para $1, $2, etc no PostgreSQL
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

export default { query, execute, getOne, hashPin };