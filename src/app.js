import express from 'express';
import swaggerUi from 'swagger-ui-dist';
import { fileURLToPath } from 'node:url';
import { routes } from './routes.js';
import { openapi } from './openapi.js';

export const app = express();
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

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});
