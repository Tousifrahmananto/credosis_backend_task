import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createApp } from './app.js';
import { createBusStore } from './buses.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST || '127.0.0.1';
if (!Number.isInteger(port) || port < 0 || port > 65535 || process.env.PORT === '') {
  throw new Error('PORT must be an integer between 0 and 65535');
}
const databasePath = resolve(process.env.DATABASE_PATH || 'data/bus-tracker.sqlite');
mkdirSync(dirname(databasePath), { recursive: true });
const busStore = createBusStore(databasePath);
const app = createApp(busStore);

const server = app.listen(port, host, () => {
  console.log(`Bus tracker listening on ${host}:${server.address().port}; API docs at /docs`);
});

server.on('error', (error) => {
  busStore.close();
  console.error('Could not start bus tracker:', error.message);
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => busStore.close()));
}
