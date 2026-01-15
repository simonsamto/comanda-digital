'use strict';
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const billingController = require('../controllers/billingController');

// ==========================================
// 1. DASHBOARD
// ==========================================
router.get('/', adminController.showDashboard);

// ==========================================
// 2. GESTIÓN DE MENÚS
// ==========================================
router.get('/menus', adminController.getGestionMenu); 
router.get('/gestion-menu', adminController.getGestionMenu);

// Crear
router.get('/menus/create', adminController.showNewMenuForm);
router.post('/menus/create', adminController.createMenu);
router.get('/menus/nuevo', adminController.showNewMenuForm); // Alias
router.post('/menus/nuevo', adminController.createMenu);     // Alias

// Editar / Eliminar / Estado
router.get('/menus/editar/:id', adminController.showEditMenuForm);
router.post('/menus/update/:id', adminController.updateMenu);
router.post('/menus/editar/:id', adminController.updateMenu);
router.post('/menus/eliminar/:id', adminController.deleteMenu);
router.post('/menus/toggle-estado/:id', adminController.toggleMenuEstado);

// Configurar
router.get('/menus/:id/configurar', adminController.showConfigurarMenu);
router.post('/menus/:id/configurar', adminController.saveConfigurarMenu);
router.get('/menus/configurar/:id', adminController.showConfigurarMenu);
router.post('/menus/configurar/:id', adminController.saveConfigurarMenu);

// ==========================================
// 3. GESTIÓN COMPONENTES
// ==========================================
router.get('/gestion-componentes', adminController.getGestionComponentes);
router.post('/componentes', adminController.createComponente);
router.get('/componentes/editar/:id', adminController.showEditComponenteForm);
router.post('/componentes/editar/:id', adminController.updateComponente);
router.post('/componentes/eliminar/:id', adminController.deleteComponente);

router.post('/grupos', adminController.createGrupo);
router.get('/grupos/editar/:id', adminController.showEditGrupoForm);
router.post('/grupos/editar/:id', adminController.updateGrupo);
router.post('/grupos/eliminar/:id', adminController.deleteGrupo);

// ==========================================
// 4. GESTIÓN USUARIOS
// ==========================================
router.get('/usuarios', adminController.getUsuarios);
router.get('/usuarios/nuevo', adminController.showNewUserForm);
router.post('/usuarios/nuevo', adminController.createUser);
router.get('/usuarios/editar/:id', adminController.showEditUserForm);
router.post('/usuarios/editar/:id', adminController.updateUser);
router.post('/usuarios/estado/:id', adminController.toggleUserStatus);

// ==========================================
// 5. GESTIÓN MESAS
// ==========================================
router.get('/mesas', adminController.getMesas);
router.get('/mesas/nueva', adminController.showNewMesaForm);
router.post('/mesas/nueva', adminController.createMesa);
router.get('/mesas/editar/:id', adminController.showEditMesaForm);
router.post('/mesas/editar/:id', adminController.updateMesa);
router.post('/mesas/eliminar/:id', adminController.deleteMesa);
router.post('/mesas/liberar-todas', adminController.liberarTodasLasMesas);

router.get('/mesas/mapa', adminController.getMapaEditor);
router.post('/mesas/mapa/guardar', adminController.saveMapaLayout);

// ==========================================
// 6. GESTIÓN EMPRESAS
// ==========================================
router.get('/empresas', adminController.getGestionEmpresas);
router.post('/empresas', adminController.createEmpresa);
router.post('/empresas/eliminar/:id', adminController.deleteEmpresa);

// ==========================================
// 7. INFORMES (REPORTES)
// ==========================================
router.get('/informes', adminController.getInformes);

// --- CORRECCIÓN AQUÍ: Agregada la ruta que busca tu formulario ---
router.post('/informes/ventas', adminController.generarReporteFechas); // <--- ESTA FALTABA
router.get('/informes/top', adminController.generarReporteTop);        // <--- ESTA FALTABA

// Rutas adicionales para los filtros dentro del reporte
router.get('/reporte-ventas', adminController.generarReporteFechas);
router.post('/reporte-ventas', adminController.generarReporteFechas);

router.get('/reporte-ranking', adminController.generarReporteTop);
router.post('/reporte-ranking', adminController.generarReporteTop);

// Reporte de Cobranza
router.get('/informes/cobranza', adminController.getReporteCuentasCobrar);
router.post('/informes/cobranza/saldar', adminController.saldarDeudaEmpresa);

// ==========================================
// 8. FACTURACIÓN
// ==========================================
router.get('/billing', billingController.getBillingDashboard);

module.exports = router;