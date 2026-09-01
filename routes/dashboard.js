const express = require('express');
const dayjs = require('dayjs');
const { pool } = require('../src/db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const oggi = dayjs().format('YYYY-MM-DD');
    const tra14gg = dayjs().add(14, 'day').format('YYYY-MM-DD');

    const prossimiEventi = (
      await pool.query(
        `SELECT e.*, emp.nome AS emp_nome, emp.cognome AS emp_cognome
         FROM calendar_events e
         LEFT JOIN employees emp ON emp.id = e.employee_id
         WHERE e.data BETWEEN $1 AND $2 ORDER BY e.data, e.ora LIMIT 10`,
        [oggi, tra14gg]
      )
    ).rows;

    const checklistAperte = (
      await pool.query(
        `SELECT c.*, emp.nome AS emp_nome, emp.cognome AS emp_cognome
         FROM checklist_items c
         JOIN employees emp ON emp.id = c.employee_id
         WHERE c.completato = false
         ORDER BY (c.scadenza IS NULL), c.scadenza LIMIT 10`
      )
    ).rows;

    const now = new Date();
    const anno = now.getFullYear();
    const mese = now.getMonth() + 1;

    const attivi = (await pool.query("SELECT COUNT(*)::int AS c FROM employees WHERE stato = 'attivo'")).rows[0].c;
    const candidati = (await pool.query("SELECT COUNT(*)::int AS c FROM employees WHERE stato = 'candidato'")).rows[0].c;
    const inOnboarding = (await pool.query("SELECT COUNT(*)::int AS c FROM employees WHERE stato = 'in_onboarding'")).rows[0].c;
    const pagatiMese = (
      await pool.query(
        "SELECT COUNT(*)::int AS c FROM payroll WHERE anno = $1 AND mese = $2 AND stato = 'pagato'",
        [anno, mese]
      )
    ).rows[0].c;
    const daPagareMese = (
      await pool.query(
        `SELECT COUNT(*)::int AS c FROM employees WHERE stato != 'candidato' AND id NOT IN
         (SELECT employee_id FROM payroll WHERE anno = $1 AND mese = $2 AND stato = 'pagato')`,
        [anno, mese]
      )
    ).rows[0].c;
    const numAziende = (await pool.query('SELECT COUNT(*)::int AS c FROM companies')).rows[0].c;

    const perAzienda = (
      await pool.query(
        `SELECT c.id, c.nome,
          SUM(CASE WHEN e.stato = 'attivo' THEN 1 ELSE 0 END)::int AS attivi,
          SUM(CASE WHEN e.stato = 'candidato' THEN 1 ELSE 0 END)::int AS candidati,
          COUNT(e.id)::int AS totale
         FROM companies c
         LEFT JOIN employees e ON e.azienda_id = c.id
         GROUP BY c.id ORDER BY c.nome`
      )
    ).rows;

    res.render('dashboard', {
      title: 'Dashboard',
      prossimiEventi,
      checklistAperte,
      perAzienda,
      stats: { attivi, candidati, inOnboarding, pagatiMese, daPagareMese, numAziende },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
