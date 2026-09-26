const bcrypt  = require('bcryptjs');
const prisma  = require('../models/db');
const { logAudit } = require('../middlewares/auth');

// GET /auth/login
exports.showLogin = (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('auth/login', { title: 'Login – E-Voting OSIS & MPK' });
};

// POST /auth/login
exports.doLogin = async (req, res) => {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';
  try {
    if (!username || !password) {
      req.flash('error', 'Username dan password wajib diisi.');
      return res.redirect('/auth/login');
    }
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      req.flash('error', 'Username tidak ditemukan.');
      return res.redirect('/auth/login');
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      req.flash('error', 'Password salah.');
      return res.redirect('/auth/login');
    }
    req.session.user = { id: user.id, username: user.username, nama: user.nama, role: user.role };
    await logAudit(req, 'LOGIN', `User ${user.nama} (${user.role}) berhasil login.`);

    if (user.role === 'ADMIN')       return res.redirect('/admin/dashboard');
    if (user.role === 'PANITIA_TPS') return res.redirect('/panitia/dashboard');
    if (user.role === 'PEMILIH')     return res.redirect('/pemilih/bilik');
    res.redirect('/');
  } catch (e) {
    console.error(e);
    req.flash('error', 'Terjadi kesalahan sistem.');
    res.redirect('/auth/login');
  }
};

// POST /auth/logout
exports.doLogout = async (req, res) => {
  const user = req.session.user;
  if (user) await logAudit(req, 'LOGOUT', `User ${user.nama} logout.`);
  req.session.destroy(() => res.redirect('/auth/login'));
};
