require('dotenv').config();
const { Pool } = require('pg');

const dbUrl = (process.env.DATABASE_URL || '')
  .replace(/[?&]channel_binding=[^&]*/g, '')
  .replace(/&&/g, '&')
  .replace(/\?&/g, '?')
  .replace(/[?&]$/, '');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

module.exports = pool;
