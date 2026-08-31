import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      // Anything not on the DTO is rejected rather than quietly ignored, so a
      // misspelled field fails loudly instead of being silently dropped.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const docs = new DocumentBuilder()
    .setTitle('Prime Market API')
    .setDescription(
      [
        'Internal operations API for Prime Market — inventory, orders, money and channel imports.',
        '',
        '### How to use this page',
        '1. Open **Auth → POST /api/auth/login** and press **Try it out**.',
        '2. Send the seeded credentials. Copy `accessToken` from the response.',
        '3. Press **Authorize** at the top right and paste the token.',
        '4. Every other endpoint on this page now works from here — no client needed.',
        '',
        'Amounts are EGP and are returned as strings, so no value is ever damaged by',
        'floating-point rounding on its way to you.',
      ].join('\n'),
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      // Named so @ApiBearerAuth() on a controller resolves to this scheme.
      'bearer',
    )
    .addTag('System', 'Health and service information')
    .addTag('Auth', 'Signing in and checking the current session')
    .build();

  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, docs), {
    customSiteTitle: 'Prime Market API',
    swaggerOptions: {
      // Keeps the token across page reloads — otherwise every refresh means
      // logging in again.
      persistAuthorization: true,
      docExpansion: 'list',
      tryItOutEnabled: true,
    },
  });

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`API on :${port} — docs at /docs`);
}

void bootstrap();
