'use strict';
const { Usuario, Rol, Mesa, Menu, Grupo, Componente, Pedido, PedidoItem, sequelize } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');

// 1. DASHBOARD
exports.showDashboard = async (req, res) => {
    try {
        const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
        const finDia = new Date(); finDia.setHours(23, 59, 59, 999);

        const todosPedidosHoy = await Pedido.findAll({
            where: { createdAt: { [Op.between]: [inicioDia, finDia] } },
            include: [{
                model: PedidoItem, as: 'items',
                include: [{ model: Componente, as: 'componentes' }]
            }]
        });

        let totalDinero = 0;
        let cantidadPedidos = 0;
        let platosVendidos = 0;
        const ventasPorPlato = {};
        const conteoEstados = { 'En Cocina': 0, 'Para Recoger': 0, 'En Mesa': 0, 'Finalizado': 0 };

        todosPedidosHoy.forEach(pedido => {
            if (pedido.estado === 'recibido' || pedido.estado === 'en_preparacion') conteoEstados['En Cocina']++;
            else if (pedido.estado === 'elaborado') conteoEstados['Para Recoger']++;
            else if (pedido.estado === 'entregado') conteoEstados['En Mesa']++;
            else if (pedido.estado === 'pagado') {
                conteoEstados['Finalizado']++;
                cantidadPedidos++;
                pedido.items.forEach(item => {
                    totalDinero += parseFloat(item.precio_unitario || 0);
                    platosVendidos++;
                    item.componentes.forEach(comp => totalDinero += parseFloat(comp.precio_adicional || 0));
                    const etiqueta = `Almuerzo ($${parseFloat(item.precio_unitario).toFixed(0)})`;
                    ventasPorPlato[etiqueta] = (ventasPorPlato[etiqueta] || 0) + 1;
                });
            }
        });

        res.render('admin/dashboard', { 
            pageTitle: 'Panel de Control',
            totalDinero, cantidadPedidos, platosVendidos,
            chartLabels: JSON.stringify(Object.keys(ventasPorPlato)),
            chartData: JSON.stringify(Object.values(ventasPorPlato)),
            estadosLabels: JSON.stringify(Object.keys(conteoEstados)),
            estadosData: JSON.stringify(Object.values(conteoEstados))
        });
    } catch (error) {
        console.error("Error en dashboard:", error);
        res.status(500).send("Error al cargar el dashboard");
    }
};

// 2. GESTIÓN DE MENÚS
exports.getGestionMenu = async (req, res) => {
    try {
        const menus = await Menu.findAll({ order: [['id', 'ASC']] });
        res.render('admin/gestion-menu', { pageTitle: 'Gestión de Menús', menus });
    } catch (error) { res.redirect('/admin'); }
};

exports.showNewMenuForm = (req, res) => res.render('admin/menu-form', { pageTitle: 'Nuevo Menú', menu: {} });

exports.createMenu = async (req, res) => {
    try {
        const { nombre, precio_base, activo } = req.body;
        await Menu.create({ nombre, precio_base, activo: !!activo });
        req.flash('success_msg', 'Menú creado.');
        res.redirect('/admin/gestion-menu');
    } catch (error) { res.render('admin/menu-form', { pageTitle: 'Nuevo Menú', menu: req.body, error: error.message }); }
};

exports.showEditMenuForm = async (req, res) => {
    try {
        const menu = await Menu.findByPk(req.params.id);
        res.render('admin/menu-form', { pageTitle: 'Editar Menú', menu });
    } catch (error) { res.redirect('/admin/gestion-menu'); }
};

exports.updateMenu = async (req, res) => {
    try {
        const menu = await Menu.findByPk(req.params.id);
        const { nombre, precio_base, activo } = req.body;
        await menu.update({ nombre, precio_base, activo: !!activo });
        req.flash('success_msg', 'Menú actualizado.');
        res.redirect('/admin/gestion-menu');
    } catch (error) { res.redirect('/admin/gestion-menu'); }
};

exports.deleteMenu = async (req, res) => {
    try {
        await Menu.destroy({ where: { id: req.params.id } });
        req.flash('success_msg', 'Menú eliminado.');
        res.redirect('/admin/gestion-menu');
    } catch (error) { res.redirect('/admin/gestion-menu'); }
};

exports.showConfigurarMenu = async (req, res) => {
    try {
        const menu = await Menu.findByPk(req.params.id);
        const todosLosGrupos = await Grupo.findAll({
            include: { model: Componente, as: 'componentes' },
            order: [['id', 'ASC'], [{ model: Componente, as: 'componentes' }, 'nombre', 'ASC']]
        });
        const compSel = await menu.getComponentes();
        const selectedComponentIds = new Set(compSel.map(c => c.id));
        res.render('admin/configurar-menu', { pageTitle: 'Configurar Menú', menu, grupos: todosLosGrupos, selectedComponentIds });
    } catch (error) { res.redirect('/admin/gestion-menu'); }
};

exports.saveConfigurarMenu = async (req, res) => {
    try {
        const menu = await Menu.findByPk(req.params.id);
        await menu.setComponentes(req.body.componenteIds || []);
        req.flash('success_msg', 'Configuración guardada.');
        res.redirect('/admin/gestion-menu');
    } catch (error) { res.redirect('/admin/gestion-menu'); }
};

// 3. GESTIÓN COMPONENTES Y GRUPOS
exports.getGestionComponentes = async (req, res) => {
    try {
        const grupos = await Grupo.findAll({
            include: { model: Componente, as: 'componentes' },
            order: [['nombre', 'ASC']]
        });
        res.render('admin/gestion-componentes', { pageTitle: 'Componentes y Grupos', grupos });
    } catch (error) { res.redirect('/admin'); }
};

exports.createComponente = async (req, res) => {
    try {
        const { nombre, grupo_id, precio_adicional } = req.body;
        await Componente.create({
            nombre,
            grupo_id,
            precio_adicional: parseFloat(precio_adicional) || 0
        });
        req.flash('success_msg', 'Componente creado.');
        res.redirect('/admin/gestion-componentes');
    } catch (error) { 
        req.flash('error_msg', 'Error al crear componente.');
        res.redirect('/admin/gestion-componentes'); 
    }
};

exports.createGrupo = async (req, res) => {
    try {
        await Grupo.create(req.body);
        req.flash('success_msg', 'Grupo creado.');
        res.redirect('/admin/gestion-componentes');
    } catch (error) { 
        req.flash('error_msg', 'Error al crear grupo.');
        res.redirect('/admin/gestion-componentes'); 
    }
};

exports.showEditComponenteForm = async (req, res) => { 
    try {
        const componente = await Componente.findByPk(req.params.id);
        const grupos = await Grupo.findAll();
        res.render('admin/componente-form-edit', { pageTitle: 'Editar Componente', componente, grupos });
    } catch (error) { res.redirect('/admin/gestion-componentes'); }
};

exports.updateComponente = async (req, res) => { 
    try {
        const { nombre, grupo_id, precio_adicional } = req.body;
        await Componente.update({
            nombre,
            grupo_id,
            precio_adicional: parseFloat(precio_adicional) || 0
        }, { where: { id: req.params.id } });
        req.flash('success_msg', 'Actualizado.');
        res.redirect('/admin/gestion-componentes');
    } catch(e) { res.redirect('/admin/gestion-componentes'); }
};

exports.deleteComponente = async (req, res) => { 
    try { await Componente.destroy({ where: { id: req.params.id } }); res.redirect('/admin/gestion-componentes'); } catch(e){ res.redirect('/admin/gestion-componentes'); }
};

exports.showEditGrupoForm = async (req, res) => { 
    try {
        const grupo = await Grupo.findByPk(req.params.id);
        res.render('admin/grupo-form-edit', { pageTitle: 'Editar Grupo', grupo });
    } catch (error) { res.redirect('/admin/gestion-componentes'); }
};

exports.updateGrupo = async (req, res) => { 
    try {
        await Grupo.update(req.body, { where: { id: req.params.id } });
        res.redirect('/admin/gestion-componentes');
    } catch(e) { res.redirect('/admin/gestion-componentes'); }
};

exports.deleteGrupo = async (req, res) => { 
    try { await Grupo.destroy({ where: { id: req.params.id } }); res.redirect('/admin/gestion-componentes'); } catch(e){ res.redirect('/admin/gestion-componentes'); }
};

// 4. GESTIÓN DE USUARIOS
exports.getUsuarios = async (req, res) => { 
    try {
        const usuarios = await Usuario.findAll({ include: { model: Rol, as: 'rol' } });
        res.render('admin/usuarios', { pageTitle: 'Usuarios', usuarios });
    } catch (error) { res.redirect('/admin'); }
};

exports.showNewUserForm = async (req, res) => {
    try {
        const roles = await Rol.findAll();
        res.render('admin/usuario-form', { pageTitle: 'Crear Usuario', usuario: {}, roles });
    } catch (error) { res.redirect('/admin/usuarios'); }
};

exports.createUser = async (req, res) => {
    try {
        const { nombre, email, password, RolId } = req.body;
        await Usuario.create({ nombre, email, password, RolId });
        req.flash('success_msg', 'Usuario creado.');
        res.redirect('/admin/usuarios');
    } catch (error) {
        const roles = await Rol.findAll();
        res.render('admin/usuario-form', { pageTitle: 'Crear Usuario', usuario: req.body, roles, error: error.message });
    }
};

exports.showEditUserForm = async (req, res) => { 
    try {
        const usuario = await Usuario.findByPk(req.params.id);
        const roles = await Rol.findAll();
        res.render('admin/usuario-form', { pageTitle: 'Editar Usuario', usuario, roles });
    } catch (error) { res.redirect('/admin/usuarios'); }
};

exports.updateUser = async (req, res) => { 
    try {
        const { nombre, email, password, RolId } = req.body;
        const usuario = await Usuario.findByPk(req.params.id);
        usuario.nombre = nombre;
        usuario.email = email;
        usuario.RolId = RolId;
        if (password) usuario.password = password;
        await usuario.save();
        res.redirect('/admin/usuarios');
    } catch (error) { res.redirect('/admin/usuarios'); }
};

exports.toggleUserStatus = async (req, res) => { 
    try {
        const usuario = await Usuario.findByPk(req.params.id);
        usuario.activo = !usuario.activo;
        await usuario.save();
        res.redirect('/admin/usuarios');
    } catch (error) { res.redirect('/admin/usuarios'); }
};

// 5. GESTIÓN DE MESAS Y MAPA (AQUÍ ESTÁ LA CORRECCIÓN CLAVE)
exports.getMesas = async (req, res) => { 
    try {
        const mesas = await Mesa.findAll({ order: [['numero', 'ASC']] });
        res.render('admin/mesas', { pageTitle: 'Mesas', mesas });
    } catch (error) { res.redirect('/admin'); }
};

exports.showNewMesaForm = (req, res) => res.render('admin/mesa-form', { pageTitle: 'Nueva Mesa', mesa: {} });

exports.createMesa = async (req, res) => { 
    try {
        await Mesa.create(req.body);
        req.flash('success_msg', 'Mesa creada.');
        res.redirect('/admin/mesas');
    } catch (error) {
        res.render('admin/mesa-form', { pageTitle: 'Nueva Mesa', mesa: req.body, error: error.message });
    }
};

exports.showEditMesaForm = async (req, res) => { 
    try {
        const mesa = await Mesa.findByPk(req.params.id);
        res.render('admin/mesa-form', { pageTitle: 'Editar Mesa', mesa });
    } catch (error) { res.redirect('/admin/mesas'); }
};

exports.updateMesa = async (req, res) => { 
    try {
        await Mesa.update(req.body, { where: { id: req.params.id } });
        res.redirect('/admin/mesas');
    } catch (error) { res.redirect('/admin/mesas'); }
};

exports.deleteMesa = async (req, res) => { 
    try {
        await Mesa.destroy({ where: { id: req.params.id } });
        res.redirect('/admin/mesas');
    } catch (error) { res.redirect('/admin/mesas'); }
};

exports.liberarTodasLasMesas = async (req, res) => {
    await Mesa.update({ estado: 'libre' }, { where: {} });
    res.redirect('/admin/mesas');
};

exports.getMapaEditor = async (req, res) => {
    const mesas = await Mesa.findAll();
    res.render('admin/mapa-editor', { pageTitle: 'Diseñador de Mapa', mesas });
};

// --- FUNCIÓN CORREGIDA PARA GUARDAR EL MAPA ---
exports.saveMapaLayout = async (req, res) => {
    try {
        const mesasPositions = req.body; 
        console.log(">>> GUARDANDO MAPA:", JSON.stringify(mesasPositions));

        if (!Array.isArray(mesasPositions)) return res.status(400).json({ success: false });
        
        let actualizados = 0;
        for (const pos of mesasPositions) {
            const id = parseInt(pos.id);
            if (!isNaN(id)) {
                await Mesa.update({
                    pos_x: parseInt(pos.x) || 0,
                    pos_y: parseInt(pos.y) || 0,
                    ancho: parseInt(pos.w) || 120,
                    alto: parseInt(pos.h) || 120
                }, { where: { id: id } });
                actualizados++;
            }
        }
        res.json({ success: true, message: `Mapa guardado. ${actualizados} mesas.` });
    } catch (error) {
        console.error("Error FATAL al guardar mapa:", error);
        res.status(500).json({ success: false });
    }
};

// 6. INFORMES
exports.getInformes = (req, res) => {
    res.render('admin/informes', { pageTitle: 'Centro de Informes' });
};

exports.generarReporteFechas = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.body;
        const start = new Date(fechaInicio); start.setHours(0,0,0,0);
        const end = new Date(fechaFin); end.setHours(23,59,59,999);

        const ventas = await Pedido.findAll({
            where: {
                estado: 'pagado',
                createdAt: { [Op.between]: [start, end] }
            },
            include: [{
                model: PedidoItem, as: 'items',
                include: [{ model: Componente, as: 'componentes' }]
            }],
            order: [['createdAt', 'DESC']]
        });

        let totalIngresos = 0;
        let totalPedidos = ventas.length;

        const detalleVentas = ventas.map(pedido => {
            let totalPedido = 0;
            pedido.items.forEach(item => {
                totalPedido += parseFloat(item.precio_unitario || 0);
                item.componentes.forEach(comp => totalPedido += parseFloat(comp.precio_adicional || 0));
            });
            totalIngresos += totalPedido;
            return { id: pedido.id, fecha: pedido.createdAt, mesa: pedido.mesa_id, total: totalPedido };
        });

        res.render('admin/reporte-resultados', {
            pageTitle: `Reporte de Ventas`,
            tipo: 'ventas',
            datos: detalleVentas,
            resumen: { totalIngresos, totalPedidos }
        });
    } catch (error) { res.redirect('/admin/informes'); }
};

exports.generarReporteTop = async (req, res) => {
    try {
        const pedidos = await Pedido.findAll({
            where: { estado: 'pagado' },
            include: [{
                model: PedidoItem, as: 'items',
                include: [{ model: Componente, as: 'componentes' }]
            }]
        });

        const ranking = {};
        pedidos.forEach(pedido => {
            pedido.items.forEach(item => {
                const nombrePlato = `Menú ($${item.precio_unitario})`;
                if (!ranking[nombrePlato]) ranking[nombrePlato] = { cantidad: 0, tipo: 'Plato' };
                ranking[nombrePlato].cantidad++;

                item.componentes.forEach(comp => {
                    if (!ranking[comp.nombre]) ranking[comp.nombre] = { cantidad: 0, tipo: 'Componente' };
                    ranking[comp.nombre].cantidad++;
                });
            });
        });

        const rankingArray = Object.keys(ranking).map(key => ({
            nombre: key, cantidad: ranking[key].cantidad, tipo: ranking[key].tipo
        })).sort((a, b) => b.cantidad - a.cantidad);

        res.render('admin/reporte-resultados', {
            pageTitle: 'Ranking de Productos',
            tipo: 'ranking',
            datos: rankingArray
        });
    } catch (error) { res.redirect('/admin/informes'); }
};