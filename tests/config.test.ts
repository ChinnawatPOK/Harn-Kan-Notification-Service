import { loadConfig } from '../src/config/env';

const VALID = {
  MONGO_URI: 'mongodb://localhost/test',
  RABBITMQ_HOST: 'localhost',
  RABBITMQ_PORT: '5672',
  RABBITMQ_USER: 'user',
  RABBITMQ_PASSWORD: 'password',
  JWT_SECRET: 'secret',
  USER_SERVICE_URL: 'http://localhost:3000',
};

describe('loadConfig', () => {
  it('requires USER_SERVICE_URL', () => {
    const { USER_SERVICE_URL: _omitted, ...env } = VALID;

    expect(() => loadConfig(env)).toThrow('USER_SERVICE_URL');
  });

  it('reads USER_SERVICE_URL', () => {
    expect(loadConfig(VALID).userService).toEqual({ url: 'http://localhost:3000' });
  });
});
