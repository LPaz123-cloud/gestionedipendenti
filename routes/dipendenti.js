const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const multer = require('multer');
const db = require('../src/db');
const { DEFAULT_CHECKLIST } = require('../src/checklistTemplate');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', 'uploads', 'documenti');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

function getEmployeeOr404(req, res) {
  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!emp) {
    res.status(404).send('Dipendente/candidato non trovato');
    return null;
  }
  return emp;
}

// Elenco
router.get('/', (req, res) => {
  const stato = req.query.stato || '';
  const azienda = req.query.azienda || '';
  const clauses = [];
  const params = [];
  if (stato) { clauses.push('e.stato = ?'); params.push(stato); }
  if (azienda) { clauses.push('e.azienda_id = ?'); params.push(azienda); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const rows = db
    .prepare(
      `SELECT e.*, c.nome AS azienda_nome FROM employees e
       LEFT JOIN companies c ON c.id = e.azienda_id
       ${where} ORDER BY e.cognome, e.nome`
    )
    .all(...params);

  const aziende = db.prepare('SELECT * FROM companies ORDER BY nome').all();

  res.render('dipendenti/list', {
    title: 'Anagrafica', employees: rows, statoFiltro: stato, aziendaFiltro: azienda, aziende,
  });
});

// Nuovo - form
router.get('/nuovo', (req, res) => {
  const aziende = db.prepare('SELECT * FROM companies ORDER BY nome').all();
  res.render('dipendenti/form', { title: 'Nuovo candidato/dipendente', employee: null, aziende });
});

// Nuovo - salva
router.post('/', (req, res) => {
  const b = req.body;
  const info = db
    .prepare(
      `INSERT INTO employees
        (azienda_id, nome, cognome, email, telefono, ruolo, dipartimento, tipo_contratto, stato,
         data_candidatura, data_assunzione, data_fine_contratto, stipendio_lordo, iban, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      b.azienda_id || null, b.nome, b.cognome, b.email || null, b.telefono || null, b.ruolo || null, b.dipartimento || null,
      b.tipo_contratto || null, b.stato || 'candidato', b.data_candidatura || null,
      b.data_assunzione || null, b.data_fine_contratto || null,
      b.stipendio_lordo ? Number(b.stipendio_lordo) : null, b.iban || null, b.note || null
    );

  const employeeId = info.lastInsertRowid;

  if (b.crea_checklist === 'on') {
    const stmt = db.prepare(
      'INSERT INTO checklist_items (employee_id, testo, ordine) VALUES (?, ?, ?)'
    );
    DEFAULT_CHECKLIST.forEach((testo, i) => stmt.run(employeeId, testo, i));
  }

  if (b.data_assunzione) {
    db.prepare(
      "INSERT INTO calendar_events (titolo, tipo, data, employee_id, note) VALUES (?, 'inizio_contratto', ?, ?, ?)"
    ).run(`Inizio contratto: ${b.nome} ${b.cognome}`, b.data_assunzione, employeeId, null);
  }

  res.redirect(`/dipendenti/${employeeId}`);
});

// Dettaglio
router.get('/:id', (req, res) => {
  const emp = getEmployeeOr404(req, res);
  if (!emp) return;

  const azienda = emp.azienda_id
    ? db.prepare('SELECT * FROM companies WHERE id = ?').get(emp.azienda_id)
    : null;
  const documents = db
    .prepare('SELECT * FROM documents WHERE employee_id = ? ORDER BY uploaded_at DESC')
    .all(emp.id);
  const checklist = db
    .prepare('SELECT * FROM checklist_items WHERE employee_id = ? ORDER BY ordine, id')
    .all(emp.id);
  const payroll = db
    .prepare('SELECT * FROM payroll WHERE employee_id = ? ORDER BY anno DESC, mese DESC')
    .all(emp.id);
  const events = db
    .prepare('SELECT * FROM calendar_events WHERE employee_id = ? ORDER BY data DESC')
    .all(emp.id);

  res.render('dipendenti/detail', {
    title: `${emp.nome} ${emp.cognome}`,
    employee: emp, azienda, documents, checklist, payroll, events,
  });
});

// Modifica - form
router.get('/:id/modifica', (req, res) => {
  const emp = getEmployeeOr404(req, res);
  if (!emp) return;
  const aziende = db.prepare('SELECT * FROM companies ORDER BY nome').all();
  res.render('dipendenti/form', { title: 'Modifica scheda', employee: emp, aziende });
});

// Modifica - salva
router.post('/:id', (req, res) => {
  const emp = getEmployeeOr404(req, res);
  if (!emp) return;
  const b = req.body;

  db.prepare(
    `UPDATE employees SET azienda_id=?, nome=?, cognome=?, email=?, telefono=?, ruolo=?, dipartimento=?,
      tipo_contratto=?, stato=?, data_candidatura=?, data_assunzione=?, data_fine_contratto=?,
      stipendio_lordo=?, iban=?, note=? WHERE id=?`
  ).run(
    b.azienda_id || null, b.nome, b.cognome, b.email || null, b.telefono || null, b.ruolo || null, b.dipartimento || null,
    b.tipo_contratto || null, b.stato || 'candidato', b.data_candidatura || null,
    b.data_assunzione || null, b.data_fine_contratto || null,
    b.stipendio_lordo ? Number(b.stipendio_lordo) : null, b.iban || null, b.note || null,
    emp.id
  );

  res.redirect(`/dipendenti/${emp.id}`);
});

// Elimina
router.post('/:id/elimina', (req, res) => {
  const emp = getEmployeeOr404(req, res);
  if (!emp) return;

  const docs = db.prepare('SELECT filename FROM documents WHERE employee_id = ?').all(emp.id);
  docs.forEach((d) => {
    const p = path.join(uploadsDir, d.filename);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });

  db.prepare('DELETE FROM employees WHERE id = ?').run(emp.id);
  res.redirect('/dipendenti');
});

// --- Checklist ---

router.post('/:id/checklist', (req, res) => {
  const emp = getEmployeeOr404(req, res);
  if (!emp) return;
  const maxOrdine = db
    .prepare('SELECT COALESCE(MAX(ordine), -1) AS m FROM checklist_items WHERE employee_id = ?')
    .get(emp.id).m;
  db.prepare('INSERT INTO checklist_items (employee_id, testo, scadenza, ordine) VALUES (?, ?, ?, ?)').run(
    emp.id, req.body.testo, req.body.scadenza || null, maxOrdine + 1
  );
  res.redirect(`/dipendenti/${emp.id}`);
});

router.post('/:id/checklist/:itemId/toggle', (req, res) => {
  const item = db
    .prepare('SELECT * FROM checklist_items WHERE id = ? AND employee_id = ?')
    .get(req.params.itemId, req.params.id);
  if (!item) return res.status(404).send('Voce non trovata');
  db.prepare('UPDATE checklist_items SET completato = ? WHERE id = ?').run(item.completato ? 0 : 1, item.id);
  res.redirect(`/dipendenti/${req.params.id}`);
});

router.post('/:id/checklist/:itemId/elimina', (req, res) => {
  db.prepare('DELETE FROM checklist_items WHERE id = ? AND employee_id = ?').run(
    req.params.itemId, req.params.id
  );
  res.redirect(`/dipendenti/${req.params.id}`);
});

// --- Documenti ---

router.post('/:id/documenti', upload.single('documento'), (req, res) => {
  const emp = getEmployeeOr404(req, res);
  if (!emp) return;
  if (!req.file) return res.redirect(`/dipendenti/${emp.id}`);

  db.prepare(
    'INSERT INTO documents (employee_id, tipo, original_name, filename) VALUES (?, ?, ?, ?)'
  ).run(emp.id, req.body.tipo || 'altro', req.file.originalname, req.file.filename);

  res.redirect(`/dipendenti/${emp.id}`);
});

router.get('/:id/documenti/:docId/scarica', (req, res) => {
  const doc = db
    .prepare('SELECT * FROM documents WHERE id = ? AND employee_id = ?')
    .get(req.params.docId, req.params.id);
  if (!doc) return res.status(404).send('Documento non trovato');
  res.download(path.join(uploadsDir, doc.filename), doc.original_name);
});

router.post('/:id/documenti/:docId/elimina', (req, res) => {
  const doc = db
    .prepare('SELECT * FROM documents WHERE id = ? AND employee_id = ?')
    .get(req.params.docId, req.params.id);
  if (doc) {
    const p = path.join(uploadsDir, doc.filename);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    db.prepare('DELETE FROM documents WHERE id = ?').run(doc.id);
  }
  res.redirect(`/dipendenti/${req.params.id}`);
});

module.exports = router;
