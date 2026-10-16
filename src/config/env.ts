export interface Config {
  port: number;
  mongoUri: string;
  rabbit: {
    host: string;
    port: number;
    user: string;
    password: string;
  };
  jwtSecret: string;
}

const REQUIRED = [
  'MONGO_URI',
  'RABBITMQ_HOST',
  'RABBITMQ_PORT',
  'RABBITMQ_USER',
  'RABBITMQ_PASSWORD',
  'JWT_SECRET',
] as const;

/** Reads config from env and fails fast if anything required is missing. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const missing = REQUIRED.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    port: toPort('PORT', env.PORT ?? '3002'),
    mongoUri: env.MONGO_URI!,
    rabbit: {
      host: env.RABBITMQ_HOST!,
      port: toPort('RABBITMQ_PORT', env.RABBITMQ_PORT!),
      user: env.RABBITMQ_USER!,
      password: env.RABBITMQ_PASSWORD!,
    },
    jwtSecret: env.JWT_SECRET!,
  };
}

function toPort(name: string, value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`${name} must be a valid port number, got "${value}"`);
  }
  return port;
}
