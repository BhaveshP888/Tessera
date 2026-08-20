import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildServer } from '../server/src/app.js';

let appPromise: ReturnType<typeof buildServer> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // 1. CORS Preflight & Headers for browser extensions & web apps
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, *');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // 2. Initialize Fastify app
  if (!appPromise) {
    appPromise = (async () => {
      const app = await buildServer();
      await app.ready();
      return app;
    })();
  }

  const app = await appPromise;
  app.server.emit('request', req, res);
}
