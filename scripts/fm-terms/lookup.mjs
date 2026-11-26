/**
 * Prints Football Manager's official translation of English terms, from your FM install.
 *
 *   node scripts/fm-terms/lookup.mjs "Off The Ball" "Best XI"
 *
 * Reads FM27, else FM26, from the default Steam folder; set FM_DIR to point elsewhere. The first run
 * decodes FM's language file (a minute or so) and caches it in the OS temp folder.
 */
import { FM_LANGUAGE, loadFmStrings, translateTerm } from "./fmf.mjs";

const terms = process.argv.slice(2);
if (terms.length === 0) {
  console.error('Usage: node scripts/fm-terms/lookup.mjs "Term" ["Another term" ...]');
  process.exit(1);
}

const fm = loadFmStrings();
for (const term of terms) {
  const t = translateTerm(fm, term);
  console.log(`${term}:`);
  if (!t) {
    console.log("  (not in FM's strings)");
    continue;
  }
  for (const locale of Object.keys(FM_LANGUAGE)) console.log(`  ${locale}: ${t[locale] ?? "(missing)"}`);
}
