const express = require('express');
const { pool } = require('../src/db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { rows: aziende } = await pool.query(
      `SELECT c.*, (SELECT COUNT(*)::int FROM employees e WHERE e.azienda_id = c.id) AS num_persone
       FROM companies c ORDER BY c.nome`
    );
    res.render('aziende', { title: 'Aziende', aziende, errore: req.query.errore || null });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.nome || !b.nome.trim()) return res.redirect('/aziende');
    await pool.query('INSERT INTO companies (nome, partita_iva, note) VALUES ($1, $2, $3)', [
      b.nome.trim(), b.partita_iva || null, b.note || null,
    ]);
    res.redirect('/aziende');
  } catch (err) {
    next(err);
  }
});

router.post('/:id', async (req, res, next) => {
  try {
    const b = req.body;
    await pool.query('UPDATE companies SET nome = $1, partita_iva = $2, note = $3 WHERE id = $4', [
      b.nome, b.partita_iva || null, b.note || null, req.params.id,
    ]);
    res.redirect('/aziende');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/elimina', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM employees WHERE azienda_id = $1', [
      req.params.id,
    ]);
    if (rows[0].c > 0) {
      const msg = encodeURIComponent('Impossibile eliminare: ci sono persone assegnate a questa azienda.');
      return res.redirect(`/aziende?errore=${msg}`);
    }
    await pool.query('DELETE FROM companies WHERE id = $1', [req.params.id]);
    res.redirect('/aziende');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
