'use strict';
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Verificación de seguridad
if (!adminController.showDashboard) {
    console.error("❌ ERROR: Controlador incompleto.");
}

// 1. DASHBOARD
router.get('/', adminController.showDashboard);

// 2. GESTIÓN DE MENÚS
router.get('/gestion-menu', adminController.getGestionMenu);
router.get('/menus/nuevo', adminController.showNewMenuForm);
router.post('/menus/nuevo', adminController.createMenu);
router.get('/menus/editar/:id', adminController.showEditMenuForm);
router.post('/menus/editar/:id', adminController.updateMenu);
router.post('/menus/eliminar/:id', adminController.deleteMenu);

// Configuración de componentes del menú
router.get('/menus/:id/configurar', adminController.showConfigurarMenu);
router.post('/menus/:id/configurar', adminController.saveConfigurarMenu);

// 3. GESTIÓN DE COMPONENTES Y GRUPOS
router.get('/gestion-componentes', adminController.getGestionComponentes);
router.post('/componentes', adminController.createComponente);
router.get('/componentes/editar/:id', adminController.showEditComponenteForm);
router.post('/componentes/editar/:id', adminController.updateComponente);
router.post('/componentes/eliminar/:id', adminController.deleteComponente);

router.post('/grupos', adminController.createGrupo);
router.get('/grupos/editar/:id', adminController.showEditGrupoForm);
router.post('/grupos/editar/:id', adminController.updateGrupo);
router.post('/grupos/eliminar/:id', adminController.deleteGrupo);

// 4. GESTIÓN DE USUARIOS
router.get('/usuarios', adminController.getUsuarios);
router.get('/usuarios/nuevo', adminController.showNewUserForm);
router.post('/usuarios/nuevo', adminController.createUser);
router.get('/usuarios/editar/:id', adminController.showEditUserForm);
router.post('/usuarios/editar/:id', adminController.updateUser);
router.post('/usuarios/estado/:id', adminController.toggleUserStatus);

// 5. GESTIÓN DE MESAS (AQUÍ ESTABA EL PROBLEMA, AHORA CORREGIDO)
router.get('/mesas', adminController.getMesas); // Ver lista
router.get('/mesas/mapa', adminController.getMapaEditor);
router.get('/mesas/nueva', adminController.showNewMesaForm); // Formulario crear
router.post('/mesas/nueva', adminController.createMesa); // Acción crear (POST)
router.get('/mesas/editar/:id', adminController.showEditMesaForm); // Formulario editar
router.post('/mesas/editar/:id', adminController.updateMesa); // Acción editar (POST)
router.post('/mesas/eliminar/:id', adminController.deleteMesa); // Eliminar
router.post('/mesas/liberar-todas', adminController.liberarTodasLasMesas); // Botón de pánico
router.post('/mesas/mapa/guardar', adminController.saveMapaLayout);

// 6. INFORMES
router.get('/informes', adminController.getInformes);
router.post('/informes/ventas', adminController.generarReporteFechas);
router.get('/informes/top', adminController.generarReporteTop);

module.exports = router;