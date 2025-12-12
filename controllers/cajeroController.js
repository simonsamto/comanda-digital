'use strict';
const { Pedido, Mesa, PedidoItem, Componente } = require('../models');

exports.getDashboard = async (req, res) => {
    try {
        // Buscar pedidos donde la MESA esté 'por_cobrar'
        const pedidosPorCobrar = await Pedido.findAll({
            where: { estado: ['elaborado', 'entregado'] }, // Solo pedidos terminados
            include: [
                { 
                    model: Mesa, 
                    as: 'mesa', 
                    where: { estado: 'por_cobrar' }, // Filtro principal
                    required: true 
                },
                {
                    // ¡ESTO ES LO NUEVO! Traemos los items y componentes para calcular el precio
                    model: PedidoItem,
                    as: 'items',
                    include: [{
                        model: Componente,
                        as: 'componentes'
                    }]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.render('cajero/dashboard', { 
            pageTitle: 'Caja - Cobrar Mesas', 
            pedidos: pedidosPorCobrar 
        });
    } catch (error) {
        console.error("Error al cargar dashboard cajero:", error);
        res.redirect('/');
    }
};

exports.cobrarPedido = async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const pedido = await Pedido.findByPk(pedidoId, { include: [{ model: Mesa, as: 'mesa' }] });

        if (!pedido) {
            req.flash('error_msg', 'Pedido no encontrado.');
            return res.redirect('/cajero');
        }

        // 1. Marcar pedido como pagado
        pedido.estado = 'pagado';
        await pedido.save();

        // 2. LIBERAR LA MESA
        if (pedido.mesa) {
            pedido.mesa.estado = 'libre';
            await pedido.mesa.save();
        }

        // 3. Notificar a meseros (Socket.IO)
        const io = req.app.get('socketio');
        if (io) io.emit('mesa_liberada', { mesaId: pedido.mesaId });

        req.flash('success_msg', `Mesa ${pedido.mesa.numero} cobrada y liberada exitosamente.`);
        res.redirect('/cajero');

    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error al cobrar.');
        res.redirect('/cajero');
    }
};