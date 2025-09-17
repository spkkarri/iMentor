module.exports = {
  apps: [
    {
      name: 'imentorAI-server',
      script: 'server/server.js',
      cwd: '/app',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5007
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5007
      },
      error_file: '/app/server/logs/imentorAI-server-error.log',
      out_file: '/app/server/logs/imentorAI-server-out.log',
      log_file: '/app/server/logs/imentorAI-server.log',
      time: true
    },
    {
      name: 'imentorAI-client',
      script: 'serve',
      args: '-s client/build -l 4004',
      cwd: '/app',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 4004
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4004
      },
      error_file: '/app/server/logs/imentorAI-client-error.log',
      out_file: '/app/server/logs/imentorAI-client-out.log',
      log_file: '/app/server/logs/imentorAI-client.log',
      time: true
    }
  ],

  deploy: {
    production: {
      user: 'tutorAI',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'your-git-repo-url',
      path: '/opt/tutorAI',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
