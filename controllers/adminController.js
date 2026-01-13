'use strict';
const { Usuario, Rol, Mesa, Menu, Grupo, Componente, Pedido, PedidoItem, sequelize, Empresa, MenuComponente } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');

// 1. DASHBOARD
exports.showDashboard = async (req, res) => {
    try {
        const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
        const finDia = new Date(); finDia.setHours(23, 59, 59, 999);
        const inicioAyer = new Date(inicioDia); inicioAyer.setDate(inicioAyer.getDate() - 1);
        const finAyer = new Date(finDia); finAyer.setDate(finAyer.getDate() - 1);

        const pedidosHoy = await Pedido.findAll({
            where: { createdAt: { [Op.between]: [inicioDia, finDia] } },
            include: [{ model: PedidoItem, as: 'items', include: [{ model: Componente, as: 'componentes' }] }]
        });
        const pedidosAyer = await Pedido.findAll({
            where: { createdAt: { [Op.between]: [inicioAyer, finAyer] }, estado: 'pagado' },
            include: [{ model: PedidoItem, as: 'items', include: [{ model: Componente, as: 'componentes' }] }]
        });
        const pedidosCredito = await Pedido.findAll({
            where: { medio_pago: 'credito_empresa', estado: 'pagado' },
            include: [{ model: Empresa, as: 'empresa' }, { model: PedidoItem, as: 'items', include: [{ model: Componente, as: 'componentes' }] }]
        });

        let totalVentasAyer = 0;
        pedidosAyer.forEach(p => p.items.forEach(i => { totalVentasAyer += parseFloat(i.precio_unitario||0); i.componentes.forEach(c => totalVentasAyer += parseFloat(c.precio_adicional||0)); }));

        let totalDinero = 0, cantidadPedidos = 0, platosVendidos = 0;
        const ventasPorPlato = {}, conteoEstados = { 'En Cocina': 0, 'Para Recoger': 0, 'En Mesa': 0, 'Finalizado': 0 }, ventasPorHora = new Array(24).fill(0), conteoBebidas = {}, ventasPorMesa = {};

        pedidosHoy.forEach(p => {
            if (p.estado === 'recibido' || p.estado === 'en_preparacion') conteoEstados['En Cocina']++;
            else if (p.estado === 'elaborado') conteoEstados['Para Recoger']++;
            else if (p.estado === 'entregado') conteoEstados['En Mesa']++;
            else if (p.estado === 'pagado') {
                conteoEstados['Finalizado']++;
                cantidadPedidos++;
                let valor = 0;
                p.items.forEach(i => {
                    const pr = parseFloat(i.precio_unitario||0); valor += pr; totalDinero += pr; platosVendidos++;
                    const etiq = `Menú ($${pr.toFixed(0)})`; ventasPorPlato[etiq] = (ventasPorPlato[etiq]||0)+1;
                    i.componentes.forEach(c => { const pc = parseFloat(c.precio_adicional||0); valor += pc; totalDinero += pc; conteoBebidas[c.nombre] = (conteoBebidas[c.nombre]||0)+1; });
                });
                ventasPorHora[new Date(p.createdAt).getHours()] += valor;
                ventasPorMesa[`Mesa ${p.mesa_id}`] = (ventasPorMesa[`Mesa ${p.mesa_id}`]||0)+valor;
            }
        });

        const deudaPorEmpresa = {};
        pedidosCredito.forEach(p => {
            if (!p.empresa) return;
            const nom = p.empresa.nombre;
            if (!deudaPorEmpresa[nom]) deudaPorEmpresa[nom] = { total: 0, detalles: [] };
            p.items.forEach(i => {
                let val = parseFloat(i.precio_unitario||0);
                i.componentes.forEach(c => val += parseFloat(c.precio_adicional||0));
                deudaPorEmpresa[nom].total += val;
                deudaPorEmpresa[nom].detalles.push({ fecha: new Date(p.createdAt).toLocaleDateString(), plato: `Pedido #${p.id}`, valor: val });
            });
        });

        const getTop5 = (o) => Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,5);
        const topP = getTop5(ventasPorPlato), topB = getTop5(conteoBebidas), topM = getTop5(ventasPorMesa);
        const empL = Object.keys(deudaPorEmpresa), empD = empL.map(k=>deudaPorEmpresa[k].total), empDet = empL.map(k=>deudaPorEmpresa[k].detalles);

        res.render('admin/dashboard', {
            pageTitle: 'Panel', totalDinero, cantidadPedidos, platosVendidos,
            kpis: { ventasHoy: totalDinero, pedidosHoy: cantidadPedidos, ticketPromedio: cantidadPedidos ? totalDinero/cantidadPedidos : 0 },
            graficos: {
                ventasHora: JSON.stringify(ventasPorHora),
                estados: { labels: JSON.stringify(Object.keys(conteoEstados)), data: JSON.stringify(Object.values(conteoEstados)) },
                topPlatos: { labels: JSON.stringify(topP.map(x=>x[0])), data: JSON.stringify(topP.map(x=>x[1])) },
                topBebidas: { labels: JSON.stringify(topB.map(x=>x[0])), data: JSON.stringify(topB.map(x=>x[1])) },
                topMesas: { labels: JSON.stringify(topM.map(x=>x[0])), data: JSON.stringify(topM.map(x=>x[1])) },
                comparativo: JSON.stringify([totalVentasAyer, totalDinero])
            },
            empresasLabels: JSON.stringify(empL), empresasData: JSON.stringify(empD), empresasDetalles: JSON.stringify(empDet)
        });
    } catch (e) { res.status(500).send("Error dashboard"); }
};

// 2. GESTIÓN DE MENÚS
exports.getGestionMenu = async (req, res) => { try { const m = await Menu.findAll({order:[['id','ASC']]}); res.render('admin/gestion-menu',{menus:m}); } catch(e){ res.redirect('/admin'); } };
exports.showNewMenuForm = (req, res) => res.render('admin/menu-form', { menu:{} });
exports.createMenu = async (req, res) => { try { await Menu.create({...req.body, activo:!!req.body.activo}); res.redirect('/admin/gestion-menu'); } catch(e){ res.render('admin/menu-form', {menu:req.body, error:e.message}); } };
exports.showEditMenuForm = async (req, res) => { try { const m = await Menu.findByPk(req.params.id); res.render('admin/menu-form',{menu:m}); } catch(e){ res.redirect('/admin/gestion-menu'); } };
exports.updateMenu = async (req, res) => { try { await Menu.update({...req.body, activo:!!req.body.activo}, {where:{id:req.params.id}}); res.redirect('/admin/gestion-menu'); } catch(e){ res.redirect('/admin/gestion-menu'); } };
exports.deleteMenu = async (req, res) => { try { await Menu.destroy({where:{id:req.params.id}}); res.redirect('/admin/gestion-menu'); } catch(e){ res.redirect('/admin/gestion-menu'); } };
exports.toggleMenuEstado = async (req, res) => { try { const m=await Menu.findByPk(req.params.id); m.activo=!m.activo; await m.save(); res.json({success:true, nuevoEstado:m.activo}); } catch(e){ res.status(500).json({success:false}); } };


// ...

exports.showConfigurarMenu = async (req, res) => {
    try {
        const menu = await Menu.findByPk(req.params.id);
        const grupos = await Grupo.findAll({
            include: { model: Componente, as: 'componentes' },
            order: [['id', 'ASC'], [{ model: Componente, as: 'componentes' }, 'nombre', 'ASC']]
        });
        
        // Obtenemos los componentes del menú
        const compSel = await menu.getComponentes();
        
        const configMap = {};
        compSel.forEach(c => {
            // INTENTO 1: Nombre estándar de Sequelize
            let pivote = c.menu_componentes;
            
            // INTENTO 2: Nombre alternativo si usaste 'as' o nombre de modelo
            if (!pivote) pivote = c.MenuComponente;
            
            // INTENTO 3: Si definiste la tabla con otro nombre en 'through'
            if (!pivote) pivote = c.dataValues.menu_componentes;

            // Debug para que veas en consola dónde está el dato
            // console.log(`Comp ${c.nombre}:`, pivote);

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
// ...


// --- FUNCIÓN CORREGIDA PARA GUARDAR "POR DEFECTO" SIN ARCHIVOS EXTRA ---
exports.saveConfigurarMenu = async (req, res) => {
    try {
        const menuId = parseInt(req.params.id);
        const data = req.body.comps || {};
        
        // Usamos el modelo de la tabla intermedia que Sequelize crea automáticamente
        const MenuComponentes = sequelize.model('MenuComponente');

        if (!MenuComponente) throw new Error("Modelo 'menu_componentes' no encontrado");

        // 1. Borrar todo lo anterior
        await MenuComponente.destroy({ where: { menu_id: menuId } });

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

        // 3. Insertar masivamente (Bulk Insert es más seguro y rápido)
        if (nuevasRelaciones.length > 0) {
            await MenuComponente.bulkCreate(nuevasRelaciones);
        }

        req.flash('success_msg', 'Configuración guardada.');
        res.redirect('/admin/gestion-menu');
    } catch (e) { 
        console.error("ERROR GUARDAR CONFIG:", e);
        req.flash('error_msg', 'Error al guardar.');
        res.redirect('/admin/gestion-menu'); 
    }
};

// 3. GESTIÓN COMPONENTES
exports.getGestionComponentes = async (req, res) => { try { const g=await Grupo.findAll({include:{model:Componente,as:'componentes'}, order:[['nombre','ASC']]}); res.render('admin/gestion-componentes',{grupos:g}); } catch(e){ res.redirect('/admin'); } };
exports.createComponente = async (req, res) => { try { const {nombre, grupo_id, precio_adicional} = req.body; await Componente.create({nombre, grupo_id, precio_adicional: parseFloat(precio_adicional)||0}); res.redirect('/admin/gestion-componentes'); } catch (e) { res.redirect('/admin/gestion-componentes'); } };
exports.createGrupo = async (req, res) => { try { await Grupo.create(req.body); res.redirect('/admin/gestion-componentes'); } catch (e) { res.redirect('/admin/gestion-componentes'); } };
exports.showEditComponenteForm = async (req, res) => { try { const c=await Componente.findByPk(req.params.id); const g=await Grupo.findAll(); res.render('admin/componente-form-edit',{componente:c, grupos:g}); } catch(e){ res.redirect('/admin'); } };
exports.updateComponente = async (req, res) => { try { const {nombre, grupo_id, precio_adicional} = req.body; await Componente.update({nombre, grupo_id, precio_adicional: parseFloat(precio_adicional)||0}, {where:{id:req.params.id}}); res.redirect('/admin/gestion-componentes'); } catch(e){ res.redirect('/admin'); } };
exports.deleteComponente = async (req, res) => { try { await Componente.destroy({where:{id:req.params.id}}); res.redirect('/admin/gestion-componentes'); } catch(e){ res.redirect('/admin'); } };
exports.showEditGrupoForm = async (req, res) => { const g=await Grupo.findByPk(req.params.id); res.render('admin/grupo-form-edit',{grupo:g}); };
exports.updateGrupo = async (req, res) => { await Grupo.update(req.body, {where:{id:req.params.id}}); res.redirect('/admin/gestion-componentes'); };
exports.deleteGrupo = async (req, res) => { await Grupo.destroy({where:{id:req.params.id}}); res.redirect('/admin/gestion-componentes'); };

// 4. USUARIOS
exports.getUsuarios = async (req, res) => { const u=await Usuario.findAll({include:{model:Rol,as:'rol'}}); res.render('admin/usuarios',{usuarios:u}); };
exports.showNewUserForm = async (req, res) => { const r=await Rol.findAll(); res.render('admin/usuario-form',{usuario:{}, roles:r}); };
exports.createUser = async (req, res) => { try{ await Usuario.create(req.body); res.redirect('/admin/usuarios'); }catch(e){ const r=await Rol.findAll(); res.render('admin/usuario-form',{usuario:req.body, roles:r, error:e.message}); } };
exports.showEditUserForm = async (req, res) => { const u=await Usuario.findByPk(req.params.id); const r=await Rol.findAll(); res.render('admin/usuario-form',{usuario:u, roles:r}); };
exports.updateUser = async (req, res) => { const u=await Usuario.findByPk(req.params.id); u.nombre=req.body.nombre; u.email=req.body.email; u.RolId=req.body.RolId; if(req.body.password) u.password=req.body.password; await u.save(); res.redirect('/admin/usuarios'); };
exports.toggleUserStatus = async (req, res) => { const u=await Usuario.findByPk(req.params.id); u.activo=!u.activo; await u.save(); res.redirect('/admin/usuarios'); };

// 5. MESAS
exports.getMesas = async (req, res) => { const m=await Mesa.findAll({order:[['numero','ASC']]}); res.render('admin/mesas',{mesas:m}); };
exports.showNewMesaForm = (req, res) => res.render('admin/mesa-form',{mesa:{}});
exports.createMesa = async (req, res) => { try{await Mesa.create(req.body);res.redirect('/admin/mesas');}catch(e){res.render('admin/mesa-form',{mesa:req.body,error:e.message});} };
exports.showEditMesaForm = async (req, res) => { const m=await Mesa.findByPk(req.params.id); res.render('admin/mesa-form',{mesa:m}); };
exports.updateMesa = async (req, res) => { await Mesa.update(req.body, {where:{id:req.params.id}}); res.redirect('/admin/mesas'); };
exports.deleteMesa = async (req, res) => { await Mesa.destroy({where:{id:req.params.id}}); res.redirect('/admin/mesas'); };
exports.liberarTodasLasMesas = async (req, res) => { await Mesa.update({estado:'libre'},{where:{}}); res.redirect('/admin/mesas'); };
exports.getMapaEditor = async (req, res) => { const m=await Mesa.findAll(); res.render('admin/mapa-editor',{mesas:m}); };
exports.saveMapaLayout = async (req, res) => { try{const d=req.body; if(!Array.isArray(d)) return res.status(400).json({success:false}); for(const p of d){ await Mesa.update({pos_x:parseInt(p.x)||0, pos_y:parseInt(p.y)||0, ancho:parseInt(p.w)||120, alto:parseInt(p.h)||120},{where:{id:parseInt(p.id)}}); } res.json({success:true}); }catch(e){res.status(500).json({success:false});} };

// 6. EMPRESAS
exports.getGestionEmpresas = async (req, res) => { try{const e=await Empresa.findAll();res.render('admin/gestion-empresas',{empresas:e});}catch(e){res.redirect('/admin');} };
exports.createEmpresa = async (req, res) => { try{await Empresa.create(req.body);res.redirect('/admin/empresas');}catch(e){res.redirect('/admin/empresas');} };
exports.deleteEmpresa = async (req, res) => { try{await Empresa.destroy({where:{id:req.params.id}});res.redirect('/admin/empresas');}catch(e){res.redirect('/admin/empresas');} };

// 7. INFORMES
exports.getInformes = (req, res) => { res.render('admin/informes', { pageTitle: 'Informes' }); };
exports.generarReporteFechas = async (req, res) => { try { const {fechaInicio,fechaFin}=req.body; const s=new Date(fechaInicio); s.setHours(0,0,0,0); const e=new Date(fechaFin); e.setHours(23,59,59,999); const v=await Pedido.findAll({where:{estado:'pagado',createdAt:{[Op.between]:[s,e]}},include:[{model:PedidoItem,as:'items',include:[{model:Componente,as:'componentes'}]}]}); let ti=0; const d=v.map(p=>{let t=0;p.items.forEach(i=>{t+=parseFloat(i.precio_unitario||0);i.componentes.forEach(c=>t+=parseFloat(c.precio_adicional||0))});ti+=t;return{id:p.id,fecha:p.createdAt,mesa:p.mesa_id,total:t};}); res.render('admin/reporte-resultados',{tipo:'ventas',datos:d,resumen:{totalIngresos:ti,totalPedidos:v.length}}); } catch(e){ res.redirect('/admin/informes'); } };
exports.generarReporteTop = async (req, res) => { try { const p=await Pedido.findAll({where:{estado:'pagado'},include:[{model:PedidoItem,as:'items',include:[{model:Componente,as:'componentes'}]}]}); const r={}; p.forEach(x=>x.items.forEach(i=>{const n=`Menú ($${i.precio_unitario})`;r[n]=(r[n]||0)+1;i.componentes.forEach(c=>r[c.nombre]=(r[c.nombre]||0)+1)})); const a=Object.keys(r).map(k=>({nombre:k,cantidad:r[k],tipo:'Item'})).sort((a,b)=>b.cantidad-a.cantidad); res.render('admin/reporte-resultados',{tipo:'ranking',datos:a}); } catch(e){ res.redirect('/admin/informes'); } };
exports.getReporteCuentasCobrar = async (req, res) => { try { const {empresaId,fechaInicio,fechaFin}=req.query; let where={medio_pago:'credito_empresa',estado:'pagado'}; if(empresaId) where.empresa_id=empresaId; if(fechaInicio) where.createdAt={[Op.between]:[new Date(fechaInicio),new Date(fechaFin||fechaInicio)]}; const p=await Pedido.findAll({where, include:[{model:Empresa,as:'empresa'},{model:PedidoItem,as:'items',include:[{model:Componente,as:'componentes'}]}], order:[['createdAt','DESC']]}); let td=0; const pr=p.map(x=>{let t=0;x.items.forEach(i=>{t+=parseFloat(i.precio_unitario||0);i.componentes.forEach(c=>t+=parseFloat(c.precio_adicional||0))});td+=t;return{...x.toJSON(),totalCalculado:t};}); res.render('admin/reporte-cobranza',{empresas:await Empresa.findAll(),pedidos:pr,totalDeuda:td,filtros:req.query}); } catch(e){ res.redirect('/admin/informes'); } };
exports.saldarDeudaEmpresa = async (req, res) => { try { const {pedidosIds,accion}=req.body; const {empresaId}=req.query; let where={medio_pago:'credito_empresa',estado:'pagado'}; if(accion==='todo'){if(empresaId)where.empresa_id=empresaId;}else{if(!pedidosIds)return res.redirect('/admin/informes/cobranza'); where.id=pedidosIds;} await Pedido.update({estado:'finalizado'},{where}); res.redirect('/admin/informes/cobranza?empresaId='+(empresaId||'')); } catch(e){ res.redirect('/admin/informes/cobranza'); } };

// 8. BILLING
const billingController = require('../controllers/billingController');
if(billingController && billingController.getBillingDashboard) exports.getBillingDashboard = billingController.getBillingDashboard;
else exports.getBillingDashboard = (req,res) => res.redirect('/admin');