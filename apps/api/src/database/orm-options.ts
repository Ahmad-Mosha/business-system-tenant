import { SnakeNamingStrategy } from './snake-naming.strategy';
import { ENTITIES } from './entities';

/**
 * Everything about the TypeORM connection except `url` — shared between the
 * app's runtime config (app.module.ts) and the CLI datasource (data-source.ts)
 * so migrations always see the same entities and naming as the running app.
 * `url` stays out of this: it's read from `process.env.DATABASE_URL` at the
 * point each caller needs it, because app.module.ts depends on ConfigModule
 * having loaded `.env` first (see the import order there) — hoisting a static
 * import of an eagerly-read `process.env.DATABASE_URL` would run before that.
 */
export const ormOptions = {
  entities: ENTITIES,
  namingStrategy: new SnakeNamingStrategy(),
  // Matches both the .ts source (CLI, via ts-node) and the compiled .js (runtime dist/).
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
};
