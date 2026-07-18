import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The series logic is deliberately free of Astro imports, so tests run as plain
// Node modules — no Astro vite plugin, no content-collection stubbing.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
