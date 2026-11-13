/**
 * The main process's side of the scan database process (db-process.ts): started on first use,
 * restarted if it dies, one promise per request.
 */
import { utilityProcess, type UtilityProcess } from "electron";
import type { DbRequest } from "./db-ops";

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  onProgress?: (share: number) => void;
}

export class DbClient {
  private child: UtilityProcess | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();

  constructor(private readonly script: string) {}

  private start(): UtilityProcess {
    if (this.child) return this.child;
    const child = utilityProcess.fork(this.script, [], { serviceName: "Scout Reporter scans", stdio: "inherit" });
    child.on("message", (msg: { id: number; progress?: number; ok?: boolean; result?: unknown; error?: string }) => {
      const p = this.pending.get(msg.id);
      if (!p) return;
      if (msg.progress !== undefined) {
        p.onProgress?.(msg.progress);
        return;
      }
      this.pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.result);
      else p.reject(new Error(msg.error ?? "The scan database failed."));
    });
    child.once("exit", (code) => {
      this.child = null;
      for (const p of this.pending.values()) p.reject(new Error(`The scan database process stopped (exit code ${code}).`));
      this.pending.clear();
    });
    this.child = child;
    return child;
  }

  request<T>(request: DbRequest, onProgress?: (share: number) => void): Promise<T> {
    const child = this.start();
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, onProgress });
      child.postMessage({ id, request });
    });
  }

  stop() {
    this.child?.kill();
    this.child = null;
  }
}
