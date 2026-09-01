/**
 * `pg` ships no type declarations and `@types/pg` isn't a dependency (it comes
 * in transitively through TypeORM). We only touch one corner of it — the
 * built-in type parsers — so this declares just that.
 */
declare module 'pg' {
  export const types: {
    builtins: { DATE: number } & Record<string, number>;
    setTypeParser(oid: number, parser: (value: string) => unknown): void;
  };
}
