import { query } from '../database/dbHelper.js';
import { escapeLikeWildcards } from '../utils/classifier.js';

export const mapTicket = (r) => ({
  id: r.id,
  externalId: r.external_id,
  subject: r.subject,
  body: r.body,
  autoCategory: r.auto_category,
  category: r.category,
  isHumanOverride: r.is_human_override,
  priority: r.priority,
  status: r.status,
  assigneeId: r.assignee_id,
  isReviewed: r.is_reviewed,
  createdAt: r.created_at,
  updatedAt: r.updated_at
});

export const mapEvent = (r) => ({
  id: r.id,
  ticketId: r.ticket_id,
  field: r.field,
  oldValue: r.old_value,
  newValue: r.new_value,
  actor: r.actor,
  createdAt: r.created_at
});

export const ticketModel = {
  async findByExternalId(externalId, client = null) {
    const exec = client ? client.query.bind(client) : query;
    const res = await exec('SELECT * FROM tickets WHERE external_id = $1 FOR UPDATE', [externalId]);
    return res.rows[0] || null;
  },

  async insertTicket({ externalId, subject, body, autoCategory, priority }, client) {
    const res = await client.query(
      `INSERT INTO tickets (external_id, subject, body, auto_category, category, priority)
       VALUES ($1, $2, $3, $4, $4, $5)
       RETURNING *`,
      [externalId, subject, body, autoCategory, priority]
    );
    return mapTicket(res.rows[0]);
  },

  async updateFromImport(id, { subject, body, autoCategory, priority, preserveCategory }, client) {
    if (preserveCategory) {
      await client.query(
        `UPDATE tickets SET subject = $1, body = $2, updated_at = NOW() WHERE id = $3`,
        [subject, body, id]
      );
    } else {
      await client.query(
        `UPDATE tickets
         SET subject = $1, body = $2, auto_category = $3, category = $3, priority = $4, updated_at = NOW()
         WHERE id = $5`,
        [subject, body, autoCategory, priority, id]
      );
    }
  },

  async list({ status, category, priority, q, page = 1, limit = 10 }) {
    const conditions = [];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    if (priority) {
      params.push(priority);
      conditions.push(`priority = $${params.length}`);
    }
    if (q && q.trim().length > 0) {
      params.push(`%${escapeLikeWildcards(q.trim())}%`);
      conditions.push(`(subject ILIKE $${params.length} ESCAPE '\\' OR body ILIKE $${params.length} ESCAPE '\\')`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*)::int AS total FROM tickets ${whereClause}`, params);
    const total = countRes.rows[0].total;

    const offset = (page - 1) * limit;
    params.push(limit, offset);
    const dataRes = await query(
      `SELECT * FROM tickets ${whereClause}
       ORDER BY created_at DESC, id ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      data: dataRes.rows.map(mapTicket),
      page,
      pageSize: limit,
      total,
      totalPages: Math.ceil(total / limit)
    };
  },

  async findByIdWithEvents(id, client = null) {
    const exec = client ? client.query.bind(client) : query;
    const tRes = await exec('SELECT * FROM tickets WHERE id = $1', [id]);
    if (!tRes.rows[0]) return null;
    const eRes = await exec('SELECT * FROM ticket_events WHERE ticket_id = $1 ORDER BY created_at ASC', [id]);
    return {
      ticket: mapTicket(tRes.rows[0]),
      events: eRes.rows.map(mapEvent)
    };
  },

  async getStats() {
    const res = await query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE is_reviewed = TRUE)::int AS reviewed_count,
        COUNT(*) FILTER (WHERE category = auto_category)::int AS agreed_count,
        COUNT(*) FILTER (WHERE category = 'BILLING')::int AS cat_billing,
        COUNT(*) FILTER (WHERE category = 'BUG')::int AS cat_bug,
        COUNT(*) FILTER (WHERE category = 'FEATURE_REQUEST')::int AS cat_feature,
        COUNT(*) FILTER (WHERE category = 'LOGIN')::int AS cat_login,
        COUNT(*) FILTER (WHERE category = 'DELIVERY')::int AS cat_delivery,
        COUNT(*) FILTER (WHERE priority = 'LOW')::int AS pri_low,
        COUNT(*) FILTER (WHERE priority = 'MEDIUM')::int AS pri_medium,
        COUNT(*) FILTER (WHERE priority = 'HIGH')::int AS pri_high,
        COUNT(*) FILTER (WHERE priority = 'URGENT')::int AS pri_urgent,
        COUNT(*) FILTER (WHERE status = 'OPEN')::int AS st_open,
        COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::int AS st_in_progress,
        COUNT(*) FILTER (WHERE status = 'RESOLVED')::int AS st_resolved,
        COUNT(*) FILTER (WHERE status = 'CLOSED')::int AS st_closed
      FROM tickets
    `);
    const r = res.rows[0];
    const agreement = r.total === 0 ? 100 : Number(((r.agreed_count / r.total) * 100).toFixed(2));
    return {
      byCategory: {
        BILLING: r.cat_billing,
        BUG: r.cat_bug,
        FEATURE_REQUEST: r.cat_feature,
        LOGIN: r.cat_login,
        DELIVERY: r.cat_delivery
      },
      byPriority: {
        LOW: r.pri_low,
        MEDIUM: r.pri_medium,
        HIGH: r.pri_high,
        URGENT: r.pri_urgent
      },
      byStatus: {
        OPEN: r.st_open,
        IN_PROGRESS: r.st_in_progress,
        RESOLVED: r.st_resolved,
        CLOSED: r.st_closed
      },
      reviewedCount: r.reviewed_count,
      modelAgreementRate: agreement
    };
  }
};
