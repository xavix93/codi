import express from "express";
import cors from "cors";
import Database from "better-sqlite3";

const app = express();
const PORT = 3000;

// Permitir peticiones desde el frontend
app.use(cors());
app.use(express.json());

// Conexión a SQLite (archivo calendario.db)
const db = new Database("calendario.db");

// Crear tablas si no existen
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    start TEXT NOT NULL,   -- ISO string
    end TEXT NOT NULL,     -- ISO string
    recurrence TEXT NOT NULL CHECK (recurrence IN ('NONE','HOURLY','DAILY')),
    owner_id INTEGER NOT NULL,
    FOREIGN KEY(owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS event_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    FOREIGN KEY(event_id) REFERENCES events(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS event_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    occurrence_date TEXT NOT NULL, -- 'YYYY-MM-DD'
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(event_id) REFERENCES events(id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    UNIQUE(event_id, user_id, occurrence_date)
  );
`);

// Helpers
const getOrCreateUserStmt = db.prepare(`
  INSERT INTO users (name) VALUES (?)
  ON CONFLICT(name) DO NOTHING
`);
const getUserByNameStmt = db.prepare(`SELECT * FROM users WHERE name = ?`);

// 1) Crear / obtener usuario por nombre
app.post("/api/users", (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name requerido" });

  getOrCreateUserStmt.run(name);
  const user = getUserByNameStmt.get(name);
  res.json(user);
});

// 2) Crear evento
app.post("/api/events", (req, res) => {
  const {
    title,
    description,
    start,
    end,
    recurrence, // 'NONE' | 'HOURLY' | 'DAILY'
    ownerId,
    sharedWithNames = []
  } = req.body;

  if (!title || !start || !end || !recurrence || !ownerId) {
    return res.status(400).json({ error: "Datos incompletos para crear evento" });
  }

  const insertEventStmt = db.prepare(`
    INSERT INTO events (title, description, start, end, recurrence, owner_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = insertEventStmt.run(
    title,
    description || "",
    start,
    end,
    recurrence,
    ownerId
  );
  const eventId = result.lastInsertRowid;

  // Asegurar que existan los usuarios compartidos y relacionarlos
  const insertShareStmt = db.prepare(`
    INSERT INTO event_shares (event_id, user_id)
    VALUES (?, ?)
  `);

  const insertUserIfNeeded = db.prepare(`
    INSERT INTO users (name) VALUES (?)
    ON CONFLICT(name) DO NOTHING
  `);

  for (const name of sharedWithNames) {
    if (!name) continue;
    insertUserIfNeeded.run(name);
    const u = getUserByNameStmt.get(name);
    if (u) insertShareStmt.run(eventId, u.id);
  }

  res.json({ message: "Evento creado", eventId });
});

// 3) Obtener eventos visibles para un usuario en una fecha
app.get("/api/events", (req, res) => {
  const { userId, date } = req.query; // date: 'YYYY-MM-DD'

  if (!userId) {
    return res.status(400).json({ error: "userId requerido" });
  }

  const dateFilter = date || new Date().toISOString().slice(0, 10); // hoy por defecto

  // Eventos donde el usuario es dueño o está compartido
  const eventsStmt = db.prepare(`
    SELECT DISTINCT e.*, u.name AS ownerName
    FROM events e
    JOIN users u ON u.id = e.owner_id
    LEFT JOIN event_shares s ON s.event_id = e.id
    WHERE e.owner_id = ? OR s.user_id = ?
    ORDER BY e.start
  `);

  const events = eventsStmt.all(userId, userId);

  const sharesStmt = db.prepare(`
    SELECT s.event_id, u.id as user_id, u.name
    FROM event_shares s
    JOIN users u ON u.id = s.user_id
    WHERE s.event_id = ?
  `);

  const completionsStmt = db.prepare(`
    SELECT c.event_id, c.user_id, u.name
    FROM event_completions c
    JOIN users u ON u.id = c.user_id
    WHERE c.event_id = ? AND c.occurrence_date = ?
  `);

  const result = events.map(ev => {
    const sharedWith = sharesStmt.all(ev.id).map(r => ({ id: r.user_id, name: r.name }));
    const completedBy = completionsStmt.all(ev.id, dateFilter).map(r => ({ id: r.user_id, name: r.name }));
    return {
      id: ev.id,
      title: ev.title,
      description: ev.description,
      start: ev.start,
      end: ev.end,
      recurrence: ev.recurrence,
      ownerId: ev.owner_id,
      ownerName: ev.ownerName,
      sharedWith,
      completedBy
    };
  });

  res.json({ date: dateFilter, events: result });
});

// 4) Marcar evento como cumplido para un usuario en una fecha
app.post("/api/events/:id/complete", (req, res) => {
  const eventId = req.params.id;
  const { userId, date } = req.body;

  if (!userId) return res.status(400).json({ error: "userId requerido" });

  const occurrenceDate = date || new Date().toISOString().slice(0, 10);

  const insertCompletionStmt = db.prepare(`
    INSERT INTO event_completions (event_id, user_id, occurrence_date)
    VALUES (?, ?, ?)
    ON CONFLICT(event_id, user_id, occurrence_date) DO NOTHING
  `);

  insertCompletionStmt.run(eventId, userId, occurrenceDate);

  res.json({ message: "Marcado como cumplido", eventId, userId, occurrenceDate });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
