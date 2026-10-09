import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Hors application (09/10/2026, mise en place de la CI) : documents et
    // copies de travail (`Claude outputs/`), ancien relais CinetPay abandonné
    // (`infra/`). Rien de tout ça n'est déployé.
    "Claude outputs/**",
    "infra/**",
  ]),
]);

export default eslintConfig;
