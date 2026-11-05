import { DatabaseSync } from 'node:sqlite';

export const staleAfterSeconds = 120;

// shortcut: a local SQLite file suits one demo instance, use a shared database before horizontal scaling.
export function createBusStore(filename = ':memory:') {
  const db = new DatabaseSync(filename);
  try {
    db.exec(`
      PRAGMA busy_timeout = 3000;
      CREATE TABLE IF NOT EXISTS buses (
        id TEXT PRIMARY KEY,
        route_id TEXT NOT NULL,
        latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
        longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
        recorded_at INTEGER NOT NULL
      );
    `);
    const seed = db.prepare('INSERT OR IGNORE INTO buses VALUES (?, ?, ?, ?, ?)');
    const now = Date.now();
    seed.run('demo-bus-01', 'demo-mirpur-farmgate', 23.8021, 90.3705, now - 30_000);
    seed.run('demo-bus-02', 'demo-mirpur-farmgate', 23.7801, 90.3791, now - 300_000);
    const get = db.prepare('SELECT * FROM buses WHERE id = ?');
    const list = db.prepare('SELECT * FROM buses WHERE route_id = ? ORDER BY id');
    const update = db.prepare(`UPDATE buses SET latitude = ?, longitude = ?, recorded_at = ?
      WHERE id = ? AND recorded_at < ?`);
    function toBus(row) {
      return row && {
        id: row.id, routeId: row.route_id, latitude: row.latitude,
        longitude: row.longitude, lastUpdated: new Date(row.recorded_at).toISOString(),
      };
    }
    return {
      get: (id) => toBus(get.get(id)),
      list: (routeId, now = Date.now()) => list.all(routeId).map((row) => ({
        ...toBus(row), isStale: now - row.recorded_at >= staleAfterSeconds * 1000,
      })),
      update: (id, body) => {
        const recordedAt = Date.parse(body.recordedAt);
        return update.run(body.latitude, body.longitude, recordedAt, id, recordedAt).changes > 0;
      },
      close: () => db.close(),
    };
  } catch (error) {
    db.close();
    throw error;
  }
}
