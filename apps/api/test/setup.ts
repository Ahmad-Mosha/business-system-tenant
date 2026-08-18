import { loadDotEnv } from '../src/config/load-dotenv.js';

loadDotEnv();

/**
 * Tests must never touch the development database. Pointing DATABASE_URL at the test
 * database here - before any application module is imported - is what guarantees it.
 */
if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL is required to run tests (see .env.example)');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
