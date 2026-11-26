import dotenv from 'dotenv';
dotenv.config();

export const env = {
  port: Number(process.env.PORT) || 5000,
  databaseUrl: process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/triagesync',
  jwtSecret: process.env.JWT_SECRET || 'dev_fallback_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  corsOrigin: process.env.CORS_ORIGIN || '*'
};
