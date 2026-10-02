import js from "@eslint/js";
import globals from "globals";
import pluginVue from "eslint-plugin-vue";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    // `dist/` contiene el bundle compilado y los iconos generados: no es código
    // fuente y lintarlo solo produce ruido de dependencias minificadas.
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    files: ["**/*.{js,mjs,vue}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
  },
  {
    // Archivos de configuración en CommonJS, como `pwa-assets.config.cjs`.
    files: ["**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: globals.node,
    },
  },
  pluginVue.configs["flat/essential"],
  {
    files: ["src/layouts/**/*.vue"],
    rules: {
      // `Layout` es el nombre del componente raíz del shell de la aplicación.
      "vue/multi-word-component-names": "off",
    },
  },
]);