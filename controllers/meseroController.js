'use strict';
const { Mesa, Categoria, Producto } = require('../models');

// Esta función se encarga de mostrar el mapa de mesas.
exports.showMesas = async (req, res) => {
    try {
        // 1. Buscamos TODAS las mesas en la base de datos, ordenadas por número.
        const mesas = await Mesa.findAll({
            order: [['numero', 'ASC']]
        });

        // 2. Renderizamos (dibujamos) una nueva página HTML que vamos a crear,
        //    y le pasamos la lista de mesas que encontramos.
        res.render('mesero/dashboard', {
            pageTitle: 'Mapa de Mesas',
            mesas: mesas
        });
    } catch (error) {
        console.error('Error al obtener las mesas:', error);
        req.flash('error_msg', 'No se pudieron cargar las mesas.');
        res.redirect('/'); // Si algo sale mal, lo redirigimos a la página de inicio.
    }
};

// --- AÑADE TODA ESTA NUEVA FUNCIÓN ---
exports.showTomarPedidoForm = async (req, res) => {
    try {
        const mesaId = req.params.id;

        // 1. Buscamos la mesa específica en la que se hizo clic
        const mesa = await Mesa.findByPk(mesaId);
        if (!mesa) {
            req.flash('error_msg', 'La mesa seleccionada no existe.');
            return res.redirect('/mesero');
        }

        // 2. Buscamos todas las categorías con sus productos asociados
        const categorias = await Categoria.findAll({
            include: [{
                model: Producto,
                as: 'Productos', // Usamos el alias que definimos en el modelo
                where: { activo: true }, // Solo mostramos productos activos
                required: false // Muestra la categoría aunque no tenga productos activos
            }],
            order: [['nombre', 'ASC']]
        });

        // 3. Renderizamos la nueva vista y le pasamos la mesa y el menú
        res.render('mesero/tomar-pedido', {
            pageTitle: `Pedido Mesa ${mesa.numero}`,
            mesa: mesa,
            categorias: categorias
        });

    } catch (error) {
        console.error('Error al cargar la página de pedido:', error);
        req.flash('error_msg', 'Error al cargar el menú.');
        res.redirect('/mesero');
    }
};