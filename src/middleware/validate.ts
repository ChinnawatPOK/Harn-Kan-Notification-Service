import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { parseOrThrow } from '../dto/parse';

export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    req.body = parseOrThrow(schema, req.body);
    next();
  };
}
