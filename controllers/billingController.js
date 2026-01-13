'use strict';
const { Comision, Pedido } = require('../models');
const { Op } = require('sequelize');

exports.getBillingDashboard = async (req, res) => {
    try {
        const mesActual = new Date().getMonth();
        const anioActual = new Date().getFullYear();
        const inicioMes = new Date(anioActual, mesActual, 1);
        const finMes = new Date(anioActual, mesActual + 1, 0, 23, 59, 59);

        // Comisiones del mes actual
        const comisionesMes = await Comision.findAll({
            where: { createdAt: { [Op.between]: [inicioMes, finMes] } },
            order: [['createdAt', 'DESC']]
        });

        // Comisiones pendientes totales (Deuda histórica)
        const totalPendiente = await Comision.sum('valor_comision', { where: { estado: 'pendiente' } }) || 0;
        
        // Total mes actual
        let totalMes = 0;
        comisionesMes.forEach(c => totalMes += parseFloat(c.valor_comision));

        res.render('admin/billing', {
            pageTitle: 'Facturación del Sistema',
            comisiones: comisionesMes,
            totalMes,
            totalPendiente,
            mesNombre: inicioMes.toLocaleString('default', { month: 'long' })
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin');
    }
};