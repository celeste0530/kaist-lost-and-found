import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The dev server proxies API and uploaded images to the Express server, so the browser
// talks to a single origin and the login cookie works without extra CORS setup.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4000",
      "/uploads": "http://localhost:4000",
    },
  },
});
