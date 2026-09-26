import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { sepoliaDeploymentDefine } from "./scripts/sepoliaDeployment";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    // Vitest runs with mode "test". Keep it undefined there, matching the
    // "plain test runner" contract in cca/addresses.ts: tests must not flip
    // between mock and chain mode just because deployments/sepolia.json
    // happens to hold a real address. Tests that want chain mode inject
    // addresses explicitly (see cca/addresses.test.ts).
    __SEPOLIA_DEPLOYMENT__: mode === "test" ? "undefined" : sepoliaDeploymentDefine(__dirname),
  },
  server: {
    fs: {
      allow: [".."],
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "src/lib/curve.vectors.test.ts",
      "src/lib/ensName.test.ts",
      "src/lib/prophetData.test.ts",
      "src/lib/graduation.test.ts",
      "src/pages/CoinPage.test.tsx",
      "src/pages/ProphetPage.test.tsx",
      "src/copy.test.tsx",
    ],
  },
}));
