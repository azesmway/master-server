import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import * as compression from 'compression';
import * as fs from 'fs';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // ── Security ─────────────────────────────────────────────
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());

  // ── CORS ─────────────────────────────────────────────────
  const origins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(',').map(s => s.trim())
  app.enableCors({
    origin: (origin, callback) => {
      // Разрешаем без origin (мобильные приложения, curl)
      if (!origin) return callback(null, true)
      // Проверяем список и поддомены it-trend.dev
      if (origins.includes(origin) || /https?:\/\/.*\.it-trend\.dev$/.test(origin)) {
        return callback(null, true)
      }
      return callback(new Error(`CORS blocked: ${origin}`))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
  })

  // ── Global prefix ─────────────────────────────────────────
  const version = process.env.API_VERSION ?? 'v1';
  app.setGlobalPrefix(version);

  // ── Validation ────────────────────────────────────────────
  app.useGlobalPipes(new ValidationPipe({
    whitelist:        true,
    forbidNonWhitelisted: false,
    transform:        true,
    transformOptions: { enableImplicitConversion: true },
  }));

  // ── Serialization (exclude @Exclude fields) ───────────────
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  // ── Exception filter ──────────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ── Static files (uploads) ────────────────────────────────
  const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  app.useStaticAssets(uploadDir, { prefix: '/uploads' });

  // ── Swagger (только в dev) ────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Master API')
      .setDescription('Маркетплейс услуг — API документация')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    console.log(`📖 Swagger: http://localhost:${process.env.PORT ?? 3000}/docs`);
  }

  // ── Start ─────────────────────────────────────────────────
  const port = parseInt(process.env.PORT ?? '3000', 10);
  // Увеличиваем таймаут для AI запросов (Ollama на CPU медленный)
  const server = app.getHttpServer();
  server.setTimeout(200000); // 200 секунд

  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Master API запущен: http://localhost:${port}/${version}`);
  console.log(`❤️  Health: http://localhost:${port}/${version}/health`);
}

bootstrap();
