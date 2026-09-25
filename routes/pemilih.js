const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/pemilihController');
const { requirePemilih } = require('../middlewares/auth');

// Bilik suara bisa diakses tanpa PEMILIH role (siapapun yang punya token bisa masuk)
// Karena bilik pakai token-based, bukan session-based login
router.get('/bilik',        ctrl.showBilik);
router.post('/bilik/verify',ctrl.verifyToken);
router.get('/pilih',        ctrl.showPilih);
router.post('/vote',        ctrl.doVote);
router.get('/sukses',       ctrl.showSukses);

module.exports = router;
