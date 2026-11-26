import { resourceModel } from '../model/resourceModel.js';
import { bookingModel } from '../model/bookingModel.js';
import {
  assertUuid,
  validateResourceCreate,
  validateResourcePatch,
  RESOURCE_TYPES
} from '../validators/schemas.js';
import { Errors } from '../utils/AppError.js';

export const resourceController = {
  async list(req, res, next) {
    try {
      const { search, type, minCapacity } = req.query;
      const page = req.query.page ? Number(req.query.page) : 1;

      if (type && !RESOURCE_TYPES.includes(type)) throw Errors.validation('Invalid resource type');
      if (!Number.isInteger(page) || page < 1) throw Errors.validation('page must be a positive integer');

      let parsedCap;
      if (minCapacity !== undefined && minCapacity !== '') {
        parsedCap = Number(minCapacity);
        if (!Number.isInteger(parsedCap) || parsedCap < 1) {
          throw Errors.validation('minCapacity must be a positive integer');
        }
      }

      const result = await resourceModel.list({
        search,
        type,
        minCapacity: parsedCap,
        page,
        pageSize: 10,
        includeInactive: req.user.role === 'ADMIN'
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      assertUuid(req.params.id, 'resource id');
      const resource = await resourceModel.findById(req.params.id);
      if (!resource || (!resource.isActive && req.user.role !== 'ADMIN')) {
        throw Errors.notFound('Resource not found');
      }
      res.status(200).json(resource);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const payload = validateResourceCreate(req.body);
      const resource = await resourceModel.create(payload);
      res.status(201).json(resource);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return next(Errors.conflict('A resource with this name already exists'));
      }
      next(err);
    }
  },

  async patch(req, res, next) {
    try {
      assertUuid(req.params.id, 'resource id');
      const patch = validateResourcePatch(req.body);
      const updated = await resourceModel.update(req.params.id, patch);
      if (!updated) throw Errors.notFound('Resource not found');
      res.status(200).json(updated);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return next(Errors.conflict('A resource with this name already exists'));
      }
      next(err);
    }
  },

  async availability(req, res, next) {
    try {
      assertUuid(req.params.id, 'resource id');
      const from = new Date(req.query.from);
      const to = new Date(req.query.to);

      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
        throw Errors.validation('Valid ISO UTC from and to query params are required (to > from)');
      }
      if (to.getTime() - from.getTime() > 7 * 24 * 60 * 60 * 1000) {
        throw Errors.validation('Availability query range cannot exceed 7 days');
      }

      const resource = await resourceModel.findById(req.params.id);
      if (!resource || (!resource.isActive && req.user.role !== 'ADMIN')) {
        throw Errors.notFound('Resource not found');
      }

      const bookings = await bookingModel.getAvailability(req.params.id, from.toISOString(), to.toISOString());
      res.status(200).json({
        resourceId: resource.id,
        from: from.toISOString(),
        to: to.toISOString(),
        bookings
      });
    } catch (err) {
      next(err);
    }
  }
};
