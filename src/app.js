import express from 'express';
import swaggerUi from 'swagger-ui-dist';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { routes } from './routes.js';
import { openapi } from './openapi.js';
import { staleAfterSeconds } from './buses.js';

export function createApp(busStore) {
  const app = express();
  app.disable('x-powered-by');

  app.get('/openapi.json', (req, res) => res.json(openapi));
  app.get('/docs', (req, res) => {
    res.sendFile(fileURLToPath(new URL('./docs.html', import.meta.url)));
  });
  app.use('/docs', express.static(swaggerUi.absolutePath(), { index: false }));

  app.get('/routes', (req, res) => {
    res.json({
      dataMode: 'simulated',
      notice: 'Fictional demo service with approximate stop coordinates. Not live transit information.',
      routes,
    });
  });

  app.get('/routes/:id/buses', (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!routes.some((route) => route.id === req.params.id)) {
      return res.status(404).json({ error: 'Route not found' });
    }
    const now = Date.now();
    res.json({
      dataMode: 'simulated',
      notice: 'Simulated bus locations saved in SQLite. Not live bus locations.',
      routeId: req.params.id,
      checkedAt: new Date(now).toISOString(),
      staleAfterSeconds,
      buses: busStore.list(req.params.id, now),
    });
  });

  app.post('/buses/:id/location', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const bus = busStore.get(req.params.id);
    if (!bus) return res.status(404).json({ error: 'Bus not found' });
    const tokenKey = `TRACKER_TOKEN_${bus.id.replaceAll('-', '_').toUpperCase()}`;
    const token = process.env[tokenKey];
    if (!token || token.length < 32) {
      return res.status(503).json({ error: 'Tracker authentication is not configured for this bus' });
    }
    const expected = Buffer.from(`Bearer ${token}`);
    const supplied = Buffer.from(req.get('Authorization') || '');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      res.set('WWW-Authenticate', 'Bearer');
      return res.status(401).json({ error: 'Valid tracker token required for this bus' });
    }
    if (!req.is('application/json')) {
      return res.status(415).json({ error: 'Content-Type must be application/json' });
    }
    res.locals.bus = bus;
    next();
  }, express.json({ limit: '1kb' }), (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)
        || Object.keys(body).some((key) => !['latitude', 'longitude', 'recordedAt'].includes(key))
        || !Number.isFinite(body.latitude) || Math.abs(body.latitude) > 90
        || !Number.isFinite(body.longitude) || Math.abs(body.longitude) > 180) {
      return res.status(400).json({ error: 'Provide only numeric latitude (-90 to 90), longitude (-180 to 180) and recordedAt' });
    }
    const recordedAt = Date.parse(body.recordedAt);
    if (typeof body.recordedAt !== 'string' || !Number.isFinite(recordedAt)
        || new Date(recordedAt).toISOString() !== body.recordedAt || recordedAt > Date.now()) {
      return res.status(400).json({ error: 'recordedAt must be a valid UTC ISO timestamp with milliseconds, not in the future' });
    }
    const bus = res.locals.bus;
    if (!busStore.update(bus.id, body)) {
      return res.status(409).json({ error: 'Reading must be newer than the saved bus location' });
    }
    res.json({ dataMode: 'simulated', bus: busStore.list(bus.routeId).find((item) => item.id === bus.id) });
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'JSON body must not exceed 1 KB' });
    if (error.status === 400) return res.status(400).json({ error: 'Invalid request or malformed JSON' });
    if (error.status === 415) return res.status(415).json({ error: 'Unsupported request encoding' });
    if (error.code?.startsWith('ERR_SQLITE')) {
      console.error('Database request failed:', error.message);
      return res.status(503).json({ error: 'Location storage is temporarily unavailable' });
    }
    console.error('Request failed:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}
