'use strict';
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Mesa, Menu, Grupo, Componente, Pedido, PedidoItem, sequelize } = require('../models');

// ==========================================
// RUTA 1: MAPA DE MESAS (DASHBOARD)
// ==========================================
router.get('/', async (req, res) => {
    try {
        const mesas = await Mesa.findAll({
            order: [['numero', 'ASC']],
            include: [{
                model: Pedido,
                as: 'pedidos',
                required: false,
                where: { estado: { [Op.notIn]: ['pagado', 'cancelado', 'finalizado'] } },
                order: [['updatedAt', 'DESC']],
                limit: 1
            }]
        });

        const menusDelDia = await Menu.findAll({ 
            where: { activo: true }, 
            include: [{ model: Componente, as: 'componentes', include: [{ model: Grupo, as: 'grupo' }] }] 
        });

        res.render('mesero/dashboard', { mesas, menus: menusDelDia, pageTitle: 'Mapa' });
    } catch (error) { 
        console.error("Error mapa mesero:", error);
        res.status(500).send("Error al cargar el mapa"); 
    }
});

// ==========================================
// RUTA 2: INICIO (CANTIDAD CLIENTES)
// ==========================================
router.get('/mesa/:mesaId/clientes', async (req, res) => {
    try {
        const mesa = await Mesa.findByPk(req.params.mesaId);
        if (!mesa || mesa.estado === 'por_cobrar') return res.redirect('/mesero');

        // Si ya hay pedido activo, redirigir a editar
        const pedidoActivo = await Pedido.findOne({
            where: { mesa_id: mesa.id, estado: ['recibido', 'en_preparacion'] }
        });

        if (pedidoActivo) return res.redirect(`/mesero/editar-pedido/${pedidoActivo.id}`);

        res.render('mesero/cantidad-clientes', { mesa, pageTitle: 'Cantidad de Clientes' });
    } catch (error) { res.redirect('/mesero'); }
});

// ==========================================
// RUTA 3: SELECCIONAR MENÚS
// ==========================================
router.get('/tomar-pedido/:mesaId', async (req, res) => {
    try {
        const { mesaId } = req.params;
        const mesa = await Mesa.findByPk(mesaId);
        if (!mesa) return res.redirect('/mesero');

        const menusRaw = await Menu.findAll({ 
            where: { activo: true }, 
            include: [{ model: Componente, as: 'componentes', attributes: ['nombre'], through: { attributes: ['por_defecto'] } }] 
        });

        if (menusRaw.length === 0) {
            req.flash('error_msg', 'No hay menús activos.');
            return res.redirect('/mesero');
        }

        const menus = menusRaw.map(m => {
            const componentesDefault = m.componentes.filter(c => c.MenuComponente && c.MenuComponente.por_defecto);
            const resumenTexto = componentesDefault.map(c => c.nombre).join(', ') || "Básico";
            return { id: m.id, nombre: m.nombre, precio_base: m.precio_base, resumen: resumenTexto };
        });

        res.render('mesero/seleccionar-menus-clientes', { mesa, menus, cantidadClientes: parseInt(req.query.cantidadClientes) || 1 });
    } catch (error) { res.redirect('/mesero'); }
});

// ==========================================
// RUTA 4: PROCESAR MENÚS
// ==========================================
router.post('/personalizar-pedido/:mesaId', async (req, res) => {
    try {
        const { mesaId } = req.params;
        const { cantidadClientes } = req.body;
        const mesa = await Mesa.findByPk(mesaId);
        const clientesConMenus = [];

        for (let i = 1; i <= parseInt(cantidadClientes); i++) {
            const mId = req.body[`cliente_${i}_menu`];
            if (!mId) continue; 

            const menu = await Menu.findByPk(mId);
            const comps = await menu.getComponentes({ include: [{ model: Grupo, as: 'grupo' }] });
            
            const grupos = {};
            comps.forEach(c => {
                const gNombre = c.grupo ? c.grupo.nombre : 'Otros';
                if(!grupos[gNombre]) grupos[gNombre] = { id: c.grupo ? c.grupo.id : 999, componentes: [] };
                const isDefault = c.MenuComponente ? c.MenuComponente.por_defecto : false;
                grupos[gNombre].componentes.push({ id: c.id, nombre: c.nombre, precio: c.precio_adicional, por_defecto: isDefault });
            });
            clientesConMenus.push({ clienteNumero: i, menu, grupos });
        }
        res.render('mesero/tomar-pedido', { mesa, clientesConMenus, esEdicion: false });
    } catch (error) { res.redirect(`/mesero/tomar-pedido/${req.params.mesaId}`); }
});

// ==========================================
// RUTA NUEVA: EDITAR PEDIDO EXISTENTE
// ==========================================
router.get('/editar-pedido/:pedidoId', async (req, res) => {
    try {
        const pedido = await Pedido.findByPk(req.params.pedidoId, {
            include: [
                { model: Mesa, as: 'mesa' },
                { model: PedidoItem, as: 'items', include: [{ model: Componente, as: 'componentes' }] }
            ]
        });

        if (!pedido || (pedido.estado !== 'recibido' && pedido.estado !== 'en_preparacion')) {
            req.flash('error_msg', 'Este pedido ya no se puede editar.');
            return res.redirect('/mesero');
        }

        const clientesConMenus = [];
        const gruposDb = await Grupo.findAll({ include: [{ model: Componente, as: 'componentes' }] });

        for (const item of pedido.items) {
            const menuSimulado = { id: 0, nombre: item.menu_nombre, precio_base: item.precio_unitario };
            const gruposOrganizados = {};
            const idsSeleccionados = item.componentes.map(c => c.id);

            gruposDb.forEach(g => {
                gruposOrganizados[g.nombre] = { id: g.id, componentes: [] };
                g.componentes.forEach(c => {
                    gruposOrganizados[g.nombre].componentes.push({
                        id: c.id, nombre: c.nombre, precio: c.precio_adicional,
                        por_defecto: idsSeleccionados.includes(c.id)
                    });
                });
            });

            clientesConMenus.push({ clienteNumero: item.cliente_numero, menu: menuSimulado, grupos: gruposOrganizados, notas: item.notas });
        }

        res.render('mesero/tomar-pedido', { mesa: pedido.mesa, clientesConMenus, esEdicion: true, pedidoId: pedido.id });

    } catch (error) { console.error(error); res.redirect('/mesero'); }
});

// ==========================================
// RUTA 5: GUARDAR PEDIDO (CREAR O ACTUALIZAR)
// ==========================================
router.post('/tomar-pedido/:mesaId', async (req, res) => {
    const { mesaId } = req.params;
    const { clientes, pedidoId } = req.body; 

    if (!clientes) return res.redirect('/mesero');
    
    const t = await sequelize.transaction();
    try {
        let pedido;
        let esActualizacion = false;

        if (pedidoId) {
            // ACTUALIZAR
            pedido = await Pedido.findByPk(pedidoId);
            await PedidoItem.destroy({ where: { pedido_id: pedidoId }, transaction: t });
            esActualizacion = true;
        } else {
            // CREAR NUEVO
            pedido = await Pedido.create({ mesa_id: parseInt(mesaId), estado: 'recibido' }, { transaction: t });
        }

        for (const idx in clientes) {
            const cData = clientes[idx]; 
            let menuNombre = 'Plato';
            let precioUnitario = 0;

            if (cData.menuId && cData.menuId != '0') {
                const menu = await Menu.findByPk(cData.menuId);
                if(menu) { menuNombre = menu.nombre; precioUnitario = menu.precio_base; }
            } else if (esActualizacion) {
                // Si es edición y no viene menuId, usamos un valor por defecto o lógica adicional
                menuNombre = 'Plato Editado'; 
            }

            const idsComponentes = Object.values(cData).flat()
                .filter(v => !isNaN(parseInt(v)) && v != cData.menuId && v != pedidoId)
                .map(id => parseInt(id));
            
            const item = await PedidoItem.create({ 
                pedido_id: pedido.id, 
                cliente_numero: parseInt(idx) + 1, 
                notas: cData.notas || '', 
                precio_unitario: precioUnitario, 
                menu_nombre: menuNombre 
            }, { transaction: t });

            if (idsComponentes.length > 0) await item.setComponentes(idsComponentes, { transaction: t });
        }

        await Mesa.update({ estado: 'ocupado' }, { where: { id: mesaId }, transaction: t });
        await t.commit();

        // -------------------------------------------------------------
        // --- NOTIFICACIÓN SOCKET.IO CON DISTINCIÓN DE EVENTO ---
        // -------------------------------------------------------------
        const io = req.app.get('socketio');
        if (io) {
            const pedidoCompleto = await Pedido.findByPk(pedido.id, {
                include: [{ model: Mesa, as: 'mesa' }, { model: PedidoItem, as: 'items', include: [{ model: Componente, as: 'componentes', include: [{model: Grupo, as: 'grupo'}] }] }]
            });
            
            if (esActualizacion) {
                console.log(">>> SOCKET: Emitiendo 'pedido_modificado'");
                io.emit('pedido_modificado', pedidoCompleto.toJSON());
            } else {
                console.log(">>> SOCKET: Emitiendo 'nuevo_pedido'");
                io.emit('nuevo_pedido', pedidoCompleto.toJSON());
            }
        }
        
        req.flash('success_msg', esActualizacion ? '¡Pedido modificado!' : '¡Pedido enviado a cocina!');
        res.redirect('/mesero');

    } catch (error) { 
        await t.rollback(); 
        console.error("Error al guardar:", error);
        req.flash('error_msg', 'Error al guardar.');
        res.redirect('/mesero'); 
    }
});

// ==========================================
// RUTA 6: ENTREGAR PEDIDO
// ==========================================
router.post('/entregar-pedido/:mesaId', async (req, res) => {
    try {
        const pedidos = await Pedido.findAll({ where: { mesa_id: req.params.mesaId, estado: ['elaborado', 'recibido', 'en_preparacion'] } });
        if (pedidos.length > 0) {
            await Pedido.update({ estado: 'entregado' }, { where: { mesa_id: req.params.mesaId, estado: ['elaborado', 'recibido', 'en_preparacion'] } });
            
            const io = req.app.get('socketio');
            if (io) pedidos.forEach(p => io.emit('actualizacion_estado', { pedidoId: p.id, nuevoEstado: 'entregado' }));
        }

        await Mesa.update({ estado: 'por_cobrar' }, { where: { id: req.params.mesaId } });
        const io = req.app.get('socketio');
        if (io) io.emit('mesa_por_cobrar', { mesaId: req.params.mesaId });
        
        res.redirect('/mesero');
    } catch (error) { res.redirect('/mesero'); }
});

module.exports = router;