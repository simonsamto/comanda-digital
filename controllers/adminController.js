// controllers/adminController.js (VERSIÓN FINAL Y COMPLETA)

'use strict';
// IMPORTANTE: Actualizamos los modelos que importamos
const { Usuario, Rol, Mesa, Menu, Grupo, Componente } = require('../models');

// --- GESTIÓN DE USUARIOS (Conservado de tu código original) ---

exports.showDashboard = (req, res) => {
    // Redirigimos al nuevo panel de gestión de menú como página principal
    res.redirect('/admin/gestion-menu');
};

exports.getUsuarios = async (req, res) => {
    try {
        // FIX: Use the correct alias 'rol' defined in the model
        const usuarios = await Usuario.findAll({ include: [{ model: Rol, as: 'rol' }], order: [['nombre', 'ASC']] });
        res.render('admin/usuarios', { pageTitle: 'Gestión de Usuarios', usuarios });
    } catch (error) { console.error(error); req.flash('error_msg', 'Error al obtener los usuarios.'); res.redirect('/admin'); }
};

exports.showNewUserForm = async (req, res) => {
    try {
        const roles = await Rol.findAll();
        res.render('admin/usuario-form', { pageTitle: 'Crear Nuevo Usuario', roles, usuario: {} });
    } catch (error) { console.error(error); req.flash('error_msg', 'Error al cargar el formulario.'); res.redirect('/admin/usuarios'); }
};

exports.createUser = async (req, res) => {
    const { nombre, email, password, RolId } = req.body;
    try {
        await Usuario.create({ nombre, email, password, RolId });
        req.flash('success_msg', 'Usuario creado exitosamente.');
        res.redirect('/admin/usuarios');
    } catch (error) {
        const roles = await Rol.findAll();
        res.render('admin/usuario-form', { pageTitle: 'Crear Nuevo Usuario', roles, error: error.errors[0].message, usuario: req.body });
    }
};

exports.showEditUserForm = async (req, res) => {
    try {
        const usuario = await Usuario.findByPk(req.params.id);
        const roles = await Rol.findAll();
        if (!usuario) { req.flash('error_msg', 'Usuario no encontrado.'); return res.redirect('/admin/usuarios'); }
        res.render('admin/usuario-form', { pageTitle: 'Editar Usuario', usuario, roles });
    } catch (error) { console.error(error); req.flash('error_msg', 'Error al cargar el formulario.'); res.redirect('/admin/usuarios'); }
};

exports.updateUser = async (req, res) => {
    const userId = req.params.id;
    const { nombre, email, password, RolId } = req.body;
    try {
        const usuario = await Usuario.findByPk(userId);
        if (!usuario) { req.flash('error_msg', 'Usuario no encontrado.'); return res.redirect('/admin/usuarios'); }
        usuario.nombre = nombre; usuario.email = email; usuario.RolId = RolId;
        if (password && password.trim() !== '') {
            usuario.password = password; // El hook del modelo se encargará del hash
        }
        await usuario.save();
        req.flash('success_msg', 'Usuario actualizado exitosamente.');
        res.redirect('/admin/usuarios');
    } catch (error) {
        const roles = await Rol.findAll();
        res.render('admin/usuario-form', { pageTitle: 'Editar Usuario', roles, error: error.errors[0].message, usuario: { id: userId, ...req.body } });
    }
};

exports.toggleUserStatus = async (req, res) => {
    try {
        const usuario = await Usuario.findByPk(req.params.id);
        usuario.activo = !usuario.activo;
        await usuario.save();
        req.flash('success_msg', `Usuario ${usuario.activo ? 'activado' : 'desactivado'}.`);
        res.redirect('/admin/usuarios');
    } catch (error) { console.error(error); req.flash('error_msg', 'Error al cambiar estado.'); res.redirect('/admin/usuarios'); }
};

// --- GESTIÓN DE MESAS (Conservado de tu código original) ---

exports.getMesas = async (req, res) => {
    try {
        const mesas = await Mesa.findAll({ order: [['numero', 'ASC']] });
        res.render('admin/mesas', { pageTitle: 'Gestión de Mesas', mesas });
    } catch (error) { console.error(error); req.flash('error_msg', 'Error al obtener las mesas.'); res.redirect('/admin'); }
};
exports.showNewMesaForm = (req, res) => { res.render('admin/mesa-form', { pageTitle: 'Añadir Nueva Mesa', mesa: {} }); };
exports.createMesa = async (req, res) => {
    try {
        const { numero, capacidad } = req.body;
        await Mesa.create({ numero, capacidad });
        req.flash('success_msg', 'Mesa creada exitosamente.');
        res.redirect('/admin/mesas');
    } catch (error) {
        res.render('admin/mesa-form', { pageTitle: 'Añadir Nueva Mesa', error: error.errors[0].message, mesa: req.body });
    }
};
exports.showEditMesaForm = async (req, res) => {
    try {
        const mesa = await Mesa.findByPk(req.params.id);
        if (!mesa) { req.flash('error_msg', 'Mesa no encontrada.'); return res.redirect('/admin/mesas'); }
        res.render('admin/mesa-form', { pageTitle: 'Editar Mesa', mesa });
    } catch (error) { console.error(error); req.flash('error_msg', 'Error al cargar la mesa.'); res.redirect('/admin/mesas'); }
};
exports.updateMesa = async (req, res) => {
    try {
        const mesa = await Mesa.findByPk(req.params.id);
        const { numero, capacidad } = req.body;
        await mesa.update({ numero, capacidad });
        req.flash('success_msg', 'Mesa actualizada exitosamente.');
        res.redirect('/admin/mesas');
    } catch (error) {
        res.render('admin/mesa-form', { pageTitle: 'Editar Mesa', error: error.errors[0].message, mesa: { id: req.params.id, ...req.body } });
    }
};
exports.deleteMesa = async (req, res) => {
    try {
        await Mesa.destroy({ where: { id: req.params.id } });
        req.flash('success_msg', 'Mesa eliminada exitosamente.');
        res.redirect('/admin/mesas');
    } catch (error) { console.error(error); req.flash('error_msg', 'Error al eliminar la mesa.'); res.redirect('/admin/mesas'); }
};

// --- (SECCIÓN REEMPLAZADA) - NUEVA Y MEJORADA GESTIÓN DE MENÚ ---

// Muestra la página principal de gestión de menús configurables
exports.getGestionMenu = async (req, res) => {
    try {
        const menus = await Menu.findAll({ order: [['id', 'ASC']] });
        res.render('admin/gestion-menu', { pageTitle: 'Gestión de Menús', menus });
    } catch (error) {
        console.error("Error al cargar la gestión de menús:", error);
        req.flash('error_msg', 'Error al cargar la página.');
        res.redirect('/admin');
    }
};

// Muestra la página con checkboxes para configurar los componentes de un menú
exports.showConfigurarMenu = async (req, res) => {
    try {
        const menu = await Menu.findByPk(req.params.id);
        if (!menu) {
            req.flash('error_msg', 'Menú no encontrado.');
            return res.redirect('/admin/gestion-menu');
        }
        const todosLosGrupos = await Grupo.findAll({
            include: { model: Componente, as: 'componentes' },
            order: [['id', 'ASC'], [{ model: Componente, as: 'componentes' }, 'nombre', 'ASC']]
        });
        const componentesSeleccionados = await menu.getComponentes();
        const selectedComponentIds = new Set(componentesSeleccionados.map(c => c.id));
        res.render('admin/configurar-menu', { pageTitle: `Configurar ${menu.nombre}`, menu, grupos: todosLosGrupos, selectedComponentIds });
    } catch (error) {
        console.error("Error al cargar la página de configuración:", error);
        req.flash('error_msg', 'Error al cargar la página de configuración.');
        res.redirect('/admin/gestion-menu');
    }
};

// Guarda la configuración de componentes seleccionados para un menú
exports.saveConfigurarMenu = async (req, res) => {
    try {
        const menu = await Menu.findByPk(req.params.id);
        const componenteIds = req.body.componenteIds || [];
        await menu.setComponentes(componenteIds);
        req.flash('success_msg', `Menú "${menu.nombre}" configurado exitosamente.`);
        res.redirect('/admin/gestion-menu');
    } catch (error) {
        console.error("Error al guardar la configuración del menú:", error);
        req.flash('error_msg', 'Hubo un error al guardar la configuración.');
        res.redirect(`/admin/menus/${req.params.id}/configurar`);
    }
};

// Muestra todos los grupos y todos los componentes existentes para poder crearlos
exports.getGestionComponentes = async (req, res) => {
    try {
        const grupos = await Grupo.findAll({
            include: { model: Componente, as: 'componentes' },
            order: [['nombre', 'ASC'], [{ model: Componente, as: 'componentes' }, 'nombre', 'ASC']]
        });
        res.render('admin/gestion-componentes', { pageTitle: 'Gestionar Componentes y Grupos', grupos });
    } catch (error) {
        console.error("Error al cargar componentes y grupos:", error);
        req.flash('error_msg', 'Error al cargar la página de componentes.');
        res.redirect('/admin');
    }
};

// Crea un nuevo componente
exports.createComponente = async (req, res) => {
    try {
        const { nombre, grupo_id } = req.body;
        await Componente.create({ nombre, grupo_id });
        req.flash('success_msg', 'Componente creado exitosamente.');
        res.redirect('/admin/gestion-componentes');
    } catch (error) {
        req.flash('error_msg', 'No se pudo crear el componente. ' + error.errors[0].message);
        res.redirect('/admin/gestion-componentes');
    }
};

// Crea un nuevo grupo
exports.createGrupo = async (req, res) => {
    try {
        const { nombre } = req.body;
        await Grupo.create({ nombre });
        req.flash('success_msg', 'Grupo creado exitosamente.');
        res.redirect('/admin/gestion-componentes');
    } catch (error) {
        req.flash('error_msg', 'No se pudo crear el grupo. ' + error.errors[0].message);
        res.redirect('/admin/gestion-componentes');
    }
};

// Muestra el formulario para crear un nuevo menú configurable
exports.showNewMenuForm = (req, res) => {
    // Solo necesitamos renderizar la vista con un objeto 'menu' vacío
    res.render('admin/menu-form', {
        pageTitle: 'Añadir Nuevo Menú',
        menu: {} // Objeto vacío para que el formulario no de error
    });
};

// Crea un nuevo menú configurable en la base de datos
exports.createMenu = async (req, res) => {
    try {
        const { nombre, precio_base, activo } = req.body;

        // El checkbox si no está marcado no envía nada, así lo convertimos a booleano
        const esActivo = !!activo;

        await Menu.create({
            nombre,
            precio_base,
            activo: esActivo
        });

        req.flash('success_msg', 'Menú creado exitosamente.');
        res.redirect('/admin/gestion-menu');

    } catch (error) {
        // Si hay un error de validación de la base de datos
        req.flash('error_msg', 'No se pudo crear el menú. ' + error.errors[0].message);
        // Re-renderizamos el formulario con los datos que el usuario ya había ingresado
        res.render('admin/menu-form', {
            pageTitle: 'Añadir Nuevo Menú',
            menu: req.body, // Pasamos los datos del body para rellenar el form
            error: error.errors[0].message
        });
    }
};

// controllers/adminController.js

// ... (todo tu código existente para usuarios, mesas y menús) ...

// --- PEGA ESTE NUEVO BLOQUE DE CÓDIGO AL FINAL DE TU ARCHIVO ---

// --- GESTIÓN DE COMPONENTES Y GRUPOS (LOS "INGREDIENTES" BASE) ---

// Muestra el formulario para editar un Componente
exports.showEditComponenteForm = async (req, res) => {
    try {
        const componente = await Componente.findByPk(req.params.id);
        const grupos = await Grupo.findAll();
        if (!componente) {
            req.flash('error_msg', 'Componente no encontrado.');
            return res.redirect('/admin/gestion-componentes');
        }
        res.render('admin/componente-form-edit', { pageTitle: 'Editar Componente', componente, grupos });
    } catch (error) {
        console.error("Error al cargar formulario de edición de componente:", error);
        req.flash('error_msg', 'Error al cargar el formulario.');
        res.redirect('/admin/gestion-componentes');
    }
};

// Actualiza un Componente en la base de datos
exports.updateComponente = async (req, res) => {
    try {
        const { nombre, grupo_id } = req.body;
        const componente = await Componente.findByPk(req.params.id);
        if (!componente) {
            req.flash('error_msg', 'Componente no encontrado.');
            return res.redirect('/admin/gestion-componentes');
        }
        await componente.update({ nombre, grupo_id });
        req.flash('success_msg', 'Componente actualizado exitosamente.');
        res.redirect('/admin/gestion-componentes');
    } catch (error) {
        console.error("Error al actualizar componente:", error);
        req.flash('error_msg', 'No se pudo actualizar el componente.');
        res.redirect(`/admin/componentes/editar/${req.params.id}`);
    }
};

// Elimina un Componente
exports.deleteComponente = async (req, res) => {
    try {
        await Componente.destroy({ where: { id: req.params.id } });
        req.flash('success_msg', 'Componente eliminado exitosamente.');
        res.redirect('/admin/gestion-componentes');
    } catch (error) {
        console.error("Error al eliminar componente:", error);
        req.flash('error_msg', 'No se pudo eliminar el componente.');
        res.redirect('/admin/gestion-componentes');
    }
};

// Muestra el formulario para editar un Grupo
exports.showEditGrupoForm = async (req, res) => {
    try {
        const grupo = await Grupo.findByPk(req.params.id);
        if (!grupo) {
            req.flash('error_msg', 'Grupo no encontrado.');
            return res.redirect('/admin/gestion-componentes');
        }
        res.render('admin/grupo-form-edit', { pageTitle: 'Editar Grupo', grupo });
    } catch (error) {
        console.error("Error al cargar formulario de edición de grupo:", error);
        req.flash('error_msg', 'Error al cargar el formulario.');
        res.redirect('/admin/gestion-componentes');
    }
};

// Actualiza un Grupo en la base de datos
exports.updateGrupo = async (req, res) => {
    try {
        const { nombre } = req.body;
        const grupo = await Grupo.findByPk(req.params.id);
        await grupo.update({ nombre });
        req.flash('success_msg', 'Grupo actualizado exitosamente.');
        res.redirect('/admin/gestion-componentes');
    } catch (error) {
        console.error("Error al actualizar grupo:", error);
        req.flash('error_msg', 'No se pudo actualizar el grupo.');
        res.redirect(`/admin/grupos/editar/${req.params.id}`);
    }
};

// Elimina un Grupo (y todos sus componentes asociados)
exports.deleteGrupo = async (req, res) => {
    try {
        // Al eliminar un grupo, Sequelize se encargará de eliminar
        // los componentes si la relación tiene 'onDelete: CASCADE'
        await Grupo.destroy({ where: { id: req.params.id } });
        req.flash('success_msg', 'Grupo eliminado exitosamente.');
        res.redirect('/admin/gestion-componentes');
    } catch (error) {
        console.error("Error al eliminar grupo:", error);
        req.flash('error_msg', 'No se pudo eliminar el grupo.');
        res.redirect('/admin/gestion-componentes');
    }
};

// Muestra el formulario para editar un menú existente
exports.showEditMenuForm = async (req, res) => {
    try {
        const menu = await Menu.findByPk(req.params.id);
        if (!menu) {
            req.flash('error_msg', 'Menú no encontrado.');
            return res.redirect('/admin/gestion-menu');
        }
        res.render('admin/menu-form', {
            pageTitle: `Editar Menú: ${menu.nombre}`,
            menu: menu // Pasamos el objeto del menú encontrado
        });
    } catch (error) {
        req.flash('error_msg', 'Error al cargar el formulario de edición.');
        res.redirect('/admin/gestion-menu');
    }
};

// Actualiza un menú en la base de datos
exports.updateMenu = async (req, res) => {
    try {
        const menuId = req.params.id;
        const menu = await Menu.findByPk(menuId);
        if (!menu) {
            req.flash('error_msg', 'Menú no encontrado.');
            return res.redirect('/admin/gestion-menu');
        }

        const { nombre, precio_base, activo } = req.body;
        const esActivo = !!activo; // Convierte el valor del checkbox a booleano

        await menu.update({
            nombre,
            precio_base,
            activo: esActivo
        });

        req.flash('success_msg', 'Menú actualizado exitosamente.');
        res.redirect('/admin/gestion-menu');

    } catch (error) {
        req.flash('error_msg', 'No se pudo actualizar el menú. ' + error.errors[0].message);
        res.redirect(`/admin/menus/editar/${req.params.id}`);
    }
};

// Elimina un menú de la base de datos
exports.deleteMenu = async (req, res) => {
    try {
        const menu = await Menu.findByPk(req.params.id);
        if (!menu) {
            req.flash('error_msg', 'Menú no encontrado.');
            return res.redirect('/admin/gestion-menu');
        }

        await menu.destroy();
        req.flash('success_msg', 'Menú eliminado exitosamente.');
        res.redirect('/admin/gestion-menu');
    } catch (error) {
        req.flash('error_msg', 'Error al eliminar el menú.');
        res.redirect('/admin/gestion-menu');
    }
};