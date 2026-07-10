import { ZodError } from 'zod';
import { HttpError } from '../utils/httpError.js';
import { logger } from '../utils/logger.js';

export function notFound(req, res) {
  res.status(404).json({ success: false, error: 'Not found' });
}

/* eslint-disable no-unused-vars */
// Central error handler. Safe (HttpError/Zod) messages pass through; everything
// else is logged in full server-side and returned as a generic 500 — no stack
// traces, DB errors, or file paths reach the client.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) {
    return res.status(err.status).json({ success: false, error: err.message });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ success: false, error: 'Invalid request data' });
  }

  logger.error(err);
  return res.status(500).json({ success: false, error: 'An internal server error occurred. Please try again later.' });
}
