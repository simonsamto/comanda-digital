'use strict';
const express = require('express');
const router = express.Router();
const cocinaController = require('../controllers/cocinaController');

// Verificación de seguridad
if (!cocinaController || !cocinaController.showDashboard) {
    console.error("❌ ERROR CRÍTICO: El controlador de cocina no se cargó bien.");
}

// RUTA 1: Dashboard
// URL Final: /cocina/  (porque app.js pone '/cocina')
router.get('/', cocinaController.showDashboard);

// RUTA 2: Actualizar Estado
// URL Final: /cocina/pedido/:pedidoId/estado
router.post('/pedido/:pedidoId/estado', cocinaController.updateEstadoPedido);

module.exports = router;