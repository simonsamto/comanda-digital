'use strict';
// IMPORTANTE: Asegúrate de que 'Comision' esté en la lista de imports
const { Pedido, Mesa, PedidoItem, Componente, Empresa, Comision } = require('../models');

exports.getDashboard = async (req, res) => {
    try {
        const empresas = await Empresa.findAll({ where: { activo: true } });
        
        const pedidosPorCobrar = await Pedido.findAll({
            where: { estado: ['elaborado', 'entregado'] },
            include: [
                { 
                    model: Mesa, 
                    as: 'mesa', 
                    where: { estado: 'por_cobrar' }, 
                    required: true 
                },
                {
                    model: PedidoItem,
                    as: 'items',
                    include: [{ model: Componente, as: 'componentes' }]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.render('cajero/dashboard', { 
            pageTitle: 'Caja - Cobrar Mesas', 
            pedidos: pedidosPorCobrar,
            empresas 
        });
    } catch (error) {
        console.error("Error cajero:", error);
        res.redirect('/');
    }
};

exports.cobrarPedido = async (req, res) => {
    try {
        const { pedidoId } = req.params; // Ojo si usas :id en la ruta, ajusta aquí
        const idBusqueda = pedidoId || req.params.id;
        const { tipo_pago, empresa_id } = req.body;

        const pedido = await Pedido.findByPk(idBusqueda, { 
            include: [
                { model: Mesa, as: 'mesa' },
                // Necesitamos los items para calcular la comisión
                { 
                    model: PedidoItem, as: 'items',
                    include: [{ model: Componente, as: 'componentes' }]
                }
            ] 
        });

        if (!pedido) {
            req.flash('error_msg', 'Pedido no encontrado.');
            return res.redirect('/cajero');
        }

        // 1. Definir Medio de Pago
        if (tipo_pago === 'credito' && empresa_id) {
            pedido.medio_pago = 'credito_empresa';
            pedido.empresa_id = empresa_id;
        } else {
            pedido.medio_pago = 'efectivo';
            pedido.empresa_id = null;
        }

        // 2. Marcar como pagado
        pedido.estado = 'pagado';
        await pedido.save();

        // 3. Liberar Mesa
        if (pedido.mesa) {
            pedido.mesa.estado = 'libre';
            await pedido.mesa.save();
        }

        // =========================================================
        // === 4. GENERAR COMISIÓN DEL SISTEMA (1%) ===
        // =========================================================
        try {
            let totalVenta = 0;
            if (pedido.items) {
                pedido.items.forEach(item => {
                    totalVenta += parseFloat(item.precio_unitario || 0);
                    if (item.componentes) {
                        item.componentes.forEach(c => totalVenta += parseFloat(c.precio_adicional || 0));
                    }
                });
            }

            if (totalVenta > 0) {
                const valorComision = totalVenta * 0.01; // 1%
                await Comision.create({
                    pedido_id: pedido.id,
                    valor_venta: totalVenta,
                    valor_comision: valorComision,
                    estado: 'pendiente'
                });
                console.log(`>>> COMISIÓN GENERADA: $${valorComision} (Pedido #${pedido.id})`);
            }
        } catch (comisionError) {
            console.error("Error al guardar comisión (No crítico para la venta):", comisionError);
        }
        // =========================================================

        // 5. Notificar Sockets
        const io = req.app.get('socketio');
        if (io) io.emit('mesa_liberada', { mesaId: pedido.mesaId });

        req.flash('success_msg', `Mesa ${pedido.mesa.numero} cobrada exitosamente.`);
        res.redirect('/cajero');

    } catch (error) {
        console.error('Error al cobrar:', error);
        req.flash('error_msg', 'Error al procesar el cobro.');
        res.redirect('/cajero');
    }
};