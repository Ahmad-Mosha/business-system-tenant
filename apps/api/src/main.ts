import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // The browser never calls the API directly — the web app proxies through
  // server actions — so credentials are only needed for local tooling.
  app.enableCors({ origin: true, credentials: true });
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  new Logger('bootstrap').log(`Prime Market API on http://localhost:${port}`);
}
void bootstrap();
