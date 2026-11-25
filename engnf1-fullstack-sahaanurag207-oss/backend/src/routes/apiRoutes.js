import { Router } from 'express';
import { requireAuth, requireAdmin } from './middleware.js';
import { authController } from '../controllers/authController.js';
import { ticketController } from '../controllers/ticketController.js';
import { resourceController } from '../controllers/resourceController.js';
import { bookingController } from '../controllers/bookingController.js';

const router = Router();

router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.get('/auth/me', requireAuth, authController.me);

router.post('/tickets/import', requireAuth, ticketController.importTickets);
router.get('/tickets', requireAuth, ticketController.listTickets);
router.get('/tickets/:id', requireAuth, ticketController.getTicket);
router.patch('/tickets/:id', requireAuth, ticketController.patchTicket);
router.get('/stats', requireAuth, ticketController.stats);

router.get('/resources', requireAuth, resourceController.list);
router.get('/resources/:id', requireAuth, resourceController.getById);
router.post('/resources', requireAuth, requireAdmin, resourceController.create);
router.patch('/resources/:id', requireAuth, requireAdmin, resourceController.patch);
router.get('/resources/:id/availability', requireAuth, resourceController.availability);

router.post('/bookings', requireAuth, bookingController.create);
router.get('/bookings/mine', requireAuth, bookingController.mine);
router.get('/bookings/:id', requireAuth, bookingController.getById);
router.get('/bookings', requireAuth, requireAdmin, bookingController.listAll);
router.patch('/bookings/:id/cancel', requireAuth, bookingController.cancel);
router.patch('/bookings/:id/approve', requireAuth, requireAdmin, bookingController.approve);
router.patch('/bookings/:id/reject', requireAuth, requireAdmin, bookingController.reject);

router.get('/admin/stats', requireAuth, requireAdmin, bookingController.adminStats);

export default router;
