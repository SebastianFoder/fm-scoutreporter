/**
 * The scan database process: an Electron utility process (started by db-client.ts) that does the
 * SQLite work of db-ops.ts, so imports and queries never block the main process or the window.
 *
 * Messages in:  { id, request: DbRequest }
 * Messages out: { id, progress } while importing, then { id, ok: true, result } or { id, ok: false, error }
 */
import { handleDbRequest, type DbRequest } from "./db-ops";

interface ParentPort {
  on(event: "message", listener: (e: { data: unknown }) => void): void;
  postMessage(message: unknown): void;
}

const port = (process as unknown as { parentPort: ParentPort }).parentPort;

port.on("message", (e) => {
  const { id, request } = e.data as { id: number; request: DbRequest };
  void handleDbRequest(request, (progress) => port.postMessage({ id, progress }))
    .then((result) => port.postMessage({ id, ok: true, result }))
    .catch((err: unknown) => port.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) }));
});
