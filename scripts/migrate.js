require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

const dbUrl = (process.env.DATABASE_URL || '')
  .replace(/[?&]channel_binding=[^&]*/g, '')
  .replace(/&&/g, '&')
  .replace(/\?&/g, '?')
  .replace(/[?&]$/, '');

if (!dbUrl) {
  console.error('[migrate] DATABASE_URL não definida. Pulando migrations.');
  process.exit(0);
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function run() {
  const client = await pool.connect();
  try {
    // Tabela de controle de migrations
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL PRIMARY KEY,
        filename   TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT id FROM _migrations WHERE filename=$1', [file]
      );
      if (rows[0]) {
        console.log(`[migrate] ✓ ${file} (já aplicada)`);
        continue;
      }

      console.log(`[migrate] → Aplicando ${file}...`);
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO _migrations (filename) VALUES ($1)', [file]
        );
        await client.query('COMMIT');
        console.log(`[migrate] ✓ ${file} aplicada com sucesso`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[migrate] ✗ Erro em ${file}:`, err.message);
        process.exit(1);
      }
    }

    console.log('[migrate] Migrations concluídas.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('[migrate] Erro fatal:', err.message);
  process.exit(1);
});
