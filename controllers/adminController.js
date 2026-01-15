'use strict';
// IMPORTACIÓN ÚNICA Y CENTRALIZADA
const { Usuario, Rol, Mesa, Menu, Grupo, Componente, Pedido, PedidoItem, sequelize, Empresa, MenuComponente } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');

// HELPER: Función para calcular el total de un pedido de forma consistente
const calcularTotalPedido = (pedido) => {
    let total = 0;
    if (pedido.items) {
        pedido.items.forEach(item => {
            total += parseFloat(item.precio_unitario || 0);
            if (item.componentes) {
                item.componentes.forEach(comp => {
                    total += parseFloat(comp.precio_adicional || 0);
                });
            }
        });
    }
    return total;
};

// ==========================================
// 1. DASHBOARD AVANZADO (CENTRO DE COMANDO)
// ==========================================
exports.showDashboard = async (req, res) => {
    try {
        const hoy = new Date();
        
        // --- DEFINICIÓN DE RANGOS DE FECHAS ---
        const startDay = new Date(hoy); startDay.setHours(0,0,0,0);
        const endDay = new Date(hoy); endDay.setHours(23,59,59,999);

        // Semana Actual (Lunes a Domingo)
        const startWeek = new Date(hoy); 
        const dayOfWeek = startWeek.getDay() || 7; // Ajuste para que lunes sea 1
        startWeek.setHours(0,0,0,0);
        startWeek.setDate(startWeek.getDate() - dayOfWeek + 1);

        // Mes Actual
        const startMonth = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        
        // Comparativos (Ayer, Mes Anterior)
        const startAyer = new Date(startDay); startAyer.setDate(startAyer.getDate() - 1);
        const endAyer = new Date(endDay); endAyer.setDate(endAyer.getDate() - 1);
        
        const startLastMonth = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        const endLastMonth = new Date(hoy.getFullYear(), hoy.getMonth(), 0);

        // --- CONSULTAS ---
        
        // A. Ventas Generales (Pagadas)
        // Traemos datos desde el mes pasado para calcular comparativos en memoria y ahorrar consultas
        const pedidosMes = await Pedido.findAll({
            where: {
                estado: 'pagado',
                createdAt: { [Op.gte]: startLastMonth } 
            },
            include: [
                { model: PedidoItem, as: 'items', include: [{ model: Componente, as: 'componentes' }] },
                { model: Mesa, as: 'mesa' }
            ]
        });

        // B. Deuda Empresas (Crédito activo)
        const pedidosCredito = await Pedido.findAll({
            where: { medio_pago: 'credito_empresa', estado: 'pagado' },
            include: [
                { model: Empresa, as: 'empresa' },
                { model: PedidoItem, as: 'items', include: [{ model: Componente, as: 'componentes' }] }
            ]
        });

        // --- PROCESAMIENTO DE KPIs ---

        let kpis = {
            dia: { total: 0, cantidad: 0 },
            ayer: { total: 0 },
            semana: { total: 0, cantidad: 0 },
            mes: { total: 0, cantidad: 0 },
            mesAnterior: { total: 0 }
        };

        const ventasPorHora = new Array(24).fill(0);
        const rankingPlatos = {};     
        const rankingMesas = {};      
        const consumoComponentes = {}; 

        pedidosMes.forEach(p => {
            const fecha = new Date(p.createdAt);
            const totalP = calcularTotalPedido(p);
            
            // Filtros de Tiempo
            if (fecha >= startDay && fecha <= endDay) {
                kpis.dia.total += totalP;
                kpis.dia.cantidad++;
                ventasPorHora[fecha.getHours()] += totalP; // Gráfica horas (solo hoy)
            }
            if (fecha >= startAyer && fecha <= endAyer) kpis.ayer.total += totalP;
            if (fecha >= startWeek) { kpis.semana.total += totalP; kpis.semana.cantidad++; }
            if (fecha >= startMonth) { 
                kpis.mes.total += totalP; 
                kpis.mes.cantidad++; 

                // Ranking Platos y Componentes (Solo analizamos el mes actual)
                p.items.forEach(i => {
                    const nombreP = i.menu_nombre || 'Varios';
                    if (!rankingPlatos[nombreP]) rankingPlatos[nombreP] = { cant: 0, dinero: 0 };
                    rankingPlatos[nombreP].cant++;
                    rankingPlatos[nombreP].dinero += parseFloat(i.precio_unitario || 0);

                    // Componentes
                    if (i.componentes) {
                        i.componentes.forEach(c => {
                            consumoComponentes[c.nombre] = (consumoComponentes[c.nombre] || 0) + 1;
                        });
                    }
                });

                // Ranking Mesas
                const mesaNombre = p.mesa ? `Mesa ${p.mesa.numero}` : 'Barra/Ext';
                rankingMesas[mesaNombre] = (rankingMesas[mesaNombre] || 0) + totalP;
            }
            if (fecha >= startLastMonth && fecha < startMonth) kpis.mesAnterior.total += totalP;
        });

        // --- PROCESAR DEUDAS EMPRESAS ---
        const deudaEmpresas = {};
        let totalFiado = 0;
        let clientesFiados = 0;

        pedidosCredito.forEach(p => {
            if (!p.empresa) return;
            const idEmp = p.empresa.id;
            const nomEmp = p.empresa.nombre;
            const totalP = calcularTotalPedido(p);

            if (!deudaEmpresas[idEmp]) deudaEmpresas[idEmp] = { id: idEmp, nombre: nomEmp, deuda: 0, pedidos: 0 };
            
            deudaEmpresas[idEmp].deuda += totalP;
            deudaEmpresas[idEmp].pedidos++;
            totalFiado += totalP;
            clientesFiados++; 
        });

        // --- ORDENAR RANKINGS ---
        const topPlatos = Object.entries(rankingPlatos)
            .map(([k, v]) => ({ nombre: k, ...v }))
            .sort((a, b) => b.cant - a.cant)
            .slice(0, 10);

        const topComponentes = Object.entries(consumoComponentes)
            .map(([k, v]) => ({ nombre: k, cantidad: v }))
            .sort((a, b) => b.cantidad - a.cantidad)
            .slice(0, 8);
        
        const topMesas = Object.entries(rankingMesas)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // --- RENDERIZAR ---
        res.render('admin/dashboard', {
            pageTitle: 'Tablero de Control',
            kpis,
            promedioDiario: kpis.mes.cantidad > 0 ? kpis.mes.total / new Date().getDate() : 0,
            
            // Datos para gráficas
            graficos: {
                horasLabels: JSON.stringify([...Array(24).keys()].map(h => `${h}:00`)),
                horasData: JSON.stringify(ventasPorHora),
                topPlatosNombres: JSON.stringify(topPlatos.map(p => p.nombre)),
                topPlatosData: JSON.stringify(topPlatos.map(p => p.cant)),
                topMesasLabels: JSON.stringify(topMesas.map(m => m[0])),
                topMesasData: JSON.stringify(topMesas.map(m => m[1]))
            },
            
            topComponentes,
            topPlatosList: topPlatos,
            
            // Sección Deudas
            deudaEmpresas: Object.values(deudaEmpresas),
            totalFiado,
            clientesFiados
        });

    } catch (e) {
        console.error("Error Dashboard:", e);
        res.status(500).send("Error cargando el dashboard");
    }
};

// ==========================================
// 2. GESTIÓN DE MENÚS (CRUD)
// ==========================================
exports.getGestionMenu = async (req, res) => { try { const m = await Menu.findAll({order:[['id','ASC']]}); res.render('admin/gestion-menu',{menus:m}); } catch(e){ res.redirect('/admin'); } };

// MOSTRAR FORMULARIO CREAR (GET)
exports.showNewMenuForm = (req, res) => {
    try {
        res.render('admin/menu-form', {
            pageTitle: 'Crear Nuevo Menú',
            menu: {}, 
            action: '/admin/menus/create'
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/menus');
    }
};

// GUARDAR NUEVO MENÚ (POST)
exports.createMenu = async (req, res) => {
    try {
        const { nombre, precio_base, activo } = req.body;
        await Menu.create({
            nombre,
            precio_base,
            activo: activo === 'on' ? true : false
        });
        res.redirect('/admin/menus');
    } catch (error) {
        console.error('Error al crear menú:', error);
        res.redirect('/admin/menus/create');
    }
};

exports.showEditMenuForm = async (req, res) => { try { const m = await Menu.findByPk(req.params.id); res.render('admin/menu-form',{menu:m, pageTitle: 'Editar Menú', action: `/admin/menus/edit/${m.id}`}); } catch(e){ res.redirect('/admin/gestion-menu'); } };
exports.updateMenu = async (req, res) => { try { await Menu.update({...req.body, activo:!!req.body.activo}, {where:{id:req.params.id}}); res.redirect('/admin/gestion-menu'); } catch(e){ res.redirect('/admin/gestion-menu'); } };
exports.deleteMenu = async (req, res) => { try { await Menu.destroy({where:{id:req.params.id}}); res.redirect('/admin/gestion-menu'); } catch(e){ res.redirect('/admin/gestion-menu'); } };
exports.toggleMenuEstado = async (req, res) => { try { const m=await Menu.findByPk(req.params.id); m.activo=!m.activo; await m.save(); res.json({success:true, nuevoEstado:m.activo}); } catch(e){ res.status(500).json({success:false}); } };

// CONFIGURACIÓN DE COMPONENTES DEL MENÚ
exports.showConfigurarMenu = async (req, res) => {
    try {
        const menu = await Menu.findByPk(req.params.id);
        const grupos = await Grupo.findAll({
            include: { model: Componente, as: 'componentes' },
            order: [['id', 'ASC'], [{ model: Componente, as: 'componentes' }, 'nombre', 'ASC']]
        });
        
        const compSel = await menu.getComponentes();
        
        const configMap = {};
        compSel.forEach(c => {
            // Lógica para encontrar la tabla pivote sin importar cómo la llamó Sequelize
            let pivote = c.menu_componentes || c.MenuComponente || c.dataValues.menu_componentes;
            
            configMap[c.id] = {
                selected: true,
                por_defecto: pivote ? pivote.por_defecto : false
            };
        });

        res.render('admin/configurar-menu', { 
            pageTitle: 'Configurar Menú', 
            menu, 
            grupos, 
            configMap 
        });
    } catch (e) { 
        console.error(e); 
        res.redirect('/admin/gestion-menu'); 
    }
};

exports.saveConfigurarMenu = async (req, res) => {
    try {
        const menuId = parseInt(req.params.id);
        const data = req.body.comps || {};
        const MenuComponenteModel = sequelize.model('MenuComponente'); 

        // 1. Borrar todo lo anterior
        await MenuComponenteModel.destroy({ where: { menu_id: menuId } });

        // 2. Preparar nuevos datos
        const nuevasRelaciones = [];
        for (const key in data) {
            const compId = parseInt(key.replace('id_', ''));
            const opciones = data[key];
            if (!isNaN(compId) && opciones.sel === 'on') {
                nuevasRelaciones.push({
                    menu_id: menuId,
                    componente_id: compId,
                    por_defecto: (opciones.def === 'on'),
                    createdAt: new Date(), updatedAt: new Date()
                });
            }
        }

        // 3. Insertar
        if (nuevasRelaciones.length > 0) {
            await MenuComponenteModel.bulkCreate(nuevasRelaciones);
        }

        res.redirect('/admin/gestion-menu');
    } catch (e) { 
        console.error("ERROR GUARDAR CONFIG:", e);
        res.redirect('/admin/gestion-menu'); 
    }
};

// ==========================================
// 3. GESTIÓN DE COMPONENTES Y GRUPOS
// ==========================================
exports.getGestionComponentes = async (req, res) => { try { const g=await Grupo.findAll({include:{model:Componente,as:'componentes'}, order:[['nombre','ASC']]}); res.render('admin/gestion-componentes',{grupos:g}); } catch(e){ res.redirect('/admin'); } };
exports.createComponente = async (req, res) => { try { const {nombre, grupo_id, precio_adicional} = req.body; await Componente.create({nombre, grupo_id, precio_adicional: parseFloat(precio_adicional)||0}); res.redirect('/admin/gestion-componentes'); } catch (e) { res.redirect('/admin/gestion-componentes'); } };
exports.createGrupo = async (req, res) => { try { await Grupo.create(req.body); res.redirect('/admin/gestion-componentes'); } catch (e) { res.redirect('/admin/gestion-componentes'); } };
exports.showEditComponenteForm = async (req, res) => { try { const c=await Componente.findByPk(req.params.id); const g=await Grupo.findAll(); res.render('admin/componente-form-edit',{componente:c, grupos:g}); } catch(e){ res.redirect('/admin'); } };
exports.updateComponente = async (req, res) => { try { const {nombre, grupo_id, precio_adicional} = req.body; await Componente.update({nombre, grupo_id, precio_adicional: parseFloat(precio_adicional)||0}, {where:{id:req.params.id}}); res.redirect('/admin/gestion-componentes'); } catch(e){ res.redirect('/admin'); } };
exports.deleteComponente = async (req, res) => { try { await Componente.destroy({where:{id:req.params.id}}); res.redirect('/admin/gestion-componentes'); } catch(e){ res.redirect('/admin'); } };
exports.showEditGrupoForm = async (req, res) => { const g=await Grupo.findByPk(req.params.id); res.render('admin/grupo-form-edit',{grupo:g}); };
exports.updateGrupo = async (req, res) => { await Grupo.update(req.body, {where:{id:req.params.id}}); res.redirect('/admin/gestion-componentes'); };
exports.deleteGrupo = async (req, res) => { await Grupo.destroy({where:{id:req.params.id}}); res.redirect('/admin/gestion-componentes'); };

// ==========================================
// 4. GESTIÓN DE USUARIOS
// ==========================================
exports.getUsuarios = async (req, res) => { const u=await Usuario.findAll({include:{model:Rol,as:'rol'}}); res.render('admin/usuarios',{usuarios:u}); };
exports.showNewUserForm = async (req, res) => { const r=await Rol.findAll(); res.render('admin/usuario-form',{usuario:{}, roles:r}); };
exports.createUser = async (req, res) => { try{ await Usuario.create(req.body); res.redirect('/admin/usuarios'); }catch(e){ const r=await Rol.findAll(); res.render('admin/usuario-form',{usuario:req.body, roles:r, error:e.message}); } };
exports.showEditUserForm = async (req, res) => { const u=await Usuario.findByPk(req.params.id); const r=await Rol.findAll(); res.render('admin/usuario-form',{usuario:u, roles:r}); };
exports.updateUser = async (req, res) => { const u=await Usuario.findByPk(req.params.id); u.nombre=req.body.nombre; u.email=req.body.email; u.RolId=req.body.RolId; if(req.body.password) u.password=req.body.password; await u.save(); res.redirect('/admin/usuarios'); };
exports.toggleUserStatus = async (req, res) => { const u=await Usuario.findByPk(req.params.id); u.activo=!u.activo; await u.save(); res.redirect('/admin/usuarios'); };

// ==========================================
// 5. GESTIÓN DE MESAS
// ==========================================
exports.getMesas = async (req, res) => { const m=await Mesa.findAll({order:[['numero','ASC']]}); res.render('admin/mesas',{mesas:m}); };
exports.showNewMesaForm = (req, res) => res.render('admin/mesa-form',{mesa:{}});
exports.createMesa = async (req, res) => { try{await Mesa.create(req.body);res.redirect('/admin/mesas');}catch(e){res.render('admin/mesa-form',{mesa:req.body,error:e.message});} };
exports.showEditMesaForm = async (req, res) => { const m=await Mesa.findByPk(req.params.id); res.render('admin/mesa-form',{mesa:m}); };
exports.updateMesa = async (req, res) => { await Mesa.update(req.body, {where:{id:req.params.id}}); res.redirect('/admin/mesas'); };
exports.deleteMesa = async (req, res) => { await Mesa.destroy({where:{id:req.params.id}}); res.redirect('/admin/mesas'); };
exports.liberarTodasLasMesas = async (req, res) => { await Mesa.update({estado:'libre'},{where:{}}); res.redirect('/admin/mesas'); };
exports.getMapaEditor = async (req, res) => { const m=await Mesa.findAll(); res.render('admin/mapa-editor',{mesas:m}); };
exports.saveMapaLayout = async (req, res) => { try{const d=req.body; if(!Array.isArray(d)) return res.status(400).json({success:false}); for(const p of d){ await Mesa.update({pos_x:parseInt(p.x)||0, pos_y:parseInt(p.y)||0, ancho:parseInt(p.w)||120, alto:parseInt(p.h)||120},{where:{id:parseInt(p.id)}}); } res.json({success:true}); }catch(e){res.status(500).json({success:false});} };

// ==========================================
// 6. GESTIÓN DE EMPRESAS
// ==========================================
exports.getGestionEmpresas = async (req, res) => { try{const e=await Empresa.findAll();res.render('admin/gestion-empresas',{empresas:e});}catch(e){res.redirect('/admin');} };
exports.createEmpresa = async (req, res) => { try{await Empresa.create(req.body);res.redirect('/admin/empresas');}catch(e){res.redirect('/admin/empresas');} };
exports.deleteEmpresa = async (req, res) => { try{await Empresa.destroy({where:{id:req.params.id}});res.redirect('/admin/empresas');}catch(e){res.redirect('/admin/empresas');} };

// ==========================================
// 7. INFORMES (REPORTES)
// ==========================================
exports.getInformes = (req, res) => { res.render('admin/informes', { pageTitle: 'Informes' }); };

// REPORTE DE VENTAS (KARDEX) - CORREGIDO
exports.generarReporteFechas = async (req, res) => {
    try {
        const hoyStr = new Date().toLocaleDateString('en-CA');
        const fechaInicio = req.body.fechaInicio || hoyStr;
        const fechaFin = req.body.fechaFin || hoyStr;

        const startDate = new Date(fechaInicio);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(fechaFin);
        endDate.setHours(23, 59, 59, 999);

        const pedidos = await Pedido.findAll({
            where: {
                estado: 'pagado', 
                createdAt: { [Op.between]: [startDate, endDate] }
            },
            include: [
                { model: Mesa, as: 'mesa' },
                { model: PedidoItem, as: 'items' }
            ],
            order: [['createdAt', 'DESC']]
        });

        let totalGeneral = 0;

        const datosFormateados = pedidos.map(p => {
            const sumaPedido = calcularTotalPedido(p); // Usamos el helper
            totalGeneral += sumaPedido;

            return {
                id: p.id,
                fecha: p.createdAt, 
                mesa: p.mesa ? `Mesa ${p.mesa.numero}` : 'Barra/Domicilio', 
                total: sumaPedido 
            };
        });

        res.render('admin/reporte-resultados', {
            pageTitle: 'Reporte de Ventas (Kardex)',
            fechaInicio: fechaInicio,
            fechaFin: fechaFin,
            datos: datosFormateados, 
            tipo: 'ventas',
            resumen: {
                totalIngresos: totalGeneral,
                totalPedidos: pedidos.length
            }
        });

    } catch (error) {
        console.error('Error en reporte fechas:', error);
        res.redirect('/admin/informes');
    }
};

// REPORTE DE RANKING PRODUCTOS - CORREGIDO
exports.generarReporteTop = async (req, res) => {
    try {
        const hoyStr = new Date().toLocaleDateString('en-CA');
        const fechaInicio = req.body.fechaInicio || hoyStr;
        const fechaFin = req.body.fechaFin || hoyStr;

        const startDate = new Date(fechaInicio);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(fechaFin);
        endDate.setHours(23, 59, 59, 999);

        // CONSULTA SOBRE PEDIDOS PAGADOS (Para consistencia con el Kardex)
        const pedidos = await Pedido.findAll({
            where: {
                estado: 'pagado', 
                createdAt: { [Op.between]: [startDate, endDate] }
            },
            include: [
                { model: PedidoItem, as: 'items' }
            ]
        });

        // AGRUPACIÓN MANUAL
        const conteo = {};

        pedidos.forEach(pedido => {
            if (pedido.items && pedido.items.length > 0) {
                pedido.items.forEach(item => {
                    const nombre = item.menu_nombre || 'Producto Personalizado';
                    const precio = parseFloat(item.precio_unitario || 0);

                    if (!conteo[nombre]) {
                        conteo[nombre] = { nombre: nombre, cantidad: 0, total: 0 };
                    }
                    conteo[nombre].cantidad += 1;
                    conteo[nombre].total += precio;
                });
            }
        });

        const ranking = Object.values(conteo).sort((a, b) => b.cantidad - a.cantidad);

        res.render('admin/reporte-resultados', {
            pageTitle: 'Ranking de Productos Más Vendidos',
            datos: ranking,
            fechaInicio: fechaInicio, 
            fechaFin: fechaFin,
            tipo: 'ranking'
        });

    } catch (error) {
        console.error('Error en reporte top:', error);
        res.redirect('/admin/informes');
    }
};

exports.getReporteCuentasCobrar = async (req, res) => { try { const {empresaId,fechaInicio,fechaFin}=req.query; let where={medio_pago:'credito_empresa',estado:'pagado'}; if(empresaId) where.empresa_id=empresaId; if(fechaInicio) where.createdAt={[Op.between]:[new Date(fechaInicio),new Date(fechaFin||fechaInicio)]}; const p=await Pedido.findAll({where, include:[{model:Empresa,as:'empresa'},{model:PedidoItem,as:'items',include:[{model:Componente,as:'componentes'}]}], order:[['createdAt','DESC']]}); let td=0; const pr=p.map(x=>{const t=calcularTotalPedido(x); td+=t; return{...x.toJSON(),totalCalculado:t};}); res.render('admin/reporte-cobranza',{empresas:await Empresa.findAll(),pedidos:pr,totalDeuda:td,filtros:req.query}); } catch(e){ res.redirect('/admin/informes'); } };
exports.saldarDeudaEmpresa = async (req, res) => { try { const {pedidosIds,accion}=req.body; const {empresaId}=req.query; let where={medio_pago:'credito_empresa',estado:'pagado'}; if(accion==='todo'){if(empresaId)where.empresa_id=empresaId;}else{if(!pedidosIds)return res.redirect('/admin/informes/cobranza'); where.id=pedidosIds;} await Pedido.update({estado:'finalizado'},{where}); res.redirect('/admin/informes/cobranza?empresaId='+(empresaId||'')); } catch(e){ res.redirect('/admin/informes/cobranza'); } };

// ==========================================
// 8. BILLING (FACTURACIÓN)
// ==========================================
const billingController = require('../controllers/billingController');
if(billingController && billingController.getBillingDashboard) exports.getBillingDashboard = billingController.getBillingDashboard;
else exports.getBillingDashboard = (req,res) => res.redirect('/admin');