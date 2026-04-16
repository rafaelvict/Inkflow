import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { VitePlugin } from "@electron-forge/plugin-vite";

const config: ForgeConfig = {
  packagerConfig: {
    name: "Inkflow",
    executableName: "inkflow",
    icon: "./build/icon",
    asar: true,
    appVersion: "0.5.0",
    appCopyright: "Copyright © 2025 Inkflow",
    // File association: .note files open with Inkflow
    protocols: [
      {
        name: "Inkflow Note",
        schemes: ["inkflow"],
      },
    ],
  },
  // Publisher: GitHub Releases (used by electron-updater to generate app-update.yml)
  // Set GH_TOKEN env var and run `npm run make` to publish a release.
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: {
          owner: "rafaelvict",
          name: "Inkflow",
        },
        prerelease: false,
        draft: true, // Publish as draft — review before making public
      },
    },
  ],
  makers: [
    new MakerSquirrel({
      name: "Inkflow",
      setupIcon: "./build/icon.ico",
      iconUrl:
        "https://raw.githubusercontent.com/Inkflow/inkflow/main/apps/desktop/build/icon.ico",
      // File type associations for Windows
      fileAssociations: [
        {
          ext: "note",
          name: "Inkflow Note",
          icon: "./build/icon.ico",
        },
      ],
    }),
    new MakerDeb({
      options: {
        name: "inkflow",
        productName: "Inkflow",
        genericName: "Notepad + Whiteboard",
        description: "Notepad + Excalidraw + AI desktop app",
        categories: ["Utility", "Office"],
        icon: "./build/icon.png",
        mimeType: ["application/x-inkflow-note"],
      },
    }),
    new MakerRpm({
      options: {
        name: "inkflow",
        productName: "Inkflow",
        genericName: "Notepad + Whiteboard",
        description: "Notepad + Excalidraw + AI desktop app",
        categories: ["Utility", "Office"],
        icon: "./build/icon.png",
      },
    }),
    new MakerDMG({
      name: "Inkflow",
      icon: "./build/icon.icns",
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/main/main.ts",
          config: "vite.main.config.mts",
        },
        {
          entry: "src/preload/preload.ts",
          config: "vite.preload.config.mts",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.mts",
        },
      ],
    }),
  ],
};

export default config;
