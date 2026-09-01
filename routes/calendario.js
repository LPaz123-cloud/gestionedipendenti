const express = require('express');
const dayjs = require('dayjs');
const { pool } = require('../src/db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const meseParam = req.query.mese; // formato YYYY-MM
    const base = meseParam && /^\d{4}-\d{2}$/.test(meseParam) ? dayjs(meseParam + '-01') : dayjs().startOf('month');
    const startOfMonth = base.startOf('month');
    const endOfMonth = base.endOf('month');

    const { rows: events } = await pool.query(
      `SELECT e.*, emp.nome AS emp_nome, emp.cognome AS emp_cognome
       FROM calendar_events e
       LEFT JOIN employees emp ON emp.id = e.employee_id
       WHERE e.data BETWEEN $1 AND $2
       ORDER BY e.data, e.ora`,
      [startOfMonth.format('YYYY-MM-DD'), endOfMonth.format('YYYY-MM-DD')]
    );

    const eventsByDay = {};
    events.forEach((ev) => {
      (eventsByDay[ev.data] ||= []).push(ev);
    });

    const firstWeekday = (startOfMonth.day() + 6) % 7; // 0 = lunedì
    const daysInMonth = endOfMonth.date();
    const cells = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(startOfMonth.date(d));
    while (cells.length % 7 !== 0) cells.push(null);

    const { rows: employees } = await pool.query('SELECT id, nome, cognome FROM employees ORDER BY cognome, nome');
    const { rows: prossimi } = await pool.query(
      `SELECT e.*, emp.nome AS emp_nome, emp.cognome AS emp_cognome
       FROM calendar_events e
       LEFT JOIN employees emp ON emp.id = e.employee_id
       WHERE e.data >= $1 ORDER BY e.data, e.ora LIMIT 8`,
      [dayjs().format('YYYY-MM-DD')]
    );

    res.render('calendario', {
      title: 'Calendario operativo',
      cells,
      eventsByDay,
      monthLabel: base.format('MMMM YYYY'),
      monthValue: base.format('YYYY-MM'),
      prevMonth: base.subtract(1, 'month').format('YYYY-MM'),
      nextMonth: base.add(1, 'month').format('YYYY-MM'),
      todayStr: dayjs().format('YYYY-MM-DD'),
      employees,
      prossimi,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    await pool.query(
      'INSERT INTO calendar_events (titolo, tipo, data, ora, employee_id, note) VALUES ($1, $2, $3, $4, $5, $6)',
      [b.titolo, b.tipo || 'altro', b.data, b.ora || null, b.employee_id || null, b.note || null]
    );
    res.redirect(`/calendario?mese=${dayjs(b.data).format('YYYY-MM')}`);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/elimina', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM calendar_events WHERE id = $1', [req.params.id]);
    const ev = rows[0];
    await pool.query('DELETE FROM calendar_events WHERE id = $1', [req.params.id]);
    const mese = ev ? dayjs(ev.data).format('YYYY-MM') : dayjs().format('YYYY-MM');
    res.redirect(`/calendario?mese=${mese}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
