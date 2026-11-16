import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./src/manifest.json";

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    rollupOptions: { input: { offscreen: "src/engine/offscreen.html" } },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
    cors: {
      origin: "*",
      methods: ["GET", "POST", "OPTIONS"],
    },
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  },
});
