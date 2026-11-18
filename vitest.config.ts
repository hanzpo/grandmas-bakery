import { defineConfig } from "vitest/config";

// Unit tests run in plain Node, without the app's Cloudflare/Tailwind Vite plugins.
export default defineConfig({
  test: { include: ["{src,worker,shared}/**/*.test.ts"] },
});
