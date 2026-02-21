'use strict';
const { Mesa, Categoria, Producto, Menu, Componente, Grupo, Pedido, PedidoItem } = require('../models');


// 1. Mostrar mapa de mesas
exports.showMesas = async (req, res) => {
    try {
        const mesas = await Mesa.findAll({ order: [['numero', 'ASC']] });
        res.render('mesero/dashboard', {
            pageTitle: 'Mapa de Mesas',
            mesas: mesas
        });
    } catch (error) {
        console.error('Error al obtener mesas:', error);
        req.flash('error_msg', 'Error al cargar mesas.');
        res.redirect('/');
    }
};

// 2. Formulario para pedido "A la Carta" (Categorías y Productos)
exports.showTomarPedidoForm = async (req, res) => {
    try {
        const mesaId = req.params.id;
        const mesa = await Mesa.findByPk(mesaId);
        
        if (!mesa) {
            req.flash('error_msg', 'Mesa no encontrada.');
            return res.redirect('/mesero');
        }

        const categorias = await Categoria.findAll({
            include: [{
                model: Producto,
                as: 'Productos', // Asegúrate de que este alias coincida con tu modelo Categoria
                where: { activo: true },
                required: false
            }],
            order: [['nombre', 'ASC']]
        });

        res.render('mesero/tomar-pedido', {
            pageTitle: `Pedido Mesa ${mesa.numero}`,
            mesa: mesa,
            categorias: categorias
        });
    } catch (error) {
        console.error('Error al cargar pedido:', error);
        req.flash('error_msg', 'Error al cargar menú.');
        res.redirect('/mesero');
    }
};

// 3. NUEVO: Mostrar selección de Menús (Ejecutivo, Especial, etc.) por Cliente
exports.showSeleccionarMenus = async (req, res) => {
    try {
        const mesaId = req.params.id;
        // Obtenemos la cantidad de clientes del Query String o del Body (dependiendo de tu flujo anterior)
        const cantidadClientes = req.query.cantidad || req.body.cantidadClientes || 1;

        const mesa = await Mesa.findByPk(mesaId);

        // AQUÍ ESTÁ LA SOLUCIÓN DEL ERROR "NO CARGA EN AZUL/RESUMEN":
        // Debemos incluir la tabla intermedia 'through' para saber cuáles son por defecto.
        const menusRaw = await Menu.findAll({
            where: { activo: true },
            include: [{
                model: Componente,
                as: 'componentes',
                include: [Grupo], // Para saber si es sopa, principio, etc.
                through: {
                    attributes: ['por_defecto'] // <--- IMPORTANTE: Traer este dato
                }
            }]
        });

        // Procesamos los menús para crear el texto de "Resumen" (Hint)
        const menus = menusRaw.map(menu => {
            const menuJson = menu.toJSON();
            
            // Filtramos solo los componentes que son por defecto para el resumen text
            const componentesDefault = menuJson.componentes.filter(c => c.MenuComponente.por_defecto);
            
            // Creamos un string ej: "Sopa de Pollo, Arroz Blanco, Limonada"
            const resumen = componentesDefault.map(c => c.nombre).join(', ');
            
            menuJson.resumen = resumen || "Sin componentes predefinidos";
            return menuJson;
        });

        res.render('mesero/seleccionar-menus-clientes', {
            pageTitle: 'Configurar Menús',
            mesa: mesa,
            cantidadClientes: parseInt(cantidadClientes),
            menus: menus
        });

    } catch (error) {
        console.error('Error al cargar selección de menús:', error);
        req.flash('error_msg', 'Error al cargar las opciones de menú.');
        res.redirect('/mesero');
    }
};

// 4. NUEVO: Recibe la selección y prepara la vista de Personalizar Componentes (Siguiente paso)
exports.procesarSeleccionYMostrarComponentes = async (req, res) => {
    // Aquí iría la lógica para recibir el POST del formulario anterior
    // y mostrar la pantalla donde se eligen las sopas, principios, etc.
    // Asegúrate de usar la misma lógica de "include through attributes" aquí también.
    res.send("Aquí iría la vista de selección de componentes (sopa, principio, carne) para cada cliente.");
};