const express = require('express');
const dayjs = require('dayjs');
const db = require('../src/db');

const router = express.Router();

router.get('/', (req, res) => {
  const meseParam = req.query.mese; // formato YYYY-MM
  const base = meseParam && /^\d{4}-\d{2}$/.test(meseParam) ? dayjs(meseParam + '-01') : dayjs().startOf('month');
  const startOfMonth = base.startOf('month');
  const endOfMonth = base.endOf('month');

  const events = db
    .prepare(
      `SELECT e.*, emp.nome AS emp_nome, emp.cognome AS emp_cognome
       FROM calendar_events e
       LEFT JOIN employees emp ON emp.id = e.employee_id
       WHERE e.data BETWEEN ? AND ?
       ORDER BY e.data, e.ora`
    )
    .all(startOfMonth.format('YYYY-MM-DD'), endOfMonth.format('YYYY-MM-DD'));

  const eventsByDay = {};
  events.forEach((ev) => {
    (eventsByDay[ev.data] ||= []).push(ev);
  });

  // Griglia settimane (lunedì-domenica)
  const firstWeekday = (startOfMonth.day() + 6) % 7; // 0 = lunedì
  const daysInMonth = endOfMonth.date();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(startOfMonth.date(d));
  while (cells.length % 7 !== 0) cells.push(null);

  const employees = db.prepare('SELECT id, nome, cognome FROM employees ORDER BY cognome, nome').all();
  const prossimi = db
    .prepare(
      `SELECT e.*, emp.nome AS emp_nome, emp.cognome AS emp_cognome
       FROM calendar_events e
       LEFT JOIN employees emp ON emp.id = e.employee_id
       WHERE e.data >= ? ORDER BY e.data, e.ora LIMIT 8`
    )
    .all(dayjs().format('YYYY-MM-DD'));

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
});

router.post('/', (req, res) => {
  const b = req.body;
  db.prepare(
    'INSERT INTO calendar_events (titolo, tipo, data, ora, employee_id, note) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(b.titolo, b.tipo || 'altro', b.data, b.ora || null, b.employee_id || null, b.note || null);
  res.redirect(`/calendario?mese=${dayjs(b.data).format('YYYY-MM')}`);
});

router.post('/:id/elimina', (req, res) => {
  const ev = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM calendar_events WHERE id = ?').run(req.params.id);
  const mese = ev ? dayjs(ev.data).format('YYYY-MM') : dayjs().format('YYYY-MM');
  res.redirect(`/calendario?mese=${mese}`);
});

module.exports = router;
