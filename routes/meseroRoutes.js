'use strict';
const express = require('express');
const router = express.Router();
const { Mesa, Menu, Grupo, Componente, Pedido, PedidoItem, sequelize } = require('../models');

// ==========================================
// RUTA 1: MAPA DE MESAS (DASHBOARD)
// ==========================================
router.get('/', async (req, res) => {
    try {
        const mesas = await Mesa.findAll({ order: [['numero', 'ASC']] });
        const menusDelDia = await Menu.findAll({ 
            where: { activo: true }, 
            include: [{ model: Componente, as: 'componentes', include: [{ model: Grupo, as: 'grupo' }] }] 
        });
        res.render('mesero/dashboard', { mesas, menus: menusDelDia, pageTitle: 'Mapa' });
    } catch (error) { 
        console.error(error);
        res.status(500).send("Error al cargar el mapa"); 
    }
});

// ==========================================
// RUTA 2: SELECCIONAR CANTIDAD DE CLIENTES
// ==========================================
router.get('/mesa/:mesaId/clientes', async (req, res) => {
    try {
        const mesa = await Mesa.findByPk(req.params.mesaId);
        if (!mesa) return res.redirect('/mesero');
        res.render('mesero/cantidad-clientes', { mesa });
    } catch (error) { 
        console.error(error);
        res.redirect('/mesero'); 
    }
});

// ==========================================
// RUTA 3: SELECCIONAR QUÉ MENÚ PIDE CADA UNO
// ==========================================
router.get('/tomar-pedido/:mesaId', async (req, res) => {
    try {
        const { mesaId } = req.params;
        const { cantidadClientes } = req.query;
        const mesa = await Mesa.findByPk(mesaId);
        if (!mesa) return res.redirect('/mesero');

        // CONSULTA: Trae el dato 'por_defecto' de la tabla intermedia
        const menusRaw = await Menu.findAll({ 
            where: { activo: true }, 
            include: [{ 
                model: Componente, 
                as: 'componentes', 
                attributes: ['nombre'],
                through: { attributes: ['por_defecto'] } 
            }] 
        });

        if (menusRaw.length === 0) {
            return res.redirect('/mesero');
        }

        // Generar el resumen para el "Hint"
        const menus = menusRaw.map(m => {
            const componentesDefault = m.componentes.filter(c => c.MenuComponente.por_defecto);
            const resumenTexto = componentesDefault.map(c => c.nombre).join(', ');

            return { 
                id: m.id, 
                nombre: m.nombre, 
                precio_base: m.precio_base, 
                resumen: resumenTexto || "Elige tus componentes" 
            };
        });

        res.render('mesero/seleccionar-menus-clientes', { 
            mesa, 
            menus, 
            cantidadClientes: parseInt(cantidadClientes) || 1 
        });
    } catch (error) { 
        console.error(error);
        res.redirect('/mesero'); 
    }
});

// ==========================================
// RUTA 4: PROCESAR MENÚS Y MOSTRAR COMPONENTES (BOTONES AZULES)
// ==========================================
// ¡AQUÍ ESTABA EL ERROR! AHORA COINCIDE CON EL ACTION DEL FORMULARIO
router.post('/personalizar-pedido/:mesaId', async (req, res) => {
    try {
        const { mesaId } = req.params;
        const { cantidadClientes } = req.body;
        const num = parseInt(cantidadClientes);
        const mesa = await Mesa.findByPk(mesaId);
        const clientesConMenus = [];

        for (let i = 1; i <= num; i++) {
            const mId = req.body[`cliente_${i}_menu`];
            if (!mId) continue; 

            const menu = await Menu.findByPk(mId);
            
            // Obtenemos componentes incluyendo la tabla pivote
            const comps = await menu.getComponentes({ 
                include: [{ model: Grupo, as: 'grupo' }] 
            });
            
            const grupos = {};
            comps.forEach(c => {
                const gNombre = c.grupo ? c.grupo.nombre : 'Otros';
                const gId = c.grupo ? c.grupo.id : 999; // ID seguro si no hay grupo

                if(!grupos[gNombre]) {
                    grupos[gNombre] = { id: gId, componentes: [] };
                }
                
                // Leemos si es por defecto desde MenuComponente
                const isDefault = c.MenuComponente ? c.MenuComponente.por_defecto : false;
                
                grupos[gNombre].componentes.push({
                    id: c.id, 
                    nombre: c.nombre, 
                    precio: c.precio_adicional,
                    por_defecto: isDefault 
                });
            });
            
            clientesConMenus.push({ clienteNumero: i, menu, grupos });
        }
        
        res.render('mesero/tomar-pedido', { mesa, clientesConMenus });

    } catch (error) { 
        console.error('Error en procesar selección:', error);
        res.redirect(`/mesero/tomar-pedido/${req.params.mesaId}`); 
    }
});

// ==========================================
// RUTA 5: GUARDAR EL PEDIDO FINAL
// ==========================================
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
            const cData = clientes[idx]; 
            const menu = await Menu.findByPk(cData.menuId);
            
            const idsComponentes = Object.values(cData)
                .flat()
                .filter(v => !isNaN(parseInt(v)) && parseInt(v) !== parseInt(cData.menuId))
                .map(id => parseInt(id));

            const item = await PedidoItem.create({ 
                pedido_id: nuevoPedido.id, 
                cliente_numero: parseInt(idx) + 1, 
                notas: cData.notas || '', 
                precio_unitario: menu ? menu.precio_base : 0, 
                menu_nombre: menu ? menu.nombre : 'Personalizado' 
            }, { transaction: t });

            if (idsComponentes.length > 0) {
                await item.setComponentes(idsComponentes, { transaction: t });
            }
        }

        await Mesa.update({ estado: 'ocupado' }, { where: { id: mesaId }, transaction: t });
        await t.commit();

        const io = req.app.get('socketio');
        if (io) {
            const pedidoCompleto = await Pedido.findByPk(nuevoPedido.id, { 
                include: [{
                    model: Mesa, as: 'mesa'}, 
                    { model: PedidoItem, as: 'items', include: [{
                        model: Componente, as: 'componentes', include: [{model: Grupo, as: 'grupo'}]
                    }]
                }] 
            });
            io.emit('nuevo_pedido', pedidoCompleto.toJSON());
        }

        res.redirect('/mesero');
    } catch (error) { 
        await t.rollback(); 
        console.error("Error al guardar pedido:", error);
        res.redirect('/mesero'); 
    }
});

// ==========================================
// RUTA 6: ENTREGAR PEDIDO / COBRAR
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