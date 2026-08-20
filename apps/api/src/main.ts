import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: true });
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  new Logger('bootstrap').log(`Prime Market API on http://localhost:${port}`);
}
void bootstrap();
