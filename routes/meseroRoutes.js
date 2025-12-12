'use strict';
const express = require('express');
const router = express.Router();
const { Mesa, Menu, Grupo, Componente, Pedido, PedidoItem, sequelize } = require('../models');

// RUTA 1: MAPA DE MESAS
router.get('/', async (req, res) => {
    try {
        const mesas = await Mesa.findAll({ order: [['numero', 'ASC']] });
        res.render('mesero/dashboard', { mesas, pageTitle: 'Mapa de Mesas' });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error interno.");
    }
});

// RUTA 2: CANTIDAD DE CLIENTES
router.get('/mesa/:mesaId/clientes', async (req, res) => {
    try {
        const mesa = await Mesa.findByPk(req.params.mesaId);
        if (!mesa) return res.redirect('/mesero');
        res.render('mesero/cantidad-clientes', { mesa, pageTitle: 'Cantidad de Clientes' });
    } catch (error) {
        res.redirect('/mesero');
    }
});

// RUTA 3: SELECCIONAR MENÚS
router.get('/tomar-pedido/:mesaId', async (req, res) => {
    try {
        const { mesaId } = req.params;
        const { cantidadClientes } = req.query;

        const mesa = await Mesa.findByPk(mesaId);
        if (!mesa) return res.redirect('/mesero');

        const menusActivos = await Menu.findAll({ where: { activo: true } });
        if (menusActivos.length === 0) {
            req.flash('error_msg', 'No hay menús activos.');
            return res.redirect('/mesero');
        }

        res.render('mesero/seleccionar-menus-clientes', {
            pageTitle: 'Seleccionar Menús',
            mesa,
            menus: menusActivos,
            cantidadClientes: parseInt(cantidadClientes) || 1
        });
    } catch (error) {
        console.error(error);
        res.redirect('/mesero');
    }
});

// RUTA 4: PROCESAR MENÚS
router.post('/seleccionar-menus-clientes/:mesaId', async (req, res) => {
    try {
        const { mesaId } = req.params;
        const { cantidadClientes } = req.body;
        const numClientes = parseInt(cantidadClientes);
        const mesa = await Mesa.findByPk(mesaId);
        const clientesConMenus = [];

        for (let i = 1; i <= numClientes; i++) {
            const menuId = req.body[`cliente_${i}_menu`];
            if (!menuId) continue;

            const menu = await Menu.findByPk(menuId);
            const componentes = await menu.getComponentes({
                include: [{ model: Grupo, as: 'grupo' }],
                order: [[{ model: Grupo, as: 'grupo' }, 'id', 'ASC']]
            });

            const gruposOrganizados = {};
            componentes.forEach(comp => {
                const gName = comp.grupo.nombre;
                if (!gruposOrganizados[gName]) {
                    gruposOrganizados[gName] = { id: comp.grupo.id, componentes: [] };
                }
                gruposOrganizados[gName].componentes.push(comp);
            });

            clientesConMenus.push({
                clienteNumero: i,
                menu: menu,
                grupos: gruposOrganizados
            });
        }

        res.render('mesero/tomar-pedido', {
            pageTitle: `Pedido Mesa ${mesa.numero}`,
            mesa,
            clientesConMenus
        });

    } catch (error) {
        console.error("Error al procesar menús:", error);
        res.redirect('/mesero');
    }
});

// RUTA 5: GUARDAR PEDIDO (CON PRECIO BASE)
router.post('/tomar-pedido/:mesaId', async (req, res) => {
    const { mesaId } = req.params;
    const { clientes } = req.body;

    if (!clientes) return res.redirect('/mesero');

    const t = await sequelize.transaction();
    try {
        const nuevoPedido = await Pedido.create({ 
            mesa_id: parseInt(mesaId), 
            estado: 'recibido' 
        }, { transaction: t });
        
        for (const idx in clientes) {
            const clienteData = clientes[idx];
            
            // 1. BUSCAR EL PRECIO DEL MENÚ SELECCIONADO
            const menuSeleccionado = await Menu.findByPk(clienteData.menuId);
            const precioBase = menuSeleccionado ? menuSeleccionado.precio_base : 0;

            const componentesIds = Object.values(clienteData).flat()
                .filter(val => !isNaN(parseInt(val)) && val !== clienteData.menuId && val !== clienteData.notas)
                .map(id => parseInt(id));

            if (componentesIds.length > 0) {
                const nuevoItem = await PedidoItem.create({
                    pedido_id: nuevoPedido.id,
                    cliente_numero: parseInt(idx) + 1,
                    notas: clienteData.notas || '',
                    precio_unitario: precioBase // <--- AQUÍ GUARDAMOS EL PRECIO
                }, { transaction: t });
                
                await nuevoItem.setComponentes(componentesIds, { transaction: t });
            }
        }

        await Mesa.update({ estado: 'ocupado' }, { where: { id: mesaId }, transaction: t });
        await t.commit();

        const io = req.app.get('socketio');
        if (io) {
            const pedidoCompleto = await Pedido.findByPk(nuevoPedido.id, {
                include: [
                    { model: Mesa, as: 'mesa' }, 
                    { 
                        model: PedidoItem, as: 'items', 
                        include: [{ 
                            model: Componente, as: 'componentes',
                            include: [{ model: Grupo, as: 'grupo' }] // <--- ¡AÑADIR ESTO!
                         }]
                    }
                ]
            });
            io.emit('nuevo_pedido', pedidoCompleto.toJSON());
        }

        req.flash('success_msg', '¡Pedido enviado a cocina!');
        res.redirect('/mesero');

    } catch (error) {
        await t.rollback();
        console.error("Error al guardar:", error);
        req.flash('error_msg', 'Error al guardar.');
        res.redirect('/mesero');
    }
});

// RUTA 6: ENTREGAR PEDIDO
router.post('/entregar-pedido/:mesaId', async (req, res) => {
    const { mesaId } = req.params;
    try {
        await Pedido.update({ estado: 'entregado' }, { where: { mesa_id: mesaId, estado: ['elaborado', 'recibido'] } });
        await Mesa.update({ estado: 'por_cobrar' }, { where: { id: mesaId } });
        
        const io = req.app.get('socketio');
        if (io) io.emit('mesa_por_cobrar', { mesaId });

        req.flash('success_msg', 'Mesa liberada para cobro.');
        res.redirect('/mesero');
    } catch (error) {
        console.error(error);
        res.redirect('/mesero');
    }
});

module.exports = router;