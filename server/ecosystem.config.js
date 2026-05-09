module.exports = {
  apps: [
    {
      name: 'anydrop-server',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT ?? 3001,
        ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN ?? 'https://anydrop.jp',
      },
    },
  ],
};
