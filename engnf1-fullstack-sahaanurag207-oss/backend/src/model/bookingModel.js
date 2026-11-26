import { query, toMysqlUtc, fromMysqlUtc } from '../database/dbHelper.js';

export const mapBooking = (r) => ({
  id: r.id,
  resourceId: r.resource_id,
  userId: r.user_id,
  ticketId: r.ticket_id,
  startTime: fromMysqlUtc(r.start_time),
  endTime: fromMysqlUtc(r.end_time),
  purpose: r.purpose,
  status: r.status,
  decisionNote: r.decision_note,
  createdAt: fromMysqlUtc(r.created_at)
});

export const bookingModel = {
  async findById(id, conn = null) {
    if (conn) {
      const [rows] = await conn.execute('SELECT * FROM bookings WHERE id = ?', [id]);
      return rows[0] ? mapBooking(rows[0]) : null;
    }
    const rows = await query('SELECT * FROM bookings WHERE id = ? LIMIT 1', [id]);
    return rows[0] ? mapBooking(rows[0]) : null;
  },

  async getAvailability(resourceId, from, to) {
    const rows = await query(
      `SELECT start_time, end_time, status
       FROM bookings
       WHERE resource_id = ?
         AND status IN ('PENDING', 'APPROVED')
         AND start_time < ?
         AND end_time > ?
       ORDER BY start_time ASC`,
      [resourceId, toMysqlUtc(to), toMysqlUtc(from)]
    );
    return rows.map((r) => ({
      startTime: fromMysqlUtc(r.start_time),
      endTime: fromMysqlUtc(r.end_time),
      status: r.status
    }));
  },

  async listByUser(userId, { status, page = 1, pageSize = 10 }) {
    const conditions = ['user_id = ?'];
    const params = [userId];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const countRows = await query(`SELECT COUNT(*) AS total FROM bookings ${where}`, params);
    const total = Number(countRows[0].total);

    const safeLimit = Number(pageSize);
    const safeOffset = (Number(page) - 1) * safeLimit;
    const rows = await query(
      `SELECT * FROM bookings ${where} ORDER BY start_time DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      params
    );

    return {
      data: rows.map(mapBooking),
      page: Number(page),
      pageSize: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit)
    };
  },

  async listAll({ status, resourceId, from, to, page = 1, pageSize = 10 }) {
    const conditions = [];
    const params = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (resourceId) {
      conditions.push('resource_id = ?');
      params.push(resourceId);
    }
    if (from) {
      conditions.push('end_time > ?');
      params.push(toMysqlUtc(from));
    }
    if (to) {
      conditions.push('start_time < ?');
      params.push(toMysqlUtc(to));
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRows = await query(`SELECT COUNT(*) AS total FROM bookings ${where}`, params);
    const total = Number(countRows[0].total);

    const safeLimit = Number(pageSize);
    const safeOffset = (Number(page) - 1) * safeLimit;
    const rows = await query(
      `SELECT * FROM bookings ${where} ORDER BY created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      params
    );

    return {
      data: rows.map(mapBooking),
      page: Number(page),
      pageSize: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit)
    };
  },

  async getAdminStats() {
    const activeRows = await query('SELECT COUNT(*) AS count FROM resources WHERE is_active = 1');
    const statusRows = await query(`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END), 0) AS pending,
        COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END), 0) AS approved,
        COALESCE(SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END), 0) AS rejected,
        COALESCE(SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END), 0) AS cancelled
      FROM bookings
    `);
    const topRows = await query(`
      SELECT r.id AS resourceId, r.name, r.type, COUNT(b.id) AS bookingCount
      FROM resources r
      LEFT JOIN bookings b ON b.resource_id = r.id AND b.status IN ('PENDING', 'APPROVED')
      GROUP BY r.id, r.name, r.type
      ORDER BY bookingCount DESC, LOWER(r.name) ASC
      LIMIT 3
    `);

    const s = statusRows[0];
    return {
      activeResources: Number(activeRows[0].count),
      bookingsByStatus: {
        PENDING: Number(s.pending),
        APPROVED: Number(s.approved),
        REJECTED: Number(s.rejected),
        CANCELLED: Number(s.cancelled)
      },
      topResources: topRows.map((r) => ({
        resourceId: r.resourceId,
        name: r.name,
        type: r.type,
        bookingCount: Number(r.bookingCount)
      }))
    };
  }
};
