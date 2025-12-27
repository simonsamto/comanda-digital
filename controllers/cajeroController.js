'use strict';
const { Pedido, Mesa, PedidoItem, Componente, Empresa } = require('../models');

exports.getDashboard = async (req, res) => {
    try {
        const empresas = await Empresa.findAll({ where: { activo: true } });
        
        const pedidosPorCobrar = await Pedido.findAll({
            where: { estado: ['elaborado', 'entregado'] },
            include: [
                { model: Mesa, as: 'mesa', where: { estado: 'por_cobrar' }, required: true },
                {
                    model: PedidoItem, as: 'items',
                    include: [{ model: Componente, as: 'componentes' }]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.render('cajero/dashboard', { pageTitle: 'Caja', pedidos: pedidosPorCobrar, empresas });
    } catch (error) {
        console.error("Error cajero:", error);
        res.redirect('/');
    }
};

exports.cobrarPedido = async (req, res) => {
    try {
        // CORRECCIÓN: Buscamos el parámetro correcto
        const id = req.params.pedidoId || req.params.id; 
        console.log(`>>> INTENTANDO COBRAR PEDIDO ID: ${id}`);

        if (!id) {
            req.flash('error_msg', 'ID de pedido inválido.');
            return res.redirect('/cajero');
        }

        const { tipo_pago, empresa_id } = req.body;

        const pedido = await Pedido.findByPk(id, { include: [{ model: Mesa, as: 'mesa' }] });

        if (!pedido) {
            console.error(">>> ERROR: Pedido no encontrado en BD.");
            req.flash('error_msg', 'Pedido no encontrado.');
            return res.redirect('/cajero');
        }

        if (tipo_pago === 'credito' && empresa_id) {
            pedido.medio_pago = 'credito_empresa';
            pedido.empresa_id = empresa_id;
        } else {
            pedido.medio_pago = 'efectivo';
            pedido.empresa_id = null;
        }

        pedido.estado = 'pagado';
        await pedido.save();

        if (pedido.mesa) {
            pedido.mesa.estado = 'libre';
            await pedido.mesa.save();
        }

        const io = req.app.get('socketio');
        if (io) io.emit('mesa_liberada', { mesaId: pedido.mesaId });

        req.flash('success_msg', `Mesa ${pedido.mesa.numero} cobrada.`);
        res.redirect('/cajero');

    } catch (error) {
        console.error('Error al cobrar:', error);
        req.flash('error_msg', 'Error al cobrar.');
        res.redirect('/cajero');
    }
};