import crypto from 'crypto';
import { withTransaction, toMysqlUtc } from '../database/dbHelper.js';
import { mapBooking } from '../model/bookingModel.js';
import { Errors } from '../utils/AppError.js';

export const bookingService = {
  async createBooking({ userId, resourceId, ticketId, startTime, endTime, purpose }) {
    return withTransaction(async (conn) => {
      // Lock user row to serialize concurrent max-3 quota check
      await conn.execute('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);

      // Lock resource row to serialize all concurrent slot checks on this resource
      const [resRows] = await conn.execute('SELECT * FROM resources WHERE id = ? FOR UPDATE', [resourceId]);
      const resource = resRows[0];
      if (!resource) {
        throw Errors.notFound('Resource not found');
      }
      if (!resource.is_active) {
        throw Errors.conflict('Cannot book an inactive resource');
      }

      if (ticketId) {
        const [tRows] = await conn.execute('SELECT id FROM tickets WHERE id = ?', [ticketId]);
        if (!tRows[0]) {
          throw Errors.notFound('Referenced ticket not found');
        }
      }

      const [countRows] = await conn.execute(
        `SELECT COUNT(*) AS active_count
         FROM bookings
         WHERE user_id = ?
           AND status IN ('PENDING', 'APPROVED')
           AND start_time > UTC_TIMESTAMP(3)`,
        [userId]
      );
      if (Number(countRows[0].active_count) >= 3) {
        throw Errors.conflict('Maximum of 3 future PENDING or APPROVED bookings allowed per user');
      }

      const startSql = toMysqlUtc(startTime);
      const endSql = toMysqlUtc(endTime);

      const [overlapRows] = await conn.execute(
        `SELECT id FROM bookings
         WHERE resource_id = ?
           AND status IN ('PENDING', 'APPROVED')
           AND start_time < ?
           AND end_time > ?
         LIMIT 1`,
        [resourceId, endSql, startSql]
      );
      if (overlapRows.length > 0) {
        throw Errors.conflict('Selected time slot overlaps with an existing booking');
      }

      const id = crypto.randomUUID();
      await conn.execute(
        `INSERT INTO bookings (id, resource_id, user_id, ticket_id, start_time, end_time, purpose, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [id, resourceId, userId, ticketId, startSql, endSql, purpose]
      );

      const [insertedRows] = await conn.execute('SELECT * FROM bookings WHERE id = ?', [id]);
      return mapBooking(insertedRows[0]);
    });
  },

  async cancelBooking(bookingId, requester) {
    return withTransaction(async (conn) => {
      const [rows] = await conn.execute('SELECT * FROM bookings WHERE id = ? FOR UPDATE', [bookingId]);
      const booking = rows[0];
      if (!booking) throw Errors.notFound('Booking not found');
      if (booking.user_id !== requester.id) throw Errors.forbidden('Only the booking owner can cancel');

      if (!['PENDING', 'APPROVED'].includes(booking.status)) {
        throw Errors.conflict(`Cannot cancel booking in ${booking.status} status`);
      }
      const startMs = new Date(`${String(booking.start_time).replace(' ', 'T')}Z`).getTime();
      if (startMs <= Date.now()) {
        throw Errors.conflict('Cannot cancel a booking that has already started');
      }

      await conn.execute(`UPDATE bookings SET status = 'CANCELLED' WHERE id = ?`, [bookingId]);
      const [upd] = await conn.execute('SELECT * FROM bookings WHERE id = ?', [bookingId]);
      return mapBooking(upd[0]);
    });
  },

  async approveBooking(bookingId) {
    return withTransaction(async (conn) => {
      const [rows] = await conn.execute('SELECT * FROM bookings WHERE id = ? FOR UPDATE', [bookingId]);
      const booking = rows[0];
      if (!booking) throw Errors.notFound('Booking not found');

      if (booking.status !== 'PENDING') {
        throw Errors.conflict(`Cannot approve booking in ${booking.status} status`);
      }
      const startMs = new Date(`${String(booking.start_time).replace(' ', 'T')}Z`).getTime();
      if (startMs <= Date.now()) {
        throw Errors.conflict('Cannot approve a booking whose startTime is in the past');
      }

      await conn.execute(`UPDATE bookings SET status = 'APPROVED' WHERE id = ?`, [bookingId]);
      const [upd] = await conn.execute('SELECT * FROM bookings WHERE id = ?', [bookingId]);
      return mapBooking(upd[0]);
    });
  },

  async rejectBooking(bookingId, note) {
    const cleanNote = typeof note === 'string' ? note.trim() : '';
    if (cleanNote.length < 5 || cleanNote.length > 200) {
      throw Errors.validation('Rejection note is required (5-200 characters)');
    }

    return withTransaction(async (conn) => {
      const [rows] = await conn.execute('SELECT * FROM bookings WHERE id = ? FOR UPDATE', [bookingId]);
      const booking = rows[0];
      if (!booking) throw Errors.notFound('Booking not found');

      if (booking.status !== 'PENDING') {
        throw Errors.conflict(`Cannot reject booking in ${booking.status} status`);
      }
      const startMs = new Date(`${String(booking.start_time).replace(' ', 'T')}Z`).getTime();
      if (startMs <= Date.now()) {
        throw Errors.conflict('Cannot reject a booking whose startTime is in the past');
      }

      await conn.execute(`UPDATE bookings SET status = 'REJECTED', decision_note = ? WHERE id = ?`, [cleanNote, bookingId]);
      const [upd] = await conn.execute('SELECT * FROM bookings WHERE id = ?', [bookingId]);
      return mapBooking(upd[0]);
    });
  }
};
