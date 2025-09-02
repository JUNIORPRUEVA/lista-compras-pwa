// 1. Cargar las "herramientas" que instalamos
require('dotenv').config(); // Carga las variables de entorno para desarrollo local
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

// --- VERIFICACIÓN CRUCIAL DE LA VARIABLE DE ENTORNO ---
// Leemos la variable de conexión
const DATABASE_URL = process.env.DATABASE_URL;

// Si la variable no existe, la aplicación se detendrá y mostrará un error claro.
if (!DATABASE_URL) {
  console.error("### FATAL ERROR: La variable de entorno DATABASE_URL no está definida. ###");
  console.error("Por favor, verifica la configuración del entorno en tu plataforma de despliegue (EasyPanel).");
  process.exit(1); // Detiene la aplicación con un código de error.
}

// --- CONFIGURACIÓN DE LA BASE DE DATOS ---
const pool = new Pool({
  connectionString: DATABASE_URL, // Usamos la variable que ya verificamos
});

// --- FUNCIÓN PARA PREPARAR LA BASE DE DATOS ---
const prepareDatabase = async () => {
  try {
    const client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        text VARCHAR(255) NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    client.release();
    console.log('¡Base de datos lista y tabla "items" asegurada!');
  } catch (err) {
    console.error('Error al preparar la base de datos:', err);
  }
};

// --- INICIO DE LA APLICACIÓN EXPRESS ---
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- RUTAS DE LA API ---
const apiRouter = express.Router();

// GET /api/items
apiRouter.get('/items', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM items ORDER BY created_at ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error en el servidor');
  }
});

// POST /api/items
apiRouter.post('/items', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).send('El texto del item es requerido');
    }
    const existingItem = await pool.query('SELECT id FROM items WHERE LOWER(text) = LOWER($1)', [text]);
    if (existingItem.rows.length > 0) {
      return res.status(409).send('El item ya existe en la lista');
    }
    const result = await pool.query('INSERT INTO items (text) VALUES ($1) RETURNING *', [text]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error en el servidor');
  }
});

// PUT /api/items/:id
apiRouter.put('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { text, completed } = req.body;
    const fields = [], values = [];
    let queryCounter = 1;
    if (text) { fields.push(`text = $${queryCounter++}`); values.push(text); }
    if (completed !== undefined) { fields.push(`completed = $${queryCounter++}`); values.push(completed); }
    if (fields.length === 0) return res.status(400).send('No se proporcionaron campos para actualizar.');
    values.push(id);
    const updateQuery = `UPDATE items SET ${fields.join(', ')} WHERE id = $${queryCounter} RETURNING *`;
    const result = await pool.query(updateQuery, values);
    if (result.rows.length === 0) return res.status(404).send('Item no encontrado');
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error en el servidor');
  }
});

// DELETE /api/items/:id
apiRouter.delete('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM items WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) return res.status(404).send('Item no encontrado');
    res.status(200).send(`Item con id ${id} eliminado`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error en el servidor');
  }
});

// Usamos el router para todas las rutas que empiecen con /api
app.use('/api', apiRouter);

// --- SERVIR ARCHIVOS DEL FRONTEND ---
// Esta sección sirve el index.html y otros archivos de la carpeta 'public'.
app.use(express.static('public'));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- INICIAR EL SERVIDOR ---
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
  prepareDatabase();
});

