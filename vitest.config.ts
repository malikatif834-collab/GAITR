import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
  // Match the tsconfig `@/*` alias so test imports can use the same paths
  // as application code (extract.ts etc. import from "@/lib/db/client").
  resolve: {
    alias: {
      "@": process.cwd(),
    },
  },
});
