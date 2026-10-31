import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';

function readJsonBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function onlineDataAndDeployPlugin(): Plugin {
  const onlineDbPath = path.resolve(process.cwd(), 'public', 'online-db.json');

  return {
    name: 'task-vaani-online-data-and-deploy',
    configureServer(server) {
      // 1. Real-Time Online DB Sync Endpoint (/api/online-db)
      server.middlewares.use('/api/online-db', async (req, res, next) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

        if (req.method === 'GET') {
          try {
            if (fs.existsSync(onlineDbPath)) {
              const raw = fs.readFileSync(onlineDbPath, 'utf-8');
              res.statusCode = 200;
              res.end(raw);
              return;
            }
          } catch (e) {
            console.warn('Read online-db warning:', e);
          }
          res.statusCode = 200;
          res.end(JSON.stringify({ empty: true }));
          return;
        }

        if (req.method === 'POST') {
          try {
            const payload = await readJsonBody(req);
            if (payload && typeof payload === 'object' && Object.keys(payload).length > 0) {
              const snapshot = {
                ...payload,
                updatedAt: new Date().toISOString(),
                updatedAtIST: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
              };
              fs.mkdirSync(path.dirname(onlineDbPath), { recursive: true });
              fs.writeFileSync(onlineDbPath, JSON.stringify(snapshot, null, 2), 'utf-8');
            }
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true }));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err?.message }));
            return;
          }
        }

        next();
      });

      // 2. 1-Click Online App & Database Publisher (/api/deploy-online)
      server.middlewares.use('/api/deploy-online', async (req, res, next) => {
        if (req.method !== 'POST') {
          return next();
        }
        res.setHeader('Content-Type', 'application/json');

        // Save latest database snapshot sent from the browser into public/online-db.json before building
        try {
          const body = await readJsonBody(req);
          if (body && body.databaseSnapshot) {
            const snapshot = {
              ...body.databaseSnapshot,
              updatedAt: new Date().toISOString(),
              updatedAtIST: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
            };
            fs.mkdirSync(path.dirname(onlineDbPath), { recursive: true });
            fs.writeFileSync(onlineDbPath, JSON.stringify(snapshot, null, 2), 'utf-8');

            const distDbPath = path.resolve(process.cwd(), 'dist', 'online-db.json');
            if (fs.existsSync(path.dirname(distDbPath))) {
              fs.writeFileSync(distDbPath, JSON.stringify(snapshot, null, 2), 'utf-8');
            }
          }
        } catch (snapErr) {
          console.warn('Snapshot save warning before deploy:', snapErr);
        }

        const isWin = process.platform === 'win32';
        const buildAndDeployCmd = isWin
          ? `npm run build && npx gh-pages -d dist`
          : `npm run build && npx gh-pages -d dist`;

        exec(buildAndDeployCmd, { cwd: process.cwd() }, (deployErr, deployOut, deployStderr) => {
          if (deployErr) {
            res.statusCode = 500;
            res.end(JSON.stringify({
              success: false,
              message: deployErr.message || 'Deployment failed',
              details: deployStderr
            }));
          } else {
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              mode: 'LIVE_GITHUB_DEPLOY',
              message: 'App & Online Database built and published live to GitHub Pages!',
              output: deployOut,
              timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
            }));
          }
        });
      });
    }
  };
}

export default defineConfig({
  base: './', // Ensures assets load correctly on GitHub Pages subpaths
  plugins: [react(), onlineDataAndDeployPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true, // Listens on 0.0.0.0 so phone can access via local Wi-Fi IP
    port: 5173,
  },
});
