import js from "@eslint/js";
import markdown from "@eslint/markdown";
import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

export default [
  {
    files: ["**/*.md"],
    plugins: {
      markdown,
    },
    processor: "markdown/markdown",
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: {
      prettier,
    },
    rules: {
      "prettier/prettier": "error",
    },
    languageOptions: {
      globals: globals.node,
    },
  },
  prettierConfig,
];
