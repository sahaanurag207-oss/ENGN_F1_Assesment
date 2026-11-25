import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseUrl?.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 25,
  idleTimeoutMillis: 30000
});
