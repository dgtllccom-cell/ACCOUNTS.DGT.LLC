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
      max_restarts: 100,
      max_memory_restart: '1800M',
      restart_delay: 1000,
      exp_backoff_restart_delay: 200,
      listen_timeout: 15000,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        NODE_OPTIONS: '--max-old-space-size=2048',
        NEXT_PUBLIC_SUPABASE_URL: 'https://csesvyxxjivnkkozgopt.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_22nhsWCggOvyEf-hYmAcfA_vFo7zk4w',
        SUPABASE_SERVICE_ROLE_KEY: 'sb_publishable_22nhsWCggOvyEf-hYmAcfA_vFo7zk4w',
        DATABASE_URL: 'postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require'
      }
    }
  ]
};
