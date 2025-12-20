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
        console.error("Error al cargar las mesas:", error);
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

// =========================================================================
// RUTA 3: SELECCIONAR MENÚS (MODIFICADA PARA TRAER EL "HINT" O RESUMEN)
// =========================================================================
router.get('/tomar-pedido/:mesaId', async (req, res) => {
    try {
        const { mesaId } = req.params;
        const { cantidadClientes } = req.query;

        const mesa = await Mesa.findByPk(mesaId);
        if (!mesa) {
            req.flash('error_msg', 'Mesa no encontrada.');
            return res.redirect('/mesero');
        }

        // 1. Buscamos los menús activos E INCLUIMOS sus componentes para el resumen
        const menusActivosRaw = await Menu.findAll({ 
            where: { activo: true },
            include: [{
                model: Componente,
                as: 'componentes',
                attributes: ['nombre'] // Solo necesitamos el nombre para el hint
            }]
        });

        if (menusActivosRaw.length === 0) {
            req.flash('error_msg', 'No hay menús activos.');
            return res.redirect('/mesero');
        }

        // 2. Preparamos un objeto más sencillo para la vista, con el resumen de texto
        const menus = menusActivosRaw.map(m => {
            // Creamos una lista de lo que trae (ej: "Sopa, Arroz, Pollo")
            // Limitamos a 5 para no saturar, o mostramos todos
            const listaComponentes = m.componentes.map(c => c.nombre).join(', ');
            
            return {
                id: m.id,
                nombre: m.nombre,
                precio_base: m.precio_base,
                // Si no tiene componentes, ponemos un texto por defecto
                resumen: listaComponentes || "Sin componentes específicos definidos"
            };
        });

        res.render('mesero/seleccionar-menus-clientes', {
            pageTitle: 'Seleccionar Menús',
            mesa,
            menus: menus, // Enviamos la lista procesada con el resumen
            cantidadClientes: parseInt(cantidadClientes) || 1
        });
    } catch (error) {
        console.error(error);
        res.redirect('/mesero');
    }
});

// RUTA 4: PROCESAR MENÚS Y MOSTRAR COMPONENTES
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

// RUTA 5: GUARDAR PEDIDO FINAL
router.post('/tomar-pedido/:mesaId', async (req, res) => {
    const { mesaId } = req.params;
    const { clientes } = req.body;

    if (!clientes) {
        req.flash('error_msg', 'Datos vacíos.');
        return res.redirect('/mesero');
    }

    const t = await sequelize.transaction();
    try {
        const nuevoPedido = await Pedido.create({ 
            mesa_id: parseInt(mesaId), 
            estado: 'recibido' 
        }, { transaction: t });
        
        for (const idx in clientes) {
            const clienteData = clientes[idx];
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
                    precio_unitario: precioBase
                }, { transaction: t });
                
                await nuevoItem.setComponentes(componentesIds, { transaction: t });
            }
        }

        await Mesa.update({ estado: 'ocupado' }, { where: { id: mesaId }, transaction: t });
        await t.commit();

        const io = req.app.get('socketio');
        if (io) {
            const pedidoCompleto = await Pedido.findByPk(nuevoPedido.id, {
                include: [{ model: Mesa, as: 'mesa' }, { model: PedidoItem, as: 'items', include: [{ model: Componente, as: 'componentes' }] }]
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
        await Pedido.update({ estado: 'entregado' }, { where: { mesa_id: mesaId, estado: ['elaborado', 'recibido', 'en_preparacion'] } });
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