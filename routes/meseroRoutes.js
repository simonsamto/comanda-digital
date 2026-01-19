'use strict';
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize'); 
const { Mesa, Menu, Grupo, Componente, Pedido, PedidoItem, sequelize } = require('../models');

// ==========================================
// RUTA 1: MAPA DE MESAS (CORREGIDO ORDEN)
// ==========================================
router.get('/', async (req, res) => {
    try {
        const mesas = await Mesa.findAll({
            order: [['numero', 'ASC']],
            include: [{
                model: Pedido,
                as: 'pedidos',
                required: false,
                where: {
                    // Traemos cualquier pedido que NO esté cerrado
                    estado: { [Op.notIn]: ['pagado', 'cancelado', 'finalizado'] }
                },
                // --- CORRECCIÓN CLAVE AQUÍ ---
                // Ordenamos por la última actualización. Así, si cocina acaba de marcar "listo",
                // este será el primer pedido que veamos, ignorando bugs viejos.
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
// RUTA 2: SELECCIONAR CANTIDAD DE CLIENTES
// ==========================================
router.get('/mesa/:mesaId/clientes', async (req, res) => {
    try {
        const mesa = await Mesa.findByPk(req.params.mesaId);
        // Si está por cobrar o tiene pedido pendiente de entrega, no deja abrir uno nuevo
        if (!mesa || mesa.estado === 'por_cobrar') return res.redirect('/mesero');
        res.render('mesero/cantidad-clientes', { mesa });
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
            include: [{ 
                model: Componente, 
                as: 'componentes', 
                attributes: ['nombre'],
                through: { attributes: ['por_defecto'] } 
            }] 
        });

        if (menusRaw.length === 0) return res.redirect('/mesero');

        const menus = menusRaw.map(m => {
            const componentesDefault = m.componentes.filter(c => c.MenuComponente.por_defecto);
            const resumenTexto = componentesDefault.map(c => c.nombre).join(', ');
            return { id: m.id, nombre: m.nombre, precio_base: m.precio_base, resumen: resumenTexto };
        });

        res.render('mesero/seleccionar-menus-clientes', { 
            mesa, menus, cantidadClientes: parseInt(req.query.cantidadClientes) || 1 
        });
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
        res.render('mesero/tomar-pedido', { mesa, clientesConMenus });
    } catch (error) { res.redirect(`/mesero/tomar-pedido/${req.params.mesaId}`); }
});

// ==========================================
// RUTA 5: GUARDAR PEDIDO
// ==========================================
router.post('/tomar-pedido/:mesaId', async (req, res) => {
    const { mesaId } = req.params;
    const { clientes } = req.body; 
    if (!clientes) return res.redirect('/mesero');
    
    const t = await sequelize.transaction();
    try {
        const nuevoPedido = await Pedido.create({ mesa_id: parseInt(mesaId), estado: 'recibido' }, { transaction: t });

        for (const idx in clientes) {
            const cData = clientes[idx]; 
            const menu = await Menu.findByPk(cData.menuId);
            const idsComponentes = Object.values(cData).flat().filter(v => !isNaN(parseInt(v)) && parseInt(v) !== parseInt(cData.menuId)).map(id => parseInt(id));
            const item = await PedidoItem.create({ pedido_id: nuevoPedido.id, cliente_numero: parseInt(idx) + 1, notas: cData.notas || '', precio_unitario: menu ? menu.precio_base : 0, menu_nombre: menu ? menu.nombre : 'Personalizado' }, { transaction: t });
            if (idsComponentes.length > 0) await item.setComponentes(idsComponentes, { transaction: t });
        }

        await Mesa.update({ estado: 'ocupado' }, { where: { id: mesaId }, transaction: t });
        await t.commit();

        const io = req.app.get('socketio');
        if (io) {
            const pedidoCompleto = await Pedido.findByPk(nuevoPedido.id, { include: [{ model: Mesa, as: 'mesa'}, { model: PedidoItem, as: 'items', include: [{ model: Componente, as: 'componentes', include: [{model: Grupo, as: 'grupo'}] }] }] });
            io.emit('nuevo_pedido', pedidoCompleto.toJSON());
        }
        res.redirect('/mesero');
    } catch (error) { await t.rollback(); res.redirect('/mesero'); }
});

// ==========================================
// RUTA 6: ENTREGAR PEDIDO
// ==========================================
router.post('/entregar-pedido/:mesaId', async (req, res) => {
    try {
        await Pedido.update(
            { estado: 'entregado' }, 
            { where: { mesa_id: req.params.mesaId, estado: ['elaborado', 'recibido', 'en_preparacion'] } }
        );
        await Mesa.update({ estado: 'por_cobrar' }, { where: { id: req.params.mesaId } });
        
        const io = req.app.get('socketio');
        if (io) io.emit('mesa_por_cobrar', { mesaId: req.params.mesaId });
        
        res.redirect('/mesero');
    } catch (error) { 
        console.error(error);
        res.redirect('/mesero'); 
    }
});

module.exports = router;