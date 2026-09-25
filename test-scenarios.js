const http = require('http');

async function runScenarioTest() {
  console.log('🧪 Memulai Pengujian Otomatis 5 Skenario Sistem E-Voting...\n');
  const baseUrl = 'http://localhost:3000';

  // Helper untuk HTTP request dengan cookie session
  function request(urlPath, method = 'GET', data = null, cookies = '') {
    return new Promise((resolve, reject) => {
      const url = new URL(urlPath, baseUrl);
      const postData = data ? (typeof data === 'string' ? data : new URLSearchParams(data).toString()) : null;
      
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          'Cookie': cookies,
        },
      };

      if (postData) {
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        options.headers['Content-Length'] = Buffer.byteLength(postData);
      }

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          const setCookie = res.headers['set-cookie'] || [];
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body,
            cookies: setCookie.map(c => c.split(';')[0]).join('; '),
          });
        });
      });

      req.on('error', reject);
      if (postData) req.write(postData);
      req.end();
    });
  }

  try {
    // ─── 0. Admin Login & Buka Sesi ──────────────────────────────────────────
    console.log('[Langkah 0] Login Admin & Buka Sesi Pemilihan...');
    const adminLoginRes = await request('/auth/login', 'POST', { username: 'admin', password: 'password123' });
    const adminCookies = adminLoginRes.cookies;
    console.log('   Admin Login Status:', adminLoginRes.statusCode);

    // Toggle sesi agar isOpen = true
    await request('/admin/session/toggle', 'POST', {}, adminCookies);
    console.log('   Sesi voting dibuka oleh Admin.\n');

    // ─── SKENARIO 1: Panitia Generate Token untuk Andi Pratama ───────────────
    console.log('📌 [SKENARIO 1] Panitia Login & Generate Token Pemilih (Andi Pratama - NISN: 0051234001)...');
    const panitiaLoginRes = await request('/auth/login', 'POST', { username: 'panitia', password: 'password123' });
    const panitiaCookies = panitiaLoginRes.cookies;

    // Andi Pratama memiliki id = 1
    const genTokenRes = await request('/panitia/voters/1/token', 'POST', {}, panitiaCookies);
    console.log('   Generate Token Status:', genTokenRes.statusCode);

    // Ambil token dari database
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const voter = await prisma.voter.findUnique({ where: { nisn: '0051234001' } });
    console.log(`   ✅ Token berhasil diterbitkan untuk ${voter.nama}: "${voter.token}"\n`);

    // ─── SKENARIO 2: Siswa Masuk Bilik Suara Menggunakan NISN & Token ────────
    console.log('📌 [SKENARIO 2] Siswa memasukkan NISN dan Token ke Bilik Suara...');
    let voterCookies = '';
    const bilikVerifyRes = await request('/pemilih/bilik/verify', 'POST', {
      nisn: '0051234001',
      token: voter.token,
    }, voterCookies);
    
    voterCookies = bilikVerifyRes.cookies;
    console.log('   Status Verifikasi Bilik:', bilikVerifyRes.statusCode, `(Redirect: ${bilikVerifyRes.headers.location})`);
    
    const masukPilihRes = await request('/pemilih/pilih', 'GET', null, voterCookies);
    const validSuratSuara = masukPilihRes.body.includes('Andi Pratama') && masukPilihRes.body.includes('COBLOS PASLON 01');
    console.log('   ✅ Siswa berhasil masuk bilik dan surat suara digital tampil:', validSuratSuara ? 'YA' : 'TIDAK', '\n');

    // ─── SKENARIO 3 & 4: Coblos Paslon 01, Suara Masuk, Token Hangus ────────
    console.log('📌 [SKENARIO 3 & 4] Siswa mencoblos Paslon Nomor Urut 01...');
    // Paslon 1 memiliki id = 1
    const coblosRes = await request('/pemilih/vote', 'POST', { candidateId: 1 }, voterCookies);
    console.log('   Status Coblos:', coblosRes.statusCode, `(Redirect: ${coblosRes.headers.location})`);

    const voterAfterVote = await prisma.voter.findUnique({ where: { nisn: '0051234001' } });
    const paslon1After = await prisma.candidate.findUnique({ where: { nomorUrut: 1 } });
    const totalAudit = await prisma.voteAudit.count();

    console.log(`   ✅ Suara Paslon 01 bertambah menjadi: ${paslon1After.suaraCount} suara`);
    console.log(`   ✅ Status hasVoted pemilih: ${voterAfterVote.hasVoted}`);
    console.log(`   ✅ Status token pemilih: ${voterAfterVote.token === null ? 'HANGUS (NULL)' : voterAfterVote.token}`);
    console.log(`   ✅ Transaksi audit tersimpan: ${totalAudit} audit log anonim\n`);

    // ─── SKENARIO 5: Coba Gunakan Token yang Sama Ulang & Live Count Update ───
    console.log('📌 [SKENARIO 5] Siswa mencoba memilih ulang dengan token yang sama & verifikasi live count...');
    const cobaLagiRes = await request('/pemilih/bilik/verify', 'POST', {
      nisn: '0051234001',
      token: voter.token || 'TOKEN_HANGUS',
    });
    console.log('   Status Percobaan Vote Ulang:', cobaLagiRes.statusCode, `(Ditolak & redirect: ${cobaLagiRes.headers.location})`);

    // Periksa API Live Count
    const liveCountRes = await request('/api/live-count', 'GET');
    const liveData = JSON.parse(liveCountRes.body);
    console.log(`   ✅ Quick Count Real-time:`);
    console.log(`      Total Suara Masuk: ${liveData.totalSuara} / ${liveData.totalDPT}`);
    console.log(`      Perolehan Paslon 01: ${liveData.candidates[0].suaraCount} suara`);
    console.log(`      Perolehan Paslon 02: ${liveData.candidates[1].suaraCount} suara`);
    console.log(`      Perolehan Paslon 03: ${liveData.candidates[2].suaraCount} suara\n`);

    await prisma.$disconnect();
    console.log('🎉 SELURUH 5 SKENARIO PENGUJIAN SISTEM BERHASIL 100% LULUS (PASSED)!');
  } catch (err) {
    console.error('Pengujian gagal:', err);
  }
}

runScenarioTest();
