'use strict';
const { Usuario, Rol } = require('../models');

exports.showLoginForm = (req, res) => {
    res.render('login', { 
        pageTitle: 'Iniciar Sesión',
        error: req.flash('error'), 
        success_msg: req.flash('success_msg') 
    });
};

exports.login = async (req, res) => {
    console.log('--- INICIO DEL PROCESO DE LOGIN ---');
    const { email, password } = req.body;
    console.log(`[1] Intentando iniciar sesión para: ${email}`);

    try {
        const usuario = await Usuario.findOne({ 
            where: { email: email, activo: true },
            include: { model: Rol }
        });

        if (!usuario) {
            console.log('[2-A] Usuario no encontrado o inactivo.');
            req.flash('error', 'Correo electrónico o contraseña incorrectos.');
            return res.redirect('/login');
        }
        
        console.log('[2-B] Usuario encontrado:', usuario.nombre);
        console.log(`[3] Hash guardado en la DB: ${usuario.password}`);
        console.log('[4] Procediendo a validar la contraseña...');
        
        const isMatch = await usuario.validarPassword(password);
        console.log(`[5] ¿La contraseña coincide? -> ${isMatch}`);

        if (!isMatch) {
            console.log('[6-A] La contraseña no coincide.');
            req.flash('error', 'Correo electrónico o contraseña incorrectos.');
            return res.redirect('/login');
        }
        
        console.log('[6-B] La contraseña es correcta.');

        if (!usuario.Rol) {
            console.error(`[ERROR FATAL] El usuario '${email}' no tiene un rol asignado.`);
            req.flash('error', 'Error de configuración: El usuario no tiene un rol asignado.');
            return res.redirect('/login');
        }

        console.log(`[7] Rol del usuario: ${usuario.Rol.nombre}`);
        
        req.session.usuario = {
            id: usuario.id,
            nombre: usuario.nombre,
            rol: usuario.Rol.nombre
        };
        console.log('[8] Sesión creada.');

        req.session.save((err) => {
            if (err) {
                console.error('[ERROR] Error al guardar la sesión:', err);
                req.flash('error', 'Ocurrió un problema al iniciar sesión.');
                return res.redirect('/login');
            }
            console.log('[9] Sesión guardada, redirigiendo a /');
            console.log('--- FIN DEL PROCESO DE LOGIN ---');
            return res.redirect('/');
        });

    } catch (error) {
        console.error("--- ERROR CATASTRÓFICO EN LOGIN ---", error);
        req.flash('error', 'Ocurrió un error inesperado en el servidor.');
        return res.redirect('/login');
    }
};

exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error al destruir la sesión:", err);
            return res.redirect('/');
        }
        res.clearCookie('connect.sid'); // Limpia la cookie de sesión
        res.redirect('/login');
    });
};