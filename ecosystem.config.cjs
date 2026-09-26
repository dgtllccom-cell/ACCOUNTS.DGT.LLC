module.exports = {
  apps: [
    {
      name: 'dgt-nextjs',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000 -H 127.0.0.1',
      cwd: '/var/www/dgt-nextjs',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 100,
      max_memory_restart: '2048M',
      restart_delay: 1000,
      listen_timeout: 15000,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        HOSTNAME: '127.0.0.1',
        NODE_OPTIONS: '--max-old-space-size=4096'
      }
    }
  ]
};
