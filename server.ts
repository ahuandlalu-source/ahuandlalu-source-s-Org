import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import express from 'express';
import {registerApiRoutes} from './server/routes';

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.set('trust proxy', 1);

  // Parse JSON for API requests (raw upload route handles binary streams separately)
  app.use((req, res, next) => {
    if (req.path === '/api/admin/upload') {
      next();
      return;
    }
    if (req.path === '/api/public/wishes') {
      express.json({limit: '8mb'})(req, res, next);
      return;
    }
    express.json({limit: '4mb'})(req, res, next);
  });

  registerApiRoutes(app);

  if (!isProduction) {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Wedding invitation server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
