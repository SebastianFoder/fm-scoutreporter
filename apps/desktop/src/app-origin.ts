/**
 * The address the app's pages are shown at: scoutreporter://app, the same on every start.
 *
 * The pages are served by a local Next server on a random free port (server.ts). The browser keeps
 * localStorage and IndexedDB per origin, port included, so if the window loaded the pages from that
 * port, weights, highlights, formations and the theme would start empty on every launch (and after
 * every update). The window loads scoutreporter://app instead, and every request to it is passed
 * on to the local server: the origin, and with it everything the pages store, stays put.
 */
import { net, protocol } from "electron";

export const APP_SCHEME = "scoutreporter";
export const APP_ORIGIN = `${APP_SCHEME}://app`;

/** Before the app is ready: let the scheme behave like https (storage, fetch, secure context). */
export function registerAppScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true },
    },
  ]);
}

/** Statuses whose response must not have a body. */
const NO_BODY = new Set([101, 204, 205, 304]);

/**
 * Pass every scoutreporter://app request to the local server at `backend` (http://127.0.0.1:port),
 * adding the pages' Content Security Policy to each response.
 */
export function serveAppScheme(backend: string, csp: string) {
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.host !== "app") return new Response("Not found", { status: 404 });
    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    const res = await net.fetch(`${backend}${url.pathname}${url.search}`, {
      method: request.method,
      headers: request.headers,
      body: hasBody ? request.body : undefined,
      // Streaming a request body needs this (Electron's fetch, like Node's).
      ...(hasBody && { duplex: "half" }),
    } as RequestInit);
    const headers = new Headers(res.headers);
    const location = headers.get("location");
    if (location?.startsWith(backend)) headers.set("location", APP_ORIGIN + location.slice(backend.length));
    headers.set("Content-Security-Policy", csp);
    return new Response(NO_BODY.has(res.status) ? null : res.body, { status: res.status, statusText: res.statusText, headers });
  });
}
