'use strict';
const { Pedido, PedidoItem, Mesa, Menu, Componente, Grupo } = require('../models');

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
                        through: { attributes: [] },
                        include: [{ model: Grupo, as: 'grupo' }] // ¡CLAVE PARA ORDENAR!
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

exports.updateEstadoPedido = async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const { nuevoEstado } = req.body;
        const id = pedidoId || req.params.id;
        const pedido = await Pedido.findByPk(id, { include: [{ model: Mesa, as: 'mesa' }] });
        
        if (!pedido) return res.redirect('/cocina');

        pedido.estado = nuevoEstado;
        await pedido.save();

        if (nuevoEstado === 'elaborado' && pedido.mesa) {
            pedido.mesa.estado = 'para_recoger';
            await pedido.mesa.save();
        }

        const io = req.app.get('socketio');
        if (io) {
            io.emit('actualizacion_estado', { pedidoId: pedido.id, nuevoEstado, mesaNumero: pedido.mesa.numero });
            if (nuevoEstado === 'elaborado') io.emit('pedido_listo_para_recoger', { mesaId: pedido.mesa.id });
        }
        res.redirect('/cocina');
    } catch (error) { console.error(error); res.redirect('/cocina'); }
};