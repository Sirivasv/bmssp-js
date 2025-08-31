import js from "@eslint/js";
import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";
import markdown from "@eslint/markdown";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    ...js.configs.recommended,
    plugins: { js, prettier },
    rules: { "prettier/prettier": "error" },
    languageOptions: { globals: globals.node },
  },
  {
    ...markdown.configs.recommended,
    plugins: { markdown },
    language: "markdown/gfm",
  },
  prettierConfig,
]);
