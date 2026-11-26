import crypto from 'crypto';
import { withTransaction } from '../database/dbHelper.js';
import { ticketModel } from '../model/ticketModel.js';
import { userModel } from '../model/userModel.js';
import { classifyTicket } from '../utils/classifier.js';
import { Errors } from '../utils/AppError.js';

export const ticketService = {
  async importFeed(tickets) {
    return withTransaction(async (conn) => {
      let importedCount = 0;
      let updatedCount = 0;
      let skippedOverrideCount = 0;

      for (const item of tickets) {
        const existing = await ticketModel.findByExternalId(item.externalId, conn);
        const { autoCategory, priority } = classifyTicket(item.subject, item.body);

        if (!existing) {
          await ticketModel.insertTicket(
            {
              externalId: item.externalId,
              subject: item.subject,
              body: item.body,
              autoCategory,
              priority
            },
            conn
          );
          importedCount++;
        } else if (existing.is_human_override) {
          await ticketModel.updateFromImport(
            existing.id,
            {
              subject: item.subject,
              body: item.body,
              preserveCategory: true
            },
            conn
          );
          skippedOverrideCount++;
        } else {
          await ticketModel.updateFromImport(
            existing.id,
            {
              subject: item.subject,
              body: item.body,
              autoCategory,
              priority,
              preserveCategory: false
            },
            conn
          );
          updatedCount++;
        }
      }

      return {
        importedCount,
        updatedCount,
        skippedOverrideCount,
        total: tickets.length
      };
    });
  },

  async reviewTicket(ticketId, patch, actor) {
    return withTransaction(async (conn) => {
      const [currentRows] = await conn.execute('SELECT * FROM tickets WHERE id = ? FOR UPDATE', [ticketId]);
      const current = currentRows[0];
      if (!current) {
        throw Errors.notFound('Ticket not found');
      }

      if (patch.assigneeId !== undefined && patch.assigneeId !== null) {
        const assignee = await userModel.findById(patch.assigneeId);
        if (!assignee) {
          throw Errors.notFound('Assigned user not found');
        }
      }

      const changes = [];
      let nextCategory = current.category;
      let nextOverride = Boolean(current.is_human_override);
      let nextPriority = current.priority;
      let nextStatus = current.status;
      let nextAssignee = current.assignee_id;
      let nextReviewed = Boolean(current.is_reviewed);

      if (patch.category !== undefined && patch.category !== current.category) {
        changes.push({ field: 'category', oldValue: current.category, newValue: patch.category });
        nextCategory = patch.category;
        nextOverride = true;
        nextReviewed = true;
      }

      if (patch.priority !== undefined && patch.priority !== current.priority) {
        changes.push({ field: 'priority', oldValue: current.priority, newValue: patch.priority });
        nextPriority = patch.priority;
      }

      if (patch.status !== undefined && patch.status !== current.status) {
        changes.push({ field: 'status', oldValue: current.status, newValue: patch.status });
        if (current.status === 'OPEN' && patch.status !== 'OPEN') {
          nextReviewed = true;
        }
        nextStatus = patch.status;
      }

      if (patch.assigneeId !== undefined && patch.assigneeId !== current.assignee_id) {
        changes.push({ field: 'assigneeId', oldValue: current.assignee_id, newValue: patch.assigneeId });
        nextAssignee = patch.assigneeId;
      }

      if (changes.length > 0) {
        await conn.execute(
          `UPDATE tickets
           SET category = ?,
               is_human_override = ?,
               priority = ?,
               status = ?,
               assignee_id = ?,
               is_reviewed = ?,
               updated_at = CURRENT_TIMESTAMP(3)
           WHERE id = ?`,
          [
            nextCategory,
            nextOverride ? 1 : 0,
            nextPriority,
            nextStatus,
            nextAssignee,
            nextReviewed ? 1 : 0,
            ticketId
          ]
        );

        for (const ch of changes) {
          await conn.execute(
            `INSERT INTO ticket_events (id, ticket_id, field, old_value, new_value, actor)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [crypto.randomUUID(), ticketId, ch.field, ch.oldValue, ch.newValue, actor]
          );
        }
      }

      return ticketModel.findByIdWithEvents(ticketId, conn);
    });
  }
};
