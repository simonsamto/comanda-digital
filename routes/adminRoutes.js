'use strict';
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Redirección de la ruta principal del admin a la gestión de menú
router.get('/', (req, res) => res.redirect('/admin/gestion-menu'));

// --- Rutas para Gestión de Usuarios ---
router.get('/usuarios', adminController.getUsuarios);
router.get('/usuarios/nuevo', adminController.showNewUserForm);
router.post('/usuarios/nuevo', adminController.createUser);
router.get('/usuarios/editar/:id', adminController.showEditUserForm);
router.post('/usuarios/editar/:id', adminController.updateUser);
router.post('/usuarios/estado/:id', adminController.toggleUserStatus);

// --- Rutas para Gestión de Mesas ---
router.get('/mesas', adminController.getMesas);
router.get('/mesas/nueva', adminController.showNewMesaForm);
router.post('/mesas', adminController.createMesa);
router.get('/mesas/editar/:id', adminController.showEditMesaForm);
router.post('/mesas/editar/:id', adminController.updateMesa);
router.post('/mesas/eliminar/:id', adminController.deleteMesa);

// --- GESTIÓN DE MENÚS CONFIGURABLES ---
router.get('/gestion-menu', adminController.getGestionMenu);
router.get('/menus/nuevo', adminController.showNewMenuForm);
router.post('/menus/nuevo', adminController.createMenu);
router.get('/menus/:id/configurar', adminController.showConfigurarMenu);
router.post('/menus/:id/configurar', adminController.saveConfigurarMenu);

// --- GESTIÓN DE COMPONENTES Y GRUPOS BASE ---
router.get('/gestion-componentes', adminController.getGestionComponentes);

// Rutas para Componentes
router.post('/componentes', adminController.createComponente);
router.get('/componentes/editar/:id', adminController.showEditComponenteForm);
router.post('/componentes/editar/:id', adminController.updateComponente);
router.post('/componentes/eliminar/:id', adminController.deleteComponente);

// Rutas para Grupos
router.post('/grupos', adminController.createGrupo);
router.get('/grupos/editar/:id', adminController.showEditGrupoForm);
router.post('/grupos/editar/:id', adminController.updateGrupo);
router.post('/grupos/eliminar/:id', adminController.deleteGrupo);

// CRUD para Menús
router.get('/menus/editar/:id', adminController.showEditMenuForm);  // Update (GET Form)
router.post('/menus/editar/:id', adminController.updateMenu);    // Update (POST Data)
router.post('/menus/eliminar/:id', adminController.deleteMenu); // Delete

module.exports = router;