'use strict';
const { Pedido, PedidoItem, Mesa, Componente, Grupo } = require('../models');
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
                        through: { attributes: [] },
                        include: [{ model: Grupo, as: 'grupo' }]
                    }]
                }
            ],
            order: [['createdAt', 'ASC']]
        });
        res.render('cocina/dashboard', { pageTitle: 'Cocina', pedidos });
    } catch (error) { res.redirect('/'); }
};

// Actualizar Estado (Terminar Plato)
exports.updateEstadoPedido = async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const { nuevoEstado } = req.body;
        // Obtenemos el ID correcto (a veces viene en params como id o pedidoId)
        const idReal = pedidoId || req.params.id;

        const pedido = await Pedido.findByPk(idReal, { 
            include: [{ model: Mesa, as: 'mesa' }] 
        });
        
        if (!pedido) return res.redirect('/cocina');

        // 1. Guardar estado del pedido
        pedido.estado = nuevoEstado;
        await pedido.save();

        // 2. CORRECCIÓN: Actualizar mesa directamente por ID
        // Si el cocinero dice "Listo" ('elaborado'), la mesa pasa a 'para_recoger'
        if (nuevoEstado === 'elaborado') {
            await Mesa.update(
                { estado: 'para_recoger' }, 
                { where: { id: pedido.mesa_id } } // Usamos mesa_id del pedido
            );
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
                // Esto hace que la mesa se ponga AZUL en el mapa del mesero
                io.emit('pedido_listo_para_recoger', { mesaId: pedido.mesa_id });
            }
        }
        res.redirect('/cocina');

    } catch (error) { 
        console.error("Error update cocina:", error); 
        res.redirect('/cocina'); 
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
                where: { 
                    estado: ['elaborado', 'entregado', 'pagado'],
                    createdAt: { [Op.between]: [inicioDia, finDia] }
                },
                required: true 
            }]
        });

        const conteo = {};
        let total = 0;
        items.forEach(item => {
            const nombre = item.menu_nombre || 'Plato Estándar';
            conteo[nombre] = (conteo[nombre] || 0) + 1;
            total++;
        });

        res.json({ success: true, conteo, total });
    } catch (error) { res.status(500).json({ success: false }); }
};