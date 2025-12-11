// routes/authRoutes.js

'use strict';
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); // Asegúrate de que bcryptjs esté importado
const { Usuario, Rol } = require('../models'); // Importamos los modelos necesarios

// --- Muestra el formulario de login ---
router.get('/login', (req, res) => {
    res.render('auth/login', { pageTitle: 'Iniciar Sesión' });
});

// --- Procesa los datos del formulario de login ---
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Buscar al usuario por su email, incluyendo su Rol asociado
        const usuario = await Usuario.findOne({
            where: { email: email },
            include: { model: Rol, as: 'rol' }
        });

        // 2. Verificar si el usuario existe
        if (!usuario) {
            req.flash('error_msg', 'El correo electrónico o la contraseña son incorrectos.');
            return res.redirect('/login');
        }

        // 3. Verificar si el usuario está activo
        if (!usuario.activo) {
            req.flash('error_msg', 'Este usuario ha sido desactivado. Contacte al administrador.');
            return res.redirect('/login');
        }

        // 4. *** ¡LA PARTE MÁS IMPORTANTE! ***
        // Comparar la contraseña ingresada (password) con la encriptada en la BD (usuario.password)
        const passwordValida = await bcrypt.compare(password, usuario.password);

        // 5. Verificar si la contraseña es correcta
        if (!passwordValida) {
            req.flash('error_msg', 'El correo electrónico o la contraseña son incorrectos.');
            return res.redirect('/login');
        }

        // 6. Si todo está bien, crear la sesión
        req.session.usuario = {
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol.nombre // Usamos el nombre del rol que incluimos
        };
        
        // 7. Guardar la sesión y redirigir a la página principal
        req.session.save(err => {
            if (err) {
                console.error('Error al guardar la sesión:', err);
                req.flash('error_msg', 'Hubo un problema al iniciar sesión.');
                return res.redirect('/login');
            }
            // La ruta raíz '/' se encargará de redirigir al panel correcto según el rol
            res.redirect('/');
        });

    } catch (error) {
        console.error('Error en el proceso de login:', error);
        req.flash('error_msg', 'Ocurrió un error inesperado. Inténtelo de nuevo.');
        res.redirect('/login');
    }
});

// --- Ruta para cerrar sesión ---
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/'); // Si hay error, al menos que lo saque
        }
        res.clearCookie('connect.sid'); // Limpia la cookie de sesión
        res.redirect('/login');
    });
});


module.exports = router;