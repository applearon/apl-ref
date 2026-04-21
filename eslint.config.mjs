import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";
import stylistic from '@stylistic/eslint-plugin'

export default defineConfig([
    { files: ["**/*.{js,mjs,cjs}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: {...globals.browser, ...globals.node} } },
    { files: ["**/*.js"], languageOptions: { sourceType: "module" } },
    {
        rules: {
            "no-unused-vars": "warn",
            "indent": ["warn", 4],
        },
        plugins: {
            '@stylistic': stylistic
        },
    }
]);
