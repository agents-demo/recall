import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Relative base so the same build works under /recall/ on GitHub Pages and from
// a local folder or a USB stick at the booth.
export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      "@laix/attention": resolve(__dirname, "../packages/laix-attention/src/index.ts"),
      "@laix/decision-record": resolve(__dirname, "../packages/laix-decision-record/src/index.ts"),
    },
  },
  server: { port: 5184 },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
