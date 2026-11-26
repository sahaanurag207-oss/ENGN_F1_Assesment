import crypto from 'crypto';
import { query, fromMysqlUtc } from '../database/dbHelper.js';
import { escapeLikeWildcards } from '../utils/classifier.js';

export const mapTicket = (r) => ({
  id: r.id,
  externalId: r.external_id,
  subject: r.subject,
  body: r.body,
  autoCategory: r.auto_category,
  category: r.category,
  isHumanOverride: Boolean(r.is_human_override),
  priority: r.priority,
  status: r.status,
  assigneeId: r.assignee_id,
  isReviewed: Boolean(r.is_reviewed),
  createdAt: fromMysqlUtc(r.created_at),
  updatedAt: fromMysqlUtc(r.updated_at)
});

export const mapEvent = (r) => ({
  id: r.id,
  ticketId: r.ticket_id,
  field: r.field,
  oldValue: r.old_value,
  newValue: r.new_value,
  actor: r.actor,
  createdAt: fromMysqlUtc(r.created_at)
});

export const ticketModel = {
  async findByExternalId(externalId, conn = null) {
    if (conn) {
      const [rows] = await conn.execute('SELECT * FROM tickets WHERE external_id = ? FOR UPDATE', [externalId]);
      return rows[0] || null;
    }
    const rows = await query('SELECT * FROM tickets WHERE external_id = ? LIMIT 1', [externalId]);
    return rows[0] || null;
  },

  async insertTicket({ externalId, subject, body, autoCategory, priority }, conn) {
    const id = crypto.randomUUID();
    await conn.execute(
      `INSERT INTO tickets (id, external_id, subject, body, auto_category, category, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, externalId, subject, body, autoCategory, autoCategory, priority]
    );
    const [rows] = await conn.execute('SELECT * FROM tickets WHERE id = ?', [id]);
    return mapTicket(rows[0]);
  },

  async updateFromImport(id, { subject, body, autoCategory, priority, preserveCategory }, conn) {
    if (preserveCategory) {
      await conn.execute(
        `UPDATE tickets SET subject = ?, body = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?`,
        [subject, body, id]
      );
    } else {
      await conn.execute(
        `UPDATE tickets
         SET subject = ?, body = ?, auto_category = ?, category = ?, priority = ?, updated_at = CURRENT_TIMESTAMP(3)
         WHERE id = ?`,
        [subject, body, autoCategory, autoCategory, priority, id]
      );
    }
  },

  async list({ status, category, priority, q, page = 1, limit = 10 }) {
    const conditions = [];
    const params = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    if (priority) {
      conditions.push('priority = ?');
      params.push(priority);
    }
    if (q && q.trim().length > 0) {
      const pattern = `%${escapeLikeWildcards(q.trim())}%`;
      conditions.push(`(LOWER(subject) LIKE LOWER(?) ESCAPE '\\' OR LOWER(body) LIKE LOWER(?) ESCAPE '\\')`);
      params.push(pattern, pattern);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRows = await query(`SELECT COUNT(*) AS total FROM tickets ${whereClause}`, params);
    const total = Number(countRows[0].total);

    const safeLimit = Number(limit);
    const safeOffset = (Number(page) - 1) * safeLimit;
    const dataRows = await query(
      `SELECT * FROM tickets ${whereClause}
       ORDER BY created_at DESC, id ASC
       LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      params
    );

    return {
      data: dataRows.map(mapTicket),
      page: Number(page),
      pageSize: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit)
    };
  },

  async findByIdWithEvents(id, conn = null) {
    let tRows;
    let eRows;
    if (conn) {
      [tRows] = await conn.execute('SELECT * FROM tickets WHERE id = ?', [id]);
      if (!tRows[0]) return null;
      [eRows] = await conn.execute('SELECT * FROM ticket_events WHERE ticket_id = ? ORDER BY created_at ASC', [id]);
    } else {
      tRows = await query('SELECT * FROM tickets WHERE id = ?', [id]);
      if (!tRows[0]) return null;
      eRows = await query('SELECT * FROM ticket_events WHERE ticket_id = ? ORDER BY created_at ASC', [id]);
    }
    return {
      ticket: mapTicket(tRows[0]),
      events: eRows.map(mapEvent)
    };
  },

  async getStats() {
    const rows = await query(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN is_reviewed = 1 THEN 1 ELSE 0 END), 0) AS reviewed_count,
        COALESCE(SUM(CASE WHEN category = auto_category THEN 1 ELSE 0 END), 0) AS agreed_count,
        COALESCE(SUM(CASE WHEN category = 'BILLING' THEN 1 ELSE 0 END), 0) AS cat_billing,
        COALESCE(SUM(CASE WHEN category = 'BUG' THEN 1 ELSE 0 END), 0) AS cat_bug,
        COALESCE(SUM(CASE WHEN category = 'FEATURE_REQUEST' THEN 1 ELSE 0 END), 0) AS cat_feature,
        COALESCE(SUM(CASE WHEN category = 'LOGIN' THEN 1 ELSE 0 END), 0) AS cat_login,
        COALESCE(SUM(CASE WHEN category = 'DELIVERY' THEN 1 ELSE 0 END), 0) AS cat_delivery,
        COALESCE(SUM(CASE WHEN priority = 'LOW' THEN 1 ELSE 0 END), 0) AS pri_low,
        COALESCE(SUM(CASE WHEN priority = 'MEDIUM' THEN 1 ELSE 0 END), 0) AS pri_medium,
        COALESCE(SUM(CASE WHEN priority = 'HIGH' THEN 1 ELSE 0 END), 0) AS pri_high,
        COALESCE(SUM(CASE WHEN priority = 'URGENT' THEN 1 ELSE 0 END), 0) AS pri_urgent,
        COALESCE(SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END), 0) AS st_open,
        COALESCE(SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END), 0) AS st_in_progress,
        COALESCE(SUM(CASE WHEN status = 'RESOLVED' THEN 1 ELSE 0 END), 0) AS st_resolved,
        COALESCE(SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END), 0) AS st_closed
      FROM tickets
    `);
    const r = rows[0];
    const total = Number(r.total);
    const agreed = Number(r.agreed_count);
    const agreement = total === 0 ? 100 : Number(((agreed / total) * 100).toFixed(2));
    return {
      byCategory: {
        BILLING: Number(r.cat_billing),
        BUG: Number(r.cat_bug),
        FEATURE_REQUEST: Number(r.cat_feature),
        LOGIN: Number(r.cat_login),
        DELIVERY: Number(r.cat_delivery)
      },
      byPriority: {
        LOW: Number(r.pri_low),
        MEDIUM: Number(r.pri_medium),
        HIGH: Number(r.pri_high),
        URGENT: Number(r.pri_urgent)
      },
      byStatus: {
        OPEN: Number(r.st_open),
        IN_PROGRESS: Number(r.st_in_progress),
        RESOLVED: Number(r.st_resolved),
        CLOSED: Number(r.st_closed)
      },
      reviewedCount: Number(r.reviewed_count),
      modelAgreementRate: agreement
    };
  }
};
