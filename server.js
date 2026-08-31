require('dotenv').config();
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const path = require('node:path');
const dayjs = require('dayjs');
require('dayjs/locale/it');
dayjs.locale('it');

const { requireAuth } = require('./src/auth');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use('/public', express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'chiave-di-sviluppo-non-sicura',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 },
  })
);

app.use((req, res, next) => {
  res.locals.username = req.session.username || null;
  res.locals.currentPath = req.path;
  res.locals.dayjs = dayjs;
  next();
});

app.use('/', require('./routes/auth'));

app.use('/', requireAuth, require('./routes/dashboard'));
app.use('/aziende', requireAuth, require('./routes/aziende'));
app.use('/dipendenti', requireAuth, require('./routes/dipendenti'));
app.use('/calendario', requireAuth, require('./routes/calendario'));
app.use('/buste', requireAuth, require('./routes/buste'));

app.use((req, res) => {
  res.status(404).send('Pagina non trovata');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Gestionale assunzioni avviato su http://localhost:${PORT}`);
});
