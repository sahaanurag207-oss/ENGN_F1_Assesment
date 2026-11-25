import { ticketModel } from '../model/ticketModel.js';
import { ticketService } from '../service/ticketService.js';
import {
  assertUuid,
  validateTicketImport,
  validateTicketPatch,
  CATEGORIES,
  PRIORITIES,
  TICKET_STATUSES
} from '../validators/schemas.js';
import { Errors } from '../utils/AppError.js';

export const ticketController = {
  async importTickets(req, res, next) {
    try {
      const tickets = validateTicketImport(req.body);
      const summary = await ticketService.importFeed(tickets);
      res.status(200).json(summary);
    } catch (err) {
      next(err);
    }
  },

  async listTickets(req, res, next) {
    try {
      const { status, category, priority, q } = req.query;
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 10;

      if (status && !TICKET_STATUSES.includes(status)) throw Errors.validation('Invalid status filter');
      if (category && !CATEGORIES.includes(category)) throw Errors.validation('Invalid category filter');
      if (priority && !PRIORITIES.includes(priority)) throw Errors.validation('Invalid priority filter');
      if (!Number.isInteger(page) || page < 1) throw Errors.validation('page must be a positive integer');
      if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw Errors.validation('limit must be 1-200');

      const result = await ticketModel.list({ status, category, priority, q, page, limit });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async getTicket(req, res, next) {
    try {
      assertUuid(req.params.id, 'ticket id');
      const data = await ticketModel.findByIdWithEvents(req.params.id);
      if (!data) throw Errors.notFound('Ticket not found');
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  },

  async patchTicket(req, res, next) {
    try {
      assertUuid(req.params.id, 'ticket id');
      const patch = validateTicketPatch(req.body);
      const headerAgent = req.get('X-Agent')?.trim();
      const actor = headerAgent && headerAgent.length <= 254 ? headerAgent : req.user.email;

      const updated = await ticketService.reviewTicket(req.params.id, patch, actor);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  },

  async stats(req, res, next) {
    try {
      const data = await ticketModel.getStats();
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }
};
