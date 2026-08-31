const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const multer = require('multer');
const db = require('../src/db');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', 'uploads', 'buste_paga');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

const MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

// Vista mensile: bonifici/buste paga per tutti i dipendenti attivi
router.get('/', (req, res) => {
  const now = new Date();
  const anno = parseInt(req.query.anno, 10) || now.getFullYear();
  const mese = parseInt(req.query.mese, 10) || now.getMonth() + 1;

  const azienda = req.query.azienda || '';
  const clauses = ["e.stato != 'candidato'"];
  const params = [];
  if (azienda) { clauses.push('e.azienda_id = ?'); params.push(azienda); }

  const employees = db
    .prepare(
      `SELECT e.*, c.nome AS azienda_nome FROM employees e
       LEFT JOIN companies c ON c.id = e.azienda_id
       WHERE ${clauses.join(' AND ')} ORDER BY e.cognome, e.nome`
    )
    .all(...params);

  const aziende = db.prepare('SELECT * FROM companies ORDER BY nome').all();

  const payrollRows = db.prepare('SELECT * FROM payroll WHERE anno = ? AND mese = ?').all(anno, mese);
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
});

router.post('/:employeeId', upload.single('busta'), (req, res) => {
  const b = req.body;
  const employeeId = req.params.employeeId;
  const anno = parseInt(b.anno, 10);
  const mese = parseInt(b.mese, 10);

  const existing = db
    .prepare('SELECT * FROM payroll WHERE employee_id = ? AND anno = ? AND mese = ?')
    .get(employeeId, anno, mese);

  const importo_lordo = b.importo_lordo ? Number(b.importo_lordo) : null;
  const importo_netto = b.importo_netto ? Number(b.importo_netto) : null;
  const data_bonifico = b.data_bonifico || null;
  const stato = b.stato || 'da_pagare';
  const note = b.note || null;

  if (existing) {
    let bustaFilename = existing.busta_filename;
    let bustaOriginal = existing.busta_original_name;
    if (req.file) {
      if (bustaFilename) {
        const oldPath = path.join(uploadsDir, bustaFilename);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      bustaFilename = req.file.filename;
      bustaOriginal = req.file.originalname;
    }
    db.prepare(
      `UPDATE payroll SET importo_lordo=?, importo_netto=?, data_bonifico=?, stato=?, note=?,
        busta_filename=?, busta_original_name=? WHERE id=?`
    ).run(importo_lordo, importo_netto, data_bonifico, stato, note, bustaFilename, bustaOriginal, existing.id);
  } else {
    db.prepare(
      `INSERT INTO payroll (employee_id, anno, mese, importo_lordo, importo_netto, data_bonifico, stato, note, busta_filename, busta_original_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      employeeId, anno, mese, importo_lordo, importo_netto, data_bonifico, stato, note,
      req.file ? req.file.filename : null, req.file ? req.file.originalname : null
    );
  }

  res.redirect(`/buste?anno=${anno}&mese=${mese}`);
});

router.get('/:employeeId/:anno/:mese/scarica', (req, res) => {
  const { employeeId, anno, mese } = req.params;
  const p = db
    .prepare('SELECT * FROM payroll WHERE employee_id = ? AND anno = ? AND mese = ?')
    .get(employeeId, anno, mese);
  if (!p || !p.busta_filename) return res.status(404).send('Busta paga non trovata');
  res.download(path.join(uploadsDir, p.busta_filename), p.busta_original_name || 'busta_paga.pdf');
});

module.exports = router;
