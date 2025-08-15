module.exports = {
  apps: [
    {
      name: 'tutorAI-server',
      script: 'server/server.js',
      cwd: '/opt/tutorAI',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 4007
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4007
      },
      error_file: '/var/log/pm2/tutorAI-server-error.log',
      out_file: '/var/log/pm2/tutorAI-server-out.log',
      log_file: '/var/log/pm2/tutorAI-server.log',
      time: true
    },
    {
      name: 'tutorAI-client',
      script: 'serve',
      args: '-s client/build -l 4004',
      cwd: '/opt/tutorAI',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 4004
      },
      error_file: '/var/log/pm2/tutorAI-client-error.log',
      out_file: '/var/log/pm2/tutorAI-client-out.log',
      log_file: '/var/log/pm2/tutorAI-client.log',
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
