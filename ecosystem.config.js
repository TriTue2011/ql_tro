// PM2 Ecosystem Config
// Dùng: pm2 start ecosystem.config.js
// Để tự khởi động lại sau khi server reboot: pm2 startup && pm2 save

module.exports = {
  apps: [
    {
      name: 'ql-tro',
      script: 'npm',
      args: 'start',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      // Đợi app thực sự sẵn sàng trước khi coi là "online"
      wait_ready: false,
      listen_timeout: 10000,
      // Tự restart nếu crash
      restart_delay: 2000,
      max_restarts: 10,
    },
  ],
};
