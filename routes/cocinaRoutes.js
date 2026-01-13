'use strict';
const express = require('express');
const router = express.Router();
const cocinaController = require('../controllers/cocinaController');

// Verificación de seguridad
if (!cocinaController || !cocinaController.showDashboard) {
    console.error("❌ ERROR CRÍTICO: El controlador de cocina no se cargó bien.");
}

// RUTA 1: Dashboard Principal
// URL: /cocina/
router.get('/', cocinaController.showDashboard);

// RUTA 2: Actualizar Estado del Pedido
// URL: /cocina/pedido/:pedidoId/estado
router.post('/pedido/:pedidoId/estado', cocinaController.updateEstadoPedido);

// RUTA 3: API para Resumen de Despachos (NUEVA)
// URL: /cocina/resumen-despachos
router.get('/resumen-despachos', cocinaController.getResumenDespachos);

module.exports = router;