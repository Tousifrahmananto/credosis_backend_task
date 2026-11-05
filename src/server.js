import { app } from './app.js';

const server = app.listen(3000, '127.0.0.1', () => {
  console.log('Bus tracker: http://127.0.0.1:3000/routes');
});

server.on('error', (error) => {
  console.error('Could not start bus tracker:', error.message);
  process.exitCode = 1;
});
