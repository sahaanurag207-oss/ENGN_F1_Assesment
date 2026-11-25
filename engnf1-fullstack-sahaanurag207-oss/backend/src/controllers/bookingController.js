import { bookingModel } from '../model/bookingModel.js';
import { ticketModel } from '../model/ticketModel.js';
import { bookingService } from '../service/bookingService.js';
import { assertUuid, validateBookingCreate, BOOKING_STATUSES } from '../validators/schemas.js';
import { Errors } from '../utils/AppError.js';

export const bookingController = {
  async create(req, res, next) {
    try {
      const payload = validateBookingCreate(req.body);
      const booking = await bookingService.createBooking({
        userId: req.user.id,
        ...payload
      });
      res.status(201).json(booking);
    } catch (err) {
      next(err);
    }
  },

  async mine(req, res, next) {
    try {
      const { status } = req.query;
      const page = req.query.page ? Number(req.query.page) : 1;

      if (status && !BOOKING_STATUSES.includes(status)) throw Errors.validation('Invalid booking status');
      if (!Number.isInteger(page) || page < 1) throw Errors.validation('page must be a positive integer');

      const result = await bookingModel.listByUser(req.user.id, { status, page, pageSize: 10 });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      assertUuid(req.params.id, 'booking id');
      const booking = await bookingModel.findById(req.params.id);
      if (!booking) throw Errors.notFound('Booking not found');
      if (booking.userId !== req.user.id && req.user.role !== 'ADMIN') {
        throw Errors.forbidden('You do not have permission to view this booking');
      }
      res.status(200).json(booking);
    } catch (err) {
      next(err);
    }
  },

  async listAll(req, res, next) {
    try {
      const { status, resourceId, from, to } = req.query;
      const page = req.query.page ? Number(req.query.page) : 1;

      if (status && !BOOKING_STATUSES.includes(status)) throw Errors.validation('Invalid booking status');
      if (resourceId) assertUuid(resourceId, 'resourceId');
      if (from && Number.isNaN(new Date(from).getTime())) throw Errors.validation('Invalid from timestamp');
      if (to && Number.isNaN(new Date(to).getTime())) throw Errors.validation('Invalid to timestamp');
      if (!Number.isInteger(page) || page < 1) throw Errors.validation('page must be a positive integer');

      const result = await bookingModel.listAll({ status, resourceId, from, to, page, pageSize: 10 });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async cancel(req, res, next) {
    try {
      assertUuid(req.params.id, 'booking id');
      const booking = await bookingService.cancelBooking(req.params.id, req.user);
      res.status(200).json(booking);
    } catch (err) {
      next(err);
    }
  },

  async approve(req, res, next) {
    try {
      assertUuid(req.params.id, 'booking id');
      const booking = await bookingService.approveBooking(req.params.id);
      res.status(200).json(booking);
    } catch (err) {
      next(err);
    }
  },

  async reject(req, res, next) {
    try {
      assertUuid(req.params.id, 'booking id');
      const booking = await bookingService.rejectBooking(req.params.id, req.body?.note);
      res.status(200).json(booking);
    } catch (err) {
      next(err);
    }
  },

  async adminStats(req, res, next) {
    try {
      const [bookingAdminStats, ticketStats] = await Promise.all([
        bookingModel.getAdminStats(),
        ticketModel.getStats()
      ]);
      res.status(200).json({
        ...bookingAdminStats,
        ticketStats
      });
    } catch (err) {
      next(err);
    }
  }
};
