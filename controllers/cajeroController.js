'use strict';
const { Pedido, Mesa, PedidoItem, Componente } = require('../models');

exports.getDashboard = async (req, res) => {
    try {
        // Buscar pedidos donde la MESA esté 'por_cobrar'
        const pedidosPorCobrar = await Pedido.findAll({
            include: [{ 
                model: Mesa, 
                as: 'mesa', 
                where: { estado: 'por_cobrar' }, // <-- FILTRO CLAVE
                required: true 
            }],
            order: [['createdAt', 'DESC']] // Los más recientes primero
        });

        res.render('cajero/dashboard', { 
            pageTitle: 'Caja - Cobrar Mesas', 
            pedidos: pedidosPorCobrar 
        });
    } catch (error) {
        console.error(error);
        res.redirect('/');
    }
};

exports.cobrarPedido = async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const pedido = await Pedido.findByPk(pedidoId, { include: [{ model: Mesa, as: 'mesa' }] });

        if (!pedido) return res.redirect('/cajero');

        // 1. Marcar pedido como pagado
        pedido.estado = 'pagado';
        await pedido.save();

        // 2. LIBERAR LA MESA
        if (pedido.mesa) {
            pedido.mesa.estado = 'libre';
            await pedido.mesa.save();
        }

        // 3. NOTIFICAR AL MESERO (Mesa verde de nuevo)
        const io = req.app.get('socketio');
        if (io) io.emit('mesa_liberada', { mesaId: pedido.mesaId });

        req.flash('success_msg', `Mesa ${pedido.mesa.numero} cobrada y liberada.`);
        res.redirect('/cajero');

    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error al cobrar.');
        res.redirect('/cajero');
    }
};