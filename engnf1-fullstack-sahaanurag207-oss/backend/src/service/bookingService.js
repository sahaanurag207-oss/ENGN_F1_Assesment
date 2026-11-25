import { withTransaction } from '../database/dbHelper.js';
import { mapBooking } from '../model/bookingModel.js';
import { Errors } from '../utils/AppError.js';

export const bookingService = {
  async createBooking({ userId, resourceId, ticketId, startTime, endTime, purpose }) {
    return withTransaction(async (client) => {
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);

      const resRow = await client.query('SELECT * FROM resources WHERE id = $1 FOR UPDATE', [resourceId]);
      const resource = resRow.rows[0];
      if (!resource) {
        throw Errors.notFound('Resource not found');
      }
      if (!resource.is_active) {
        throw Errors.conflict('Cannot book an inactive resource');
      }

      if (ticketId) {
        const tRow = await client.query('SELECT id FROM tickets WHERE id = $1', [ticketId]);
        if (!tRow.rows[0]) {
          throw Errors.notFound('Referenced ticket not found');
        }
      }

      const countRes = await client.query(
        `SELECT COUNT(*)::int AS active_count
         FROM bookings
         WHERE user_id = $1
           AND status IN ('PENDING', 'APPROVED')
           AND start_time > NOW()`,
        [userId]
      );
      if (countRes.rows[0].active_count >= 3) {
        throw Errors.conflict('Maximum of 3 future PENDING or APPROVED bookings allowed per user');
      }

      const overlapRes = await client.query(
        `SELECT id FROM bookings
         WHERE resource_id = $1
           AND status IN ('PENDING', 'APPROVED')
           AND start_time < $3::timestamptz
           AND end_time > $2::timestamptz
         LIMIT 1`,
        [resourceId, startTime, endTime]
      );
      if (overlapRes.rows.length > 0) {
        throw Errors.conflict('Selected time slot overlaps with an existing booking');
      }

      try {
        const insertRes = await client.query(
          `INSERT INTO bookings (resource_id, user_id, ticket_id, start_time, end_time, purpose, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
           RETURNING *`,
          [resourceId, userId, ticketId, startTime, endTime, purpose]
        );
        return mapBooking(insertRes.rows[0]);
      } catch (err) {
        if (err.code === '23P01') {
          throw Errors.conflict('Selected time slot was just claimed by another request');
        }
        throw err;
      }
    });
  },

  async cancelBooking(bookingId, requester) {
    return withTransaction(async (client) => {
      const res = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [bookingId]);
      const booking = res.rows[0];
      if (!booking) throw Errors.notFound('Booking not found');
      if (booking.user_id !== requester.id) throw Errors.forbidden('Only the booking owner can cancel');

      if (!['PENDING', 'APPROVED'].includes(booking.status)) {
        throw Errors.conflict(`Cannot cancel booking in ${booking.status} status`);
      }
      if (new Date(booking.start_time).getTime() <= Date.now()) {
        throw Errors.conflict('Cannot cancel a booking that has already started');
      }

      const upd = await client.query(
        `UPDATE bookings SET status = 'CANCELLED' WHERE id = $1 RETURNING *`,
        [bookingId]
      );
      return mapBooking(upd.rows[0]);
    });
  },

  async approveBooking(bookingId) {
    return withTransaction(async (client) => {
      const res = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [bookingId]);
      const booking = res.rows[0];
      if (!booking) throw Errors.notFound('Booking not found');

      if (booking.status !== 'PENDING') {
        throw Errors.conflict(`Cannot approve booking in ${booking.status} status`);
      }
      if (new Date(booking.start_time).getTime() <= Date.now()) {
        throw Errors.conflict('Cannot approve a booking whose startTime is in the past');
      }

      const upd = await client.query(
        `UPDATE bookings SET status = 'APPROVED' WHERE id = $1 RETURNING *`,
        [bookingId]
      );
      return mapBooking(upd.rows[0]);
    });
  },

  async rejectBooking(bookingId, note) {
    const cleanNote = typeof note === 'string' ? note.trim() : '';
    if (cleanNote.length < 5 || cleanNote.length > 200) {
      throw Errors.validation('Rejection note is required (5-200 characters)');
    }

    return withTransaction(async (client) => {
      const res = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [bookingId]);
      const booking = res.rows[0];
      if (!booking) throw Errors.notFound('Booking not found');

      if (booking.status !== 'PENDING') {
        throw Errors.conflict(`Cannot reject booking in ${booking.status} status`);
      }
      if (new Date(booking.start_time).getTime() <= Date.now()) {
        throw Errors.conflict('Cannot reject a booking whose startTime is in the past');
      }

      const upd = await client.query(
        `UPDATE bookings SET status = 'REJECTED', decision_note = $2 WHERE id = $1 RETURNING *`,
        [bookingId, cleanNote]
      );
      return mapBooking(upd.rows[0]);
    });
  }
};
