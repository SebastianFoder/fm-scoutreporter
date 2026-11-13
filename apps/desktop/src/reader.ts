/**
 * Runs the reader (ScoutReporter.Reader.exe) and follows its JSON-lines output. No Electron imports,
 * so the line handling is unit-tested.
 */
import { spawn } from "node:child_process";
import type { ScanProgress } from "@scoutreporter/core/desktop/bridge";

export interface ReaderDone {
  type: "done";
  file: string;
  players: number;
  staff: number;
  versionOk: boolean;
  game: string;
  gameVersion: string | null;
  /** Time spent scanning, in milliseconds. */
  elapsedMs?: number;
  /** Milliseconds per reader step, in order (open, version, find, merge, read people, ...). */
  timings?: Record<string, number>;
}

export interface ReaderError {
  type: "error";
  code: string;
  message: string;
}

export interface ReaderRun {
  done: ReaderDone | null;
  error: ReaderError | null;
  log: string[];
  exitCode: number | null;
}

/** Follows the reader's stdout: call `push` with each chunk, `finish` at the end. */
export class ReaderOutput {
  private buffer = "";
  readonly run: ReaderRun = { done: null, error: null, log: [], exitCode: null };

  constructor(private readonly onProgress: (p: ScanProgress) => void = () => {}) {}

  push(chunk: string) {
    this.buffer += chunk;
    let nl: number;
    while ((nl = this.buffer.indexOf("\n")) >= 0) {
      this.line(this.buffer.slice(0, nl).trim());
      this.buffer = this.buffer.slice(nl + 1);
    }
  }

  finish(exitCode: number | null): ReaderRun {
    if (this.buffer.trim()) this.line(this.buffer.trim());
    this.buffer = "";
    this.run.exitCode = exitCode;
    if (!this.run.done && !this.run.error) {
      this.run.error = { type: "error", code: "failed", message: `The reader stopped without a result (exit code ${exitCode ?? "none"}).` };
    }
    return this.run;
  }

  private line(text: string) {
    if (!text) return;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(text) as Record<string, unknown>;
    } catch {
      this.run.log.push(text);
      return;
    }
    switch (msg.type) {
      case "progress":
        this.onProgress({ phase: String(msg.phase ?? ""), progress: Number(msg.progress) || 0 });
        break;
      case "log":
        this.run.log.push(String(msg.message ?? ""));
        break;
      case "done":
        this.run.done = msg as unknown as ReaderDone;
        break;
      case "error":
        this.run.error = { type: "error", code: String(msg.code ?? "failed"), message: String(msg.message ?? "The scan failed.") };
        break;
    }
  }
}

/** Run `<exe> scan --out <outDir> --db <db> [extraArgs]`. Kills it after `timeoutMs`. */
export function runReader(
  exe: string,
  outDir: string,
  db: string,
  onProgress: (p: ScanProgress) => void,
  extraArgs: string[] = [],
  timeoutMs = 5 * 60_000,
): Promise<ReaderRun> {
  return new Promise((resolve) => {
    const output = new ReaderOutput(onProgress);
    let child;
    try {
      child = spawn(exe, ["scan", "--out", outDir, "--db", db, ...extraArgs], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      output.run.error = { type: "error", code: "missing-reader", message: `Could not start the reader: ${(e as Error).message}` };
      resolve(output.finish(null));
      return;
    }
    const timer = setTimeout(() => {
      output.run.error = { type: "error", code: "failed", message: "The scan took too long and was stopped. Try again; if this keeps happening, restart Football Manager." };
      child.kill();
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => output.push(chunk));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => output.run.log.push(chunk.trim()));
    child.on("error", (e) => {
      output.run.error ??= { type: "error", code: "missing-reader", message: `Could not start the reader: ${e.message}` };
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(output.finish(code));
    });
  });
}
