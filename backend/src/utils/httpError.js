/**
 * An error whose message is SAFE to send to the client (e.g. "Invalid password").
 * Anything thrown that is not an HttpError is treated as unexpected and returned
 * to the client as a generic 500 — internal details never leak.
 */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.expose = true;
  }
}
