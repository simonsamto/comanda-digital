'use strict';
const { Pedido, PedidoItem, Mesa, Componente, Grupo } = require('../models');
const { Op } = require('sequelize');

// 1. Mostrar el Dashboard
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
                        include: [{ model: Grupo, as: 'grupo' }]
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

// 2. Actualizar Estado (Terminar Plato)
exports.updateEstadoPedido = async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const { nuevoEstado } = req.body;
        const id = pedidoId || req.params.id;
        const pedido = await Pedido.findByPk(id, { include: [{ model: Mesa, as: 'mesa' }] });
        
        if (!pedido) return res.redirect('/cocina');

        pedido.estado = nuevoEstado;
        await pedido.save();

        // Si se termina, pasar mesa a 'para_recoger'
        if (nuevoEstado === 'elaborado' && pedido.mesa) {
            pedido.mesa.estado = 'para_recoger';
            await pedido.mesa.save();
        }

        // Notificar Sockets
        const io = req.app.get('socketio');
        if (io) {
            io.emit('actualizacion_estado', { pedidoId: pedido.id, nuevoEstado, mesaNumero: pedido.mesa.numero });
            if (nuevoEstado === 'elaborado') io.emit('pedido_listo_para_recoger', { mesaId: pedido.mesa.id });
        }
        res.redirect('/cocina');
    } catch (error) { console.error(error); res.redirect('/cocina'); }
};

// 3. API Resumen Producción (CORREGIDA)
exports.getResumenDespachos = async (req, res) => {
    try {
        const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
        const finDia = new Date(); finDia.setHours(23, 59, 59, 999);

        // CORRECCIÓN: Filtramos por la fecha del PEDIDO, no del ITEM
        const items = await PedidoItem.findAll({
            include: [{
                model: Pedido, 
                as: 'pedido',
                where: { 
                    estado: ['elaborado', 'entregado', 'pagado'],
                    createdAt: { [Op.between]: [inicioDia, finDia] } // Filtro correcto
                },
                required: true 
            }]
        });

        const conteo = {};
        let total = 0;

        items.forEach(item => {
            const nombre = item.menu_nombre || 'Plato Estándar';
            if (!conteo[nombre]) conteo[nombre] = 0;
            conteo[nombre]++;
            total++;
        });

        res.json({ success: true, conteo, total });

    } catch (error) {
        console.error("ERROR EN RESUMEN DESPACHOS:", error);
        res.status(500).json({ success: false, message: 'Error interno al calcular.' });
    }
};