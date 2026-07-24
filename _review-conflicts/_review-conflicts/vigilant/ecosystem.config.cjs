module.exports = {
  apps: [
    {
      name: 'dgt-nextjs',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: '/var/www/dgt-nextjs',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1536M',
      restart_delay: 2000,
      exp_backoff_restart_delay: 200,
      listen_timeout: 10000,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        NODE_OPTIONS: '--max-old-space-size=2048'
      }
    }
  ]
};
