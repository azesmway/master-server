export default () => ({
  app: {
    env:     process.env.NODE_ENV ?? 'development',
    port:    parseInt(process.env.PORT ?? '3000', 10),
    version: process.env.API_VERSION ?? 'v1',
    isDev:   process.env.NODE_ENV !== 'production',
  },
  database: {
    host:     process.env.DB_HOST ?? 'localhost',
    port:     parseInt(process.env.DB_PORT ?? '5432', 10),
    name:     process.env.DB_NAME ?? 'master_db',
    user:     process.env.DB_USER ?? 'master_user',
    password: process.env.DB_PASSWORD ?? '',
    url:      process.env.DATABASE_URL,
  },
  redis: {
    host:     process.env.REDIS_HOST ?? 'localhost',
    port:     parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  jwt: {
    secret:        process.env.JWT_SECRET ?? 'dev-secret-change-in-prod',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
    expiresIn:     process.env.JWT_EXPIRES_IN ?? '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  otp: {
    expiresIn: parseInt(process.env.OTP_EXPIRES_IN ?? '300', 10),
    provider:  process.env.SMS_PROVIDER ?? 'mock',
    apiKey:    process.env.SMS_API_KEY,
    sender:    process.env.SMS_SENDER ?? 'MASTER',
  },
  media: {
    uploadDir: process.env.UPLOAD_DIR ?? './uploads',
    maxSize:   parseInt(process.env.MAX_FILE_SIZE ?? '10485760', 10),
    cdnUrl:    process.env.CDN_URL ?? 'http://localhost:3000/uploads',
  },
  cors: {
    origins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(','),
  },
  whisper: {
    url: process.env.WHISPER_URL ?? 'http://localhost:8000',
  },
});
