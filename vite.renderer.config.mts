import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const projectRoot = path.resolve(__dirname);

// When Vite processes files from packages/excalidraw (outside this project),
// bare imports can't find our node_modules. This plugin re-resolves them
// as if imported from this project root, using Vite's own resolver
// (which respects ESM exports, browser fields, etc.).
function resolveMonorepoDeps(): Plugin {
  const fakeImporter = path.join(projectRoot, "index.html");

  return {
    name: "resolve-monorepo-deps",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (!importer) return null;
      // Skip relative, absolute, virtual imports
      if (
        source.startsWith(".") ||
        source.startsWith("/") ||
        source.startsWith("\0")
      ) {
        return null;
      }
      // Skip only the @excalidraw packages that have source aliases
      if (/^@excalidraw\/(excalidraw|utils|math)(\/|$)/.test(source)) {
        return null;
      }
      // Only intercept when importer is outside this project
      if (importer.startsWith(projectRoot)) return null;

      // Re-resolve using Vite's pipeline, pretending the import
      // comes from our project root (where node_modules/ lives)
      const result = await this.resolve(source, fakeImporter, {
        ...options,
        skipSelf: true,
      });
      return result;
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load .env from project root so VITE_* vars are available during build
  const env = loadEnv(mode, projectRoot, "VITE_");

  return {
  plugins: [resolveMonorepoDeps(), react()],
  css: {
    preprocessorOptions: {
      scss: {
        // Silence Dart Sass deprecation warnings from upstream Excalidraw SCSS
        silenceDeprecations: [
          "legacy-js-api",
          "import",
          "global-builtin",
          "color-functions",
        ],
      },
    },
  },
  resolve: {
    alias: [
      {
        find: /^@excalidraw\/excalidraw$/,
        replacement: path.resolve(
          __dirname,
          "packages/excalidraw/index.tsx",
        ),
      },
      {
        find: /^@excalidraw\/excalidraw\/(.*)/,
        replacement: path.resolve(
          __dirname,
          "packages/excalidraw/$1",
        ),
      },
      {
        find: /^@excalidraw\/utils$/,
        replacement: path.resolve(
          __dirname,
          "packages/utils/index.ts",
        ),
      },
      {
        find: /^@excalidraw\/utils\/(.*)/,
        replacement: path.resolve(__dirname, "packages/utils/$1"),
      },
      {
        find: /^@excalidraw\/math$/,
        replacement: path.resolve(
          __dirname,
          "packages/math/index.ts",
        ),
      },
      {
        find: /^@excalidraw\/math\/(.*)/,
        replacement: path.resolve(__dirname, "packages/math/$1"),
      },
    ],
  },
  build: {
    rollupOptions: {
      output: {
        // Copiar padrão EXATO do excalidraw-app/vite.config.mts:56-63
        // Fonts precisam ficar em fonts/{family}/[name][extname]
        // Ex: Virgil-Regular.woff2 → fonts/Virgil/Virgil-Regular.woff2
        assetFileNames(chunkInfo) {
          if (chunkInfo?.name?.endsWith(".woff2")) {
            const family = chunkInfo.name.split("-")[0];
            return `fonts/${family}/[name][extname]`;
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
    // Não inline fonts como base64 — emitir como arquivos
    assetsInlineLimit: 0,
  },
};
});
