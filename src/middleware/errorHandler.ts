import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../errors';

/** Shared error format: { code, message, timestamp }. */
function body(code: string, message: string) {
  return { code, message, timestamp: new Date().toISOString() };
}

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json(body('NOT_FOUND', `Route ${req.method} ${req.path} not found`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json(body(err.code, err.message));
    return;
  }

  // Malformed JSON body from express.json().
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json(body('VALIDATION_ERROR', 'Request body is not valid JSON'));
    return;
  }

  console.error('[http] unhandled error', err);
  res.status(500).json(body('INTERNAL_ERROR', 'Internal server error'));
};
