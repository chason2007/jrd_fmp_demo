import { HttpError } from '../utils/httpError.js';

/**
 * Validate req.body against a Zod schema. On success, replaces req.body with the
 * parsed/typed result (unknown keys rejected by `.strict()` schemas → blocks
 * mass-assignment). On failure, returns a 400 with a safe, field-level message.
 */
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path?.join('.') || 'body';
    return next(new HttpError(400, first ? `${where}: ${first.message}` : 'Invalid request body'));
  }
  req.body = result.data;
  next();
};

/** Same as `validate`, but for route params (e.g. :id, :auditCode). */
export const validateParams = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.params);
  if (!result.success) {
    return next(new HttpError(400, 'Invalid request parameter'));
  }
  req.params = result.data;
  next();
};
