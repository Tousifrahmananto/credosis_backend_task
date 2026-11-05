import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createApp } from './app.js';
import { createBusStore } from './buses.js';

const databasePath = resolve(process.env.DATABASE_PATH || 'data/bus-tracker.sqlite');
mkdirSync(dirname(databasePath), { recursive: true });
const busStore = createBusStore(databasePath);
const app = createApp(busStore);

const server = app.listen(3000, '127.0.0.1', () => {
  console.log('Bus tracker: http://127.0.0.1:3000/routes');
});

server.on('error', (error) => {
  busStore.close();
  console.error('Could not start bus tracker:', error.message);
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => busStore.close()));
}
