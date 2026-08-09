import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const dashboardPort = Number(process.env.PORT ?? 4000);
const apiPort = dashboardPort + 1;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: dashboardPort,
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
