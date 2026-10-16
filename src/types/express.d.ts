declare global {
  namespace Express {
    interface Request {
      /** Set by the auth middleware from the JWT claim `id`. */
      userId?: string;
    }
  }
}

export {};
