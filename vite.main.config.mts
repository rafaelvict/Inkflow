import { defineConfig } from "vite";
import { builtinModules } from "node:module";

export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        "electron",
        "jszip",
        "electron-store",
        "chokidar",
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
    },
  },
});
