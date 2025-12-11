const mysql = require('mysql2/promise'); // Importa la versión con promesas de mysql2
require('dotenv').config(); // Carga las variables de entorno desde el archivo .env

// Configuración del pool de conexiones
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'comanda_digital_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Función simple para probar la conexión al iniciar
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Conexión exitosa a la base de datos MySQL.');
        connection.release(); // Libera la conexión de vuelta al pool
    } catch (error) {
        console.error('❌ Error al conectar con la base de datos:', error.message);
    }
}

testConnection();

// Exportamos el pool para poder usarlo en otros archivos (como en meseroRoutes.js)
module.exports = pool;