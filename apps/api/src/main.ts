import 'reflect-metadata';
import { loadDotEnv } from './config/load-dotenv.js';

loadDotEnv();
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { ENV, type Env } from './config/env.js';
import { PinoLoggerService, rootLogger } from './shared/logger.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new PinoLoggerService(),
    bufferLogs: true,
  });

  const env = app.get<Env>(ENV);

  app.use(helmet());
  app.use(cookieParser());
  app.enableShutdownHooks();
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  // Trust the first proxy hop so req.ip reflects the client, not the load balancer.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  await app.listen(env.API_PORT);
  rootLogger.info({ port: env.API_PORT, env: env.NODE_ENV }, 'API listening');
}

bootstrap().catch((err) => {
  rootLogger.error({ err }, 'Failed to start API');
  process.exit(1);
});
