const prisma  = require('../models/db');
const { v4: uuidv4 } = require('uuid');
const { logAudit } = require('../middlewares/auth');

// ─── BILIK SUARA (Form masuk) ─────────────────────────────────────────────
exports.showBilik = async (req, res) => {
  const session = await prisma.votingSession.findFirst();
  res.render('pemilih/bilik', {
    title: 'Bilik Suara – E-Voting OSIS',
    session,
  });
};

// ─── VERIFIKASI TOKEN & NISN ──────────────────────────────────────────────
exports.verifyToken = async (req, res) => {
  const nisn = (req.body.nisn || '').trim();
  const token = (req.body.token || '').trim().toUpperCase();

  if (!nisn || !token) {
    req.flash('error', 'Nomor NISN dan Token wajib diisi.');
    return res.redirect('/pemilih/bilik');
  }

  try {
    const session = await prisma.votingSession.findFirst();
    if (!session?.isOpen) {
      req.flash('error', 'Sesi voting belum dibuka. Hubungi panitia TPS.');
      return res.redirect('/pemilih/bilik');
    }

    const voter = await prisma.voter.findFirst({ where: { nisn, token } });
    if (!voter) {
      req.flash('error', 'NISN atau Token tidak valid. Periksa kembali dan hubungi panitia.');
      return res.redirect('/pemilih/bilik');
    }
    if (voter.hasVoted) {
      req.flash('error', 'Token ini sudah digunakan. Setiap pemilih hanya boleh memilih 1 kali (LUBER-JURDIL).');
      return res.redirect('/pemilih/bilik');
    }

    // Simpan data pemilih sementara ke session (BUKAN identitas pilihan)
    req.session.votingVoter = { id: voter.id, nama: voter.nama, kelas: voter.kelas, nisn: voter.nisn };
    await logAudit(req, 'MASUK_BILIK', `Pemilih NISN ${nisn} berhasil masuk bilik suara.`);
    res.redirect('/pemilih/pilih');
  } catch (e) {
    console.error(e);
    req.flash('error', 'Terjadi kesalahan sistem: ' + e.message);
    res.redirect('/pemilih/bilik');
  }
};

// ─── HALAMAN PILIH ────────────────────────────────────────────────────────
exports.showPilih = async (req, res) => {
  if (!req.session.votingVoter) {
    req.flash('error', 'Sesi bilik tidak valid. Masukkan token terlebih dahulu.');
    return res.redirect('/pemilih/bilik');
  }
  const candidates = await prisma.candidate.findMany({ orderBy: { nomorUrut: 'asc' } });
  const session    = await prisma.votingSession.findFirst();
  if (!session?.isOpen) {
    req.flash('error', 'Sesi voting telah ditutup.');
    delete req.session.votingVoter;
    return res.redirect('/pemilih/bilik');
  }
  res.render('pemilih/pilih', {
    title: 'Coblos Pilihanmu – E-Voting OSIS',
    candidates,
    voter: req.session.votingVoter,
  });
};

// ─── PROSES VOTE ──────────────────────────────────────────────────────────
exports.doVote = async (req, res) => {
  const votingVoter = req.session.votingVoter;
  if (!votingVoter) {
    req.flash('error', 'Sesi bilik tidak valid. Ulangi dari awal.');
    return res.redirect('/pemilih/bilik');
  }

  const candidateId = parseInt(req.body.candidateId);
  if (!candidateId || isNaN(candidateId)) {
    req.flash('error', 'Pilih salah satu paslon terlebih dahulu.');
    return res.redirect('/pemilih/pilih');
  }

  try {
    const session = await prisma.votingSession.findFirst();
    if (!session?.isOpen) {
      req.flash('error', 'Sesi voting sudah ditutup.');
      delete req.session.votingVoter;
      return res.redirect('/pemilih/bilik');
    }

    const kodeVerifikasi = uuidv4().toUpperCase();

    // Transaksi atomik interaktif untuk mengunci pembatalan ganda (race condition)
    await prisma.$transaction(async (tx) => {
      const currentVoter = await tx.voter.findUnique({ where: { id: votingVoter.id } });
      if (!currentVoter || currentVoter.hasVoted) {
        throw new Error('ALREADY_VOTED');
      }

      const candidateExists = await tx.candidate.findUnique({ where: { id: candidateId } });
      if (!candidateExists) {
        throw new Error('INVALID_CANDIDATE');
      }

      // Tambah suara ke kandidat
      await tx.candidate.update({
        where: { id: candidateId },
        data: { suaraCount: { increment: 1 } },
      });

      // Hanguskan token + tandai sudah vote
      await tx.voter.update({
        where: { id: currentVoter.id },
        data: { hasVoted: true, votedAt: new Date(), token: null },
      });

      // Catat audit suara tanpa menyimpan identitas pemilih (prinsip RAHASIA)
      await tx.voteAudit.create({
        data: { candidateId, kodeVerifikasi },
      });
    });

    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
    await logAudit(req, 'VOTE_CAST', `Suara sah tercatat untuk Paslon No. ${candidate?.nomorUrut}. Kode: ${kodeVerifikasi.substring(0, 8)}`);

    // Hapus data voter dari session bilik suara
    delete req.session.votingVoter;

    // Simpan bukti ke session untuk halaman sukses
    req.session.voteProof = {
      kodeVerifikasi: kodeVerifikasi.substring(0, 8),
      paslon: `No. ${candidate?.nomorUrut} – ${candidate?.namaKetua}`,
      waktu: new Date().toLocaleString('id-ID'),
    };

    res.redirect('/pemilih/sukses');
  } catch (e) {
    if (e.message === 'ALREADY_VOTED') {
      req.flash('error', 'Anda sudah memberikan suara atau sesi tidak valid.');
      delete req.session.votingVoter;
      return res.redirect('/pemilih/bilik');
    }
    if (e.message === 'INVALID_CANDIDATE') {
      req.flash('error', 'Paslon yang dipilih tidak valid.');
      return res.redirect('/pemilih/pilih');
    }
    console.error(e);
    req.flash('error', 'Terjadi kesalahan saat menyimpan suara. Hubungi panitia.');
    res.redirect('/pemilih/pilih');
  }
};

// ─── HALAMAN SUKSES ───────────────────────────────────────────────────────
exports.showSukses = (req, res) => {
  const proof = req.session.voteProof;
  if (!proof) return res.redirect('/pemilih/bilik');
  delete req.session.voteProof;
  res.render('pemilih/sukses', {
    title: 'Suara Berhasil Dicoblos – E-Voting',
    proof,
  });
};
