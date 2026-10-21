import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // bots/ are separate Node programs with their own tooling; mock/ is static HTML.
  globalIgnores([".next/**", "node_modules/**", "bots/**", "mock/**", "public/**", "next-env.d.ts"]),
]);
