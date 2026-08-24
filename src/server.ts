import { buildApp } from './app.js';
import { config } from './config.js';

const app = buildApp();

app
  .listen({ host: config.host, port: config.port })
  .then(() => {
    console.log(`open-rm listening on http://${config.host}:${config.port}`);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
