#!/usr/bin/env node
/**
 * Times a reader scan against the running FM and checks it against a reference scan, so a faster
 * reader can be proven to read exactly the same data (see reader/PERFORMANCE.md).
 *
 *   node reader/tools/scan-check.mjs [--exe <reader.exe>] [--out <dir>] [--db men|women|both]
 *                                    [--only-search] [--ref <scan.ndjson>] [--repeat <n>]
 *   node reader/tools/scan-check.mjs --compare <reference.ndjson> <other.ndjson>
 *
 * Without --exe it runs reader/dist/ScoutReporter.Reader.exe (bun run reader:build). Each run prints
 * the wall time, the reader's own step timings and, with --ref, the comparison. The scan file is
 * kept in --out (default: a folder in the system temp dir) to use as a later --ref.
 *
 * Keep FM on one in-game day between the reference and the check (do not press Continue):
 * otherwise the data really changes. People missing on one side usually come from memory that
 * could not be read in that run (see "unreadable" in the output), not from a reader bug; a field
 * that differs for someone found in both scans is a real difference.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
};
const flag = (name) => args.includes(name);

function usage() {
  console.error("Usage: scan-check.mjs [--exe <reader.exe>] [--out <dir>] [--db men|women|both] [--only-search] [--ref <scan.ndjson>] [--repeat <n>]");
  console.error("       scan-check.mjs --compare <reference.ndjson> <other.ndjson>");
  process.exit(64);
}

/** Runs the reader, following its JSON-lines output. */
function runReader(file, readerArgs) {
  return new Promise((done) => {
    const started = performance.now();
    const res = { done: null, error: null, log: [], exitCode: null, wallMs: 0 };
    const child = spawn(file, readerArgs, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const rl = createInterface({ input: child.stdout });
    rl.on("line", (text) => {
      let msg;
      try {
        msg = JSON.parse(text);
      } catch {
        res.log.push(text);
        return;
      }
      if (msg.type === "log") res.log.push(msg.message);
      else if (msg.type === "done") res.done = msg;
      else if (msg.type === "error") res.error = msg;
    });
    child.stderr.on("data", (c) => res.log.push(String(c).trim()));
    child.on("close", (code) => {
      res.exitCode = code;
      res.wallMs = Math.round(performance.now() - started);
      done(res);
    });
  });
}

const KEY = /^\{"kind":"(\w+)","uid":(\d+)/;

/** Each line of a scan file: the meta line first, then `kind:uid` and the raw line. */
async function* lines(file) {
  const rl = createInterface({ input: createReadStream(file, { encoding: "utf8" }), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (!line) continue;
    if (first) {
      first = false;
      yield { meta: JSON.parse(line).meta };
      continue;
    }
    const m = KEY.exec(line);
    if (m) yield { key: `${m[1]}:${m[2]}`, line };
  }
}

const hash = (s) => createHash("sha1").update(s).digest("base64");

/** Every leaf that differs between two parsed people, as "path: a -> b". */
function diff(a, b, path = "", outList = []) {
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], path ? `${path}.${k}` : k, outList);
  } else if (JSON.stringify(a) !== JSON.stringify(b)) {
    outList.push({ path, a, b });
  }
  return outList;
}

/** Compares two scan files person by person. True when everyone found in both is identical. */
async function compare(refFile, otherFile) {
  console.log(`\nComparing ${otherFile}\n     with ${refFile}`);
  const refHashes = new Map();
  let refMeta = {};
  for await (const x of lines(refFile)) {
    if (x.meta) refMeta = x.meta;
    else refHashes.set(x.key, hash(x.line));
  }
  let same = 0;
  let onlyOther = 0;
  const changed = [];
  const changedOther = new Map();
  let otherMeta = {};
  const seen = new Set();
  for await (const x of lines(otherFile)) {
    if (x.meta) {
      otherMeta = x.meta;
      continue;
    }
    seen.add(x.key);
    const h = refHashes.get(x.key);
    if (h === undefined) onlyOther++;
    else if (h === hash(x.line)) same++;
    else {
      changed.push(x.key);
      if (changedOther.size < 2000) changedOther.set(x.key, x.line);
    }
  }
  let onlyRef = 0;
  for (const k of refHashes.keys()) if (!seen.has(k)) onlyRef++;

  const ignore = new Set(["scannedAt", "unreadFraction", "readerVersion"]);
  const metaDiffs = diff(
    Object.fromEntries(Object.entries(refMeta).filter(([k]) => !ignore.has(k))),
    Object.fromEntries(Object.entries(otherMeta).filter(([k]) => !ignore.has(k))),
  );

  console.log(`Identical: ${same}   Different: ${changed.length}   Only in reference: ${onlyRef}   Only in new: ${onlyOther}`);
  console.log(`Unreadable memory: reference ${pct(refMeta.unreadFraction)}, new ${pct(otherMeta.unreadFraction)}`);
  for (const d of metaDiffs) console.log(`  meta.${d.path}: ${JSON.stringify(d.a)} -> ${JSON.stringify(d.b)}`);

  if (changed.length > 0) {
    // Second pass over the reference for the people that differ.
    const refLines = new Map();
    for await (const x of lines(refFile)) if (x.key && changedOther.has(x.key)) refLines.set(x.key, x.line);
    const byField = new Map();
    const examples = [];
    for (const [key, line] of changedOther) {
      const ds = diff(JSON.parse(refLines.get(key)), JSON.parse(line));
      for (const d of ds) byField.set(d.path, (byField.get(d.path) ?? 0) + 1);
      if (examples.length < 12) examples.push(`  ${key} ${JSON.parse(line).name}: ${ds.slice(0, 4).map((d) => `${d.path} ${JSON.stringify(d.a)} -> ${JSON.stringify(d.b)}`).join("; ")}`);
    }
    const sample = changedOther.size < changed.length ? ` (field counts from the first ${changedOther.size})` : "";
    console.log(`Fields that differ${sample}:`);
    for (const [path, n] of [...byField].sort((x, y) => y[1] - x[1]).slice(0, 20)) console.log(`  ${path}: ${n}`);
    console.log("Examples:");
    for (const e of examples) console.log(e);
  }
  const ok = changed.length === 0 && metaDiffs.length === 0;
  console.log(ok ? "OK: everyone found in both scans is identical." : "DIFFERENT: see above.");
  return ok;
}

function pct(x) {
  return typeof x === "number" ? `${(x * 100).toFixed(1)} %` : "?";
}

async function main() {
  if (flag("--compare")) {
    const i = args.indexOf("--compare");
    const [a, b] = [args[i + 1], args[i + 2]];
    if (!a || !b) usage();
    const ok = await compare(resolve(a), resolve(b));
    process.exit(ok ? 0 : 1);
  }

  const exe = resolve(arg("--exe") ?? join(here, "..", "dist", "ScoutReporter.Reader.exe"));
  if (!existsSync(exe)) {
    console.error(`No reader at ${exe}. Build it with: bun run reader:build`);
    process.exit(64);
  }
  const out = resolve(arg("--out") ?? join(tmpdir(), "scoutreporter-scan-check"));
  mkdirSync(out, { recursive: true });
  const ref = arg("--ref") ? resolve(arg("--ref")) : undefined;
  const repeat = Math.max(1, Number(arg("--repeat") ?? 1) || 1);
  const scanArgs = ["scan", "--out", out, "--db", arg("--db") ?? "men", ...(flag("--only-search") ? ["--only-search"] : [])];

  let failed = false;
  for (let run = 1; run <= repeat; run++) {
    if (repeat > 1) console.log(`\n=== Run ${run} of ${repeat} ===`);
    const result = await runReader(exe, scanArgs);
    if (!result.done) {
      console.log(`Reader failed after ${result.wallMs} ms: ${result.error?.message ?? `exit code ${result.exitCode}`}`);
      failed = true;
      break;
    }
    const d = result.done;
    console.log(`Reader: ${exe}`);
    console.log(`Wall time: ${result.wallMs} ms (reader's own count: ${d.elapsedMs ?? "?"} ms scanning)`);
    console.log(`Found: ${d.players} players, ${d.staff} staff  ->  ${d.file}`);
    if (d.timings) console.log(`Steps: ${Object.entries(d.timings).map(([k, v]) => `${k} ${v} ms`).join(", ")}`);
    for (const line of result.log.filter((l) => /unreadable|retry|snapshot|search result|Kept/i.test(l))) console.log(`  ${line}`);
    if (ref && !(await compare(ref, d.file))) failed = true;
  }
  process.exit(failed ? 1 : 0);
}

await main();
