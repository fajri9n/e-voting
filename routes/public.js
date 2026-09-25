const express = require('express');
const router  = express.Router();
const prisma  = require('../models/db');

// Home → redirect to login or dashboard
router.get('/', async (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  const role = req.session.user.role;
  if (role === 'ADMIN')       return res.redirect('/admin/dashboard');
  if (role === 'PANITIA_TPS') return res.redirect('/panitia/dashboard');
  if (role === 'PEMILIH')     return res.redirect('/pemilih/bilik');
  res.redirect('/auth/login');
});

// Public live count (read-only)
router.get('/live-count', async (req, res) => {
  const [candidates, voters, session] = await Promise.all([
    prisma.candidate.findMany({ orderBy: { nomorUrut: 'asc' } }),
    prisma.voter.findMany(),
    prisma.votingSession.findFirst(),
  ]);
  const totalSuara = voters.filter(v => v.hasVoted).length;
  const totalDPT   = voters.length;
  res.render('shared/quick-count', {
    title: 'Live Count – E-Voting OSIS Publik',
    candidates, totalSuara, totalDPT, session, role: 'PUBLIC',
  });
});

// API for live count (AJAX polling)
router.get('/api/live-count', async (req, res) => {
  const [candidates, voters, session] = await Promise.all([
    prisma.candidate.findMany({ orderBy: { nomorUrut: 'asc' } }),
    prisma.voter.findMany(),
    prisma.votingSession.findFirst(),
  ]);
  const totalSuara = voters.filter(v => v.hasVoted).length;
  const totalDPT   = voters.length;
  res.json({ candidates, totalSuara, totalDPT, session });
});

module.exports = router;
