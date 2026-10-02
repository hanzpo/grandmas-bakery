import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  // Pre-bundle so lazy admin pages don't trigger a dep re-optimize (and a failed import) on first visit.
  optimizeDeps: { include: ["recharts"] },
});
