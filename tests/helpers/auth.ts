import jwt from 'jsonwebtoken';

export const JWT_SECRET = 'test-secret';

export function tokenFor(id: string | number, secret = JWT_SECRET): string {
  return jwt.sign({ id }, secret, { algorithm: 'HS256', expiresIn: '1h' });
}

export function bearer(id: string | number): string {
  return `Bearer ${tokenFor(id)}`;
}
