'use strict';
const { Pedido, PedidoItem, Mesa, Componente, Grupo, Menu } = require('../models');
const { Op } = require('sequelize');

// Mostrar Dashboard
exports.showDashboard = async (req, res) => {
    try {
        const pedidos = await Pedido.findAll({
            where: { estado: ['recibido', 'en_preparacion', 'elaborado'] },
            include: [
                { model: Mesa, as: 'mesa', required: true },
                {
                    model: PedidoItem, as: 'items',
                    include: [{
                        model: Componente, as: 'componentes',
                        through: { attributes: ['createdAt', 'updatedAt'] },
                        include: [{ model: Grupo, as: 'grupo' }]
                    }]
                }
            ],
            order: [['createdAt', 'ASC']]
        });

        // LÓGICA DE DETECCIÓN DE CAMBIOS (INMEDIATA)
        const pedidosProcesados = pedidos.map(p => {
            const pedidoJSON = p.toJSON();
            const fechaPedido = new Date(pedidoJSON.createdAt).getTime();
            let pedidoModificado = false;

            if(pedidoJSON.items) {
                pedidoJSON.items.forEach(item => {
                    if(item.componentes) {
                        item.componentes.forEach(comp => {
                            const throughData = comp.PedidoItemComponente || comp.through || {};
                            const fechaAgregado = new Date(throughData.createdAt || item.updatedAt).getTime();
                            
                            if ((fechaAgregado - fechaPedido) > 2000) {
                                comp.es_nuevo = true;
                                pedidoModificado = true; 
                            } else {
                                comp.es_nuevo = false;
                            }
                        });
                    }
                });
            }
            
            pedidoJSON.fue_modificado = pedidoModificado;
            return pedidoJSON;
        });

        res.render('cocina/dashboard', { pageTitle: 'Cocina', pedidos: pedidosProcesados });
    } catch (error) { 
        console.error("Error Dashboard:", error);
        res.redirect('/'); 
    }
};

// Actualizar Estado + FIX ACCESO DENEGADO (JSON) + FIX PRECIO $0
exports.updateEstadoPedido = async (req, res) => {
    try {
        const rawId = req.params.pedidoId || req.params.id;
        const idReal = parseInt(rawId, 10);
        const { nuevoEstado } = req.body;

        if (!idReal || isNaN(idReal)) return res.status(400).json({ success: false, message: 'ID de pedido inválido.' });

        const pedido = await Pedido.findByPk(idReal, { 
            include: [
                { model: Mesa, as: 'mesa' },
                { model: PedidoItem, as: 'items' } 
            ] 
        });
        
        if (!pedido) return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });

        // =================================================================
        // BLOQUE DE REPARACIÓN DE PRECIOS $0
        // =================================================================
        if (nuevoEstado === 'elaborado') {
            let granTotal = 0;

            for (const item of pedido.items) {
                // *** USO DE precio_unitario ***
                let precioItem = parseFloat(item.precio_unitario || 0);

                if (precioItem === 0) {
                    let menuOriginal = null;
                    if (item.menu_id) menuOriginal = await Menu.findByPk(item.menu_id);
                    if (!menuOriginal && item.menu_nombre) menuOriginal = await Menu.findOne({ where: { nombre: item.menu_nombre } });

                    if (menuOriginal) {
                        precioItem = parseFloat(menuOriginal.precio_base);
                        item.precio_unitario = precioItem; // Guardamos en la BD
                        await item.save();
                    }
                }
                
                granTotal += precioItem;
            }
            
            // Si tienes columna total, descomenta esto:
            /*
            if (granTotal > 0) {
                await Pedido.update({ total: granTotal }, { where: { id: pedido.id }});
            }
            */
        }
        // =================================================================

        // Guardar estado nuevo
        pedido.estado = nuevoEstado;
        await pedido.save();

        // Liberar Mesa para recoger
        if (nuevoEstado === 'elaborado') {
            await Mesa.update({ estado: 'para_recoger' }, { where: { id: pedido.mesa_id } });
        }

        // 3. Notificar Sockets
        const io = req.app.get('socketio');
        if (io) {
            io.emit('actualizacion_estado', { 
                pedidoId: pedido.id, 
                nuevoEstado, 
                mesaNumero: pedido.mesa ? pedido.mesa.numero : '?' 
            });
            if (nuevoEstado === 'elaborado') {
                io.emit('pedido_listo_para_recoger', { mesaId: pedido.mesa_id });
            }
        }
        
        // FIX ACCESO DENEGADO: Respondemos con JSON en lugar de hacer un redirect
        return res.json({ success: true, message: 'Estado actualizado correctamente.' });

    } catch (error) { 
        console.error("Error crítico updateEstadoPedido:", error); 
        // En caso de error, respondemos con error JSON
        return res.status(500).json({ success: false, message: 'Error interno del servidor. Consulte la consola.' });
    }
};

// API Resumen
exports.getResumenDespachos = async (req, res) => {
    try {
        const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
        const finDia = new Date(); finDia.setHours(23, 59, 59, 999);
        const items = await PedidoItem.findAll({
            include: [{
                model: Pedido, as: 'pedido',
                where: { estado: ['elaborado', 'entregado', 'pagado'], createdAt: { [Op.between]: [inicioDia, finDia] } },
                required: true 
            }]
        });
        const conteo = {}; let total = 0;
        items.forEach(item => {
            const nombre = item.menu_nombre || 'Plato Estándar';
            conteo[nombre] = (conteo[nombre] || 0) + 1;
            total++;
        });
        res.json({ success: true, conteo, total });
    } catch (error) { res.status(500).json({ success: false }); }
};