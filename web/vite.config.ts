import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the same build works under /recall/ on GitHub Pages and from
// a local folder or a USB stick at the booth.
export default defineConfig({
  plugins: [react()],
  base: "./",
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
