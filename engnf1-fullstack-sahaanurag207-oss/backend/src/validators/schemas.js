import { Errors } from '../utils/AppError.js';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const CATEGORIES = ['BILLING', 'BUG', 'FEATURE_REQUEST', 'LOGIN', 'DELIVERY'];
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
export const RESOURCE_TYPES = ['ROOM', 'LAB', 'EQUIPMENT'];
export const BOOKING_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

export function assertUuid(id, label = 'ID') {
  if (!id || !UUID_REGEX.test(id)) {
    throw Errors.validation(`Invalid ${label} format`);
  }
}

export function validateRegister(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (name.length < 2 || name.length > 50) {
    throw Errors.validation('Name must be between 2 and 50 characters');
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || email.length > 254 || !emailRegex.test(email)) {
    throw Errors.validation('Valid email up to 254 characters is required');
  }
  if (password.length < 8 || password.length > 64 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    throw Errors.validation('Password must be 8-64 characters with at least 1 letter and 1 digit');
  }
  return { name, email, password };
}

export function validateTicketImport(body) {
  if (!body || !Array.isArray(body.tickets) || body.tickets.length === 0) {
    throw Errors.validation('tickets array is required and must not be empty');
  }
  return body.tickets.map((t, idx) => {
    const externalId = typeof t?.externalId === 'string' ? t.externalId.trim() : '';
    const subject = typeof t?.subject === 'string' ? t.subject.trim() : '';
    const ticketBody = typeof t?.body === 'string' ? t.body.trim() : '';

    if (!externalId || externalId.length > 120) {
      throw Errors.validation(`Ticket at index ${idx}: externalId is required (1-120 chars)`);
    }
    if (subject.length < 3 || subject.length > 150) {
      throw Errors.validation(`Ticket ${externalId}: subject must be 3-150 characters`);
    }
    if (ticketBody.length < 5 || ticketBody.length > 2000) {
      throw Errors.validation(`Ticket ${externalId}: body must be 5-2000 characters`);
    }
    return { externalId, subject, body: ticketBody };
  });
}

export function validateTicketPatch(body) {
  const allowed = ['category', 'priority', 'status', 'assigneeId'];
  const keys = Object.keys(body || {}).filter((k) => allowed.includes(k));
  if (keys.length === 0) {
    throw Errors.validation('At least one updatable field (category, priority, status, assigneeId) is required');
  }

  const patch = {};
  if (body.category !== undefined) {
    if (!CATEGORIES.includes(body.category)) throw Errors.validation('Invalid ticket category');
    patch.category = body.category;
  }
  if (body.priority !== undefined) {
    if (!PRIORITIES.includes(body.priority)) throw Errors.validation('Invalid ticket priority');
    patch.priority = body.priority;
  }
  if (body.status !== undefined) {
    if (!TICKET_STATUSES.includes(body.status)) throw Errors.validation('Invalid ticket status');
    patch.status = body.status;
  }
  if (body.assigneeId !== undefined) {
    if (body.assigneeId !== null) {
      assertUuid(body.assigneeId, 'assigneeId');
    }
    patch.assigneeId = body.assigneeId;
  }
  return patch;
}

export function validateResourceCreate(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const type = body.type;
  const capacity = Number(body.capacity);
  const description = body.description !== undefined && body.description !== null ? String(body.description).trim() : null;

  if (name.length < 3 || name.length > 60) {
    throw Errors.validation('Resource name must be 3-60 characters');
  }
  if (!RESOURCE_TYPES.includes(type)) {
    throw Errors.validation('Resource type must be ROOM, LAB, or EQUIPMENT');
  }
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
    throw Errors.validation('Capacity must be an integer between 1 and 500');
  }
  if (description !== null && description.length > 300) {
    throw Errors.validation('Description must be at most 300 characters');
  }
  return { name, type, capacity, description };
}

export function validateResourcePatch(body) {
  const patch = {};
  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 3 || name.length > 60) throw Errors.validation('Resource name must be 3-60 characters');
    patch.name = name;
  }
  if (body.type !== undefined) {
    if (!RESOURCE_TYPES.includes(body.type)) throw Errors.validation('Invalid resource type');
    patch.type = body.type;
  }
  if (body.capacity !== undefined) {
    const cap = Number(body.capacity);
    if (!Number.isInteger(cap) || cap < 1 || cap > 500) throw Errors.validation('Capacity must be 1-500');
    patch.capacity = cap;
  }
  if (body.description !== undefined) {
    if (body.description === null) {
      patch.description = null;
    } else {
      const desc = String(body.description).trim();
      if (desc.length > 300) throw Errors.validation('Description must be <= 300 chars');
      patch.description = desc;
    }
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') throw Errors.validation('isActive must be boolean');
    patch.isActive = body.isActive;
  }
  if (Object.keys(patch).length === 0) {
    throw Errors.validation('No valid fields provided for update');
  }
  return patch;
}

export function validateBookingCreate(body) {
  assertUuid(body.resourceId, 'resourceId');
  if (body.ticketId !== undefined && body.ticketId !== null && body.ticketId !== '') {
    assertUuid(body.ticketId, 'ticketId');
  }

  const purpose = typeof body.purpose === 'string' ? body.purpose.trim() : '';
  if (purpose.length < 5 || purpose.length > 200) {
    throw Errors.validation('Purpose must be 5-200 characters');
  }

  const start = new Date(body.startTime);
  const end = new Date(body.endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw Errors.validation('startTime and endTime must be valid ISO 8601 UTC timestamps');
  }

  if (
    start.getUTCSeconds() !== 0 ||
    start.getUTCMilliseconds() !== 0 ||
    end.getUTCSeconds() !== 0 ||
    end.getUTCMilliseconds() !== 0 ||
    (start.getUTCMinutes() !== 0 && start.getUTCMinutes() !== 30) ||
    (end.getUTCMinutes() !== 0 && end.getUTCMinutes() !== 30)
  ) {
    throw Errors.validation('startTime and endTime must align to 00 or 30 UTC minutes with 0s/0ms');
  }

  const durationMins = (end.getTime() - start.getTime()) / 60000;
  if (durationMins < 30 || durationMins > 240) {
    throw Errors.validation('Booking duration must be between 30 and 240 minutes inclusive');
  }

  const now = Date.now();
  const maxAhead = now + 30 * 24 * 60 * 60 * 1000;
  if (start.getTime() <= now) {
    throw Errors.validation('startTime must be in the future');
  }
  if (start.getTime() > maxAhead) {
    throw Errors.validation('startTime cannot be more than 30 days ahead');
  }

  return {
    resourceId: body.resourceId,
    ticketId: body.ticketId || null,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    purpose
  };
}
