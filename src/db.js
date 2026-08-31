const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'gestionale.db'));

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    partita_iva TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    stipendio_lordo REAL,
    iban TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    original_name TEXT NOT NULL,
    filename TEXT NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS checklist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    testo TEXT NOT NULL,
    completato INTEGER NOT NULL DEFAULT 0,
    scadenza TEXT,
    ordine INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titolo TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'altro',
    data TEXT NOT NULL,
    ora TEXT,
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS payroll (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    anno INTEGER NOT NULL,
    mese INTEGER NOT NULL,
    importo_lordo REAL,
    importo_netto REAL,
    data_bonifico TEXT,
    stato TEXT NOT NULL DEFAULT 'da_pagare',
    busta_filename TEXT,
    busta_original_name TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(employee_id, anno, mese)
  );
`);

// Migrazione: aggiunge azienda_id a installazioni esistenti senza la colonna
const employeeColumns = db.prepare("PRAGMA table_info(employees)").all().map((c) => c.name);
if (!employeeColumns.includes('azienda_id')) {
  db.exec('ALTER TABLE employees ADD COLUMN azienda_id INTEGER REFERENCES companies(id) ON DELETE SET NULL');
}

function seedDefaultCompany() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM companies').get().c;
  if (count > 0) return;
  db.prepare('INSERT INTO companies (nome) VALUES (?)').run('Azienda principale');
}

seedDefaultCompany();

function seedAdminUser() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count > 0) return;

  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin';
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
  console.log(`Utente amministratore creato: ${username}`);
}

seedAdminUser();

module.exports = db;
