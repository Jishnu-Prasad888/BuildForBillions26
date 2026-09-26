import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// API calls go to /api and are proxied to the FastAPI backend.
const target = process.env.VITE_API_PROXY || "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: { host: true, port: 5173, proxy: { "/api": { target, changeOrigin: true } } },
});
