import { defineConfig } from "vitest/config";

// O motor (/engine) é JS puro, então roda no ambiente "node" sem DOM.
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
  },
});
