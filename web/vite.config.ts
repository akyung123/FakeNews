import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
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
});

