/**
 * Types for the part of Node's built-in `node:sqlite` we use (Electron 45 ships Node 24, and Bun
 * implements it too). The repo's @types/node (20.x) predates the module; remove this file once it
 * moves to a version that declares it.
 */
declare module "node:sqlite" {
  type SqlValue = null | number | bigint | string | Uint8Array;

  export class StatementSync {
    run(...params: SqlValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    all(...params: SqlValue[]): Record<string, SqlValue>[];
    get(...params: SqlValue[]): Record<string, SqlValue> | undefined;
  }

  export class DatabaseSync {
    constructor(path: string, options?: { open?: boolean; readOnly?: boolean; timeout?: number });
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
