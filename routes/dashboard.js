const express = require('express');
const dayjs = require('dayjs');
const db = require('../src/db');

const router = express.Router();

router.get('/', (req, res) => {
  const oggi = dayjs().format('YYYY-MM-DD');
  const tra14gg = dayjs().add(14, 'day').format('YYYY-MM-DD');

  const prossimiEventi = db
    .prepare(
      `SELECT e.*, emp.nome AS emp_nome, emp.cognome AS emp_cognome
       FROM calendar_events e
       LEFT JOIN employees emp ON emp.id = e.employee_id
       WHERE e.data BETWEEN ? AND ? ORDER BY e.data, e.ora LIMIT 10`
    )
    .all(oggi, tra14gg);

  const checklistAperte = db
    .prepare(
      `SELECT c.*, emp.nome AS emp_nome, emp.cognome AS emp_cognome
       FROM checklist_items c
       JOIN employees emp ON emp.id = c.employee_id
       WHERE c.completato = 0
       ORDER BY (c.scadenza IS NULL), c.scadenza LIMIT 10`
    )
    .all();

  const now = new Date();
  const anno = now.getFullYear();
  const mese = now.getMonth() + 1;
  const attivi = db.prepare("SELECT COUNT(*) AS c FROM employees WHERE stato = 'attivo'").get().c;
  const candidati = db.prepare("SELECT COUNT(*) AS c FROM employees WHERE stato = 'candidato'").get().c;
  const inOnboarding = db.prepare("SELECT COUNT(*) AS c FROM employees WHERE stato = 'in_onboarding'").get().c;
  const pagatiMese = db
    .prepare("SELECT COUNT(*) AS c FROM payroll WHERE anno = ? AND mese = ? AND stato = 'pagato'")
    .get(anno, mese).c;
  const daPagareMese = db
    .prepare(
      `SELECT COUNT(*) AS c FROM employees WHERE stato != 'candidato' AND id NOT IN
       (SELECT employee_id FROM payroll WHERE anno = ? AND mese = ? AND stato = 'pagato')`
    )
    .get(anno, mese).c;
  const numAziende = db.prepare('SELECT COUNT(*) AS c FROM companies').get().c;

  const perAzienda = db
    .prepare(
      `SELECT c.id, c.nome,
        SUM(CASE WHEN e.stato = 'attivo' THEN 1 ELSE 0 END) AS attivi,
        SUM(CASE WHEN e.stato = 'candidato' THEN 1 ELSE 0 END) AS candidati,
        COUNT(e.id) AS totale
       FROM companies c
       LEFT JOIN employees e ON e.azienda_id = c.id
       GROUP BY c.id ORDER BY c.nome`
    )
    .all();

  res.render('dashboard', {
    title: 'Dashboard',
    prossimiEventi,
    checklistAperte,
    perAzienda,
    stats: { attivi, candidati, inOnboarding, pagatiMese, daPagareMese, numAziende },
  });
});

module.exports = router;
