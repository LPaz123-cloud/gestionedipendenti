const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('login', { error: null });
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username || '']);
    const user = rows[0];

    if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
      return res.render('login', { error: 'Credenziali non valide.' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    res.redirect('/');
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
