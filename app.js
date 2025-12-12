'use strict';
require('dotenv').config();
const express = require('express');
const http = require('http'); // 1. IMPORTANTE: Necesitamos el módulo HTTP nativo
const { Server } = require("socket.io"); // 2. Importamos la clase Server
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const db = require('./models');

const app = express();
const server = http.createServer(app); // 3. Creamos el servidor HTTP envolviendo a Express
const io = new Server(server); // 4. Inicializamos Socket.IO sobre ese servidor HTTP

app.set('socketio', io); // Guardamos io para usarlo en las rutas

// --- CONFIGURACIÓN ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'secreto_super_seguro',
    resave: false,
    saveUninitialized: false
}));
app.use(flash());

app.use((req, res, next) => {
    res.locals.usuario = req.session.usuario;
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    next();
});

// --- RUTAS ---
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const meseroRoutes = require('./routes/meseroRoutes');
const cocinaRoutes = require('./routes/cocinaRoutes');
const cajeroRoutes = require('./routes/cajeroRoutes'); // Asumiendo que ya tienes cajero
const { isAuthenticated, hasRole } = require('./middlewares/authMiddleware');

app.use(authRoutes);

app.get('/', isAuthenticated, (req, res) => {
    const rol = req.session.usuario.rol;
    if (rol === 'Administrador') return res.redirect('/admin');
    if (rol === 'Mesero') return res.redirect('/mesero');
    if (rol === 'Cocina') return res.redirect('/cocina');
    if (rol === 'Cajero') return res.redirect('/cajero');
    res.redirect('/login');
});

// Registro de Rutas
app.use('/admin', isAuthenticated, hasRole(['Administrador']), adminRoutes);
app.use('/mesero', isAuthenticated, hasRole(['Mesero', 'Administrador']), meseroRoutes);
app.use('/cocina', isAuthenticated, hasRole(['Cocina', 'Administrador', 'Mesero']), cocinaRoutes);
app.use('/cajero', isAuthenticated, hasRole(['Cajero', 'Administrador']), cajeroRoutes);

// --- SOCKET.IO EVENTOS ---
io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado a Socket.IO');
});

// --- ARRANQUE (¡ESTA ES LA PARTE CRÍTICA!) ---
const PORT = process.env.PORT || 3000;

// Si estamos en producción (Render), no usamos alter: true para evitar errores con TiDB
const syncOptions = process.env.NODE_ENV === 'production' ? {} : { alter: true };

db.sequelize.sync(syncOptions).then(() => {
    console.log('✅ Base de datos sincronizada.');
    server.listen(PORT, () => {
        console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('❌ Error de base de datos:', err);
});