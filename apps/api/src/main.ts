import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { types } from 'pg';
import { AppModule } from './app.module';

// A `date` column is a calendar day, not an instant. Postgres' driver parses it
// into a JS Date at local midnight, which shifts to the previous day once
// serialised to UTC — so "this month" filters and the like silently miss rows.
// Keep dates as plain `YYYY-MM-DD` strings everywhere.
types.setTypeParser(types.builtins.DATE, (v) => v);

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
