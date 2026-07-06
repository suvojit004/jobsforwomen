module.exports = {
  apps: [
    {
      name: "jfw-backend",
      script: "./dist/server.js",
      instances: "max", // Scale to all available CPU cores
      exec_mode: "cluster", // Cluster mode for load balancing
      watch: false, // Do not restart on directory changes in production
      max_memory_restart: "1G", // Auto-restart if RAM exceeds 1GB
      env_production: {
        NODE_ENV: "production",
        PORT: 5000,
      },
      error_file: "./logs/pm2_error.log",
      out_file: "./logs/pm2_out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      autorestart: true, // Automatically restart crashed instances
      restart_delay: 2000, // Wait 2s before restarting a failed instance
      max_restarts: 10, // Limit loop restarts
    },
  ],
}
