const express = require('express');
const session = require('express-session');
const flash   = require('connect-flash');
const path    = require('path');
const fs      = require('fs');

const app = express();

// ─── Ensure required directories exist ───────────────────────────────────────
const dirs = ['public/uploads', 'database'];
dirs.forEach(d => {
  const full = path.join(__dirname, d);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
});

// ─── View Engine ─────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ─── Session ──────────────────────────────────────────────────────────────────
app.use(session({
  secret: 'evoting-osis-mpk-secret-2024-kpu-sekolah',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 3 * 60 * 60 * 1000 }, // 3 jam
}));

// ─── Flash Messages ───────────────────────────────────────────────────────────
app.use(flash());

// ─── Global Locals ────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.locals.user         = req.session.user || null;
  res.locals.success      = req.flash('success');
  res.locals.error        = req.flash('error');
  res.locals.warning      = req.flash('warning');
  res.locals.info         = req.flash('info');
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
const authRoutes      = require('./routes/auth');
const adminRoutes     = require('./routes/admin');
const panitiaRoutes   = require('./routes/panitia');
const pemilihRoutes   = require('./routes/pemilih');
const publicRoutes    = require('./routes/public');

app.use('/',          publicRoutes);
app.use('/auth',      authRoutes);
app.use('/admin',     adminRoutes);
app.use('/panitia',   panitiaRoutes);
app.use('/pemilih',   pemilihRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('errors/404', { title: '404 – Halaman Tidak Ditemukan' });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('errors/500', { title: '500 – Kesalahan Server', error: err.message });
});

// ─── Server Start ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🗳️  E-Voting OSIS & MPK – Server berjalan di http://localhost:${PORT}`);
  console.log('─────────────────────────────────────────────────────');
  console.log(`   Admin   → http://localhost:${PORT}/admin/dashboard`);
  console.log(`   Panitia → http://localhost:${PORT}/panitia/dashboard`);
  console.log(`   Pemilih → http://localhost:${PORT}/pemilih/bilik`);
  console.log('─────────────────────────────────────────────────────\n');
});
