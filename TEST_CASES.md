# DOKUMENTASI PENGUJIAN SISTEM E-VOTING PEMILIHAN OSIS & MPK
**Standar Uji Kompetensi Keahlian (UKK) & Standar Industri**  
**Role:** Programmer Software Developer  
**Target Narasumber:** Pembina OSIS / Ketua Komisi Pemilihan OSIS (KPU Sekolah)

---

## 1. Lingkungan & Akun Pengujian

Aplikasi dijalankan pada server lokal Node.js + Express.js dengan database SQLite via Prisma ORM:
- **URL Aplikasi:** `http://localhost:3000`
- **Portal Login:** `http://localhost:3000/auth/login`
- **Bilik Suara Siswa:** `http://localhost:3000/pemilih/bilik`
- **Live Quick Count Publik:** `http://localhost:3000/live-count`

### Akun Demo Penguji:
| Role | Username | Password | Deskripsi Tugas |
| :--- | :--- | :--- | :--- |
| **ADMIN (KPU/Pembina)** | `admin` | `password123` | Buka/kunci sesi voting, kelola paslon, monitor audit |
| **PANITIA (Operator TPS)** | `panitia` | `password123` | Verifikasi kehadiran pemilih, terbitkan token, cetak berita acara |
| **PEMILIH (Siswa DPT)** | *Menggunakan NISN & Token* | *(Token 1x Pakai)* | Masuk bilik suara, membaca visi-misi, coblos suara sah |

---

## 2. Matriks 5 Skenario Pengujian Wajib

Berikut adalah hasil pengujian detail 5 skenario inti sistem e-voting:

| No | Skenario Pengujian | Langkah Pengujian (Action Steps) | Ekspektasi Sistem (Expected Result) | Hasil Aktual | Status |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | **Panitia generate token voting untuk siswa yang hadir di TPS** | 1. Admin membuka sesi voting di `/admin/dashboard`.<br>2. Panitia login ke `/auth/login` (username: `panitia`, password: `password123`).<br>3. Buka menu `/panitia/voters`.<br>4. Cari siswa bernama **Andi Pratama** (NISN: `0051234001`).<br>5. Klik tombol **"Generate Token"**. | Sistem meng-generate 8 digit kode alfanumerik acak (contoh: `A8F4C29B`), menyimpan token ke database, dan menampilkan token di layar panitia untuk diserahkan ke siswa. | Token 8 karakter berhasil di-generate dan tersimpan di database `Voter.token`. | **PASSED (LULUS)** |
| **2** | **Siswa login menggunakan NISN dan token di bilik suara** | 1. Buka layar bilik suara di `/pemilih/bilik`.<br>2. Masukkan NISN `0051234001`.<br>3. Masukkan Token yang telah didapat dari Panitia.<br>4. Klik tombol **"Buka Surat Suara Digital"**. | Sistem memverifikasi pasangan NISN dan Token di database, memvalidasi bahwa siswa belum pernah memilih (`hasVoted = false`), dan mengarahkan siswa ke halaman surat suara `/pemilih/pilih`. | Siswa berhasil masuk ke bilik suara digital dan data diri (Nama, Kelas, NISN) tampil valid. | **PASSED (LULUS)** |
| **3** | **Siswa memilih Paslon Nomor Urut 01 dan menekan konfirmasi coblos** | 1. Di halaman `/pemilih/pilih`, baca visi dan misi dari masing-masing Paslon.<br>2. Klik tombol hijau **"COBLOS PASLON 01"**.<br>3. Muncul pop-up modal konfirmasi pencoblosan.<br>4. Klik tombol **"Ya, Coblos Sekarang!"**. | Sistem memunculkan dialog konfirmasi sebelum suara dikirim, lalu memproses pencoblosan secara aman melalui transaksi atomik database. | Modal konfirmasi muncul dengan benar dan tombol submit mengirimkan permintaan POST `/pemilih/vote`. | **PASSED (LULUS)** |
| **4** | **Sistem menambahkan 1 suara ke Paslon 01 dan token langsung berstatus hangus** | 1. Transaksi database atomik dieksekusi:<br>&bull; `Candidate(id=1).suaraCount += 1`<br>&bull; `Voter.hasVoted = true`<br>&bull; `Voter.token = null` (token hangus)<br>&bull; `VoteAudit.create({ candidateId: 1, kodeVerifikasi: UUID })`<br>2. Siswa dialihkan ke halaman bukti sukses `/pemilih/sukses`. | Suara paslon 01 bertambah 1, token hangus (dihapus/null), status memilih berubah menjadi `true`, dan kode bukti audit suara diterbitkan tanpa mencatat identitas pemilih (asas LUBER). | Database mencatat penambahan suara, token hangus otomatis, dan bukti verifikasi ditampilkan ke siswa. | **PASSED (LULUS)** |
| **5** | **Siswa mencoba memilih ulang dengan token yang sama, sistem menolak akses, dan live count terupdate** | 1. Siswa kembali ke halaman bilik suara `/pemilih/bilik`.<br>2. Siswa mencoba memasukkan ulang NISN `0051234001` dan token yang sebelumnya digunakan.<br>3. Klik tombol submit.<br>4. Buka halaman `/live-count` di tab lain. | 1. Sistem menolak akses dengan notifikasi error: *"NISN atau Token tidak valid"* atau *"Token ini sudah digunakan. Setiap pemilih hanya boleh memilih 1 kali".*<br>2. Di halaman `/live-count`, perolehan suara Paslon 01 dan persentase partisipasi otomatis terupdate real-time. | Percobaan voting ganda berhasil diblokir 100% oleh sistem, dan dashboard live count menampilkan hasil perolehan terbaru. | **PASSED (LULUS)** |

---

## 3. Matriks Pengujian Hak Akses RBAC 3 Level

| Endpoint / Fitur | Role ADMIN | Role PANITIA_TPS | Role PEMILIH | Guest / Belum Login | Hasil Uji Keamanan |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `/admin/*` (Dashboard, Paslon, Sesi) |  Diizinkan |  403 Forbidden |  403 Forbidden |  Redirect Login | **PASSED** |
| `/panitia/*` (Verifikasi, Token, BA) |  403 Forbidden |  Diizinkan |  403 Forbidden |  Redirect Login | **PASSED** |
| `/pemilih/bilik` (Akses Bilik Suara) |  Diizinkan |  Diizinkan |  Diizinkan |  Diizinkan (Token-Based) | **PASSED** |
| `/pemilih/pilih` & `/pemilih/vote` |  Hanya jika punya sesi bilik valid |  Hanya jika punya sesi bilik valid |  Hanya jika punya sesi bilik valid |  Ditolak (Butuh Verifikasi Token) | **PASSED** |
| `/live-count` (Quick Count Publik) |  Diizinkan |  Diizinkan |  Diizinkan |  Diizinkan | **PASSED** |

---

## 4. Kesimpulan Hasil Pengujian
Sistem E-Voting Pemilihan OSIS & MPK telah memenuhi seluruh persyaratan fungsional, keamanan transaksi suara LUBER-JURDIL, integritas audit, dan siap digunakan untuk simulasi maupun pemungutan suara resmi di lingkungan sekolah.
