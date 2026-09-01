const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

if (!process.env.DATABASE_URL) {
  throw new Error(
    'Variabile DATABASE_URL mancante. Imposta la stringa di connessione Postgres (es. quella di Supabase) nel file .env.'
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      partita_iva TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS')
    );

    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      azienda_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      nome TEXT NOT NULL,
      cognome TEXT NOT NULL,
      email TEXT,
      telefono TEXT,
      ruolo TEXT,
      dipartimento TEXT,
      tipo_contratto TEXT,
      stato TEXT NOT NULL DEFAULT 'candidato',
      data_candidatura TEXT,
      data_assunzione TEXT,
      data_fine_contratto TEXT,
      stipendio_lordo NUMERIC,
      iban TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS')
    );

    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mimetype TEXT,
      content BYTEA NOT NULL,
      uploaded_at TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS')
    );

    CREATE TABLE IF NOT EXISTS checklist_items (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      testo TEXT NOT NULL,
      completato BOOLEAN NOT NULL DEFAULT false,
      scadenza TEXT,
      ordine INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS')
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id SERIAL PRIMARY KEY,
      titolo TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'altro',
      data TEXT NOT NULL,
      ora TEXT,
      employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS')
    );

    CREATE TABLE IF NOT EXISTS payroll (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      anno INTEGER NOT NULL,
      mese INTEGER NOT NULL,
      importo_lordo NUMERIC,
      importo_netto NUMERIC,
      data_bonifico TEXT,
      stato TEXT NOT NULL DEFAULT 'da_pagare',
      busta_content BYTEA,
      busta_original_name TEXT,
      busta_mimetype TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS'),
      UNIQUE(employee_id, anno, mese)
    );
  `);

  const { rows: userRows } = await pool.query('SELECT COUNT(*)::int AS c FROM users');
  if (userRows[0].c === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin';
    const hash = bcrypt.hashSync(password, 10);
    await pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [username, hash]);
    console.log(`Utente amministratore creato: ${username}`);
  }

  const { rows: companyRows } = await pool.query('SELECT COUNT(*)::int AS c FROM companies');
  if (companyRows[0].c === 0) {
    await pool.query('INSERT INTO companies (nome) VALUES ($1)', ['Azienda principale']);
  }
}

module.exports = { pool, init };
