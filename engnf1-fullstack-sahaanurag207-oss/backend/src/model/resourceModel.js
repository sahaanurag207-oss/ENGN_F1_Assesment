import crypto from 'crypto';
import { query, fromMysqlUtc } from '../database/dbHelper.js';
import { escapeLikeWildcards } from '../utils/classifier.js';

export const mapResource = (r) => ({
  id: r.id,
  name: r.name,
  type: r.type,
  capacity: Number(r.capacity),
  description: r.description,
  isActive: Boolean(r.is_active),
  createdAt: fromMysqlUtc(r.created_at)
});

export const resourceModel = {
  async list({ search, type, minCapacity, page = 1, pageSize = 10, includeInactive = false }) {
    const conditions = [];
    const params = [];

    if (!includeInactive) {
      conditions.push('is_active = 1');
    }
    if (search && search.trim()) {
      const pattern = `%${escapeLikeWildcards(search.trim())}%`;
      conditions.push(`(LOWER(name) LIKE LOWER(?) ESCAPE '\\' OR LOWER(COALESCE(description, '')) LIKE LOWER(?) ESCAPE '\\')`);
      params.push(pattern, pattern);
    }
    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }
    if (minCapacity !== undefined) {
      conditions.push('capacity >= ?');
      params.push(Number(minCapacity));
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRows = await query(`SELECT COUNT(*) AS total FROM resources ${where}`, params);
    const total = Number(countRows[0].total);

    const safeLimit = Number(pageSize);
    const safeOffset = (Number(page) - 1) * safeLimit;
    const rows = await query(
      `SELECT * FROM resources ${where} ORDER BY LOWER(name) ASC LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      params
    );

    return {
      data: rows.map(mapResource),
      page: Number(page),
      pageSize: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit)
    };
  },

  async findById(id) {
    const rows = await query('SELECT * FROM resources WHERE id = ? LIMIT 1', [id]);
    return rows[0] ? mapResource(rows[0]) : null;
  },

  async create({ name, type, capacity, description = null }) {
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO resources (id, name, type, capacity, description)
       VALUES (?, ?, ?, ?, ?)`,
      [id, name, type, capacity, description]
    );
    return this.findById(id);
  },

  async update(id, fields) {
    const sets = [];
    const params = [];

    if (fields.name !== undefined) {
      sets.push('name = ?');
      params.push(fields.name);
    }
    if (fields.type !== undefined) {
      sets.push('type = ?');
      params.push(fields.type);
    }
    if (fields.capacity !== undefined) {
      sets.push('capacity = ?');
      params.push(fields.capacity);
    }
    if (fields.description !== undefined) {
      sets.push('description = ?');
      params.push(fields.description);
    }
    if (fields.isActive !== undefined) {
      sets.push('is_active = ?');
      params.push(fields.isActive ? 1 : 0);
    }

    params.push(id);
    await query(`UPDATE resources SET ${sets.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }
};
