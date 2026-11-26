import crypto from 'crypto';
import { query, fromMysqlUtc } from '../database/dbHelper.js';

const mapUser = (row) =>
  row
    ? {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        createdAt: fromMysqlUtc(row.created_at)
      }
    : null;

export const userModel = {
  async findByEmail(email) {
    const rows = await query('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [email]);
    return rows[0] || null;
  },

  async findById(id) {
    const rows = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
    return mapUser(rows[0]);
  },

  async create({ name, email, passwordHash, role = 'USER' }) {
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES (?, ?, LOWER(?), ?, ?)`,
      [id, name, email, passwordHash, role]
    );
    return this.findById(id);
  },

  toPublic: mapUser
};
