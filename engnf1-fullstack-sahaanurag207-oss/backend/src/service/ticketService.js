import { withTransaction } from '../database/dbHelper.js';
import { ticketModel } from '../model/ticketModel.js';
import { userModel } from '../model/userModel.js';
import { classifyTicket } from '../utils/classifier.js';
import { Errors } from '../utils/AppError.js';

export const ticketService = {
  async importFeed(tickets) {
    return withTransaction(async (client) => {
      let importedCount = 0;
      let updatedCount = 0;
      let skippedOverrideCount = 0;

      for (const item of tickets) {
        const existing = await ticketModel.findByExternalId(item.externalId, client);
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
            client
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
            client
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
            client
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
    return withTransaction(async (client) => {
      const currentRes = await client.query('SELECT * FROM tickets WHERE id = $1 FOR UPDATE', [ticketId]);
      const current = currentRes.rows[0];
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
      let nextOverride = current.is_human_override;
      let nextPriority = current.priority;
      let nextStatus = current.status;
      let nextAssignee = current.assignee_id;
      let nextReviewed = current.is_reviewed;

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
        await client.query(
          `UPDATE tickets
           SET category = $1,
               is_human_override = $2,
               priority = $3,
               status = $4,
               assignee_id = $5,
               is_reviewed = $6,
               updated_at = NOW()
           WHERE id = $7`,
          [nextCategory, nextOverride, nextPriority, nextStatus, nextAssignee, nextReviewed, ticketId]
        );

        for (const ch of changes) {
          await client.query(
            `INSERT INTO ticket_events (ticket_id, field, old_value, new_value, actor)
             VALUES ($1, $2, $3, $4, $5)`,
            [ticketId, ch.field, ch.oldValue, ch.newValue, actor]
          );
        }
      }

      return ticketModel.findByIdWithEvents(ticketId, client);
    });
  }
};
