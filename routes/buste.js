const express = require('express');
const multer = require('multer');
const { pool } = require('../src/db');

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

// Vista mensile: bonifici/buste paga per tutti i dipendenti attivi
router.get('/', async (req, res, next) => {
  try {
    const now = new Date();
    const anno = parseInt(req.query.anno, 10) || now.getFullYear();
    const mese = parseInt(req.query.mese, 10) || now.getMonth() + 1;

    const azienda = req.query.azienda || '';
    const clauses = ["e.stato != 'candidato'"];
    const params = [];
    if (azienda) { params.push(azienda); clauses.push(`e.azienda_id = $${params.length}`); }

    const { rows: employees } = await pool.query(
      `SELECT e.*, c.nome AS azienda_nome FROM employees e
       LEFT JOIN companies c ON c.id = e.azienda_id
       WHERE ${clauses.join(' AND ')} ORDER BY e.cognome, e.nome`,
      params
    );

    const { rows: aziende } = await pool.query('SELECT * FROM companies ORDER BY nome');

    const { rows: payrollRows } = await pool.query(
      `SELECT id, employee_id, anno, mese, importo_lordo, importo_netto, data_bonifico, stato, busta_original_name, note
       FROM payroll WHERE anno = $1 AND mese = $2`,
      [anno, mese]
    );
    const payrollByEmployee = {};
    payrollRows.forEach((p) => (payrollByEmployee[p.employee_id] = p));

    const righe = employees.map((emp) => ({ employee: emp, payroll: payrollByEmployee[emp.id] || null }));

    let prevMese = mese - 1, prevAnno = anno;
    if (prevMese < 1) { prevMese = 12; prevAnno -= 1; }
    let nextMese = mese + 1, nextAnno = anno;
    if (nextMese > 12) { nextMese = 1; nextAnno += 1; }

    res.render('buste', {
      title: 'Buste paga',
      righe, anno, mese, meseLabel: MESI[mese - 1],
      prevAnno, prevMese, nextAnno, nextMese, aziende, aziendaFiltro: azienda,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:employeeId', upload.single('busta'), async (req, res, next) => {
  try {
    const b = req.body;
    const employeeId = req.params.employeeId;
    const anno = parseInt(b.anno, 10);
    const mese = parseInt(b.mese, 10);

    const { rows } = await pool.query(
      'SELECT * FROM payroll WHERE employee_id = $1 AND anno = $2 AND mese = $3',
      [employeeId, anno, mese]
    );
    const existing = rows[0];

    const importo_lordo = b.importo_lordo ? Number(b.importo_lordo) : null;
    const importo_netto = b.importo_netto ? Number(b.importo_netto) : null;
    const data_bonifico = b.data_bonifico || null;
    const stato = b.stato || 'da_pagare';
    const note = b.note || null;

    if (existing) {
      if (req.file) {
        await pool.query(
          `UPDATE payroll SET importo_lordo=$1, importo_netto=$2, data_bonifico=$3, stato=$4, note=$5,
            busta_content=$6, busta_original_name=$7, busta_mimetype=$8 WHERE id=$9`,
          [importo_lordo, importo_netto, data_bonifico, stato, note,
            req.file.buffer, req.file.originalname, req.file.mimetype, existing.id]
        );
      } else {
        await pool.query(
          `UPDATE payroll SET importo_lordo=$1, importo_netto=$2, data_bonifico=$3, stato=$4, note=$5 WHERE id=$6`,
          [importo_lordo, importo_netto, data_bonifico, stato, note, existing.id]
        );
      }
    } else {
      await pool.query(
        `INSERT INTO payroll (employee_id, anno, mese, importo_lordo, importo_netto, data_bonifico, stato, note, busta_content, busta_original_name, busta_mimetype)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          employeeId, anno, mese, importo_lordo, importo_netto, data_bonifico, stato, note,
          req.file ? req.file.buffer : null, req.file ? req.file.originalname : null, req.file ? req.file.mimetype : null,
        ]
      );
    }

    res.redirect(`/buste?anno=${anno}&mese=${mese}`);
  } catch (err) {
    next(err);
  }
});

router.get('/:employeeId/:anno/:mese/scarica', async (req, res, next) => {
  try {
    const { employeeId, anno, mese } = req.params;
    const { rows } = await pool.query(
      'SELECT * FROM payroll WHERE employee_id = $1 AND anno = $2 AND mese = $3',
      [employeeId, anno, mese]
    );
    const p = rows[0];
    if (!p || !p.busta_content) return res.status(404).send('Busta paga non trovata');
    res.set('Content-Type', p.busta_mimetype || 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(p.busta_original_name || 'busta_paga.pdf')}"`);
    res.send(p.busta_content);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
