/**
 * PM2 process for the production frontend on the VPS.
 *   pm2 start ecosystem.config.js        # first time
 *   ./deploy-frontend.sh                 # every deploy after that
 *
 * Listens on 127.0.0.1:3000 only — Caddy proxies contrastco.tech to it, so
 * the Node server isn't reachable directly from the internet.
 */
module.exports = {
  apps: [
    {
      name: "contrast-frontend",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000 -H 127.0.0.1",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
  ],
};
