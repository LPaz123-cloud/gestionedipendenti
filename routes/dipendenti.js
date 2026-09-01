const express = require('express');
const multer = require('multer');
const { pool } = require('../src/db');
const { DEFAULT_CHECKLIST } = require('../src/checklistTemplate');

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

async function getEmployeeOr404(req, res) {
  const { rows } = await pool.query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
  const emp = rows[0];
  if (!emp) {
    res.status(404).send('Dipendente/candidato non trovato');
    return null;
  }
  return emp;
}

// Elenco
router.get('/', async (req, res, next) => {
  try {
    const stato = req.query.stato || '';
    const azienda = req.query.azienda || '';
    const clauses = [];
    const params = [];
    if (stato) { params.push(stato); clauses.push(`e.stato = $${params.length}`); }
    if (azienda) { params.push(azienda); clauses.push(`e.azienda_id = $${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT e.*, c.nome AS azienda_nome FROM employees e
       LEFT JOIN companies c ON c.id = e.azienda_id
       ${where} ORDER BY e.cognome, e.nome`,
      params
    );

    const { rows: aziende } = await pool.query('SELECT * FROM companies ORDER BY nome');

    res.render('dipendenti/list', {
      title: 'Anagrafica', employees: rows, statoFiltro: stato, aziendaFiltro: azienda, aziende,
    });
  } catch (err) {
    next(err);
  }
});

// Nuovo - form
router.get('/nuovo', async (req, res, next) => {
  try {
    const { rows: aziende } = await pool.query('SELECT * FROM companies ORDER BY nome');
    res.render('dipendenti/form', { title: 'Nuovo candidato/dipendente', employee: null, aziende });
  } catch (err) {
    next(err);
  }
});

// Nuovo - salva
router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    const { rows } = await pool.query(
      `INSERT INTO employees
        (azienda_id, nome, cognome, email, telefono, ruolo, dipartimento, tipo_contratto, stato,
         data_candidatura, data_assunzione, data_fine_contratto, stipendio_lordo, iban, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id`,
      [
        b.azienda_id || null, b.nome, b.cognome, b.email || null, b.telefono || null, b.ruolo || null, b.dipartimento || null,
        b.tipo_contratto || null, b.stato || 'candidato', b.data_candidatura || null,
        b.data_assunzione || null, b.data_fine_contratto || null,
        b.stipendio_lordo ? Number(b.stipendio_lordo) : null, b.iban || null, b.note || null,
      ]
    );

    const employeeId = rows[0].id;

    if (b.crea_checklist === 'on') {
      let ordine = 0;
      for (const testo of DEFAULT_CHECKLIST) {
        await pool.query(
          'INSERT INTO checklist_items (employee_id, testo, ordine) VALUES ($1, $2, $3)',
          [employeeId, testo, ordine++]
        );
      }
    }

    if (b.data_assunzione) {
      await pool.query(
        "INSERT INTO calendar_events (titolo, tipo, data, employee_id, note) VALUES ($1, 'inizio_contratto', $2, $3, $4)",
        [`Inizio contratto: ${b.nome} ${b.cognome}`, b.data_assunzione, employeeId, null]
      );
    }

    res.redirect(`/dipendenti/${employeeId}`);
  } catch (err) {
    next(err);
  }
});

// Dettaglio
router.get('/:id', async (req, res, next) => {
  try {
    const emp = await getEmployeeOr404(req, res);
    if (!emp) return;

    const azienda = emp.azienda_id
      ? (await pool.query('SELECT * FROM companies WHERE id = $1', [emp.azienda_id])).rows[0]
      : null;
    const { rows: documents } = await pool.query(
      'SELECT id, employee_id, tipo, original_name, mimetype, uploaded_at FROM documents WHERE employee_id = $1 ORDER BY uploaded_at DESC',
      [emp.id]
    );
    const { rows: checklist } = await pool.query(
      'SELECT * FROM checklist_items WHERE employee_id = $1 ORDER BY ordine, id',
      [emp.id]
    );
    const { rows: payroll } = await pool.query(
      'SELECT id, employee_id, anno, mese, importo_lordo, importo_netto, data_bonifico, stato, busta_original_name, note FROM payroll WHERE employee_id = $1 ORDER BY anno DESC, mese DESC',
      [emp.id]
    );
    const { rows: events } = await pool.query(
      'SELECT * FROM calendar_events WHERE employee_id = $1 ORDER BY data DESC',
      [emp.id]
    );

    res.render('dipendenti/detail', {
      title: `${emp.nome} ${emp.cognome}`,
      employee: emp, azienda, documents, checklist, payroll, events,
    });
  } catch (err) {
    next(err);
  }
});

// Modifica - form
router.get('/:id/modifica', async (req, res, next) => {
  try {
    const emp = await getEmployeeOr404(req, res);
    if (!emp) return;
    const { rows: aziende } = await pool.query('SELECT * FROM companies ORDER BY nome');
    res.render('dipendenti/form', { title: 'Modifica scheda', employee: emp, aziende });
  } catch (err) {
    next(err);
  }
});

// Modifica - salva
router.post('/:id', async (req, res, next) => {
  try {
    const emp = await getEmployeeOr404(req, res);
    if (!emp) return;
    const b = req.body;

    await pool.query(
      `UPDATE employees SET azienda_id=$1, nome=$2, cognome=$3, email=$4, telefono=$5, ruolo=$6, dipartimento=$7,
        tipo_contratto=$8, stato=$9, data_candidatura=$10, data_assunzione=$11, data_fine_contratto=$12,
        stipendio_lordo=$13, iban=$14, note=$15 WHERE id=$16`,
      [
        b.azienda_id || null, b.nome, b.cognome, b.email || null, b.telefono || null, b.ruolo || null, b.dipartimento || null,
        b.tipo_contratto || null, b.stato || 'candidato', b.data_candidatura || null,
        b.data_assunzione || null, b.data_fine_contratto || null,
        b.stipendio_lordo ? Number(b.stipendio_lordo) : null, b.iban || null, b.note || null,
        emp.id,
      ]
    );

    res.redirect(`/dipendenti/${emp.id}`);
  } catch (err) {
    next(err);
  }
});

// Elimina
router.post('/:id/elimina', async (req, res, next) => {
  try {
    const emp = await getEmployeeOr404(req, res);
    if (!emp) return;
    await pool.query('DELETE FROM employees WHERE id = $1', [emp.id]);
    res.redirect('/dipendenti');
  } catch (err) {
    next(err);
  }
});

// --- Checklist ---

router.post('/:id/checklist', async (req, res, next) => {
  try {
    const emp = await getEmployeeOr404(req, res);
    if (!emp) return;
    const { rows } = await pool.query(
      'SELECT COALESCE(MAX(ordine), -1) AS m FROM checklist_items WHERE employee_id = $1',
      [emp.id]
    );
    await pool.query(
      'INSERT INTO checklist_items (employee_id, testo, scadenza, ordine) VALUES ($1, $2, $3, $4)',
      [emp.id, req.body.testo, req.body.scadenza || null, rows[0].m + 1]
    );
    res.redirect(`/dipendenti/${emp.id}`);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/checklist/:itemId/toggle', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM checklist_items WHERE id = $1 AND employee_id = $2',
      [req.params.itemId, req.params.id]
    );
    const item = rows[0];
    if (!item) return res.status(404).send('Voce non trovata');
    await pool.query('UPDATE checklist_items SET completato = $1 WHERE id = $2', [!item.completato, item.id]);
    res.redirect(`/dipendenti/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/checklist/:itemId/elimina', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM checklist_items WHERE id = $1 AND employee_id = $2', [
      req.params.itemId, req.params.id,
    ]);
    res.redirect(`/dipendenti/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

// --- Documenti ---

router.post('/:id/documenti', upload.single('documento'), async (req, res, next) => {
  try {
    const emp = await getEmployeeOr404(req, res);
    if (!emp) return;
    if (!req.file) return res.redirect(`/dipendenti/${emp.id}`);

    await pool.query(
      'INSERT INTO documents (employee_id, tipo, original_name, mimetype, content) VALUES ($1, $2, $3, $4, $5)',
      [emp.id, req.body.tipo || 'altro', req.file.originalname, req.file.mimetype, req.file.buffer]
    );

    res.redirect(`/dipendenti/${emp.id}`);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/documenti/:docId/scarica', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM documents WHERE id = $1 AND employee_id = $2',
      [req.params.docId, req.params.id]
    );
    const doc = rows[0];
    if (!doc) return res.status(404).send('Documento non trovato');
    res.set('Content-Type', doc.mimetype || 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.original_name)}"`);
    res.send(doc.content);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/documenti/:docId/elimina', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM documents WHERE id = $1 AND employee_id = $2', [
      req.params.docId, req.params.id,
    ]);
    res.redirect(`/dipendenti/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
