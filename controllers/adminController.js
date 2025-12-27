'use strict';
const { Usuario, Rol, Mesa, Menu, Grupo, Componente, Pedido, PedidoItem, sequelize, Empresa } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');

// =================================================================
// 1. DASHBOARD PRINCIPAL (KPIs Y GRÁFICOS)
// =================================================================
exports.showDashboard = async (req, res) => {
    try {
        const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
        const finDia = new Date(); finDia.setHours(23, 59, 59, 999);
        const inicioAyer = new Date(inicioDia); inicioAyer.setDate(inicioAyer.getDate() - 1);
        const finAyer = new Date(finDia); finAyer.setDate(finAyer.getDate() - 1);

        // Pedidos de HOY
        const pedidosHoy = await Pedido.findAll({
            where: { createdAt: { [Op.between]: [inicioDia, finDia] } },
            include: [{ model: PedidoItem, as: 'items', include: [{ model: Componente, as: 'componentes' }] }]
        });

        // Pedidos de AYER (Total)
        const pedidosAyer = await Pedido.findAll({
            where: { createdAt: { [Op.between]: [inicioAyer, finAyer] }, estado: 'pagado' },
            include: [{ model: PedidoItem, as: 'items', include: [{ model: Componente, as: 'componentes' }] }]
        });

        // Cálculo KPI Ayer
        let totalVentasAyer = 0;
        pedidosAyer.forEach(p => {
            p.items.forEach(i => {
                totalVentasAyer += parseFloat(i.precio_unitario || 0);
                i.componentes.forEach(c => totalVentasAyer += parseFloat(c.precio_adicional || 0));
            });
        });

        // Cálculo KPIs Hoy
        let totalDinero = 0;
        let cantidadPedidos = 0;
        let platosVendidos = 0;
        const ventasPorPlato = {};
        const conteoEstados = { 'En Cocina': 0, 'Para Recoger': 0, 'En Mesa': 0, 'Finalizado': 0 };

        // Datos para gráficas extra
        const ventasPorHora = new Array(24).fill(0);
        const conteoBebidas = {};
        const ventasPorMesa = {};

        pedidosHoy.forEach(p => {
            // Estados
            if (p.estado === 'recibido' || p.estado === 'en_preparacion') conteoEstados['En Cocina']++;
            else if (p.estado === 'elaborado') conteoEstados['Para Recoger']++;
            else if (p.estado === 'entregado') conteoEstados['En Mesa']++;
            else if (p.estado === 'pagado') {
                conteoEstados['Finalizado']++;
                cantidadPedidos++;
                
                let valorPedido = 0;
                p.items.forEach(item => {
                    const precio = parseFloat(item.precio_unitario || 0);
                    valorPedido += precio;
                    totalDinero += precio;
                    platosVendidos++;

                    // Gráfica Platos
                    const etiqueta = `Menú ($${precio})`;
                    ventasPorPlato[etiqueta] = (ventasPorPlato[etiqueta] || 0) + 1;

                    item.componentes.forEach(comp => {
                        const precioComp = parseFloat(comp.precio_adicional || 0);
                        valorPedido += precioComp;
                        totalDinero += precioComp;
                        
                        // Gráfica Bebidas (Lógica simple: si el nombre parece bebida o por grupo si trajeras el include)
                        // Aquí asumimos todo componente para simplificar, idealmente filtrar por grupo
                        conteoBebidas[comp.nombre] = (conteoBebidas[comp.nombre] || 0) + 1;
                    });
                });

                // Gráfica Horas
                const hora = new Date(p.createdAt).getHours();
                ventasPorHora[hora] += valorPedido;

                // Gráfica Mesas
                ventasPorMesa[`Mesa ${p.mesa_id}`] = (ventasPorMesa[`Mesa ${p.mesa_id}`] || 0) + valorPedido;
            }
        });

        // Helpers
        const getTop5 = (obj) => Object.entries(obj).sort((a,b) => b[1]-a[1]).slice(0,5);
        const topPlatos = getTop5(ventasPorPlato);
        const topBebidas = getTop5(conteoBebidas);
        const topMesas = getTop5(ventasPorMesa);

        res.render('admin/dashboard', { 
            pageTitle: 'Panel de Control',
            totalDinero, cantidadPedidos, platosVendidos,
            // KPIs
            kpis: { ventasHoy: totalDinero, pedidosHoy: cantidadPedidos, ticketPromedio: cantidadPedidos ? totalDinero/cantidadPedidos : 0 },
            // Gráficos básicos
            chartLabels: JSON.stringify(Object.keys(ventasPorPlato)),
            chartData: JSON.stringify(Object.values(ventasPorPlato)),
            estadosLabels: JSON.stringify(Object.keys(conteoEstados)),
            estadosData: JSON.stringify(Object.values(conteoEstados)),
            // Gráficos avanzados
            graficos: {
                ventasHora: JSON.stringify(ventasPorHora),
                estados: { labels: JSON.stringify(Object.keys(conteoEstados)), data: JSON.stringify(Object.values(conteoEstados)) },
                topPlatos: { labels: JSON.stringify(topPlatos.map(x=>x[0])), data: JSON.stringify(topPlatos.map(x=>x[1])) },
                topBebidas: { labels: JSON.stringify(topBebidas.map(x=>x[0])), data: JSON.stringify(topBebidas.map(x=>x[1])) },
                topMesas: { labels: JSON.stringify(topMesas.map(x=>x[0])), data: JSON.stringify(topMesas.map(x=>x[1])) },
                comparativo: JSON.stringify([totalVentasAyer, totalDinero])
            }
        });
    } catch (error) {
        console.error("Error en dashboard:", error);
        res.status(500).send("Error al cargar el dashboard");
    }
};

// =================================================================
// 2. GESTIÓN DE MENÚS
// =================================================================
exports.getGestionMenu = async (req, res) => { try { const menus = await Menu.findAll({ order: [['id', 'ASC']] }); res.render('admin/gestion-menu', { pageTitle: 'Gestión de Menús', menus }); } catch (error) { res.redirect('/admin'); } };
exports.showNewMenuForm = (req, res) => res.render('admin/menu-form', { pageTitle: 'Nuevo Menú', menu: {} });
exports.createMenu = async (req, res) => { try { await Menu.create({ ...req.body, activo: !!req.body.activo }); res.redirect('/admin/gestion-menu'); } catch (error) { res.render('admin/menu-form', { menu: req.body, error: error.message }); } };
exports.showEditMenuForm = async (req, res) => { try { const menu = await Menu.findByPk(req.params.id); res.render('admin/menu-form', { pageTitle: 'Editar', menu }); } catch (error) { res.redirect('/admin/gestion-menu'); } };
exports.updateMenu = async (req, res) => { try { await Menu.update({ ...req.body, activo: !!req.body.activo }, { where: { id: req.params.id } }); res.redirect('/admin/gestion-menu'); } catch (error) { res.redirect('/admin/gestion-menu'); } };
exports.deleteMenu = async (req, res) => { try { await Menu.destroy({ where: { id: req.params.id } }); res.redirect('/admin/gestion-menu'); } catch (error) { res.redirect('/admin/gestion-menu'); } };
exports.showConfigurarMenu = async (req, res) => { try { const menu = await Menu.findByPk(req.params.id); const grupos = await Grupo.findAll({ include: { model: Componente, as: 'componentes' } }); const comp = await menu.getComponentes(); res.render('admin/configurar-menu', { menu, grupos, selectedComponentIds: new Set(comp.map(c=>c.id)) }); } catch (error) { res.redirect('/admin/gestion-menu'); } };
exports.saveConfigurarMenu = async (req, res) => { try { const menu = await Menu.findByPk(req.params.id); await menu.setComponentes(req.body.componenteIds || []); res.redirect('/admin/gestion-menu'); } catch (error) { res.redirect('/admin/gestion-menu'); } };

// =================================================================
// 3. GESTIÓN COMPONENTES Y GRUPOS
// =================================================================
exports.getGestionComponentes = async (req, res) => { try { const grupos = await Grupo.findAll({ include: { model: Componente, as: 'componentes' }, order: [['nombre', 'ASC']] }); res.render('admin/gestion-componentes', { pageTitle: 'Componentes', grupos }); } catch (error) { res.redirect('/admin'); } };
exports.createComponente = async (req, res) => { try { const {nombre, grupo_id, precio_adicional} = req.body; await Componente.create({nombre, grupo_id, precio_adicional: parseFloat(precio_adicional)||0}); res.redirect('/admin/gestion-componentes'); } catch (e) { res.redirect('/admin/gestion-componentes'); } };
exports.createGrupo = async (req, res) => { try { await Grupo.create(req.body); res.redirect('/admin/gestion-componentes'); } catch (e) { res.redirect('/admin/gestion-componentes'); } };
exports.showEditComponenteForm = async (req, res) => { try { const c = await Componente.findByPk(req.params.id); const g = await Grupo.findAll(); res.render('admin/componente-form-edit', { componente: c, grupos: g }); } catch (e) { res.redirect('/admin'); } };
exports.updateComponente = async (req, res) => { try { const {nombre, grupo_id, precio_adicional} = req.body; await Componente.update({nombre, grupo_id, precio_adicional: parseFloat(precio_adicional)||0}, {where:{id:req.params.id}}); res.redirect('/admin/gestion-componentes'); } catch(e){ res.redirect('/admin'); } };
exports.deleteComponente = async (req, res) => { try { await Componente.destroy({where:{id:req.params.id}}); res.redirect('/admin/gestion-componentes'); } catch(e){ res.redirect('/admin'); } };
exports.showEditGrupoForm = async (req, res) => { const g = await Grupo.findByPk(req.params.id); res.render('admin/grupo-form-edit', { grupo: g }); };
exports.updateGrupo = async (req, res) => { await Grupo.update(req.body, {where:{id:req.params.id}}); res.redirect('/admin/gestion-componentes'); };
exports.deleteGrupo = async (req, res) => { await Grupo.destroy({where:{id:req.params.id}}); res.redirect('/admin/gestion-componentes'); };

// =================================================================
// 4. GESTIÓN USUARIOS
// =================================================================
exports.getUsuarios = async (req, res) => { const u = await Usuario.findAll({ include: { model: Rol, as: 'rol' } }); res.render('admin/usuarios', { usuarios: u }); };
exports.showNewUserForm = async (req, res) => { const r = await Rol.findAll(); res.render('admin/usuario-form', { usuario: {}, roles: r }); };
exports.createUser = async (req, res) => { try { await Usuario.create(req.body); res.redirect('/admin/usuarios'); } catch(e) { const r = await Rol.findAll(); res.render('admin/usuario-form', { usuario: req.body, roles: r, error: e.message }); } };
exports.showEditUserForm = async (req, res) => { const u = await Usuario.findByPk(req.params.id); const r = await Rol.findAll(); res.render('admin/usuario-form', { usuario: u, roles: r }); };
exports.updateUser = async (req, res) => { const u = await Usuario.findByPk(req.params.id); u.nombre=req.body.nombre; u.email=req.body.email; u.RolId=req.body.RolId; if(req.body.password) u.password=req.body.password; await u.save(); res.redirect('/admin/usuarios'); };
exports.toggleUserStatus = async (req, res) => { const u = await Usuario.findByPk(req.params.id); u.activo=!u.activo; await u.save(); res.redirect('/admin/usuarios'); };

// =================================================================
// 5. GESTIÓN MESAS Y MAPA
// =================================================================
exports.getMesas = async (req, res) => { const m = await Mesa.findAll({ order: [['numero', 'ASC']] }); res.render('admin/mesas', { pageTitle: 'Mesas', mesas: m }); };
exports.showNewMesaForm = (req, res) => res.render('admin/mesa-form', { mesa: {} });
exports.createMesa = async (req, res) => { try { await Mesa.create(req.body); res.redirect('/admin/mesas'); } catch(e) { res.render('admin/mesa-form', { mesa: req.body, error: e.message }); } };
exports.showEditMesaForm = async (req, res) => { const m = await Mesa.findByPk(req.params.id); res.render('admin/mesa-form', { mesa: m }); };
exports.updateMesa = async (req, res) => { await Mesa.update(req.body, {where:{id:req.params.id}}); res.redirect('/admin/mesas'); };
exports.deleteMesa = async (req, res) => { await Mesa.destroy({where:{id:req.params.id}}); res.redirect('/admin/mesas'); };
exports.liberarTodasLasMesas = async (req, res) => { await Mesa.update({estado:'libre'},{where:{}}); res.redirect('/admin/mesas'); };
exports.getMapaEditor = async (req, res) => { const m = await Mesa.findAll(); res.render('admin/mapa-editor', { mesas: m }); };
exports.saveMapaLayout = async (req, res) => { 
    try { 
        const data = req.body; 
        if(!Array.isArray(data)) return res.status(400).json({success:false});
        for(const p of data) { await Mesa.update({pos_x: parseInt(p.x)||0, pos_y: parseInt(p.y)||0, ancho: parseInt(p.w)||120, alto: parseInt(p.h)||120}, {where:{id:parseInt(p.id)}}); }
        res.json({success:true}); 
    } catch(e) { res.status(500).json({success:false}); } 
};

// =================================================================
// 6. GESTIÓN DE EMPRESAS (¡AQUÍ ESTÁ LO QUE FALTABA!)
// =================================================================
exports.getGestionEmpresas = async (req, res) => {
    try {
        const empresas = await Empresa.findAll();
        res.render('admin/gestion-empresas', { pageTitle: 'Gestión de Empresas', empresas });
    } catch (error) { res.redirect('/admin'); }
};

exports.createEmpresa = async (req, res) => {
    try {
        await Empresa.create(req.body);
        req.flash('success_msg', 'Empresa creada.');
        res.redirect('/admin/empresas');
    } catch (error) {
        req.flash('error_msg', 'Error al crear empresa.');
        res.redirect('/admin/empresas');
    }
};

exports.deleteEmpresa = async (req, res) => {
    try {
        await Empresa.destroy({ where: { id: req.params.id } });
        res.redirect('/admin/empresas');
    } catch (error) { res.redirect('/admin/empresas'); }
};

// =================================================================
// 7. INFORMES
// =================================================================
exports.getInformes = (req, res) => {
    res.render('admin/informes', { pageTitle: 'Centro de Informes' });
};

exports.generarReporteFechas = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.body;
        const start = new Date(fechaInicio); start.setHours(0,0,0,0);
        const end = new Date(fechaFin); end.setHours(23,59,59,999);

        const ventas = await Pedido.findAll({
            where: {
                estado: 'pagado',
                createdAt: { [Op.between]: [start, end] }
            },
            include: [{
                model: PedidoItem, as: 'items',
                include: [{ model: Componente, as: 'componentes' }]
            }],
            order: [['createdAt', 'DESC']]
        });

        let totalIngresos = 0;
        let totalPedidos = ventas.length;

        const detalleVentas = ventas.map(pedido => {
            let totalPedido = 0;
            pedido.items.forEach(item => {
                totalPedido += parseFloat(item.precio_unitario || 0);
                item.componentes.forEach(comp => totalPedido += parseFloat(comp.precio_adicional || 0));
            });
            totalIngresos += totalPedido;
            return { id: pedido.id, fecha: pedido.createdAt, mesa: pedido.mesa_id, total: totalPedido };
        });

        res.render('admin/reporte-resultados', {
            pageTitle: `Reporte de Ventas`,
            tipo: 'ventas',
            datos: detalleVentas,
            resumen: { totalIngresos, totalPedidos }
        });
    } catch (error) { res.redirect('/admin/informes'); }
};

exports.generarReporteTop = async (req, res) => {
    // ... (Tu lógica de reporte Top que ya tienes, la incluyo resumida)
    try {
        const pedidos = await Pedido.findAll({ where: { estado: 'pagado' }, include: [{ model: PedidoItem, as: 'items', include: [{ model: Componente, as: 'componentes' }] }] });
        const ranking = {};
        pedidos.forEach(p => p.items.forEach(i => {
            const nombre = `Menú ($${i.precio_unitario})`;
            ranking[nombre] = (ranking[nombre] || 0) + 1;
            i.componentes.forEach(c => ranking[c.nombre] = (ranking[c.nombre] || 0) + 1);
        }));
        const rankingArray = Object.keys(ranking).map(k => ({ nombre: k, cantidad: ranking[k], tipo: 'Item' })).sort((a,b)=>b.cantidad-a.cantidad);
        res.render('admin/reporte-resultados', { pageTitle: 'Ranking', tipo: 'ranking', datos: rankingArray });
    } catch(e) { res.redirect('/admin/informes'); }
};

// Reporte de Cobranza Empresas
exports.getReporteCuentasCobrar = async (req, res) => {
    try {
        const empresas = await Empresa.findAll();
        const { empresaId, fechaInicio, fechaFin } = req.query;

        let whereClause = { medio_pago: 'credito_empresa', estado: 'pagado' };
        if (empresaId) whereClause.empresa_id = empresaId;
        if (fechaInicio && fechaFin) {
            const start = new Date(fechaInicio); start.setHours(0,0,0,0);
            const end = new Date(fechaFin); end.setHours(23,59,59,999);
            whereClause.createdAt = { [Op.between]: [start, end] };
        }

        const pedidosCredito = await Pedido.findAll({
            where: whereClause,
            include: [
                { model: Empresa, as: 'empresa' },
                { model: PedidoItem, as: 'items', include: [{ model: Componente, as: 'componentes' }] }
            ],
            order: [['createdAt', 'DESC']]
        });

        let totalDeuda = 0;
        const pedidosProcesados = pedidosCredito.map(p => {
            let total = 0;
            p.items.forEach(i => {
                total += parseFloat(i.precio_unitario || 0);
                i.componentes.forEach(c => total += parseFloat(c.precio_adicional || 0));
            });
            totalDeuda += total;
            return { ...p.toJSON(), totalCalculado: total };
        });

        res.render('admin/reporte-cobranza', { pageTitle: 'Cuentas por Cobrar', empresas, pedidos: pedidosProcesados, totalDeuda, filtros: req.query });
    } catch (e) { res.redirect('/admin/informes'); }
};