import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../errors';

/**
 * Verifies the JWT itself (User Service is only called at login).
 * Token comes from `Authorization: Bearer` first, then cookie `token`.
 * HS256 only; the user id is the claim `id` and is set on `req.userId`.
 */
export function requireAuth(jwtSecret: string): RequestHandler {
  return (req, _res, next) => {
    const token = readToken(req.headers.authorization, req.cookies?.token);
    if (!token) throw new UnauthorizedError();

    let payload: string | jwt.JwtPayload;
    try {
      payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedError();
    }

    const id = typeof payload === 'object' ? payload.id : undefined;
    if ((typeof id !== 'string' && typeof id !== 'number') || id === '') {
      throw new UnauthorizedError('Token has no user id');
    }

    req.userId = String(id);
    next();
  };
}

function readToken(authorization: string | undefined, cookie: unknown): string | undefined {
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length).trim();
    if (token) return token;
  }
  return typeof cookie === 'string' && cookie ? cookie : undefined;
}
