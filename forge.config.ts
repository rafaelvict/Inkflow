import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerZIP } from "@electron-forge/maker-zip";
import { VitePlugin } from "@electron-forge/plugin-vite";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require("./package.json");

const config: ForgeConfig = {
  packagerConfig: {
    name: "Inkflow",
    executableName: "inkflow",
    icon: "./build/icon",
    asar: true,
    appVersion: pkg.version,
    appCopyright: `Copyright (c) ${new Date().getFullYear()} Inkflow`,
    // File association: .note files open with Inkflow
    protocols: [
      {
        name: "Inkflow Note",
        schemes: ["inkflow"],
      },
    ],
    // macOS code signing (no-op when certificate not in keychain)
    osxSign: {},
    // macOS notarization (only active when APPLE_ID env var is set, i.e. CI)
    osxNotarize: process.env.APPLE_ID
      ? {
          appleId: process.env.APPLE_ID,
          appleIdPassword: process.env.APPLE_PASSWORD!,
          teamId: process.env.APPLE_TEAM_ID!,
        }
      : undefined,
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
      setupExe: "InkflowSetup.exe",
      setupIcon: "./build/icon.ico",
      iconUrl:
        "https://raw.githubusercontent.com/rafaelvict/Inkflow/main/build/icon.ico",
      // Windows code signing (env vars set in CI only; undefined = unsigned local build)
      certificateFile: process.env.WINDOWS_PFX_FILE || undefined,
      certificatePassword: process.env.WINDOWS_PFX_PASSWORD || undefined,
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
        bin: "inkflow",
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
        bin: "inkflow",
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
    // ZIP for macOS — required by electron-updater for auto-update
    new MakerZIP({}, ["darwin"]),
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
