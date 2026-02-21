'use strict';
const { Pedido, Mesa, PedidoItem, Componente, Empresa, Comision, Menu } = require('../models');
const { Op } = require('sequelize');

// Función de Auto-Reparación de Precios
async function repararPrecios(pedido) {
    let granTotal = 0;
    
    if (pedido.items && pedido.items.length > 0) {
        console.log(`\n--- 🕵️ RASTREO CAJERO INICIO: Pedido #${pedido.id} ---`);

        for (const item of pedido.items) {
            let precioUnitarioActual = parseFloat(item.precio_unitario || 0);
            let precioAdicionales = 0;

            console.log(`Ítem ${item.id} (${item.menu_nombre}): Precio inicial en BD: $${item.precio_unitario}`);

            // 1. Si el precio está en 0, lo reparamos
            if (precioUnitarioActual === 0) {
                console.log(`   ⚠️ Detectado $0. Intentando recuperar precio real...`);
                let menuOriginal = null;
                let precioRecuperado = 0;

                const nombreItem = item.menu_nombre ? item.menu_nombre.trim().toLowerCase() : '';
                const esGenerico = nombreItem.includes('plato editado');

                // =============================================================
                // PASO 1: BÚSQUEDA DEL PRECIO USANDO EL NOMBRE
                // =============================================================
                
                // Si el nombre no es genérico, intentamos buscarlo por LIKE
                if (!esGenerico) {
                    menuOriginal = await Menu.findOne({ 
                        where: { nombre: { [Op.like]: `%${nombreItem}%` } } 
                    });
                } else {
                    // Si es genérico, buscamos el menú más probable (Menú del Día)
                    menuOriginal = await Menu.findOne({ where: { nombre: { [Op.like]: '%menú del día%' } } });
                }

                if (menuOriginal) {
                    precioRecuperado = parseFloat(menuOriginal.precio_base);
                    if (precioRecuperado > 0) {
                        console.log(`   ✅ PRECIO BASE RECUPERADO por NOMBRE: $${precioRecuperado}`);
                    }
                } else {
                    console.log(`   ❌ FALLO: No se encontró ningún menú con ese nombre.`);
                }
                
                // =============================================================
                // PASO 2: APLICAR EMERGENCIA (Si el precio sigue siendo $0)
                // =============================================================
                if (precioRecuperado === 0) {
                     // *** AJUSTA ESTE VALOR AL PRECIO BASE COMÚN ***
                     precioRecuperado = 5000; 
                     console.log(`   ⚠️ APLICANDO PRECIO FIJO DE EMERGENCIA: $${precioRecuperado}`);
                }
                
                // Asignar y guardar el precio recuperado
                if (precioRecuperado > 0) {
                    precioUnitarioActual = precioRecuperado;
                    item.precio_unitario = precioUnitarioActual; 
                    await item.save(); 
                } else {
                    console.log(`   ❌ FRACASO: El precio final sigue siendo $0 después de la reparación.`);
                }
            }
            
            // 2. Sumar adicionales de componentes
            if (item.componentes) {
                item.componentes.forEach(c => {
                    precioAdicionales += parseFloat(c.precio_adicional || 0);
                });
            }

            // 3. Sumar al total del pedido
            const subtotal = precioUnitarioActual + precioAdicionales;
            granTotal += subtotal;
            
            item.precio_unitario = precioUnitarioActual; 

            console.log(`   Subtotal (Base + Adicionales): $${subtotal.toFixed(2)}`);
        }
        
        console.log(`FIN RASTREO CAJERO: Gran Total Calculado: $${granTotal.toFixed(2)}`);
        console.log(`----------------------------------------------`);
    }
    return granTotal;
}


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

        for (const pedido of pedidosPorCobrar) {
            const totalCalculado = await repararPrecios(pedido);
            pedido.total_calculado = totalCalculado;
        }

        res.render('cajero/dashboard', { 
            pageTitle: 'Caja - Cobrar Mesas', 
            pedidos: pedidosPorCobrar,
            empresas 
        });
    } catch (error) {
        console.error("Error cajero dashboard:", error);
        res.redirect('/');
    }
};

exports.cobrarPedido = async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const idBusqueda = pedidoId || req.params.id;
        const { tipo_pago, empresa_id } = req.body;

        const pedido = await Pedido.findByPk(idBusqueda, { 
            include: [
                { model: Mesa, as: 'mesa' },
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
        
        const totalFinal = await repararPrecios(pedido);

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

        try {
            if (totalFinal > 0) {
                const valorComision = totalFinal * 0.02; 
                await Comision.create({
                    pedido_id: pedido.id,
                    valor_venta: totalFinal, 
                    valor_comision: valorComision,
                    estado: 'pendiente'
                });
            }
        } catch (comisionError) {
            console.error("Error al guardar comisión:", comisionError);
        }

        const io = req.app.get('socketio');
        if (io) {
            io.emit('mesa_liberada', { mesaId: pedido.mesa_id });
        }

        req.flash('success_msg', `Mesa ${pedido.mesa.numero} cobrada: $${totalFinal.toLocaleString('es-CO')}`);
        res.redirect('/cajero');

    } catch (error) {
        console.error('Error al cobrar:', error);
        req.flash('error_msg', 'Error al procesar el cobro.');
        res.redirect('/cajero');
    }
};
