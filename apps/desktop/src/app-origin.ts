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
 * The headers that pick the pages' language. Chromium sends neither cookies nor Accept-Language on a
 * custom scheme, so the app adds them: the language chosen in the header (kept in the app's
 * settings) as next-intl's NEXT_LOCALE cookie, and Windows' preferred languages.
 */
export interface LanguageHeaders {
  /** The chosen language code, or null to follow Windows. */
  language: () => string | null;
  /** Windows' preferred languages, most preferred first ("fr-FR", "en-US"). */
  systemLanguages: () => string[];
}

/**
 * Pass every scoutreporter://app request to the local server at `backend` (http://127.0.0.1:port),
 * adding the pages' Content Security Policy to each response.
 */
export function serveAppScheme(backend: string, csp: string, lang: LanguageHeaders) {
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.host !== "app") return new Response("Not found", { status: 404 });
    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    // Fonts (and anything else fetched in CORS mode) come with Origin: scoutreporter://app. Passed
    // on, it makes net.fetch treat the request to the local server as cross-origin, and without
    // CORS headers in the answer it fails (net::ERR_FAILED): the window then fell back to a system
    // font with faked bold. The server never needs it for reading pages and files.
    const headers = new Headers(request.headers);
    if (!hasBody) headers.delete("origin");
    const language = lang.language();
    if (language) headers.set("cookie", `NEXT_LOCALE=${language}`);
    const system = lang.systemLanguages();
    if (system.length > 0) headers.set("accept-language", system.join(","));
    let res: Response;
    try {
      res = await net.fetch(`${backend}${url.pathname}${url.search}`, {
        method: request.method,
        headers,
        body: hasBody ? request.body : undefined,
        // Streaming a request body needs this (Electron's fetch, like Node's).
        ...(hasBody && { duplex: "half" }),
      } as RequestInit);
    } catch (e) {
      console.error(`app scheme: ${request.method} ${url.pathname} failed: ${(e as Error).message}`);
      return new Response("Bad gateway", { status: 502 });
    }
    const answer = new Headers(res.headers);
    const location = answer.get("location");
    if (location?.startsWith(backend)) answer.set("location", APP_ORIGIN + location.slice(backend.length));
    answer.set("Content-Security-Policy", csp);
    return new Response(NO_BODY.has(res.status) ? null : res.body, { status: res.status, statusText: res.statusText, headers: answer });
  });
}
