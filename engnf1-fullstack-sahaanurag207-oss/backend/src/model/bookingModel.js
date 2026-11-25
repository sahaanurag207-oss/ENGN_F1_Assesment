import { query } from '../database/dbHelper.js';

export const mapBooking = (r) => ({
  id: r.id,
  resourceId: r.resource_id,
  userId: r.user_id,
  ticketId: r.ticket_id,
  startTime: r.start_time,
  endTime: r.end_time,
  purpose: r.purpose,
  status: r.status,
  decisionNote: r.decision_note,
  createdAt: r.created_at
});

export const bookingModel = {
  async findById(id, client = null) {
    const exec = client ? client.query.bind(client) : query;
    const res = await exec('SELECT * FROM bookings WHERE id = $1', [id]);
    return res.rows[0] ? mapBooking(res.rows[0]) : null;
  },

  async getAvailability(resourceId, from, to) {
    const res = await query(
      `SELECT start_time, end_time, status
       FROM bookings
       WHERE resource_id = $1
         AND status IN ('PENDING', 'APPROVED')
         AND start_time < $3::timestamptz
         AND end_time > $2::timestamptz
       ORDER BY start_time ASC`,
      [resourceId, from, to]
    );
    return res.rows.map((r) => ({
      startTime: r.start_time,
      endTime: r.end_time,
      status: r.status
    }));
  },

  async listByUser(userId, { status, page = 1, pageSize = 10 }) {
    const conditions = ['user_id = $1'];
    const params = [userId];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const countRes = await query(`SELECT COUNT(*)::int AS total FROM bookings ${where}`, params);
    const total = countRes.rows[0].total;

    const offset = (page - 1) * pageSize;
    params.push(pageSize, offset);
    const rowsRes = await query(
      `SELECT * FROM bookings ${where} ORDER BY start_time DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      data: rowsRes.rows.map(mapBooking),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    };
  },

  async listAll({ status, resourceId, from, to, page = 1, pageSize = 10 }) {
    const conditions = [];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (resourceId) {
      params.push(resourceId);
      conditions.push(`resource_id = $${params.length}`);
    }
    if (from) {
      params.push(from);
      conditions.push(`end_time > $${params.length}::timestamptz`);
    }
    if (to) {
      params.push(to);
      conditions.push(`start_time < $${params.length}::timestamptz`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*)::int AS total FROM bookings ${where}`, params);
    const total = countRes.rows[0].total;

    const offset = (page - 1) * pageSize;
    params.push(pageSize, offset);
    const rowsRes = await query(
      `SELECT * FROM bookings ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      data: rowsRes.rows.map(mapBooking),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    };
  },

  async getAdminStats() {
    const activeRes = await query('SELECT COUNT(*)::int AS count FROM resources WHERE is_active = TRUE');
    const statusRes = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
        COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS rejected,
        COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled
      FROM bookings
    `);
    const topRes = await query(`
      SELECT r.id AS "resourceId", r.name, r.type, COUNT(b.id)::int AS "bookingCount"
      FROM resources r
      LEFT JOIN bookings b ON b.resource_id = r.id AND b.status IN ('PENDING', 'APPROVED')
      GROUP BY r.id
      ORDER BY "bookingCount" DESC, LOWER(r.name) ASC
      LIMIT 3
    `);

    const s = statusRes.rows[0];
    return {
      activeResources: activeRes.rows[0].count,
      bookingsByStatus: {
        PENDING: s.pending,
        APPROVED: s.approved,
        REJECTED: s.rejected,
        CANCELLED: s.cancelled
      },
      topResources: topRes.rows
    };
  }
};
