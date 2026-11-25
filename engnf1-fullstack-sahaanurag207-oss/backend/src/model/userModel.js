import { query } from '../database/dbHelper.js';

const mapUser = (row) =>
  row
    ? {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        createdAt: row.created_at
      }
    : null;

export const userModel = {
  async findByEmail(email) {
    const res = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    return res.rows[0] || null;
  },

  async findById(id) {
    const res = await query('SELECT * FROM users WHERE id = $1', [id]);
    return mapUser(res.rows[0]);
  },

  async create({ name, email, passwordHash, role = 'USER' }) {
    const res = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, LOWER($2), $3, $4)
       RETURNING *`,
      [name, email, passwordHash, role]
    );
    return mapUser(res.rows[0]);
  },

  toPublic: mapUser
};
