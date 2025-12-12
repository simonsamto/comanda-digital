    'use strict';
const { Pedido, PedidoItem, Mesa, Menu, Componente, Grupo } = require('../models');

// --- Función 1: Mostrar el Dashboard ---
exports.showDashboard = async (req, res) => {
    try {
        const pedidos = await Pedido.findAll({
            where: { estado: ['recibido', 'en_preparacion', 'elaborado'] },
            include: [
                { model: Mesa, as: 'mesa', required: true },
                {
                    model: PedidoItem, as: 'items',
                    include: [{
                        model: Componente,
                        as: 'componentes',
                        through: { attributes: [] },
                        include: [{ model: Grupo, as: 'grupo' }] // <--- ¡ESTO ES LO NUEVO!
                    }]
                }
            ],
            order: [['createdAt', 'ASC']]
        });
        res.render('cocina/dashboard', { pageTitle: 'Cocina', pedidos });
    } catch (error) {
        console.error('Error cocina:', error);
        res.redirect('/');
    }
};


// --- Función 2: Actualizar Estado ---
exports.updateEstadoPedido = async (req, res) => {
    try {
        const { pedidoId } = req.params; // Ojo: debe coincidir con la ruta
        const { nuevoEstado } = req.body;

        // Buscamos por el ID que venga en la URL
        const id = pedidoId || req.params.id;

        const pedido = await Pedido.findByPk(id, { include: [{ model: Mesa, as: 'mesa' }] });
        
        if (!pedido) {
            req.flash('error_msg', 'Pedido no encontrado.');
            return res.redirect('/cocina');
        }

        pedido.estado = nuevoEstado;
        await pedido.save();

        // Lógica de cambio de estado de la MESA
        if (nuevoEstado === 'elaborado') {
            if (pedido.mesa) {
                pedido.mesa.estado = 'para_recoger';
                await pedido.mesa.save();
            }
        }

        // Notificaciones Socket.IO
        const io = req.app.get('socketio');
        if (io) {
            io.emit('actualizacion_estado', { 
                pedidoId: pedido.id, 
                nuevoEstado: nuevoEstado, 
                mesaNumero: pedido.mesa.numero 
            });
            
            if (nuevoEstado === 'elaborado') {
                io.emit('pedido_listo_para_recoger', { mesaId: pedido.mesa.id });
            }
        }

        req.flash('success_msg', `Pedido actualizado.`);
        res.redirect('/cocina');

    } catch (error) {
        console.error("Error al actualizar:", error);
        req.flash('error_msg', 'Error al actualizar el pedido.');
        res.redirect('/cocina');
    }
};