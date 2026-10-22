import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "node_modules/**", "public/**", "next-env.d.ts"]),
  // Each bot is a standalone CommonJS project with its own package.json, not part of the site.
  globalIgnores(["discmeet/**", "modmail/**"]),
]);
