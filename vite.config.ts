import { defineConfig } from "vite";

// GitHub Pages: Repo kanzlerclash/personas → https://kanzlerclash.github.io/personas/
export default defineConfig({
  root: "src/site",
  base: process.env.PAGES_BASE ?? "/personas/",
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
  },
});
