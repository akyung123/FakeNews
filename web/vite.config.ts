import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // GitHub Pages sets VITE_BASE=/Prophecy/. Local and Vercel stay at /.
  base: process.env.VITE_BASE || "/",
});
