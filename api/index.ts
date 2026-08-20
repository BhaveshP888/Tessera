import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildServer } from '../server/src/app.js';

let appPromise: ReturnType<typeof buildServer> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
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
