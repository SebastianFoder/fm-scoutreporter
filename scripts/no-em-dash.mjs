/**
 * Em dashes are banned from the repo in every form: the character itself and any way of writing it
 * (JS/regex escapes, HTML entities, code points). The patterns are assembled from pieces so this
 * file never contains one of the forms it bans.
 *
 * Used by the `local/no-em-dash` ESLint rule, and run directly (`bun scripts/no-em-dash.mjs`) to
 * scan every tracked text file, including Markdown, CSS and JSON that ESLint doesn't lint.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const HEX = "20" + "14";
const DEC = "82" + "12";

const EM_DASH_PATTERN = new RegExp(
  [
    String.fromCharCode(0x2000 + 0x14), // the character
    `\\\\u\\{?0*${HEX}\\}?`, // JS / regex escape, with or without braces
    `\\\\x\\{0*${HEX}\\}`, // PCRE-style escape
    `\\b0x0*${HEX}\\b`, // hex code point
    `U\\+0*${HEX}\\b`, // Unicode notation
    `&m${"dash"};`, // named HTML entity
    `&#0*${DEC};`, // decimal HTML entity
    `&#x0*${HEX};`, // hex HTML entity
    `fromC(?:harCode|odePoint)\\(\\s*${DEC}\\s*\\)`, // decimal code point
  ].join("|"),
  "gi",
);

export const EM_DASH_MESSAGE =
  "Em dashes are not allowed in any form. Use a comma, colon, parentheses or a new sentence.";

/** Every em dash (or way of writing one) in `text`, as start index and length. */
export function findEmDashes(text) {
  return [...text.matchAll(EM_DASH_PATTERN)].map((m) => ({ index: m.index, length: m[0].length }));
}

function lineAndColumn(text, index) {
  const before = text.slice(0, index).split("\n");
  return { line: before.length, column: before[before.length - 1].length + 1 };
}

function scanRepo() {
  const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
  let count = 0;
  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue; // deleted in the working tree
    }
    if (text.includes("\0")) continue; // binary
    for (const { index } of findEmDashes(text)) {
      const { line, column } = lineAndColumn(text, index);
      console.error(`${file}:${line}:${column}  ${EM_DASH_MESSAGE}`);
      count++;
    }
  }
  if (count > 0) {
    console.error(`\n${count} em dash${count === 1 ? "" : "es"} found.`);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) scanRepo();
