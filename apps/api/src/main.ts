import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.setGlobalPrefix('api');

  const config = app.get(ConfigService);

  // CORS：默认允许本地前端 localhost:3000，线上通过 CORS_ORIGIN 传入（逗号分隔多个来源）
  const corsOrigins = (config.get<string>('CORS_ORIGIN', 'http://localhost:3000') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  // Swagger / OpenAPI 文档（全局前缀 api 不作用于 Swagger 路由，需显式写全路径）
  const swaggerConfig = new DocumentBuilder()
    .setTitle('AI SaaS API')
    .setDescription('AI SaaS 平台后端 API 文档')
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: '登录后获取的 access_token' },
      'access-token'
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true }
  });

  const port = config.get<number>('PORT', 3001);
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/api/docs`);
}

void bootstrap();
