import { pool } from '../config/db.js';

export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function withTransaction(callback) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export function toMysqlUtc(isoOrDate) {
  const d = new Date(isoOrDate);
  return d.toISOString().slice(0, 23).replace('T', ' ');
}

export function fromMysqlUtc(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  const s = String(val);
  return s.endsWith('Z') ? s : `${s.replace(' ', 'T')}Z`;
}
