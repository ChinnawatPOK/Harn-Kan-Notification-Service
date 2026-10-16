/** An error that maps to an HTTP status and a stable error code. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Bad input. In HTTP it becomes a 400; in the consumer it means
 * "ack and drop", because redelivering the same message cannot fix it.
 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, 'VALIDATION_ERROR', message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Missing, invalid or expired token') {
    super(401, 'UNAUTHORIZED', message);
  }
}
