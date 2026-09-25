const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/authController');

router.get('/login',  ctrl.showLogin);
router.post('/login', ctrl.doLogin);
router.post('/logout', ctrl.doLogout);

module.exports = router;
