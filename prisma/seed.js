const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── USERS ───────────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      nama: 'Pembina OSIS - Bapak Rudi Hartono',
      role: 'ADMIN',
    },
  });

  const panitia = await prisma.user.upsert({
    where: { username: 'panitia' },
    update: {},
    create: {
      username: 'panitia',
      password: hashedPassword,
      nama: 'Operator TPS - Ibu Sari Dewi',
      role: 'PANITIA_TPS',
    },
  });

  const pemilih = await prisma.user.upsert({
    where: { username: 'pemilih' },
    update: {},
    create: {
      username: 'pemilih',
      password: hashedPassword,
      nama: 'Siswa Demo',
      role: 'PEMILIH',
    },
  });

  console.log('✅ Users created:', { admin: admin.username, panitia: panitia.username, pemilih: pemilih.username });

  // ─── CANDIDATES ──────────────────────────────────────────────────────────
  const candidates = [
    {
      nomorUrut: 1,
      namaKetua: 'Ahmad Fadhil Ramadhan',
      namaWakil: 'Siti Nurhaliza Putri',
      visi: 'Mewujudkan OSIS yang Inovatif, Berkarakter, dan Berprestasi untuk membawa nama sekolah ke tingkat nasional.',
      misi: '1. Mengadakan program literasi digital dan coding club mingguan.\n2. Membentuk unit wirausaha siswa (student startup) berbasis digital.\n3. Meningkatkan frekuensi lomba akademik dan non-akademik antar kelas.\n4. Membangun sistem aspirasi siswa digital berbasis aplikasi.\n5. Menguatkan kolaborasi antar ekstrakurikuler untuk festival seni budaya tahunan.',
      fotoUrl: '/uploads/paslon1.svg',
    },
    {
      nomorUrut: 2,
      namaKetua: 'Bintang Prasetyo Nugroho',
      namaWakil: 'Dinda Ayu Maharani',
      visi: 'OSIS Bersatu, Berbudaya, dan Berjiwa Pancasila sebagai landasan membangun generasi emas Indonesia.',
      misi: '1. Menghidupkan kembali kegiatan pramuka dan seni budaya daerah.\n2. Membangun program mentoring senior-junior antar kelas.\n3. Mengadakan kegiatan sosial bersama masyarakat sekitar sekolah.\n4. Membentuk tim green school untuk lingkungan sekolah yang lebih hijau.\n5. Mewujudkan kantin sehat dan bebas sampah plastik.',
      fotoUrl: '/uploads/paslon2.svg',
    },
    {
      nomorUrut: 3,
      namaKetua: 'Citra Wulandari Susanto',
      namaWakil: 'Rizky Firmansyah',
      visi: 'OSIS Transparan, Inklusif, dan Responsif – Suara Setiap Siswa Didengar dan Diwujudkan.',
      misi: '1. Membuka kotak saran digital yang ditanggapi setiap minggu.\n2. Menyelenggarakan diskusi publik bulanan bersama kepala sekolah.\n3. Mendorong partisipasi siswa dalam setiap pengambilan keputusan sekolah.\n4. Membentuk komunitas anti-bullying dan kesehatan mental siswa.\n5. Mengadakan bazaar karya siswa dan pameran inovasi setiap semester.',
      fotoUrl: '/uploads/paslon3.svg',
    },
  ];

  for (const c of candidates) {
    await prisma.candidate.upsert({
      where: { nomorUrut: c.nomorUrut },
      update: { fotoUrl: c.fotoUrl },
      create: c,
    });
  }
  console.log('✅ Candidates (3 Paslon) created');

  // ─── VOTERS (DPT) ────────────────────────────────────────────────────────
  const voters = [
    { nisn: '0051234001', nama: 'Andi Pratama',        kelas: 'XII IPA 1' },
    { nisn: '0051234002', nama: 'Bella Oktavia',       kelas: 'XII IPA 1' },
    { nisn: '0051234003', nama: 'Charlie Irawan',      kelas: 'XII IPA 2' },
    { nisn: '0051234004', nama: 'Dewi Rahayu',         kelas: 'XII IPA 2' },
    { nisn: '0051234005', nama: 'Eka Surya',           kelas: 'XII IPS 1' },
    { nisn: '0051234006', nama: 'Fauzan Akbar',        kelas: 'XII IPS 1' },
    { nisn: '0051234007', nama: 'Gita Permata',        kelas: 'XII IPS 2' },
    { nisn: '0051234008', nama: 'Hendra Kusuma',       kelas: 'XI IPA 1' },
    { nisn: '0051234009', nama: 'Indah Lestari',       kelas: 'XI IPA 1' },
    { nisn: '0051234010', nama: 'Joko Santoso',        kelas: 'XI IPA 2' },
    { nisn: '0051234011', nama: 'Kartika Sari',        kelas: 'XI IPS 1' },
    { nisn: '0051234012', nama: 'Lutfi Hakim',         kelas: 'XI IPS 2' },
    { nisn: '0051234013', nama: 'Maya Anggraini',      kelas: 'X IPA 1' },
    { nisn: '0051234014', nama: 'Nanda Febrian',       kelas: 'X IPA 2' },
    { nisn: '0051234015', nama: 'Omar Alfarisi',       kelas: 'X IPS 1' },
    { nisn: '0051234016', nama: 'Putri Handayani',     kelas: 'X IPS 2' },
    { nisn: '0051234017', nama: 'Qodri Maulana',       kelas: 'XII IPA 3' },
    { nisn: '0051234018', nama: 'Rina Saraswati',      kelas: 'XI IPA 3' },
    { nisn: '0051234019', nama: 'Sandi Wijaya',        kelas: 'X IPA 3' },
    { nisn: '0051234020', nama: 'Tia Nuraini',         kelas: 'XII IPS 3' },
  ];

  for (const v of voters) {
    await prisma.voter.upsert({
      where: { nisn: v.nisn },
      update: {},
      create: v,
    });
  }
  console.log('✅ Voters DPT (20 siswa) created');

  // ─── VOTING SESSION ───────────────────────────────────────────────────────
  const session = await prisma.votingSession.findFirst();
  if (!session) {
    await prisma.votingSession.create({
      data: { isOpen: true, openedAt: new Date() },
    });
  } else {
    await prisma.votingSession.update({
      where: { id: session.id },
      data: { isOpen: true, openedAt: new Date(), closedAt: null },
    });
  }
  console.log('✅ Voting session initialized (OPEN)');

  // ─── AUDIT LOG AWAL ──────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { userName: 'System', role: 'SYSTEM', action: 'INIT', detail: 'Database berhasil diinisialisasi dan seed data dimuat.' },
      { userName: 'admin',  role: 'ADMIN',  action: 'SEED', detail: '3 paslon, 20 pemilih DPT, dan sesi voting berhasil dibuat.' },
    ],
  });
  console.log('✅ Initial audit logs created');

  console.log('\n🎉 Seeding selesai!');
  console.log('─────────────────────────────');
  console.log('Akun Demo:');
  console.log('  Admin   → username: admin   | password: password123');
  console.log('  Panitia → username: panitia | password: password123');
  console.log('  Pemilih → username: pemilih | password: password123');
  console.log('─────────────────────────────');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
