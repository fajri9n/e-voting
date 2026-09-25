const prisma = require('../models/db');

// ─── Log action to audit table ────────────────────────────────────────────────
async function logAudit(req, action, detail) {
  try {
    await prisma.auditLog.create({
      data: {
        userId:    req.session.user?.id   || null,
        userName:  req.session.user?.nama || 'Anonim',
        role:      req.session.user?.role || 'UNKNOWN',
        action,
        detail,
        ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
      },
    });
  } catch (e) {
    console.error('Audit log error:', e.message);
  }
}

// ─── Auth: must be logged in ──────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.user) {
    req.flash('error', 'Anda harus login terlebih dahulu.');
    return res.redirect('/auth/login');
  }
  next();
}

// ─── Role checker factory ─────────────────────────────────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      req.flash('error', 'Sesi tidak valid. Silakan login ulang.');
      return res.redirect('/auth/login');
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).render('errors/403', {
        title: '403 – Akses Ditolak',
        user: req.session.user,
        success: [], error: [], warning: [], info: [],
      });
    }
    next();
  };
}

// ─── Shorthand role middlewares ───────────────────────────────────────────────
const requireAdmin   = requireRole('ADMIN');
const requirePanitia = requireRole('PANITIA_TPS');
const requirePemilih = requireRole('PEMILIH');
const requireAdminOrPanitia = requireRole('ADMIN', 'PANITIA_TPS');

module.exports = { requireAuth, requireRole, requireAdmin, requirePanitia, requirePemilih, requireAdminOrPanitia, logAudit };
