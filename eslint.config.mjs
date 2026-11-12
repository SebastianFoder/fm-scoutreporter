import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import storybook from "eslint-plugin-storybook";
import { EM_DASH_MESSAGE, findEmDashes } from "./scripts/no-em-dash.mjs";

/** Flags every em dash in the source, in any form (character, escape or entity), including comments. */
const noEmDash = {
  meta: {
    type: "problem",
    schema: [],
    messages: { emDash: EM_DASH_MESSAGE },
  },
  create(context) {
    const { sourceCode } = context;
    return {
      Program() {
        for (const { index, length } of findEmDashes(sourceCode.text)) {
          context.report({
            loc: { start: sourceCode.getLocFromIndex(index), end: sourceCode.getLocFromIndex(index + length) },
            messageId: "emDash",
          });
        }
      },
    };
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...storybook.configs["flat/recommended"],
  {
    // The Next app is in a workspace, not at the repo root.
    settings: { next: { rootDir: "apps/web/" }, react: { version: "19.2" } },
  },
  {
    plugins: { local: { rules: { "no-em-dash": noEmDash } } },
    rules: { "local/no-em-dash": "error" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    "**/.next/**",
    "**/.next-desktop/**",
    "**/out/**",
    "**/build/**",
    "**/dist/**",
    "**/next-env.d.ts",
    "storybook-static/**",
    "reader/**",
    "apps/desktop/release/**",
    "apps/desktop/dist/**",
  ]),
  // CommonJS build hooks (electron-builder loads them with require).
  {
    files: ["**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Storybook config dir is dot-prefixed, so it's ignored by default.
  globalIgnores(["!**/.storybook"]),
]);

export default eslintConfig;
