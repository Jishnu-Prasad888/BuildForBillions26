import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import mockApi from "./mock/mockApi";

// UI-preview only: serves the app with a fake /api (no backend needed).
// Run: npx vite --config vite.config.mock.ts
export default defineConfig({
  plugins: [react(), mockApi()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: { host: true, port: 5199 },
});
