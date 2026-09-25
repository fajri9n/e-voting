const prisma  = require('../models/db');
const bcrypt  = require('bcryptjs');
const path    = require('path');
const fs      = require('fs');
const { logAudit } = require('../middlewares/auth');

// ─── DASHBOARD ─────────────────────────────────────────────────────────────
exports.dashboard = async (req, res) => {
  try {
    const [candidates, voters, session, recentLogs] = await Promise.all([
      prisma.candidate.findMany({ orderBy: { nomorUrut: 'asc' } }),
      prisma.voter.findMany(),
      prisma.votingSession.findFirst(),
      prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);
    const totalSuara  = voters.filter(v => v.hasVoted).length;
    const totalDPT    = voters.length;
    const partisipasi = totalDPT > 0 ? ((totalSuara / totalDPT) * 100).toFixed(1) : 0;
    const totalSuaraKandidat = candidates.reduce((s, c) => s + c.suaraCount, 0);

    res.render('admin/dashboard', {
      title: 'Dashboard Admin – E-Voting',
      candidates, voters, session, recentLogs,
      totalSuara, totalDPT, partisipasi, totalSuaraKandidat,
    });
  } catch (e) {
    console.error(e);
    req.flash('error', 'Gagal memuat dashboard.');
    res.redirect('/');
  }
};

// ─── CANDIDATE CRUD ────────────────────────────────────────────────────────
exports.listCandidates = async (req, res) => {
  const candidates = await prisma.candidate.findMany({ orderBy: { nomorUrut: 'asc' } });
  res.render('admin/candidates', { title: 'Kelola Paslon – Admin', candidates });
};

exports.showAddCandidate = (req, res) => {
  res.render('admin/candidate-form', { title: 'Tambah Paslon', candidate: null });
};

exports.doAddCandidate = async (req, res) => {
  const { nomorUrut, namaKetua, namaWakil, visi, misi } = req.body;
  const fotoUrl = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    await prisma.candidate.create({
      data: { nomorUrut: parseInt(nomorUrut), namaKetua, namaWakil, visi, misi, fotoUrl },
    });
    await logAudit(req, 'CREATE_CANDIDATE', `Paslon nomor ${nomorUrut}: ${namaKetua} & ${namaWakil} ditambahkan.`);
    req.flash('success', `Paslon No. ${nomorUrut} berhasil ditambahkan.`);
    res.redirect('/admin/candidates');
  } catch (e) {
    req.flash('error', 'Gagal menambahkan paslon: ' + e.message);
    res.redirect('/admin/candidates/add');
  }
};

exports.showEditCandidate = async (req, res) => {
  const candidate = await prisma.candidate.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!candidate) { req.flash('error', 'Paslon tidak ditemukan.'); return res.redirect('/admin/candidates'); }
  res.render('admin/candidate-form', { title: 'Edit Paslon', candidate });
};

exports.doEditCandidate = async (req, res) => {
  const id = parseInt(req.params.id);
  const { nomorUrut, namaKetua, namaWakil, visi, misi } = req.body;
  try {
    const existing = await prisma.candidate.findUnique({ where: { id } });
    let fotoUrl = existing.fotoUrl;
    if (req.file) {
      if (fotoUrl && !fotoUrl.startsWith('/uploads/paslon')) {
        const oldPath = path.join(__dirname, '../public', fotoUrl);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      fotoUrl = `/uploads/${req.file.filename}`;
    }
    await prisma.candidate.update({
      where: { id },
      data: { nomorUrut: parseInt(nomorUrut), namaKetua, namaWakil, visi, misi, fotoUrl },
    });
    await logAudit(req, 'EDIT_CANDIDATE', `Paslon ID ${id} diperbarui.`);
    req.flash('success', 'Data paslon berhasil diperbarui.');
    res.redirect('/admin/candidates');
  } catch (e) {
    req.flash('error', 'Gagal memperbarui paslon: ' + e.message);
    res.redirect(`/admin/candidates/${id}/edit`);
  }
};

exports.doDeleteCandidate = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const existing = await prisma.candidate.findUnique({ where: { id } });
    if (existing?.suaraCount > 0) {
      req.flash('error', 'Tidak dapat menghapus paslon yang sudah menerima suara.');
      return res.redirect('/admin/candidates');
    }
    await prisma.candidate.delete({ where: { id } });
    await logAudit(req, 'DELETE_CANDIDATE', `Paslon "${existing?.namaKetua}" dihapus.`);
    req.flash('success', 'Paslon berhasil dihapus.');
    res.redirect('/admin/candidates');
  } catch (e) {
    req.flash('error', 'Gagal menghapus paslon.');
    res.redirect('/admin/candidates');
  }
};

// ─── VOTING SESSION CONTROL ────────────────────────────────────────────────
exports.toggleSession = async (req, res) => {
  try {
    let session = await prisma.votingSession.findFirst();
    const nowOpen = !session?.isOpen;
    if (session) {
      session = await prisma.votingSession.update({
        where: { id: session.id },
        data: {
          isOpen:   nowOpen,
          openedAt: nowOpen ? new Date() : session.openedAt,
          closedAt: !nowOpen ? new Date() : null,
        },
      });
    } else {
      session = await prisma.votingSession.create({ data: { isOpen: true, openedAt: new Date() } });
    }
    const status = nowOpen ? 'DIBUKA' : 'DIKUNCI';
    await logAudit(req, 'TOGGLE_SESSION', `Sesi voting ${status} oleh admin.`);
    req.flash(nowOpen ? 'success' : 'warning', `Sesi voting berhasil ${status}.`);
    res.redirect('/admin/dashboard');
  } catch (e) {
    req.flash('error', 'Gagal mengubah status sesi: ' + e.message);
    res.redirect('/admin/dashboard');
  }
};

// ─── AUDIT LOG ─────────────────────────────────────────────────────────────
exports.auditLog = async (req, res) => {
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  res.render('admin/audit-log', { title: 'Audit Log – Admin', logs });
};

// ─── QUICK COUNT ────────────────────────────────────────────────────────────
exports.quickCount = async (req, res) => {
  const [candidates, voters, session] = await Promise.all([
    prisma.candidate.findMany({ orderBy: { nomorUrut: 'asc' } }),
    prisma.voter.findMany(),
    prisma.votingSession.findFirst(),
  ]);
  const totalSuara = voters.filter(v => v.hasVoted).length;
  const totalDPT   = voters.length;
  res.render('shared/quick-count', {
    title: 'Live Count – Admin',
    candidates, totalSuara, totalDPT, session,
    role: 'ADMIN',
  });
};

// ─── API: real-time count data ─────────────────────────────────────────────
exports.apiQuickCount = async (req, res) => {
  const [candidates, voters, session] = await Promise.all([
    prisma.candidate.findMany({ orderBy: { nomorUrut: 'asc' } }),
    prisma.voter.findMany(),
    prisma.votingSession.findFirst(),
  ]);
  const totalSuara = voters.filter(v => v.hasVoted).length;
  const totalDPT   = voters.length;
  res.json({ candidates, totalSuara, totalDPT, session });
};

// ─── VOTER MANAGEMENT ───────────────────────────────────────────────────────
exports.listVoters = async (req, res) => {
  const voters = await prisma.voter.findMany({ orderBy: { kelas: 'asc' } });
  res.render('admin/voters', { title: 'Data DPT – Admin', voters });
};

exports.resetVoter = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const voter = await prisma.voter.findUnique({ where: { id } });
    await prisma.voter.update({
      where: { id },
      data: { hasVoted: false, votedAt: null, token: null },
    });
    await logAudit(req, 'RESET_VOTER', `Token dan status voting pemilih "${voter?.nama}" (${voter?.nisn}) direset.`);
    req.flash('warning', `Status pemilih ${voter?.nama} berhasil direset.`);
    res.redirect('/admin/voters');
  } catch (e) {
    req.flash('error', 'Gagal reset pemilih.');
    res.redirect('/admin/voters');
  }
};
