export class AppError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const Errors = {
  validation: (msg) => new AppError(400, 'VALIDATION_ERROR', msg),
  unauthenticated: (msg = 'Authentication required') => new AppError(401, 'UNAUTHENTICATED', msg),
  forbidden: (msg = 'Access denied') => new AppError(403, 'FORBIDDEN', msg),
  notFound: (msg = 'Resource not found') => new AppError(404, 'NOT_FOUND', msg),
  conflict: (msg = 'Operation conflicts with existing state') => new AppError(409, 'CONFLICT', msg)
};
