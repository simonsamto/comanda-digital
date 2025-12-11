// routes/authRoutes.js (VERSIÓN FINAL DE DEPURACIÓN - INSEGURA)

'use strict';
const express = require('express');
const router = express.Router(); // Asegura que esta línea exista
const { Usuario, Rol } = require('../models');

// --- Muestra el formulario de login ---
router.get('/login', (req, res) => {
    // Para asegurarnos, usamos la vista ultra-simple por ahora
    res.render('auth/login'); 
});

// --- Procesa los datos del formulario de login (CON COMPARACIÓN DE TEXTO PLANO) ---
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`\n--- [MODO INSEGURO] Intentando login con: ${email} ---`);

        const usuario = await Usuario.findOne({
            where: { email: email },
            include: { model: Rol, as: 'rol' }
        });

        if (!usuario) {
            console.log("--- [ERROR] Usuario no encontrado.");
            req.flash('error_msg', 'El correo o la contraseña son incorrectos.');
            return res.redirect('/login');
        }
        
        console.log("--- [INFO] Usuario encontrado:", usuario.nombre);
        console.log("--- [INFO] Contraseña del formulario:", password);
        console.log("--- [INFO] Contraseña de la BD (texto plano):", usuario.password);

        // =================================================================
        // === CAMBIO CRÍTICO: COMPARACIÓN INSEGURA DE TEXTO PLANO ===
        const passwordValida = (password === usuario.password);
        // =================================================================
        
        console.log(`--- [INFO] ¿La contraseña coincide? -> ${passwordValida}`);

        if (!passwordValida) {
            console.log("--- [ERROR] La contraseña NO coincide.");
            req.flash('error_msg', 'El correo o la contraseña son incorrectos.');
            return res.redirect('/login');
        }

        console.log("--- [ÉXITO] ¡Login correcto! Creando sesión...");
        req.session.usuario = {
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol.nombre
        };
        
        req.session.save(() => {
            res.redirect('/');
        });

    } catch (error) {
        console.error('--- [ERROR FATAL] Error en el login:', error);
        req.flash('error_msg', 'Ocurrió un error inesperado.');
        res.redirect('/login');
    }
});

// --- Ruta para cerrar sesión ---
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

module.exports = router;