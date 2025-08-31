import js from "@eslint/js";
import prettier from "eslint-plugin-prettier";
import globals from "globals";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { files: ["**/*.{js,mjs,cjs}"], plugins: { js, prettier }, extends: ["js/recommended", "plugin:prettier/recommended"], languageOptions: { globals: globals.node } },
  { files: ["**/*.json"], plugins: { json }, language: "json/json", extends: ["json/recommended"] },
  { files: ["**/*.md"], plugins: { markdown }, language: "markdown/gfm", extends: ["markdown/recommended"] },
]);
