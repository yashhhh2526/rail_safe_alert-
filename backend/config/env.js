require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 5000;

// Enforce JWT secret security in production while allowing seamless local dev
const JWT_SECRET = process.env.JWT_SECRET || (
  NODE_ENV === 'production' 
    ? (() => { throw new Error('JWT_SECRET must be set in production'); })()
    : 'railsafe_dev_jwt_secret_key_change_in_production'
);

const config = {
  NODE_ENV,
  PORT,
  JWT_SECRET,
  RAILRADAR_API_KEY: process.env.RAILRADAR_API_KEY || '',
  DATABASE_URL: process.env.DATABASE_URL || '',
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  DB_NAME: process.env.DB_NAME || 'railsafe',
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
};

module.exports = config;
