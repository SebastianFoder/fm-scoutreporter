import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { LOCALES, DEFAULT_LOCALE, negotiateLocale, resolveLocale } from "./locales";
import { NAMESPACES } from "./namespaces";
import { mergeMessages } from "./messages";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "messages");

type Tree = { [key: string]: string | Tree };

function read(locale: string, ns: string): Tree {
  const file = path.join(DIR, locale, `${ns}.json`);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Tree) : {};
}

function leaves(tree: Tree, prefix = ""): [string, string][] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === "string" ? [[`${prefix}${k}`, v] as [string, string]] : leaves(v, `${prefix}${k}.`),
  );
}

/** The arguments a message uses ({count}, {name}, <b>...</b>), so translations can't drop or invent one. */
function argumentsOf(elements: MessageFormatElement[], out = new Set<string>()): Set<string> {
  for (const el of elements) {
    if (el.type === TYPE.argument || el.type === TYPE.number || el.type === TYPE.date || el.type === TYPE.time) {
      out.add(el.value);
    } else if (el.type === TYPE.select || el.type === TYPE.plural) {
      out.add(el.value);
      for (const option of Object.values(el.options)) argumentsOf(option.value, out);
    } else if (el.type === TYPE.tag) {
      out.add(`<${el.value}>`);
      argumentsOf(el.children, out);
    }
  }
  return out;
}

const sorted = (s: Set<string>) => [...s].sort();

test("every locale has every namespace file", () => {
  for (const locale of LOCALES) {
    for (const ns of NAMESPACES) assert.ok(existsSync(path.join(DIR, locale, `${ns}.json`)), `${locale}/${ns}.json`);
  }
});

for (const ns of NAMESPACES) {
  const english = new Map(leaves(read(DEFAULT_LOCALE, ns)));

  test(`${ns}: English messages are valid ICU`, () => {
    for (const [key, message] of english) {
      assert.doesNotThrow(() => parse(message), `${ns}.${key}`);
    }
  });

  for (const locale of LOCALES.filter((l) => l !== DEFAULT_LOCALE)) {
    test(`${ns}: ${locale} has the same keys and arguments as English`, () => {
      const translated = new Map(leaves(read(locale, ns)));
      const missing = [...english.keys()].filter((k) => !translated.has(k));
      const extra = [...translated.keys()].filter((k) => !english.has(k));
      assert.deepEqual(missing, [], `${locale}/${ns}.json is missing keys`);
      assert.deepEqual(extra, [], `${locale}/${ns}.json has keys English doesn't`);

      for (const [key, message] of translated) {
        let parsed: MessageFormatElement[] = [];
        assert.doesNotThrow(() => (parsed = parse(message)), `${locale}/${ns}.${key} is not valid ICU`);
        const source = english.get(key);
        if (source === undefined) continue;
        assert.deepEqual(
          sorted(argumentsOf(parsed)),
          sorted(argumentsOf(parse(source))),
          `${locale}/${ns}.${key} arguments`,
        );
      }
    });
  }
}

test("negotiateLocale picks the best supported language", () => {
  assert.equal(negotiateLocale("fr-FR,fr;q=0.9,en;q=0.8"), "fr");
  assert.equal(negotiateLocale("ko-KR"), "ko");
  assert.equal(negotiateLocale("nb-NO,no;q=0.9"), "nb");
  assert.equal(negotiateLocale("nn"), "nb");
  assert.equal(negotiateLocale("pt-BR,de;q=0.5"), "de");
  assert.equal(negotiateLocale("en;q=0.2,da;q=0.9"), "da");
  assert.equal(negotiateLocale("ja"), "en");
  assert.equal(negotiateLocale(""), "en");
  assert.equal(negotiateLocale(null), "en");
});

test("resolveLocale: the cookie wins, unless it isn't a language we have", () => {
  assert.equal(resolveLocale("sv", "fr"), "sv");
  assert.equal(resolveLocale("xx", "fr"), "fr");
  assert.equal(resolveLocale(undefined, "es-ES"), "es");
});

test("mergeMessages falls back to English per key", () => {
  const en = { a: { b: "B", c: "C" }, d: "D" };
  assert.deepEqual(mergeMessages(en, { a: { b: "Bé" } }), { a: { b: "Bé", c: "C" }, d: "D" });
});
