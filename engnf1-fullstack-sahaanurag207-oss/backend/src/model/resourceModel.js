import { query } from '../database/dbHelper.js';
import { escapeLikeWildcards } from '../utils/classifier.js';

export const mapResource = (r) => ({
  id: r.id,
  name: r.name,
  type: r.type,
  capacity: r.capacity,
  description: r.description,
  isActive: r.is_active,
  createdAt: r.created_at
});

export const resourceModel = {
  async list({ search, type, minCapacity, page = 1, pageSize = 10, includeInactive = false }) {
    const conditions = [];
    const params = [];

    if (!includeInactive) {
      conditions.push('is_active = TRUE');
    }
    if (search && search.trim()) {
      params.push(`%${escapeLikeWildcards(search.trim())}%`);
      conditions.push(`(name ILIKE $${params.length} ESCAPE '\\' OR COALESCE(description, '') ILIKE $${params.length} ESCAPE '\\')`);
    }
    if (type) {
      params.push(type);
      conditions.push(`type = $${params.length}`);
    }
    if (minCapacity !== undefined) {
      params.push(minCapacity);
      conditions.push(`capacity >= $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*)::int AS total FROM resources ${where}`, params);
    const total = countRes.rows[0].total;

    const offset = (page - 1) * pageSize;
    params.push(pageSize, offset);
    const rowsRes = await query(
      `SELECT * FROM resources ${where} ORDER BY LOWER(name) ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      data: rowsRes.rows.map(mapResource),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    };
  },

  async findById(id) {
    const res = await query('SELECT * FROM resources WHERE id = $1', [id]);
    return res.rows[0] ? mapResource(res.rows[0]) : null;
  },

  async create({ name, type, capacity, description = null }) {
    const res = await query(
      `INSERT INTO resources (name, type, capacity, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, type, capacity, description]
    );
    return mapResource(res.rows[0]);
  },

  async update(id, fields) {
    const sets = [];
    const params = [];

    if (fields.name !== undefined) {
      params.push(fields.name);
      sets.push(`name = $${params.length}`);
    }
    if (fields.type !== undefined) {
      params.push(fields.type);
      sets.push(`type = $${params.length}`);
    }
    if (fields.capacity !== undefined) {
      params.push(fields.capacity);
      sets.push(`capacity = $${params.length}`);
    }
    if (fields.description !== undefined) {
      params.push(fields.description);
      sets.push(`description = $${params.length}`);
    }
    if (fields.isActive !== undefined) {
      params.push(fields.isActive);
      sets.push(`is_active = $${params.length}`);
    }

    params.push(id);
    const res = await query(
      `UPDATE resources SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    return res.rows[0] ? mapResource(res.rows[0]) : null;
  }
};
