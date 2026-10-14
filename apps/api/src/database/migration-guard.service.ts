import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { checkMigrations, editedMessage } from './migration-guard';

/**
 * On boot: a migration edited after it ran stops a development server cold
 * (and is logged loudly in production, where stopping would be an outage);
 * migrations still waiting — development applies them with `npm run db:migrate`,
 * not on every hot reload — are listed so nobody works against an old schema.
 */
@Injectable()
export class MigrationGuardService implements OnApplicationBootstrap {
  private readonly log = new Logger('Migrations');

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async onApplicationBootstrap() {
    const { edited, pending } = await checkMigrations(this.db, process.env.MIGRATIONS_ACCEPT_EDITS === '1');
    if (edited.length) {
      if (process.env.NODE_ENV === 'production') this.log.error(editedMessage(edited));
      else throw new Error(editedMessage(edited));
    }
    if (pending.length) {
      this.log.warn(
        `${pending.length} migration${pending.length > 1 ? 's are' : ' is'} waiting: ${pending.join(', ')}. ` +
          'Run `npm run db:migrate` once they are finished — until then, screens that need them will fail.',
      );
    }
  }
}
