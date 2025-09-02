// 1. Cargar las "herramientas" que instalamos
require('dotenv').config(); // Carga las variables de entorno (nuestras contraseñas)
const express = require('express'); // Carga Express para crear el servidor
const cors = require('cors'); // Carga CORS para permitir la comunicación
const { Pool } = require('pg'); // Carga la herramienta para hablar con PostgreSQL

// --- CONFIGURACIÓN DE LA BASE DE DATOS ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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

// 2. Crear nuestra aplicación Express
const app = express();
const PORT = process.env.PORT || 3001;

// 3. Configurar "middlewares"
app.use(cors());
app.use(express.json());

// 4. Ruta de prueba
app.get('/', (req, res) => {
  res.send('¡El backend de la lista de compras está funcionando!');
});

// --- RUTAS DE LA API (CRUD con nuevas funciones) ---

// GET /api/items - Obtener todos los items
app.get('/api/items', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM items ORDER BY created_at ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error en el servidor');
  }
});

// POST /api/items - Crear un nuevo item (con validación de duplicados)
app.post('/api/items', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).send('El texto del item es requerido');
    }

    // VERIFICACIÓN DE DUPLICADOS (insensible a mayúsculas/minúsculas)
    const existingItem = await pool.query('SELECT id FROM items WHERE LOWER(text) = LOWER($1)', [text]);
    if (existingItem.rows.length > 0) {
      return res.status(409).send('El item ya existe en la lista'); // 409 Conflict
    }

    const result = await pool.query(
      'INSERT INTO items (text) VALUES ($1) RETURNING *',
      [text]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error en el servidor');
  }
});

// PUT /api/items/:id - Actualizar un item (texto o estado completado)
app.put('/api/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { text, completed } = req.body;

    // Construir la consulta dinámicamente
    const fields = [];
    const values = [];
    let queryCounter = 1;

    if (text) {
      fields.push(`text = $${queryCounter++}`);
      values.push(text);
    }
    if (completed !== undefined) {
      fields.push(`completed = $${queryCounter++}`);
      values.push(completed);
    }

    if (fields.length === 0) {
      return res.status(400).send('No se proporcionaron campos para actualizar.');
    }

    values.push(id);
    const updateQuery = `UPDATE items SET ${fields.join(', ')} WHERE id = $${queryCounter} RETURNING *`;
    
    const result = await pool.query(updateQuery, values);
    
    if (result.rows.length === 0) {
      return res.status(404).send('Item no encontrado');
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error en el servidor');
  }
});

// DELETE /api/items/:id - Borrar un item
app.delete('/api/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM items WHERE id = $1 RETURNING *', [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).send('Item no encontrado');
    }
    res.status(200).send(`Item con id ${id} eliminado`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error en el servidor');
  }
});

// 5. Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
  prepareDatabase();
});

