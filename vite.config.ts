import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { exec } from 'child_process';

function onlineDeployPlugin(): Plugin {
  return {
    name: 'task-vaani-online-deploy',
    configureServer(server) {
      server.middlewares.use('/api/deploy-online', (req, res, next) => {
        if (req.method !== 'POST') {
          return next();
        }
        res.setHeader('Content-Type', 'application/json');

        const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        // Run git commit/push (if changes exist, excluding .github) + npm run deploy
        const cmd = `git add src public index.html package.json vite.config.ts && (git diff --cached --quiet || git commit -m "One-click online update from TASK-VAANI App") && git push origin main && ${npmCmd} run deploy`;

        exec(cmd, { cwd: process.cwd() }, (error, stdout, stderr) => {
          if (error) {
            // Fallback to direct npm run deploy if git push had nothing or minor warning
            exec(`${npmCmd} run deploy`, { cwd: process.cwd() }, (deployErr, deployOut, deployStderr) => {
              if (deployErr) {
                res.statusCode = 500;
                res.end(JSON.stringify({
                  success: false,
                  message: deployErr.message || 'Deployment failed',
                  details: deployStderr || stderr
                }));
              } else {
                res.statusCode = 200;
                res.end(JSON.stringify({
                  success: true,
                  mode: 'LIVE_GITHUB_DEPLOY',
                  message: 'App built & published live to GitHub Pages!',
                  output: deployOut || stdout,
                  timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                }));
              }
            });
            return;
          }

          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            mode: 'LIVE_GITHUB_DEPLOY',
            message: 'All code & app changes committed and deployed live to GitHub Pages!',
            output: stdout,
            timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
          }));
        });
      });
    }
  };
}

export default defineConfig({
  base: './', // Ensures assets load correctly on GitHub Pages subpaths
  plugins: [react(), onlineDeployPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true, // Listens on 0.0.0.0 so phone can access via local Wi-Fi IP
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
