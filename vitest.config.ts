import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// O motor (/engine) é JS puro, então roda no ambiente "node" sem DOM.
// O alias "@" espelha o paths do tsconfig pra os imports "@/..." funcionarem nos testes.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
  },
});
