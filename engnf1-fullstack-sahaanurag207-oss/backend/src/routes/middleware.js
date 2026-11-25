import { verifyToken } from '../utils/authUtils.js';
import { Errors } from '../utils/AppError.js';

export function requireAuth(req, res, next) {
  const header = req.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) {
    return next(Errors.unauthenticated('Missing or malformed Bearer token'));
  }
  try {
    const decoded = verifyToken(header.slice(7));
    req.user = { id: decoded.sub, email: decoded.email, role: decoded.role };
    next();
  } catch {
    next(Errors.unauthenticated('Invalid or expired token'));
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return next(Errors.forbidden('Administrator privileges required'));
  }
  next();
}

export function errorHandler(err, req, res, next) {
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message }
    });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred' }
  });
}
