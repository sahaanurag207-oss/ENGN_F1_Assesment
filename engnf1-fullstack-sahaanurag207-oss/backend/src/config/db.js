import mysql from 'mysql2/promise';
import { env } from './env.js';

export const pool = mysql.createPool({
  uri: env.databaseUrl,
  waitForConnections: true,
  connectionLimit: 25,
  queueLimit: 0,
  timezone: 'Z',
  multipleStatements: true
});
