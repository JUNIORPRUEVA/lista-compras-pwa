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


// --- RUTAS DE LA API ---
// Primero definimos todas nuestras rutas de la API para que tengan prioridad.
const apiRouter = express.Router();

// GET /items - Obtener todos los items
apiRouter.get('/items', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM items ORDER BY created_at ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error en el servidor');
  }
});

// POST /items - Crear un nuevo item
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

// PUT /items/:id - Actualizar un item
apiRouter.put('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { text, completed } = req.body;
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

// DELETE /items/:id - Borrar un item
apiRouter.delete('/items/:id', async (req, res) => {
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

// Le decimos a nuestra app que use este router para todas las rutas que empiecen con /api
app.use('/api', apiRouter);


// --- SERVIR ARCHIVOS DEL FRONTEND ---
// Esto va al final. Si la petición no es para la API, entonces busca en la carpeta 'public'.
app.use(express.static('public'));


// 5. Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
  prepareDatabase();
});

