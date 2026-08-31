const express = require('express');
const db = require('../src/db');

const router = express.Router();

router.get('/', (req, res) => {
  const aziende = db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM employees e WHERE e.azienda_id = c.id) AS num_persone
       FROM companies c ORDER BY c.nome`
    )
    .all();
  res.render('aziende', { title: 'Aziende', aziende, errore: req.query.errore || null });
});

router.post('/', (req, res) => {
  const b = req.body;
  if (!b.nome || !b.nome.trim()) return res.redirect('/aziende');
  db.prepare('INSERT INTO companies (nome, partita_iva, note) VALUES (?, ?, ?)').run(
    b.nome.trim(), b.partita_iva || null, b.note || null
  );
  res.redirect('/aziende');
});

router.post('/:id', (req, res) => {
  const b = req.body;
  db.prepare('UPDATE companies SET nome = ?, partita_iva = ?, note = ? WHERE id = ?').run(
    b.nome, b.partita_iva || null, b.note || null, req.params.id
  );
  res.redirect('/aziende');
});

router.post('/:id/elimina', (req, res) => {
  const numPersone = db
    .prepare('SELECT COUNT(*) AS c FROM employees WHERE azienda_id = ?')
    .get(req.params.id).c;
  if (numPersone > 0) {
    const msg = encodeURIComponent('Impossibile eliminare: ci sono persone assegnate a questa azienda.');
    return res.redirect(`/aziende?errore=${msg}`);
  }
  db.prepare('DELETE FROM companies WHERE id = ?').run(req.params.id);
  res.redirect('/aziende');
});

module.exports = router;
