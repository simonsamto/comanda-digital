'use strict';
const express = require('express');
const router = express.Router();
const cajeroController = require('../controllers/cajeroController');

router.get('/', cajeroController.getDashboard);
router.post('/cobrar/:pedidoId', cajeroController.cobrarPedido);

module.exports = router;